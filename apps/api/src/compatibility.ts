import type { AssetType, RiskCategory, ScanType } from "@trustlayer/contracts";

const scanCompatibility: Readonly<Record<AssetType, readonly ScanType[]>> = {
  custom_http_agent: ["agent", "infrastructure"],
  openai_compatible_agent: ["agent", "model", "infrastructure"],
  dify_agent: ["agent", "infrastructure"],
  infrastructure_url: ["infrastructure"],
  mcp_server: ["mcp"],
  llm_endpoint: ["model"],
};

const categoryForScan: Readonly<Record<ScanType, readonly RiskCategory[]>> = {
  agent: ["agent_behavior", "data_privacy"],
  infrastructure: ["infrastructure"],
  mcp: ["agent_behavior", "permissions", "data_privacy"],
  model: ["model_security", "data_privacy"],
};

export function compatibleScans(type: AssetType): readonly ScanType[] {
  return scanCompatibility[type];
}

export function applicableRiskCategories(type: AssetType): RiskCategory[] {
  return [
    ...new Set<RiskCategory>([
      "permissions",
      "vendor_posture",
      "historical_stability",
      ...scanCompatibility[type].flatMap((scan) => categoryForScan[scan]),
    ]),
  ];
}

