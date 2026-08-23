import { describe, expect, it } from "vitest";
import { createAssetSchema, targetUrlSchema } from "./schemas.js";

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
});
