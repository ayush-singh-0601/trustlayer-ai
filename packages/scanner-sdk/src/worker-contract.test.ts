import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scanJobSchema, workerOutcomeSchema } from "./worker-contract.js";

function job() {
  return {
    jobId: randomUUID(),
    organizationId: randomUUID(),
    assessmentId: randomUUID(),
    scanId: randomUUID(),
    assetName: "Support agent",
    targetsToValidate: ["https://agent.example.com"],
    dataCategories: ["customer_data"],
    permissions: ["read"],
    blastRadius: "high",
    scanType: "agent",
    secretBrokerUrl: "http://api.internal/v1/internal/scans/secret",
    secretToken: "s".repeat(32),
    callbackUrl: "http://api.internal/v1/internal/scans/callback",
    callbackToken: "c".repeat(32),
  };
}

describe("worker boundary contracts", () => {
  it("rejects oversized tokens and unknown job fields", () => {
    expect(scanJobSchema.safeParse({ ...job(), secretToken: "s".repeat(257) }).success).toBe(false);
    expect(scanJobSchema.safeParse({ ...job(), unexpected: true }).success).toBe(false);
  });

  it("rejects oversized evidence before persistence", () => {
    const value = {
      jobId: randomUUID(),
      organizationId: randomUUID(),
      assessmentId: randomUUID(),
      scanId: randomUUID(),
      state: "succeeded",
      findings: [],
      redactedRawResult: { output: "x".repeat(1_000_001) },
    };

    expect(workerOutcomeSchema.safeParse(value).success).toBe(false);
  });
});
