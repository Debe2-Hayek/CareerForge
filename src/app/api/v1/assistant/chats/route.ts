import { assistantChats } from "@/lib/assistant/chats-server";
export const dynamic = "force-dynamic";
/** The list of saved chats (newest first), or DELETE to remove them all. */
export function GET(request: Request) { return assistantChats.list(request); }
export function DELETE(request: Request) { return assistantChats.removeAll(request); }
