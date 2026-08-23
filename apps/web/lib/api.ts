import type { Asset, Assessment, CreateAssetInput, ScanType } from "@trustlayer/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

interface ApiEnvelope<T> {
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiEnvelope<T> & { detail?: string };
  if (!response.ok) throw new Error(payload.detail ?? `Request failed with status ${response.status}`);
  return payload.data;
}

export interface DashboardSummary {
  overallTrustScore: number | null;
  totalAssets: number;
  byStatus: Record<string, number>;
  urgentAssets: Asset[];
}

export interface LocalSystemStatus {
  mode: "local";
  persistence: "sqlite";
  scanner: { available: boolean; detail: string };
}

export async function loadDashboard(): Promise<[DashboardSummary, Asset[]]> {
  return Promise.all([request<DashboardSummary>("/dashboard"), request<Asset[]>("/assets")]);
}

export async function loadSystemStatus(): Promise<LocalSystemStatus> {
  return request<LocalSystemStatus>("/system/status");
}

export async function loadAsset(id: string): Promise<Asset> {
  return request<Asset>(`/assets/${id}`);
}

export async function loadAssessment(id: string): Promise<Assessment> {
  return request<Assessment>(`/assessments/${id}`);
}

export async function createAssetAndAssessment(
  input: CreateAssetInput,
  options: { authorizeRecurring: boolean; runNow: boolean },
): Promise<{ asset: Asset; assessmentId: string | null }> {
  const createdResponse = await fetch(`${API_URL}/assets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const created = (await createdResponse.json()) as ApiEnvelope<Asset> & { compatibleScans: ScanType[]; detail?: string };
  if (!createdResponse.ok) throw new Error(created.detail ?? "Could not add this AI asset");

  const authorization = await request<{ id: string }>(`/assets/${created.data.id}/scan-authorizations`, {
    method: "POST",
    body: JSON.stringify({
      targets: [input.targetUrl],
      recurring: options.authorizeRecurring,
      confirmed: true,
      termsVersion: "scan-authorization-v1",
    }),
  });

  if (!options.runNow) return { asset: created.data, assessmentId: null };
  const assessment = await request<Assessment>(`/assets/${created.data.id}/assessments`, {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({
      authorizationId: authorization.id,
      requestedScans: created.compatibleScans,
      reason: "manual",
    }),
  });
  return { asset: created.data, assessmentId: assessment.id };
}
