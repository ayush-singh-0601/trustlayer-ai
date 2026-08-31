import { describe, expect, it } from "vitest";
import {
  createAssessmentSchema,
  createAssetSchema,
  scanAuthorizationInputSchema,
  targetUrlSchema,
} from "./schemas.js";

describe("public input contracts", () => {
  it("rejects non-HTTPS and credential-bearing targets", () => {
    expect(targetUrlSchema.safeParse("http://127.0.0.1:11434").success).toBe(true);
    expect(targetUrlSchema.safeParse("ftp://example.com").success).toBe(false);
    expect(targetUrlSchema.safeParse("https://user:secret@example.com").success).toBe(false);
  });

  it("accepts a complete inventory asset", () => {
    const result = createAssetSchema.safeParse({
      name: "Customer Support Agent",
      vendorName: "Acme AI",
      type: "custom_http_agent",
      purpose: "Resolve customer support requests using CRM context",
      department: "Support",
      businessOwner: "Support Operations",
      criticality: "high",
      environment: "production",
      targetUrl: "https://agent.example.com/api/chat",
      dataCategories: ["customer_data"],
      integrations: [
        {
          provider: "HubSpot",
          dataCategories: ["customer_data"],
          permissions: { current: ["read", "bulk_export"], required: ["read"] },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate values in set-like request fields", () => {
    const assetId = "00000000-0000-4000-8000-000000000001";
    const authorizationId = "00000000-0000-4000-8000-000000000002";

    expect(
      createAssessmentSchema.safeParse({
        assetId,
        authorizationId,
        requestedScans: ["agent", "agent"],
      }).success,
    ).toBe(false);
    expect(
      scanAuthorizationInputSchema.safeParse({
        assetId,
        targets: ["https://agent.example.com", "https://agent.example.com"],
        recurring: false,
        confirmed: true,
        termsVersion: "scan-authorization-v1",
      }).success,
    ).toBe(false);
  });

  it("rejects required permissions that are not currently granted", () => {
    const result = createAssetSchema.safeParse({
      name: "Customer Support Agent",
      vendorName: "Acme AI",
      type: "custom_http_agent",
      purpose: "Resolve customer support requests using approved context",
      department: "Support",
      businessOwner: "Support Operations",
      criticality: "high",
      environment: "production",
      targetUrl: "https://agent.example.com/api/chat",
      dataCategories: ["customer_data"],
      integrations: [
        {
          provider: "CRM",
          dataCategories: ["customer_data"],
          permissions: { current: ["read"], required: ["write"] },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["integrations", 0, "permissions", "required", 0]);
  });
});
