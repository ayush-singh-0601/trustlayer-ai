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

  it("lists assessment history within the tenant and optional asset scope", async () => {
    const store = new InMemoryTrustLayerStore();
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const userId = randomUUID();
    const assetId = randomUUID();
    const otherAssetId = randomUUID();
    const makeInput = (targetAssetId: string) => ({
      assetId: targetAssetId,
      authorizationId: randomUUID(),
      requestedScans: ["infrastructure"] as const,
      reason: "manual" as const,
    });

    await store.createAssessment(organizationId, userId, makeInput(assetId), "history-key-1");
    await store.createAssessment(organizationId, userId, makeInput(otherAssetId), "history-key-2");
    await store.createAssessment(otherOrganizationId, userId, makeInput(assetId), "history-key-3");

    expect(await store.listAssessments(organizationId)).toHaveLength(2);
    expect(await store.listAssessments(organizationId, assetId)).toHaveLength(1);
  });
});
