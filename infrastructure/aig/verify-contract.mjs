import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const lock = JSON.parse(readFileSync(resolve(scriptDirectory, "upstream.lock.json"), "utf8"));
const checkout = resolve(repositoryRoot, lock.checkoutPath);

const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (head !== lock.commit) {
  throw new Error(`AIG revision mismatch. Expected ${lock.commit}, received ${head}.`);
}

const swagger = JSON.parse(readFileSync(resolve(checkout, "docs/swagger.json"), "utf8"));
const expectedRoutes = [
  ["/api/v1/app/taskapi/tasks", "post"],
  ["/api/v1/app/taskapi/status/{id}", "get"],
  ["/api/v1/app/taskapi/result/{id}", "get"],
];

for (const [route, method] of expectedRoutes) {
  if (!swagger.paths?.[route]?.[method]) {
    throw new Error(`Pinned AIG no longer exposes ${method.toUpperCase()} ${route}.`);
  }
}

const taskApiSource = readFileSync(resolve(checkout, "common/websocket/api.go"), "utf8");
for (const taskType of ["agent_scan", "ai_infra_scan", "mcp_scan", "model_redteam_report"]) {
  if (!taskApiSource.includes(`case \"${taskType}\":`)) {
    throw new Error(`Pinned AIG no longer handles task type ${taskType}.`);
  }
}

console.log(`Verified TrustLayer's AIG contract against ${lock.tag} (${head}).`);
console.log("Routes: task submission, status, and result");
console.log("Task types: agent, infrastructure, MCP, and model red-team");
