import { trustPageHandlers } from "@/lib/trust-page-handlers";
import { authorizeTrustPage } from "@/lib/trust-page-server";

export const { POST } = trustPageHandlers(authorizeTrustPage);
