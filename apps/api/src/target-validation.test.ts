import { describe, expect, it } from "vitest";
import {
  isPublicAddress,
  validateLocalScanTarget,
  validatePublicHttpsTarget,
} from "@trustlayer/scanner-sdk";

describe("active scan target validation", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.2", "::1", "fd00::1", "fe80::1"])(
    "rejects non-public address %s",
    (address) => expect(isPublicAddress(address)).toBe(false),
  );

  it("rejects DNS names when any answer is private", async () => {
    await expect(
      validatePublicHttpsTarget("https://agent.example.com", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ]),
    ).rejects.toThrow("private, local, reserved, or metadata");
  });

  it("accepts an HTTPS target resolving entirely to public addresses", async () => {
    await expect(
      validatePublicHttpsTarget("https://agent.example.com", async () => [
        { address: "93.184.216.34", family: 4 },
      ]),
    ).resolves.toBeInstanceOf(URL);
  });

  it("accepts HTTP for an explicitly local target", async () => {
    await expect(
      validateLocalScanTarget("http://localhost:11434", async () => [
        { address: "127.0.0.1", family: 4 },
      ]),
    ).resolves.toBeInstanceOf(URL);
  });

  it("still blocks cloud metadata and public plaintext HTTP", async () => {
    await expect(
      validateLocalScanTarget("http://metadata.local", async () => [
        { address: "169.254.169.254", family: 4 },
      ]),
    ).rejects.toThrow("link-local");
    await expect(
      validateLocalScanTarget("http://public.example.com", async () => [
        { address: "93.184.216.34", family: 4 },
      ]),
    ).rejects.toThrow("must use HTTPS");
  });
});
