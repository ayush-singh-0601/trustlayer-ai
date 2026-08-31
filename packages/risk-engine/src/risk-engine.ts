import type {
  BusinessContext,
  NormalizedFinding,
  RiskBand,
  RiskCategory,
  TrustDecision,
  TrustScoreResult,
} from "@trustlayer/contracts";
import {
  BLAST_RADIUS_FACTOR,
  CATEGORY_WEIGHTS,
  CONFIDENCE_FACTOR,
  CRITICALITY_FACTOR,
  DATA_FACTOR,
  MODEL_VERSION,
  PERMISSION_FACTOR,
  SEVERITY_RISK,
} from "./config.js";

export interface CalculateTrustScoreInput {
  findings: readonly NormalizedFinding[];
  context: BusinessContext;
  applicableCategories: readonly RiskCategory[];
  assessedCategories: readonly RiskCategory[];
  categoryOverrides?: Partial<Record<RiskCategory, number>>;
  assessmentComplete: boolean;
  monitoringActive: boolean;
}

const catastrophicImpacts = new Set([
  "data_exfiltration",
  "authorization_bypass",
  "remote_code_execution",
  "arbitrary_tool_execution",
]);

const sensitiveData = new Set(["customer_data", "employee_data", "financial_data", "source_code"]);
const highImpactPermissions = new Set(["write", "send", "delete", "execute", "bulk_export"]);

function maximumFactor<T extends string>(values: readonly T[], factors: Readonly<Record<T, number>>, fallback: number): number {
  return values.reduce((maximum, value) => Math.max(maximum, factors[value]), fallback);
}

function contextFactor(finding: NormalizedFinding, context: BusinessContext): number {
  const data = finding.affectedData.length > 0 ? finding.affectedData : context.dataCategories;
  const permissions = finding.permissions.length > 0 ? finding.permissions : context.currentPermissions;
  const dataFactor = maximumFactor(data, DATA_FACTOR, 1);
  const permissionFactor = maximumFactor(permissions, PERMISSION_FACTOR, 1);
  const product =
    dataFactor *
    permissionFactor *
    CRITICALITY_FACTOR[context.criticality] *
    BLAST_RADIUS_FACTOR[finding.blastRadius ?? context.blastRadius];
  return Math.min(1.5, Math.max(0.5, Math.pow(product, 0.25)));
}

function adjustedFindingRisk(finding: NormalizedFinding, context: BusinessContext): number {
  const risk = SEVERITY_RISK[finding.severity] * CONFIDENCE_FACTOR[finding.confidence] * contextFactor(finding, context);
  return Math.min(100, Math.max(0, risk));
}

function combinedRisk(findings: readonly NormalizedFinding[], context: BusinessContext): number {
  const remainingTrust = findings.reduce(
    (remaining, finding) => remaining * (1 - adjustedFindingRisk(finding, context) / 100),
    1,
  );
  return 100 * (1 - remainingTrust);
}

function bandFor(score: number | null): RiskBand {
  if (score === null) return "unassessed";
  if (score >= 92) return "excellent";
  if (score >= 80) return "low";
  if (score >= 65) return "moderate";
  if (score >= 40) return "high";
  return "critical";
}

function decisionFor(score: number | null): TrustDecision {
  if (score === null) return "unassessed";
  if (score >= 80) return "approved";
  if (score >= 65) return "approved_with_restrictions";
  if (score >= 40) return "security_review_required";
  return "blocked";
}

const decisionRank: Readonly<Record<TrustDecision, number>> = {
  unassessed: 0,
  approved: 1,
  approved_with_restrictions: 2,
  security_review_required: 3,
  blocked: 4,
};

function atLeast(current: TrustDecision, minimum: TrustDecision): TrustDecision {
  return decisionRank[current] >= decisionRank[minimum] ? current : minimum;
}

