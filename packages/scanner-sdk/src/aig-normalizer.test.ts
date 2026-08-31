import { describe, expect, it } from "vitest";
import { normalizeAigResult, ScannerNormalizationError } from "./aig-normalizer.js";

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

  it("keeps finding identity stable when scanner arrays are reordered", () => {
    const makeResult = (findings: unknown[]) =>
      normalizeAigResult(
        {
          scanner: "aig",
          scannerVersion: "fixture",
          externalId: "session-1",
          scanType: "infrastructure",
          raw: { findings },
        },
        {
          assetName: "Gateway",
          dataCategories: ["company_documents"],
          permissions: ["read"],
          blastRadius: "medium",
          detectedAt: new Date("2026-08-23T00:00:00.000Z"),
        },
      );
    const first = { title: "Outdated package", severity: "high", description: "CVE-2026-1000 is installed" };
    const second = { title: "Weak TLS", severity: "medium", description: "TLS 1.1 is enabled" };

    const forward = makeResult([first, second]);
    const reversed = makeResult([second, first]);

    expect(forward.map(({ fingerprint }) => fingerprint).sort()).toEqual(
      reversed.map(({ fingerprint }) => fingerprint).sort(),
    );
  });

  it("fails safely on excessively deep or cyclic scanner output", () => {
    const context = {
      assetName: "Gateway",
      dataCategories: ["company_documents" as const],
      permissions: ["read" as const],
      blastRadius: "medium" as const,
    };
    let nested: Record<string, unknown> = {};
    const root = nested;
    for (let depth = 0; depth < 25; depth += 1) {
      nested.next = {};
      nested = nested.next as Record<string, unknown>;
    }
    expect(() =>
      normalizeAigResult(
        { scanner: "aig", scannerVersion: "fixture", externalId: "deep", scanType: "infrastructure", raw: root },
        context,
      ),
    ).toThrow(ScannerNormalizationError);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      normalizeAigResult(
        { scanner: "aig", scannerVersion: "fixture", externalId: "cycle", scanType: "infrastructure", raw: cyclic },
        context,
      ),
    ).toEqual([]);
  });
});
