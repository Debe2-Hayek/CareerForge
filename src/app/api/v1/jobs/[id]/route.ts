import { trackerHandlers } from "@/lib/tracker/handlers";
import { authorizeTracker } from "@/lib/tracker/server";
const handlers = trackerHandlers(authorizeTracker);
type Context = { params: Promise<{ id: string }> };
/** One job with its full description, for the role dialog when the list only sent an excerpt. */
export async function GET(request: Request, context: Context) { return handlers.job(request, (await context.params).id); }
