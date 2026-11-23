import { adminInterviewHandlers } from "@/lib/project-interview/handlers";
import { authorizeAdminInterviews } from "@/lib/project-interview/server";

export const maxDuration = 60;
export const { POST } = adminInterviewHandlers(authorizeAdminInterviews);
