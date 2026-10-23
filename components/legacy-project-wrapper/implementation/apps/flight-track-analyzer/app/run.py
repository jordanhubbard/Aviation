"""Entrypoint: `python run.py [--host H] [--port P]`. `--litai-serve` is the lifecycle serve mode."""
import argparse
import sys

import uvicorn

from flightlab.api import create_app


def main(argv=None):
    ap = argparse.ArgumentParser(description="Flight track analyzer server")
    ap.add_argument("--litai-serve", action="store_true", help="framework lifecycle serve mode (same server)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--data-dir", default=None)
    a = ap.parse_args(argv)
    uvicorn.run(create_app(a.data_dir), host=a.host, port=a.port, log_level="info")


if __name__ == "__main__":
    sys.exit(main())
