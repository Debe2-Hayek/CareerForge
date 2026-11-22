import { z } from "zod";
import { privateWriteLimit } from "@/lib/account/attempt-limit";
import { failure, isSameOrigin, json } from "@/lib/account/http";
import { readBoundedJson } from "@/lib/account/request-body";
import { mergeWorkshops } from "./discovery";
import { buildSubmission } from "./submission";
import { suggestionInputSchema, type OwnSuggestion } from "./suggestions";
import { workshopIdSchema, type Workshop, type WorkshopCatalog } from "./types";

export const bookmarkInputSchema = z.object({ workshopId: workshopIdSchema, saved: z.boolean() }).strict();

export class WorkshopError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export type WorkshopAccess = {
  userId: string;
  setBookmark: (workshopId: string, saved: boolean) => Promise<void>;
  /** Reviewed community workshops; empty when they cannot be read. */
  approved: () => Promise<Workshop[]>;
  suggestions: () => Promise<OwnSuggestion[]>;
  addSuggestion: (workshop: Workshop) => Promise<void>;
  /** False when there is nothing the owner may change (missing or already reviewed). */
  setSuggested: (workshopId: string, suggested: boolean) => Promise<boolean>;
  removeSuggestion: (workshopId: string) => Promise<void>;
};

export function workshopHandlers(authorize: () => Promise<WorkshopAccess | null>, catalog: () => Promise<WorkshopCatalog>, limit = privateWriteLimit, now = Date.now) {
  /** The shared catalogue plus what operators approved, as this learner sees it. */
  async function catalogFor(access: WorkshopAccess): Promise<WorkshopCatalog> {
    const [shared, approved] = await Promise.all([catalog(), access.approved()]);
    return { ...shared, workshops: mergeWorkshops(shared.workshops, approved) };
  }
  function limited(access: WorkshopAccess): Response | null {
    const wait = limit("workshops", access.userId);
    if (!wait) return null;
    const response = failure("RATE_LIMITED", "Too many changes. Wait a moment and retry.", 429);
    response.headers.set("Retry-After", String(wait));
    return response;
  }
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
    GET: (request: Request) => run(request, async access => {
      if (new URL(request.url).search) return failure("INVALID_INPUT", "This endpoint takes no parameters.", 400);
      return json(await catalogFor(access));
    }),
    bookmark: (request: Request) => run(request, async access => {
      const parsed = bookmarkInputSchema.safeParse(await readBoundedJson(request, 512));
      if (!parsed.success) return failure("INVALID_INPUT", "Choose a workshop to save or remove.", 400);
      // Removing must always work, even after a workshop has left the catalogue.
      if (parsed.data.saved && !(await catalogFor(access)).workshops.some(workshop => workshop.id === parsed.data.workshopId)) {
        return failure("NOT_FOUND", "This workshop is no longer available.", 404);
      }
      const denied = limited(access);
      if (denied) return denied;
      await access.setBookmark(parsed.data.workshopId, parsed.data.saved);
      return json({ saved: parsed.data.saved });
    }),
    suggestion: (request: Request) => run(request, async access => {
      const parsed = suggestionInputSchema.safeParse(await readBoundedJson(request, 4096));
      if (!parsed.success) return failure("INVALID_INPUT", "Check the workshop and try again.", 400);
      const denied = limited(access);
      if (denied) return denied;
      const change = parsed.data;
      if (change.action === "add") {
        const [shared, own] = await Promise.all([catalogFor(access), access.suggestions()]);
        const built = await buildSubmission(change.input, [...shared.workshops, ...own.map(item => item.workshop)], now());
        if ("errors" in built) return json({ error: { code: "INVALID_INPUT", message: Object.values(built.errors)[0] ?? "Check the workshop and try again.", fields: built.errors } }, 400);
        await access.addSuggestion(built.workshop);
        return json({ workshop: built.workshop }, 201);
      }
      if (change.action === "remove") { await access.removeSuggestion(change.workshopId); return json({ removed: true }); }
      const changed = await access.setSuggested(change.workshopId, change.action === "suggest");
      return changed ? json({ status: change.action === "suggest" ? "pending" : "private" }) : failure("CONFLICT", "This workshop has already been reviewed. Refresh the page.", 409);
    })
  };
}
