import { describe, expect, it } from "vitest";
import { redactDeep } from "./redaction.js";

describe("scanner evidence redaction", () => {
  it("redacts nested secret keys", () => {
    expect(redactDeep({ headers: { Authorization: "Bearer secret" }, api_key: "key" })).toEqual({
      headers: { Authorization: "[REDACTED]" },
      api_key: "[REDACTED]",
    });
  });

  it("redacts URL credentials, secret query values, and JWT-like values", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature";
    const value = `connect https://user:password@example.com/path?access_token=secret-value&safe=yes with ${jwt}`;
    const redacted = String(redactDeep(value));

    expect(redacted).not.toContain("user");
    expect(redacted).not.toContain("password");
    expect(redacted).not.toContain("secret-value");
    expect(redacted).not.toContain(jwt);
    expect(redacted).toContain("safe=yes");
  });
});
