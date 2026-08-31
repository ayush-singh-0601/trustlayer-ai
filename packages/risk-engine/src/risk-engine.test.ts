import { describe, expect, it } from "vitest";
import type { BusinessContext, NormalizedFinding } from "@trustlayer/contracts";
import { analyzeExcessPermissions, calculateTrustScore } from "./index.js";

const context: BusinessContext = {
  criticality: "high",
  dataCategories: ["customer_data"],
  currentPermissions: ["read", "bulk_export"],
  requiredPermissions: ["read"],
  blastRadius: "high",
};

function finding(overrides: Partial<NormalizedFinding> = {}): NormalizedFinding {
  const timestamp = "2026-08-22T12:00:00.000Z";
  return {
    fingerprint: "fixture:finding:1",
    source: "aig",
    scannerVersion: "fixture",
    scanType: "agent",
    category: "agent_behavior",
    severity: "low",
    confidence: "high",
    status: "open",
    title: "Fixture finding",
    technicalSummary: "Controlled fixture",
    businessExplanation: "Controlled fixture",
    affectedData: ["customer_data"],
    permissions: ["read"],
    impactTypes: ["prompt_manipulation"],
    blastRadius: "medium",
    evidenceRef: null,
    recommendations: [],
    firstDetectedAt: timestamp,
    lastDetectedAt: timestamp,
    ...overrides,
  };
}

describe("Trust Score v1", () => {
  it("is deterministic and ignores duplicate fingerprints", () => {
    const duplicate = finding();
    const input = {
      findings: [duplicate, duplicate],
      context,
      applicableCategories: ["agent_behavior", "permissions"] as const,
      assessedCategories: ["agent_behavior", "permissions"] as const,
      assessmentComplete: true,
      monitoringActive: false,
    };

    expect(calculateTrustScore(input)).toEqual(calculateTrustScore(input));
    expect(calculateTrustScore(input).components[0]?.findingCount).toBe(1);
  });

  it("keeps the highest-risk version of a duplicate fingerprint", () => {
    const result = calculateTrustScore({
      findings: [
        finding({ severity: "low" }),
        finding({ severity: "critical", impactTypes: ["data_exfiltration"] }),
      ],
      context,
      applicableCategories: ["agent_behavior"],
      assessedCategories: ["agent_behavior"],
      assessmentComplete: true,
      monitoringActive: false,
    });

    expect(result.components[0]).toMatchObject({ findingCount: 1, score: 0 });
    expect(result.decision).toBe("blocked");
  });

  it("blocks catastrophic critical findings regardless of average", () => {
    const result = calculateTrustScore({
      findings: [
        finding({
          severity: "critical",
          impactTypes: ["data_exfiltration"],
          affectedData: ["customer_data"],
        }),
      ],
      context,
      applicableCategories: ["agent_behavior", "permissions"],
      assessedCategories: ["agent_behavior", "permissions"],
      categoryOverrides: { permissions: 100 },
      assessmentComplete: true,
      monitoringActive: false,
    });

    expect(result.decision).toBe("blocked");
    expect(result.appliedGates).toContain("catastrophic_critical_finding");
  });

  it("forces review when evidence coverage is insufficient", () => {
    const result = calculateTrustScore({
      findings: [],
      context,
      applicableCategories: ["agent_behavior", "permissions", "vendor_posture"],
      assessedCategories: ["permissions"],
      assessmentComplete: true,
      monitoringActive: false,
    });

    expect(result.score).toBe(100);
    expect(result.coveragePercent).toBeLessThan(60);
    expect(result.decision).toBe("security_review_required");
  });

  it("turns declared excess access into deterministic findings", () => {
    const findings = analyzeExcessPermissions(context, new Date("2026-08-22T12:00:00.000Z"));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "permissions", severity: "critical", permissions: ["bulk_export"] });
  });
});
