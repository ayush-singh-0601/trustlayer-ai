import type { OrganizationRole } from "@trustlayer/contracts";

export interface AuthContext {
  userId: string;
  identitySubject: string;
  organizationId: string;
  role: OrganizationRole;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

