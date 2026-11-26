import { assistantChats } from "@/lib/assistant/chats-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** One saved chat with its messages; PATCH renames it, DELETE removes it. */
export async function GET(request: Request, context: Context) { return assistantChats.get(request, (await context.params).id); }
export async function PATCH(request: Request, context: Context) { return assistantChats.rename(request, (await context.params).id); }
export async function DELETE(request: Request, context: Context) { return assistantChats.remove(request, (await context.params).id); }
