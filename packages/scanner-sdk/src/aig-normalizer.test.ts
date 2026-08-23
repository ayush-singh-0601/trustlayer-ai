import { describe, expect, it } from "vitest";
import { normalizeAigResult } from "./aig-normalizer.js";

describe("AIG normalization", () => {
  it("extracts nested scanner findings without retaining AIG field names in the domain model", () => {
    const findings = normalizeAigResult(
      {
        scanner: "aig",
        scannerVersion: "fixture",
        externalId: "session-1",
        scanType: "agent",
        raw: {
          report: {
            vulnerabilities: [
              {
                name: "Authorization bypass permits customer data leakage",
                risk_level: "critical",
                description: "The test retrieved another customer's record.",
                remediation: "Bind retrieval to the authenticated customer ID.",
              },
            ],
          },
        },
      },
      {
        assetName: "Support Agent",
        dataCategories: ["customer_data"],
        permissions: ["read"],
        blastRadius: "high",
        detectedAt: new Date("2026-08-23T00:00:00.000Z"),
      },
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      source: "aig",
      category: "data_privacy",
      severity: "critical",
      impactTypes: expect.arrayContaining(["data_exfiltration", "authorization_bypass"]),
      affectedData: ["customer_data"],
    });
    expect(findings[0]?.businessExplanation).not.toContain("risk_level");
  });
});