function uniqueOpenFindings(findings: readonly NormalizedFinding[], context: BusinessContext): NormalizedFinding[] {
  const unique = new Map<string, NormalizedFinding>();
  for (const finding of findings) {
    if (finding.status !== "open") continue;
    const existing = unique.get(finding.fingerprint);
    if (!existing || dangerRank(finding, context) > dangerRank(existing, context)) {
      unique.set(finding.fingerprint, finding);
    }
  }
  return [...unique.values()];
}

function dangerRank(finding: NormalizedFinding, context: BusinessContext): number {
  const gateRank =
    finding.severity === "critical" && finding.impactTypes.some((impact) => catastrophicImpacts.has(impact))
      ? 4
      : finding.severity === "critical"
        ? 3
        : finding.severity === "high" &&
            (finding.affectedData.some((data) => sensitiveData.has(data)) ||
              finding.permissions.some((permission) => highImpactPermissions.has(permission)))
          ? 2
          : finding.severity === "high"
            ? 1
            : 0;
  return gateRank * 1_000 + adjustedFindingRisk(finding, context);
}

export function calculateTrustScore(input: CalculateTrustScoreInput): TrustScoreResult {
  const applicable = new Set(input.applicableCategories);
  const assessed = new Set(input.assessedCategories.filter((category) => applicable.has(category)));
  const findings = uniqueOpenFindings(input.findings, input.context);
  const applicableWeight = [...applicable].reduce((total, category) => total + CATEGORY_WEIGHTS[category], 0);
  const assessedWeight = [...assessed].reduce((total, category) => total + CATEGORY_WEIGHTS[category], 0);
  const coveragePercent = applicableWeight === 0 ? 0 : Math.round((assessedWeight / applicableWeight) * 100);

  const components = [...applicable].map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category);
    const isAssessed = assessed.has(category);
    const override = input.categoryOverrides?.[category];
    const score = !isAssessed
      ? null
      : Math.round(Math.min(100, Math.max(0, override ?? 100 - combinedRisk(categoryFindings, input.context))));
    return {
      category,
      weight: CATEGORY_WEIGHTS[category],
      assessed: isAssessed,
      score,
      findingCount: categoryFindings.length,
    };
  });

  const weightedTotal = components.reduce(
    (total, component) => total + (component.score ?? 0) * (component.assessed ? component.weight : 0),
    0,
  );
  const score = assessedWeight === 0 ? null : Math.round(weightedTotal / assessedWeight);
  let decision = decisionFor(score);
  const appliedGates: string[] = [];

  const hasCatastrophicCritical = findings.some(
    (finding) =>
      finding.severity === "critical" && finding.impactTypes.some((impact) => catastrophicImpacts.has(impact)),
  );
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasSensitiveHigh = findings.some(
    (finding) =>
      finding.severity === "high" &&
      (finding.affectedData.some((data) => sensitiveData.has(data)) ||
        finding.permissions.some((permission) => highImpactPermissions.has(permission))),
  );

  if (hasCatastrophicCritical) {
    decision = "blocked";
    appliedGates.push("catastrophic_critical_finding");
  } else if (hasCritical) {
    decision = atLeast(decision, "security_review_required");
    appliedGates.push("critical_finding");
  }
  if (hasSensitiveHigh) {
    decision = atLeast(decision, "approved_with_restrictions");
    appliedGates.push("high_sensitive_or_privileged_finding");
  }
  if (!input.assessmentComplete || coveragePercent < 60) {
    decision = atLeast(decision, "security_review_required");
    appliedGates.push(!input.assessmentComplete ? "incomplete_assessment" : "insufficient_coverage");
  }

  const evidenceLevel =
    assessedWeight === 0
      ? "unverified"
      : input.assessmentComplete && input.monitoringActive
        ? "continuously_monitored"
        : "verified_tested";

  return {
    score,
    riskBand: bandFor(score),
    decision,
    coveragePercent,
    evidenceLevel,
    modelVersion: MODEL_VERSION,
    components,
    appliedGates,
  };
}
