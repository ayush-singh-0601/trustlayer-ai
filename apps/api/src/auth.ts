import type { FastifyRequest } from "fastify";
import type { OrganizationRole } from "@trustlayer/contracts";
import type { AuthContext } from "./types.js";

export type AuthResolver = (request: FastifyRequest) => Promise<AuthContext>;

export class AuthenticationError extends Error {
  constructor(message = "Authentication is required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function createDevelopmentAuthResolver(options: {
  userId: string;
  organizationId: string;
  email?: string;
  role?: OrganizationRole;
}): AuthResolver {
  const context: AuthContext = {
    userId: options.userId,
    identitySubject: `development:${options.userId}`,
    organizationId: options.organizationId,
    role: options.role ?? "owner",
    email: options.email ?? "founder@trustlayer.local",
  };
  return async () => context;
}

const roleCapabilities: Readonly<Record<OrganizationRole, ReadonlySet<string>>> = {
  owner: new Set(["read", "manage_assets", "run_scans", "manage_members", "view_evidence"]),
  admin: new Set(["read", "manage_assets", "run_scans", "manage_members", "view_evidence"]),
  security_analyst: new Set(["read", "manage_assets", "run_scans", "view_evidence"]),
  viewer: new Set(["read"]),
};

export function requireCapability(context: AuthContext, capability: string): void {
  if (!roleCapabilities[context.role].has(capability)) throw new AuthorizationError();
}
