#!/usr/bin/env python3
"""Build committed Aviation apps and install loopback Docker services on do-host1.

The host runs each container under systemd and publishes it through Caddy. The
flight track analyzer retains its existing native systemd deployment.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMPLEMENTATION = HERE.parent
REPO = Path(__file__).resolve().parents[4]
MANIFEST = HERE / "apps.json"
BROWSER_CONTRACT = REPO / "verification" / "deployed-browser.json"
REMOTE_E2E_CONTRACT = REPO / "verification" / "remote-e2e.json"
REMOTE_INSTALL = HERE / "install.sh"


def run(*argv: str, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    subprocess.run(argv, cwd=cwd, env=env, check=True)


def output(*argv: str, cwd: Path | None = None) -> str:
    return subprocess.check_output(argv, cwd=cwd, text=True).strip()


def load_manifest() -> tuple[dict, list[dict]]:
    config = json.loads(MANIFEST.read_text())
    apps = config["apps"]
    browser_contract = json.loads(BROWSER_CONTRACT.read_text())
    if browser_contract.get("schema") != "aviation/deployed-browser-smoke@1" or set(browser_contract.get("apps", {})) != {app["name"] for app in apps}:
        raise ValueError("browser acceptance contract must cover every application")
    e2e_contract = json.loads(REMOTE_E2E_CONTRACT.read_text())
    if e2e_contract.get("schema") != "aviation/remote-e2e-inventory@1" or set(e2e_contract.get("apps", {})) != {app["name"] for app in apps}:
        raise ValueError("remote E2E inventory must cover every application")
    for app_name, entry in e2e_contract["apps"].items():
        if app_name == "flightschool":
            if entry != {"kind": "dynamic-flask-routes", "minimum": 50, "sharedFeedback": True}:
                raise ValueError("Flight School must declare dynamic route coverage")
        elif (entry.get("kind") not in {"screens", "endpoints"}
              or not isinstance(entry.get("ids"), list) or not entry["ids"]
              or not all(isinstance(item, str) and item for item in entry["ids"])
              or len(entry["ids"]) != len(set(entry["ids"]))
              or (entry["kind"] == "screens" and "feedback" not in entry["ids"])):
            raise ValueError(f"invalid remote E2E inventory for {app_name}")
        if app_name == "aviation-chat" and entry.get("sharedFeedback") is not True:
            raise ValueError("Aviation Chat must exercise its shared feedback widget")
    names: set[str] = set()
    hostnames: set[str] = set()
    ports: set[int] = set()
    images: set[str] = set()
    folders = {p.name for p in (IMPLEMENTATION / "apps").iterdir() if p.is_dir()}
    if config["schema"] != 1 or folders != {app["name"] for app in apps}:
        raise ValueError("manifest must cover every app directory exactly once")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", config["registry_owner"]):
        raise ValueError("invalid registry owner")
    for app in apps:
        name = app["name"]
        hostname = app.get("hostname", name)
        registry_image = app.get("registry_image", name)
        port = app["port"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
            raise ValueError(f"invalid app name: {name}")
        if not isinstance(app.get("launcher_visible", True), bool):
            raise ValueError(f"invalid launcher visibility for {name}")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", hostname):
            raise ValueError(f"invalid hostname: {hostname}")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", registry_image):
            raise ValueError(f"invalid registry image for {name}")
        if not 1024 <= port <= 65535 or not 1 <= app["container_port"] <= 65535:
            raise ValueError(f"invalid port for {name}")
        if not app["health"].startswith("/") or "\n" in app["health"]:
            raise ValueError(f"invalid health path for {name}")
        if name in names or hostname in hostnames or port in ports or registry_image in images:
            raise ValueError(f"duplicate name, hostname, port or registry image for {name}")
        if not 128 <= app["memory_mb"] <= 8192:
            raise ValueError(f"invalid memory limit for {name}")
        if not (IMPLEMENTATION / "apps" / name / "Dockerfile").is_file():
            raise ValueError(f"missing Dockerfile for {name}")
        for volume in app.get("volumes", []):
            source, dest = volume.split(":", 1)
            if not re.fullmatch(r"[a-z0-9-]+", source) or not dest.startswith("/") or ".." in dest:
                raise ValueError(f"unsafe volume for {name}: {volume}")
        names.add(name)
        hostnames.add(hostname)
        ports.add(port)
        images.add(registry_image)
    return config, apps


def selected(apps: list[dict], name: str) -> list[dict]:
    if name == "all":
        return apps
    matches = [app for app in apps if app["name"] == name]
    if not matches:
        raise ValueError(f"unknown app: {name}")
    return matches


def committed_revision() -> str:
    if output("git", "status", "--porcelain", "--untracked-files=all", cwd=REPO):
        raise RuntimeError("commit all source and deployment changes before building or deploying")
    return output("git", "rev-parse", "HEAD", cwd=REPO)


def image_name(app: dict, revision: str) -> str:
    return f"aviation/{app['name']}:{revision[:12]}"


def registry_image_name(config: dict, app: dict, revision: str) -> str:
    registry_image = app.get("registry_image", app["name"])
    return f"ghcr.io/{config['registry_owner']}/{registry_image}:sha-{revision}"


def build(app: dict, revision: str) -> str:
    image = image_name(app, revision)
    print(f"Building {app['name']} from {revision}", flush=True)
    run(
        "docker", "build", "--platform", "linux/amd64", "--label",
        f"org.opencontainers.image.revision={revision}", "-f",
        f"apps/{app['name']}/Dockerfile", "-t", image, ".", cwd=IMPLEMENTATION,
    )
    return image


def fetch_image(config: dict, app: dict, revision: str) -> str:
    source = registry_image_name(config, app, revision)
    target = image_name(app, revision)
    with tempfile.TemporaryDirectory(prefix="aviation-docker-auth-") as config_dir:
        env = {**os.environ, "DOCKER_CONFIG": config_dir}
        token = subprocess.check_output(["gh", "auth", "token"], text=True).strip()
        subprocess.run(
            ["docker", "login", "ghcr.io", "-u", config["registry_owner"], "--password-stdin"],
            input=token + "\n", text=True, env=env, stdout=subprocess.DEVNULL, check=True,
        )
        del token
        subprocess.run(["docker", "pull", "--platform", "linux/amd64", source], env=env, check=True)
    run("docker", "tag", source, target)
    image_revision = output("docker", "image", "inspect", target, "--format", "{{index .Config.Labels \"org.opencontainers.image.revision\"}}")
    if image_revision != revision:
        raise RuntimeError(f"image revision label does not match Git HEAD for {app['name']}")
    return target


def render(app: dict, revision: str, dest: Path) -> None:
    name = app["name"]
    image = image_name(app, revision)
    docker_args = [
        "/usr/bin/docker", "run", "--rm", "--name", f"aviation-{name}",
        "--pull", "never", "--memory", f"{app['memory_mb']}m",
        "--memory-swap", f"{app['memory_mb'] * 2}m",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "-p", f"127.0.0.1:{app['port']}:{app['container_port']}",
    ]
    for key, value in app.get("environment", {}).items():
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or "\n" in value or " " in value:
            raise ValueError(f"unsafe environment for {name}: {key}")
        docker_args += ["--env", f"{key}={value}"]
    docker_args += ["--env-file", f"/etc/aviation/{name}.env"]
    for volume in app.get("volumes", []):
        source, target = volume.split(":", 1)
        docker_args += ["--mount", f"type=bind,src=/var/lib/aviation/{name}/{source},dst={target}"]
    docker_args.append(image)
    unit = f"""[Unit]
