import { claimEvidenceHandlers } from "@/lib/claims/handlers";
import { authorizeClaims } from "@/lib/claims/server";

export const { POST } = claimEvidenceHandlers(authorizeClaims);
