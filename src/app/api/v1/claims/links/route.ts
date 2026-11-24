import { claimLinkHandlers } from "@/lib/claims/handlers";
import { authorizeClaims } from "@/lib/claims/server";

export const { POST } = claimLinkHandlers(authorizeClaims);
