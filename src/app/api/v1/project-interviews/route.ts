import { studentInterviewHandlers } from "@/lib/project-interview/handlers";
import { authorizeStudentInterviews } from "@/lib/project-interview/server";

export const maxDuration = 60;
export const { POST } = studentInterviewHandlers(authorizeStudentInterviews);
