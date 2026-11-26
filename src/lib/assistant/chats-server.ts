import "server-only";
import { signedInClient } from "../cv-analysis/server";
import { chatHandlers, chatStore } from "./chats";

/** The signed-in person's own chats (row-level security keeps everyone else's out). */
export const assistantChats = chatHandlers(async () => {
  const session = await signedInClient();
  return session ? chatStore(session.client) : null;
});
