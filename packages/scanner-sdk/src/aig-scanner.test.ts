import { describe, expect, it, vi } from "vitest";
import { AigScanner, ScannerCapabilityError } from "./aig-scanner.js";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}

describe("AigScanner", () => {
  it("maps infrastructure submissions to the official task API", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({ status: 0, message: "ok", data: { session_id: "session-1" } }),
    );
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088/", version: "fixture", fetch });

    const handle = await scanner.submit({
      scanType: "infrastructure",
      targets: ["https://agent.example.com"],
      timeoutSeconds: 20,
    });

    expect(handle).toEqual({ scanner: "aig", externalId: "session-1", scanType: "infrastructure" });
    expect(fetch).toHaveBeenCalledWith(
      "http://aig.internal:8088/api/v1/app/taskapi/tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "ai_infra_scan",
          content: { target: ["https://agent.example.com"], timeout: 20 },
        }),
      }),
    );
  });

  it("maps inline agent configuration to the pinned agent_scan contract", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({ status: 0, message: "ok", data: { session_id: "agent-session" } }),
    );
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088", version: "v4.5.0", fetch });

    await scanner.submit({
      scanType: "agent",
      agentConfig: "provider: dify\nbase_url: https://agent.example.com",
      evaluationModel: {
        model: "gpt-4.1-mini",
        token: "evaluation-token",
        baseUrl: "https://api.openai.com/v1",
      },
      prompt: "Focus on privilege escalation",
      language: "en",
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      type: "agent_scan",
      content: {
        agent_config: "provider: dify\nbase_url: https://agent.example.com",
        eval_model: {
          model: "gpt-4.1-mini",
          token: "evaluation-token",
          base_url: "https://api.openai.com/v1",
        },
        prompt: "Focus on privilege escalation",
        language: "en",
      },
    });
  });

  it("maps a remote MCP endpoint to the pinned mcp_scan contract", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({ status: 0, message: "ok", data: { session_id: "mcp-session" } }),
    );
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088", version: "v4.5.0", fetch });

    await scanner.submit({
      scanType: "mcp",
      targetUrl: "https://mcp.example.com",
      headers: { Authorization: "Bearer one-time-secret" },
      model: { model: "gpt-4.1-mini" },
      concurrency: 2,
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      type: "mcp_scan",
      content: {
        prompt: "https://mcp.example.com",
        headers: { Authorization: "Bearer one-time-secret" },
        model: { model: "gpt-4.1-mini" },
        thread: 2,
        language: "en",
      },
    });
  });

  it("maps model evaluation settings to the pinned model_redteam_report contract", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({ status: 0, message: "ok", data: { session_id: "model-session" } }),
    );
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088", version: "v4.5.0", fetch });

    await scanner.submit({
      scanType: "model",
      targets: [{ model: "customer-model", baseUrl: "https://model.example.com/v1", token: "target-token" }],
      evaluationModel: { model: "gpt-4.1-mini", token: "evaluation-token" },
      datasets: ["JailBench-Tiny", "HarmfulEvalBenchmark"],
      promptCount: 25,
      randomSeed: 42,
      techniques: ["jailbreak"],
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      type: "model_redteam_report",
      content: {
        model: [{ model: "customer-model", token: "target-token", base_url: "https://model.example.com/v1" }],
        eval_model: { model: "gpt-4.1-mini", token: "evaluation-token" },
        dataset: {
          dataFile: ["JailBench-Tiny", "HarmfulEvalBenchmark"],
          numPrompts: 25,
          randomSeed: 42,
        },
        techniques: ["jailbreak"],
      },
    });
  });

  it("uses status and result endpoints and redacts scanner logs", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 0,
          data: { session_id: "session-1", status: "running", log: "Authorization: Bearer secret-value" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: 0, data: { findings: [] } }));
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088", version: "4.1.x", fetch });
    const handle = { scanner: "aig", externalId: "session-1", scanType: "agent" } as const;

    expect((await scanner.status(handle)).redactedLog).not.toContain("secret-value");
    expect((await scanner.result(handle)).raw).toEqual({ findings: [] });
  });

  it("fails explicitly because AIG does not document cancellation", async () => {
    const scanner = new AigScanner({ baseUrl: "http://aig.internal:8088", version: "fixture" });
    await expect(scanner.cancel({ scanner: "aig", externalId: "x", scanType: "agent" })).rejects.toBeInstanceOf(
      ScannerCapabilityError,
    );
  });
});
