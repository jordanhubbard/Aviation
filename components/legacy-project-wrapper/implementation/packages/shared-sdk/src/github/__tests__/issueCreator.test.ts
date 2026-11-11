import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { GitHubIssueCreator, redactIssueText } from "../issueCreator.js";

describe("GitHubIssueCreator", () => {
  const originalEnv = { ...process.env };
  const servers: Server[] = [];
  beforeEach(() => {
    process.env.GITHUB_ISSUES_AUTOREPORT = "1";
    process.env.GITHUB_ISSUES_AUTOREPORT_FORCE = "1";
    process.env.GITHUB_ISSUES_TOKEN = "synthetic-report-credential";
  });
  afterEach(async () => {
    process.env = { ...originalEnv };
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  async function provider() {
    const calls: Array<{
      path: string;
      headers: Record<string, any>;
      body: any;
    }> = [];
    const reply = {
      status: 201,
      payload: {
        number: 42,
        html_url: "https://github.com/test-owner/test-repo/issues/42",
      } as any,
    };
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      calls.push({
        path: req.url!,
        headers: req.headers,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      });
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.payload));
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test listener");
    return {
      calls,
      reply,
      creator: new GitHubIssueCreator({
        repository: "test-owner/test-repo",
        apiUrl: `http://127.0.0.1:${address.port}`,
      }),
    };
  }
  it("uses the actual GitHub issue wire contract and returns the issue number and URL", async () => {
    const { calls, creator } = await provider();
    expect(
      await creator.createIssue({ title: "Runtime failure", body: "Details" }),
    ).toEqual({
      created: true,
      issueNumber: 42,
      issueUrl: "https://github.com/test-owner/test-repo/issues/42",
    });
    expect(calls[0].path).toBe("/repos/test-owner/test-repo/issues");
    expect(calls[0].headers.authorization).toBe(
      "Bearer synthetic-report-credential",
    );
    expect(calls[0].headers["x-github-api-version"]).toBe("2022-11-28");
    expect(Object.keys(calls[0].body).sort()).toEqual(["body", "title"]);
    expect(calls[0].body.body).toMatch(/aviation-autoreport:[0-9a-f]{64}/);
  });
  it("dedupes concurrent and repeated reports without making duplicate provider requests", async () => {
    const { creator, calls } = await provider();
    const issue = { title: "Same error", body: "Same details" };
    const [first, second] = await Promise.all([
      creator.createIssue(issue),
      creator.createIssue(issue),
    ]);
    expect(first.created).toBe(true);
    expect(second.reason).toBe("deduped");
    expect((await creator.createIssue(issue)).reason).toBe("deduped");
    expect(calls).toHaveLength(1);
  });
  it("does not suppress a retry after a failed GitHub request", async () => {
    const { creator, calls, reply } = await provider();
    const issue = { title: "Retry", body: "Details" };
    reply.status = 503;
    expect((await creator.createIssue(issue)).reason).toContain("HTTP 503");
    reply.status = 201;
    expect((await creator.createIssue(issue)).created).toBe(true);
    expect(calls).toHaveLength(2);
  });
  it("rejects malformed provider responses rather than treating arbitrary IDs as issues", async () => {
    const { creator, reply } = await provider();
    reply.payload = { id: "not-an-issue" };
    expect(
      (await creator.createIssue({ title: "Malformed", body: "Details" }))
        .created,
    ).toBe(false);
  });
  it("requires explicit opt-in and credentials, and keeps CI disabled unless explicitly forced", async () => {
    const { creator, calls } = await provider();
    delete process.env.GITHUB_ISSUES_AUTOREPORT;
    expect(creator.enabled()).toBe(false);
    process.env.GITHUB_ISSUES_AUTOREPORT = "1";
    process.env.CI = "true";
    delete process.env.GITHUB_ISSUES_AUTOREPORT_FORCE;
    expect(creator.enabled()).toBe(false);
    process.env.GITHUB_ISSUES_AUTOREPORT_FORCE = "1";
    expect(new GitHubIssueCreator({ token: "" }).enabled()).toBe(false);
    delete process.env.GITHUB_ISSUES_TOKEN;
    process.env.MAC_API_URL = "https://retired-tracker.example.test";
    process.env.MAC_API_TOKEN = "retired-credential";
    expect(
      (
        await new GitHubIssueCreator().createIssue({
          title: "Disabled",
          body: "No request",
        })
      ).created,
    ).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("limits unique reports to five attempts per hour", async () => {
    const { creator, calls } = await provider();
    for (let i = 0; i < 5; i++)
      expect(
        (await creator.createIssue({ title: `Error ${i}`, body: "Details" }))
          .created,
      ).toBe(true);
    expect(
      (await creator.createIssue({ title: "Sixth", body: "Details" })).reason,
    ).toContain("rate limited");
    expect(calls).toHaveLength(5);
  });
  it("redacts URL credentials, query secrets and context secrets before sending issue bodies", async () => {
    const { creator, calls } = await provider();
    await creator.createAutoFiledIssue({
      title: "Failure",
      body: 'https://user:private-pass@example.test/path?token=private-query#private-fragment {"api_key": "private-value"} Authorization: Bearer private-auth',
      autoFiledContext: "password=private-context",
    });
    expect(calls[0].body.body).toContain("https://example.test/path");
    for (const value of [
      "private-pass",
      "private-query",
      "private-fragment",
      "private-value",
      "private-auth",
      "private-context",
    ])
      expect(calls[0].body.body).not.toContain(value);
    expect(calls[0].body.body).toContain("Auto-filed context:");
    expect(redactIssueText("token=hidden")).toContain("[REDACTED]");
  });
  it("rejects unsafe destinations and repository path traversal", () => {
    expect(() => new GitHubIssueCreator({ repository: "../repo" })).toThrow();
    expect(
      () => new GitHubIssueCreator({ apiUrl: "http://external.example.test" }),
    ).toThrow();
    expect(
      () =>
        new GitHubIssueCreator({
          apiUrl: "https://user:credential@api.github.com",
        }),
    ).toThrow();
  });
});
