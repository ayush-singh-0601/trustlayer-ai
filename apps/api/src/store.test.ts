import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IdempotencyConflictError, InMemoryTrustLayerStore } from "./store.js";

describe("assessment idempotency", () => {
  it("replays the same request and rejects a changed request", async () => {
    const store = new InMemoryTrustLayerStore();
    const organizationId = randomUUID();
    const userId = randomUUID();
    const input = {
      assetId: randomUUID(),
      authorizationId: randomUUID(),
      requestedScans: ["agent", "infrastructure"] as const,
      reason: "manual" as const,
    };

    const first = await store.createAssessment(organizationId, userId, input, "stable-key");
    const replay = await store.createAssessment(
      organizationId,
      userId,
      { ...input, requestedScans: ["infrastructure", "agent"] },
      "stable-key",
    );
    expect(replay.id).toBe(first.id);

    await expect(
      store.createAssessment(
        organizationId,
        userId,
        { ...input, authorizationId: randomUUID() },
        "stable-key",
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});