Description=Aviation {name}
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=simple
ExecStartPre=-/usr/bin/docker rm -f aviation-{name}
ExecStart={' '.join(docker_args)}
ExecStop=/usr/bin/docker stop -t 15 aviation-{name}
Restart=always
RestartSec=5
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
"""
    domain = json.loads(MANIFEST.read_text())["domain"]
    hostname = app.get("hostname", name)
    caddy = f"{hostname}.{domain} {{\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:{app['port']}\n}}\n"
    (dest / "service.unit").write_text(unit)
    (dest / "site.caddy").write_text(caddy)
    (dest / "volumes.txt").write_text("\n".join(v.split(":", 1)[0] for v in app.get("volumes", [])) + "\n")


def ship_image(host: str, image: str) -> None:
    print(f"Shipping {image} to {host}", flush=True)
    saver = subprocess.Popen(["docker", "save", image], stdout=subprocess.PIPE)
    assert saver.stdout is not None
    loader = subprocess.run(["ssh", host, "docker", "load"], stdin=saver.stdout)
    saver.stdout.close()
    if saver.wait() or loader.returncode:
        raise RuntimeError(f"failed to transfer {image}")


def prepare_remote_image(config: dict, app: dict, revision: str, host: str) -> None:
    source = registry_image_name(config, app, revision)
    target = image_name(app, revision)
    try:
        run("ssh", host, "docker", "pull", "--platform", "linux/amd64", source)
    except subprocess.CalledProcessError:
        print(f"Remote pull failed for {app['name']}; transferring the exact image instead", flush=True)
        try:
            image = fetch_image(config, app, revision)
        except subprocess.CalledProcessError:
            image = build(app, revision)
        ship_image(host, image)
    else:
        run("ssh", host, "docker", "tag", source, target)
    image_revision = output(
        "ssh", host, "docker", "image", "inspect", target,
        "--format", shlex.quote('{{index .Config.Labels "org.opencontainers.image.revision"}}'),
    )
    if image_revision != revision:
        raise RuntimeError(f"remote image revision label does not match Git HEAD for {app['name']}")


def deploy(config: dict, app: dict, revision: str, host: str) -> None:
    if app.get("runtime") == "native":
        run("make", "-C", str(IMPLEMENTATION / "apps" / app["name"]), "deploy", f"DEPLOY_HOST={host}")
        return
    prepare_remote_image(config, app, revision, host)
    with tempfile.TemporaryDirectory(prefix="aviation-deploy-") as temp:
        stage = Path(temp)
        render(app, revision, stage)
        remote = f"/tmp/aviation-{app['name']}-{revision[:12]}"
        run("ssh", host, "mkdir", "-p", remote)
        run("scp", str(stage / "service.unit"), str(stage / "site.caddy"), str(stage / "volumes.txt"), f"{host}:{remote}/")
        with REMOTE_INSTALL.open("rb") as script:
            subprocess.run(["ssh", host, "bash", "-s", "--", app["name"], str(app["port"]), app["health"], remote],
                           stdin=script, check=True)


def do_request(token: str, method: str, path: str, data: dict | None = None) -> dict:
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(
        "https://api.digitalocean.com/v2" + path, data=body, method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def register_dns(config: dict, apps: list[dict], token_file: Path) -> None:
    token = token_file.read_text().strip()
    domain = config["domain"]
    response = do_request(token, "GET", f"/domains/{domain}/records?per_page=200")
    if response.get("meta", {}).get("total", 0) > len(response["domain_records"]):
        raise RuntimeError("DNS record list is paginated; refusing to create ambiguous names")
    existing = response["domain_records"]
    for app in apps:
        hostname = app.get("hostname", app["name"])
        records = [record for record in existing if record["name"] == hostname and record["type"] in ("A", "CNAME")]
        if records:
            if len(records) != 1 or records[0]["type"] != "A" or records[0]["data"] != config["host"]:
                raise RuntimeError(f"DNS name {hostname}.{domain} already has a different record")
            print(f"DNS present: {hostname}.{domain} -> {config['host']}")
            continue
        do_request(token, "POST", f"/domains/{domain}/records", {
            "type": "A", "name": hostname, "data": config["host"], "ttl": 300,
        })
        print(f"DNS created: {hostname}.{domain} -> {config['host']}")


def verify(config: dict, apps: list[dict], host: str) -> None:
    revision = committed_revision()
    for app in apps:
        name = app.get("hostname", app["name"])
        url = f"https://{name}.{config['domain']}{app['health']}"
        expected_ip = config["host"]
        last_error: Exception | None = None
        for attempt in range(24):
            try:
                resolved = {entry[4][0] for entry in socket.getaddrinfo(f"{name}.{config['domain']}", 443, family=socket.AF_INET)}
                if resolved != {expected_ip}:
                    raise RuntimeError(f"{name}.{config['domain']} resolves to {resolved}, expected {expected_ip}")
                with urllib.request.urlopen(url, timeout=10) as response:
                    if 200 <= response.status < 400:
                        print(f"healthy: {url} ({response.status})")
                        break
            except (urllib.error.URLError, TimeoutError, RuntimeError, socket.gaierror) as error:
                last_error = error
            if attempt == 23:
                raise RuntimeError(f"public health check failed: {url}: {last_error}")
            time.sleep(5)
        run("ssh", host, "systemctl", "is-active", "kmlab" if app.get("runtime") == "native" else f"aviation-{app['name']}")
        if app.get("runtime") == "native":
            running_revision = output("ssh", host, "cat", "/opt/kmlab/revision")
        else:
            running_revision = output(
                "docker", "-H", f"ssh://{host}", "inspect", "--type", "container",
                f"aviation-{app['name']}", "--format",
                '{{index .Config.Labels "org.opencontainers.image.revision"}}',
            )
        if running_revision != revision:
            raise RuntimeError(f"{app['name']} runs {running_revision}, expected {revision}")
    run("node", str(HERE / "browser-smoke.mjs"), apps[0]["name"] if len(apps) == 1 else "all", cwd=IMPLEMENTATION)
    isolated_images = {"aviation-accident-tracker", "aviation-chat", "aviation-missions-app", "flight-planner", "flightschool", "flight-tracker"}
    for app in apps:
        name = app["name"]
        if app.get("runtime") == "native":
            script = "isolated-native-e2e.mjs"
            env = {**os.environ, "AVIATION_E2E_SSH_HOST": host, "AVIATION_E2E_REVISION": revision}
        elif name in isolated_images:
            script = "isolated-e2e.mjs"
            env = {**os.environ, "AVIATION_E2E_SSH_HOST": host, "AVIATION_E2E_REVISION": revision,
                   "AVIATION_E2E_IMAGE": image_name(app, revision)}
        else:
            script = "remote-e2e.mjs"
            env = None
        run("node", str(HERE / script), name, cwd=IMPLEMENTATION, env=env)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("list", "check", "matrix", "build", "dns", "deploy", "verify"))
    parser.add_argument("--app", default="all")
    parser.add_argument("--ssh-host", default="jkh@146.190.134.110")
    parser.add_argument("--token-file", type=Path, default=Path(os.environ.get("DIGITALOCEAN_TOKEN_FILE", "")))
    args = parser.parse_args()
    config, all_apps = load_manifest()
    apps = selected(all_apps, args.app)
    if args.command == "list":
        for app in apps:
            print(f"{app['name']:28} {app.get('hostname', app['name'])}.{config['domain']:20} {app['port']} {app['health']}")
    elif args.command == "check":
        print(f"validated {len(all_apps)} applications, unique hostnames and loopback ports")
    elif args.command == "matrix":
        print("matrix=" + json.dumps({"include": [
            {"app": app["name"], "image": app.get("registry_image", app["name"])} for app in apps
        ]}, separators=(",", ":")))
    elif args.command == "dns":
        if not args.token_file.is_file():
            parser.error("--token-file must name a readable DigitalOcean token file")
        register_dns(config, apps, args.token_file)
    elif args.command == "verify":
        verify(config, apps, args.ssh_host)
    else:
        revision = committed_revision()
        deployment_apps = (sorted(apps, key=lambda app: app["name"] != "meta-app")
                           if args.command == "deploy" else apps)
        for app in deployment_apps:
            if args.command == "build":
                build(app, revision)
            else:
                deploy(config, app, revision, args.ssh_host)
                verify(config, [app], args.ssh_host)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError, urllib.error.URLError) as error:
        print(f"deployment failed: {error}", file=sys.stderr)
        sys.exit(1)
