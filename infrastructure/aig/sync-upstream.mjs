import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const upstreamRoot = resolve(repositoryRoot, ".upstream");
const lock = JSON.parse(readFileSync(resolve(scriptDirectory, "upstream.lock.json"), "utf8"));

if (
  typeof lock.repository !== "string" ||
  typeof lock.tag !== "string" ||
  !/^[a-f0-9]{40}$/.test(lock.commit)
) {
  throw new Error("The AIG upstream lock is invalid.");
}

const requestedDestination = process.argv[2] ?? ".upstream/AI-Infra-Guard";
const destination = isAbsolute(requestedDestination)
  ? resolve(requestedDestination)
  : resolve(repositoryRoot, requestedDestination);
const destinationRelativeToUpstream = relative(upstreamRoot, destination);

if (
  destinationRelativeToUpstream === "" ||
  destinationRelativeToUpstream.startsWith("..") ||
  isAbsolute(destinationRelativeToUpstream)
) {
  throw new Error("The AIG checkout must remain inside the repository's .upstream directory.");
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

if (!existsSync(destination)) {
  mkdirSync(dirname(destination), { recursive: true });
  git([
    "clone",
    "--branch",
    lock.tag,
    "--depth",
    "1",
    "--single-branch",
    lock.repository,
    destination,
  ]);
} else {
  if (!existsSync(resolve(destination, ".git"))) {
    throw new Error(`Refusing to reuse a non-Git directory: ${destination}`);
  }

  const dirtyEntries = git(["-C", destination, "status", "--porcelain"], { capture: true })
    .split(/\r?\n/)
    .filter(Boolean);
  const windowsCheckoutCollisions = new Set([
    " D data/vuln_en/LiteLLM/CVE-2026-42208.yaml",
    " D data/vuln_en/LiteLLM/CVE-2026-42271.yaml",
  ]);
  const unexpectedChanges = dirtyEntries.filter(
    (entry) => process.platform !== "win32" || !windowsCheckoutCollisions.has(entry),
  );
  if (unexpectedChanges.length > 0) {
    throw new Error("The AIG checkout contains local changes. Preserve them before syncing.");
  }
  if (dirtyEntries.length > 0) {
    console.warn("Continuing past two known upstream case-collision omissions on Windows.");
  }

  const origin = git(["-C", destination, "remote", "get-url", "origin"], {
    capture: true,
  }).trim();
  if (origin.toLowerCase() !== lock.repository.toLowerCase()) {
    throw new Error(`Unexpected AIG origin: ${origin}`);
  }

  git(["-C", destination, "fetch", "--depth", "1", "origin", lock.commit]);
  git(["-C", destination, "checkout", "--detach", lock.commit]);
}

const head = git(["-C", destination, "rev-parse", "HEAD"], { capture: true }).trim();
if (head !== lock.commit) {
  throw new Error(`AIG revision mismatch. Expected ${lock.commit}, received ${head}.`);
}

console.log(`AI-Infra-Guard ${lock.tag} is pinned at ${head}`);
console.log(`Checkout: ${destination}`);
