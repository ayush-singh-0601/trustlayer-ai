import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDevelopmentAuthResolver } from "./auth.js";
import { AssessmentCoordinator, PublicEndpointRequestProvider } from "./coordinator.js";
import { LocalScanDispatcher } from "./local-dispatcher.js";
import { SqliteTrustLayerStore } from "./sqlite-store.js";

const apiPort = Number(process.env.API_PORT ?? 4000);
const apiHost = process.env.API_HOST ?? "127.0.0.1";
if (!["127.0.0.1", "localhost", "::1"].includes(apiHost)) {
  throw new Error("TrustLayer local mode only listens on loopback addresses");
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDirectory, "../../..");
const dataDirectory = resolve(process.env.TRUSTLAYER_DATA_DIR ?? join(repositoryRoot, ".trustlayer"));
const store = new SqliteTrustLayerStore(join(dataDirectory, "trustlayer.db"));
const userId = process.env.LOCAL_USER_ID ?? "00000000-0000-4000-8000-000000000001";
const organizationId = process.env.LOCAL_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000101";
const resolveAuth = createDevelopmentAuthResolver({
  userId,
  organizationId,
  email: "local@trustlayer",
  role: "owner",
});

const scannerMode = process.env.LOCAL_SCANNER_MODE ?? "auto";
if (!["auto", "enabled", "disabled"].includes(scannerMode)) {
  throw new Error("LOCAL_SCANNER_MODE must be auto, enabled, or disabled");
}
const aigBaseUrl = (process.env.AIG_BASE_URL ?? "http://127.0.0.1:8088").replace(/\/$/, "");
const scannerAvailable = scannerMode !== "disabled" && (await isAigAvailable(aigBaseUrl));
if (scannerMode === "enabled" && !scannerAvailable) {
  throw new Error(`LOCAL_SCANNER_MODE=enabled but AIG is unavailable at ${aigBaseUrl}`);
}

let dispatcher: LocalScanDispatcher | undefined;
let coordinator: AssessmentCoordinator | undefined;
if (scannerAvailable) {
  const lock = JSON.parse(
    readFileSync(join(repositoryRoot, "infrastructure/aig/upstream.lock.json"), "utf8"),
  ) as { tag: string };
  dispatcher = new LocalScanDispatcher({
    workerPath: join(repositoryRoot, "workers/aig-worker/dist/index.js"),
    aigBaseUrl,
    aigVersion: lock.tag,
    cwd: repositoryRoot,
  });
  coordinator = new AssessmentCoordinator(
    store,
    dispatcher,
    new PublicEndpointRequestProvider(),
    `http://${apiHost === "::1" ? "[::1]" : apiHost}:${apiPort}`,
  );
}

const app = await createApp({
  store,
  resolveAuth,
  logger: true,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  scannerStatus: scannerAvailable
    ? { available: true, detail: `Local AIG connected at ${aigBaseUrl}` }
    : { available: false, detail: "Context-only mode; start the optional local scanner for technical scans" },
  ...(coordinator ? { coordinator } : {}),
});
app.addHook("onClose", async () => {
  dispatcher?.close();
  store.close();
});

await app.listen({ host: apiHost, port: apiPort });

async function isAigAvailable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(750) });
    return response.ok;
  } catch {
    return false;
  }
}
