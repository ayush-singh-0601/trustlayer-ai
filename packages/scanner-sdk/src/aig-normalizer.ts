import { createHash } from "node:crypto";
import type {
  BlastRadiusTier,
  DataCategory,
  NormalizedFinding,
  PermissionAction,
  RiskCategory,
  ScanType,
} from "@trustlayer/contracts";
import { normalizedFindingSchema } from "@trustlayer/contracts";
import type { ScannerResult } from "./types.js";

export interface AigNormalizationContext {
  assetName: string;
  dataCategories: DataCategory[];
  permissions: PermissionAction[];
  blastRadius: BlastRadiusTier;
  detectedAt?: Date;
}

interface Candidate {
  title: string;
  description: string;
  recommendation: string | null;
  severity: NormalizedFinding["severity"];
  path: string;
}

const severityKeys = ["severity", "risk_level", "riskLevel", "level", "risk", "cvss"];
const titleKeys = ["title", "name", "vulnerability", "vuln_name", "vulnerability_name", "rule_name", "ruleName"];
const descriptionKeys = ["description", "detail", "details", "evidence", "message", "summary"];
const recommendationKeys = ["recommendation", "remediation", "solution", "fix", "suggestion"];

export function normalizeAigResult(result: ScannerResult, context: AigNormalizationContext): NormalizedFinding[] {
  const timestamp = (context.detectedAt ?? new Date()).toISOString();
  const candidates = collectCandidates(result.raw);
  const normalized = new Map<string, NormalizedFinding>();

  for (const candidate of candidates) {
    const category = categoryFor(result.scanType, `${candidate.title} ${candidate.description}`);
    const impact = impactFor(`${candidate.title} ${candidate.description}`, result.scanType);
    const fingerprint = createHash("sha256")
      .update(`${result.scanType}|${candidate.path}|${candidate.title.toLowerCase()}`)
      .digest("hex");
    const recommendation = candidate.recommendation ?? defaultRecommendation(category);
    const finding = normalizedFindingSchema.parse({
      fingerprint: `aig:${fingerprint}`,
      source: "aig",
      scannerVersion: result.scannerVersion,
      scanType: result.scanType,
      category,
      severity: candidate.severity,
      confidence: "medium",
      status: "open",
      title: candidate.title,
      technicalSummary: candidate.description,
      businessExplanation: businessExplanation(category, context.assetName, context.dataCategories),
      affectedData: context.dataCategories,
      permissions: context.permissions,
      impactTypes: impact,
      blastRadius: context.blastRadius,
      evidenceRef: null,
      recommendations: [
        {
          id: `aig:${fingerprint}:remediation`,
          title: recommendationTitle(category),
          action: recommendation,
          priority: candidate.severity === "critical" || candidate.severity === "high" ? "immediate" : "next",
        },
      ],
      firstDetectedAt: timestamp,
      lastDetectedAt: timestamp,
    });
    normalized.set(finding.fingerprint, finding);
  }
  return [...normalized.values()];
}

function collectCandidates(value: unknown, path = "result", candidates: Candidate[] = []): Candidate[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, `${path}[${index}]`, candidates));
    return candidates;
  }
  if (!isRecord(value)) return candidates;

  const severityValue = firstValue(value, severityKeys);
  const titleValue = firstString(value, titleKeys);
  if (severityValue !== undefined && titleValue) {
    const severity = normalizeSeverity(severityValue);
    if (severity) {
      candidates.push({
        title: titleValue.slice(0, 300),
        description: (firstString(value, descriptionKeys) ?? titleValue).slice(0, 10_000),
        recommendation: firstString(value, recommendationKeys)?.slice(0, 2_000) ?? null,
        severity,
        path,
      });
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if (nested && typeof nested === "object") collectCandidates(nested, `${path}.${key}`, candidates);
  }
  return candidates;
}

function normalizeSeverity(value: unknown): NormalizedFinding["severity"] | null {
  if (typeof value === "number") {
    if (value >= 9) return "critical";
    if (value >= 7) return "high";
    if (value >= 4) return "medium";
    if (value > 0) return "low";
    return "informational";
  }
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("critical") || normalized === "severe") return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium") || normalized.includes("moderate")) return "medium";
  if (normalized.includes("low")) return "low";
  if (normalized.includes("info")) return "informational";
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? normalizeSeverity(numeric) : null;
}

function categoryFor(scanType: ScanType, text: string): RiskCategory {
  const normalized = text.toLowerCase();
  if (/leak|exfiltrat|privacy|sensitive data|credential exposure/.test(normalized)) return "data_privacy";
  if (/permission|privilege|authori[sz]ation|tool misuse|access control/.test(normalized)) return "permissions";
  if (scanType === "infrastructure") return "infrastructure";
  if (scanType === "model") return "model_security";
  return "agent_behavior";
}

function impactFor(text: string, scanType: ScanType): NormalizedFinding["impactTypes"] {
  const normalized = text.toLowerCase();
  const impacts: NormalizedFinding["impactTypes"] = [];
  if (/exfiltrat|data leak/.test(normalized)) impacts.push("data_exfiltration");
  else if (/sensitive data|privacy|credential exposure/.test(normalized)) impacts.push("sensitive_data_exposure");
  if (/authori[sz]ation bypass|access control bypass|privilege escalation/.test(normalized)) impacts.push("authorization_bypass");
  if (/remote code|\brce\b/.test(normalized)) impacts.push("remote_code_execution");
  if (/tool misuse|arbitrary tool/.test(normalized)) impacts.push("arbitrary_tool_execution");
  if (/prompt injection|prompt manipulation/.test(normalized)) impacts.push("prompt_manipulation");
  if (scanType === "infrastructure" && impacts.length === 0) impacts.push("known_vulnerability");
  if (scanType === "model" && impacts.length === 0) impacts.push("harmful_model_output");
  if (impacts.length === 0) impacts.push("prompt_manipulation");
  return impacts;
}

function businessExplanation(category: RiskCategory, assetName: string, data: readonly DataCategory[]): string {
  const affected = data.length > 0 ? data.map(humanize).join(", ") : "business information";
  if (category === "infrastructure") {
    return `The software supporting ${assetName} contains a security weakness that could affect its confidentiality or availability.`;
  }
  if (category === "data_privacy") {
    return `Security testing indicates that ${assetName} may expose ${affected} outside the intended request or user boundary.`;
  }
  if (category === "permissions") {
    return `${assetName} may be able to use connected systems with more authority than its stated business purpose requires.`;
  }
  if (category === "model_security") {
    return `${assetName}'s model produced behavior that did not meet the configured safety test.`;
  }
  return `${assetName} responded unsafely to controlled security testing, which may allow manipulation of its behavior.`;
}

function defaultRecommendation(category: RiskCategory): string {
  if (category === "infrastructure") return "Upgrade or reconfigure the affected component, then run the assessment again.";
  if (category === "data_privacy") return "Restrict retrieval to the active user and business object, then retest the authorization boundary.";
  if (category === "permissions") return "Remove unnecessary permissions and require human approval for high-impact actions.";
  if (category === "model_security") return "Add model safeguards for the failed test category and repeat the same evaluation dataset.";
  return "Add input isolation and tool-use guardrails, then rerun the agent security assessment.";
}

function recommendationTitle(category: RiskCategory): string {
  if (category === "infrastructure") return "Remediate the affected component";
  if (category === "data_privacy") return "Enforce the data boundary";
  if (category === "permissions") return "Reduce access to least privilege";
  if (category === "model_security") return "Strengthen model safeguards";
  return "Harden the agent boundary";
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function firstValue(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const value = firstValue(record, keys);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

