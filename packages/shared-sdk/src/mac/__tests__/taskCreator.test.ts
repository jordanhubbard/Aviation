import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MacTaskCreator } from "../taskCreator";

describe("MacTaskCreator", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.MAC_AUTOREPORT_FORCE = "1";
    process.env.MAC_API_URL = "https://mac.example.test";
    process.env.MAC_API_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("creates one idempotent MAC task and dedupes repeated calls", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "task_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const creator = new MacTaskCreator({ project: "Aviation" });
    const first = await creator.createTask({ title: "t", description: "d" });
    expect(first).toEqual({ created: true, taskId: "task_123" });

    const second = await creator.createTask({ title: "t", description: "d" });
    expect(second).toEqual({ created: false, reason: "deduped" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.project).toBe("Aviation");
    expect(body.idempotency_key).toMatch(/^aviation-autoreport:/);
  });

  it("includes auto-filed context in the task description", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "task_456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const creator = new MacTaskCreator();
    const result = await creator.createAutoFiledTask({
      title: "boom",
      description: "stack",
      autoFiledContext: "something happened",
    });

    expect(result.taskId).toBe("task_456");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.description).toContain("Auto-filed context:");
    expect(body.description).toContain("something happened");
  });
});
