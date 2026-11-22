import { z } from "zod";
import { privateWriteLimit } from "@/lib/account/attempt-limit";
import { failure, isSameOrigin, json } from "@/lib/account/http";
import { readBoundedJson } from "@/lib/account/request-body";
import { workshopIdSchema, type WorkshopCatalog } from "./types";

export const bookmarkInputSchema = z.object({ workshopId: workshopIdSchema, saved: z.boolean() }).strict();

export class WorkshopError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export type WorkshopAccess = {
  userId: string;
  setBookmark: (workshopId: string, saved: boolean) => Promise<void>;
};

export function workshopHandlers(authorize: () => Promise<WorkshopAccess | null>, catalog: () => Promise<WorkshopCatalog>, limit = privateWriteLimit) {
  const unavailable = () => failure("WORKSHOPS_UNAVAILABLE", "Workshops could not be loaded or saved. Please retry.", 503);
  async function run(request: Request, action: (access: WorkshopAccess) => Promise<Response>) {
    if (request.method !== "GET" && !isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    try {
      const access = await authorize();
      if (!access) return failure("UNAUTHORIZED", "Sign in to use workshops.", 401);
      return await action(access);
    } catch (error) {
      if (error instanceof WorkshopError) return failure(error.code, error.message, error.status);
      return unavailable();
    }
  }
  return {
    GET: (request: Request) => run(request, async () => {
      if (new URL(request.url).search) return failure("INVALID_INPUT", "This endpoint takes no parameters.", 400);
      return json(await catalog());
    }),
    bookmark: (request: Request) => run(request, async access => {
      const parsed = bookmarkInputSchema.safeParse(await readBoundedJson(request, 512));
      if (!parsed.success) return failure("INVALID_INPUT", "Choose a workshop to save or remove.", 400);
      // Removing must always work, even after a workshop has left the catalogue.
      if (parsed.data.saved && !(await catalog()).workshops.some(workshop => workshop.id === parsed.data.workshopId)) {
        return failure("NOT_FOUND", "This workshop is no longer available.", 404);
      }
      const wait = limit("workshops", access.userId);
      if (wait) {
        const response = failure("RATE_LIMITED", "Too many changes. Wait a moment and retry.", 429);
        response.headers.set("Retry-After", String(wait));
        return response;
      }
      await access.setBookmark(parsed.data.workshopId, parsed.data.saved);
      return json({ saved: parsed.data.saved });
    })
  };
}
