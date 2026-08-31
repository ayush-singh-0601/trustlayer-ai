import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

export const systemHostResolver: HostResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true }).then((addresses) =>
    addresses.map(({ address, family }) => ({ address, family })),
  );

export async function validatePublicHttpsTarget(target: string, resolveHost: HostResolver = systemHostResolver): Promise<URL> {
  const url = new URL(target);
  if (url.protocol !== "https:") throw new UnsafeTargetError("Only HTTPS targets are accepted");
  if (url.username || url.password) throw new UnsafeTargetError("Target URLs cannot contain credentials");
  if (url.port && url.port !== "443") throw new UnsafeTargetError("MVP scans are restricted to HTTPS port 443");

  const hostname = normalizedHostname(url);
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveHost(hostname);
  if (addresses.length === 0) throw new UnsafeTargetError("Target hostname did not resolve");
  if (addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UnsafeTargetError("Target resolves to a private, local, reserved, or metadata address");
  }
  return url;
}

export async function validateLocalScanTarget(
  target: string,
  resolveHost: HostResolver = systemHostResolver,
): Promise<URL> {
  const url = new URL(target);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeTargetError("Only HTTP and HTTPS targets are accepted");
  }
  if (url.username || url.password) throw new UnsafeTargetError("Target URLs cannot contain credentials");

  const hostname = normalizedHostname(url);
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveHost(hostname);
  if (addresses.length === 0) throw new UnsafeTargetError("Target hostname did not resolve");
  const publicFlags = addresses.map(({ address }) => isPublicAddress(address));
  const localFlags = addresses.map(({ address }) => isLocalAddress(address));
  if (addresses.some((_, index) => !publicFlags[index] && !localFlags[index])) {
    throw new UnsafeTargetError("Target resolves to a link-local, metadata, multicast, or reserved address");
  }
  if (publicFlags.some(Boolean) && localFlags.some(Boolean)) {
    throw new UnsafeTargetError("Target mixes public and local DNS addresses");
  }
  if (url.protocol === "http:" && publicFlags.every(Boolean)) {
    throw new UnsafeTargetError("Public targets must use HTTPS");
  }
  return url;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function isLocalAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd");
  }
  return false;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 0) return false;
  if (first === 192 && second === 2) return false;
  if (first === 192 && second === 88) return false;
  if (first === 192 && second === 168) return false;
  if (first === 198 && (second === 18 || second === 19)) return false;
  if (first === 198 && second === 51) return false;
  if (first === 203 && second === 0) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("::") && !normalized.startsWith("::ffff:")) return false;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  if (/^fe[89abcdef]/.test(normalized)) return false;
  if (normalized.startsWith("ff")) return false;
  if (normalized.startsWith("64:ff9b:") || normalized.startsWith("100:")) return false;
  if (normalized.startsWith("2001:0:") || normalized.startsWith("2001:10:") || normalized.startsWith("2001:20:")) return false;
  if (normalized.startsWith("2001:db8:")) return false;
  if (normalized.startsWith("2002:")) return false;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 && isPublicIpv4(mapped);
  }
  return true;
}

function normalizedHostname(url: URL): string {
  return url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
}
