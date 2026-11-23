import { skillDraftHandlers } from "@/lib/skill-check-drafts-handlers";
import { authorizeDrafts } from "@/lib/skill-check-drafts-server";

export const maxDuration = 60;
export const { POST } = skillDraftHandlers(authorizeDrafts);
