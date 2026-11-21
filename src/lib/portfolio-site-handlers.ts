import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { privateWriteLimit } from "./account/attempt-limit";
import { siteStatusSchema, siteWriteSchema, type BuilderState } from "./portfolio-site";

export type PortfolioSiteAccess = {
  userId: string;
  read: () => Promise<unknown>;
  save: (state: BuilderState, revision: string | null) => Promise<unknown>;
  publish: (slug: string, revision: string) => Promise<unknown>;
  unpublish: () => Promise<unknown>;
};

// Room for a downscaled photo plus generous text; the database enforces its own cap.
const MAX_BODY_BYTES = 700_000;

export function portfolioSiteHandlers(authorize: () => Promise<PortfolioSiteAccess | null>, limit = privateWriteLimit) {
  const unavailable = () => failure("SITE_UNAVAILABLE", "Your portfolio site could not be saved or loaded. Your edits are still on this page; please retry.", 503);
  const status = (data: unknown) => {
    if (data && typeof data === "object") {
      if ("conflict" in data && data.conflict === true) return failure("CONFLICT", "Your portfolio changed in another tab or device. Reload to get the latest version before saving.", 409);
      if ("slugTaken" in data && data.slugTaken === true) return failure("SLUG_TAKEN", "That web address is already taken. Try another one.", 409);
    }
    const parsed = siteStatusSchema.safeParse(data);
    return parsed.success ? json(parsed.data) : unavailable();
  };
  return {
    async GET() {
      try {
        const access = await authorize();
        if (!access) return failure("UNAUTHORIZED", "Sign in to manage your portfolio site.", 401);
        return status(await access.read());
      } catch { return unavailable(); }
    },
    async PUT(request: Request) {
      if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
      try {
        const access = await authorize();
        if (!access) return failure("UNAUTHORIZED", "Sign in to manage your portfolio site.", 401);
        const body = await readBoundedJson(request, MAX_BODY_BYTES);
        if (body === null) return failure("TOO_LARGE", "This portfolio could not be read or is too large to save. Try a smaller photo and retry.", 413);
        const input = siteWriteSchema.safeParse(body);
        if (!input.success) {
          const slugIssue = input.error.issues.find(issue => issue.path.includes("slug"));
          return failure("INVALID_INPUT", slugIssue ? `Web address: ${slugIssue.message}.` : "Some portfolio content could not be saved. Check long text and the photo, then retry.", 400);
        }
        const wait = limit("site", access.userId);
        if (wait) {
          const response = failure("RATE_LIMITED", "Too many saves in a short time. Wait a moment and retry.", 429);
          response.headers.set("Retry-After", String(wait));
          return response;
        }
        const action = input.data;
        if (action.action === "save") return status(await access.save(action.state, action.revision));
        if (action.action === "publish") return status(await access.publish(action.slug, action.revision));
        return status(await access.unpublish());
      } catch { return unavailable(); }
    }
  };
}
