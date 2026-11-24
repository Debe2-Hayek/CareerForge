import { languageHandlers } from "@/lib/languages-handlers";
import { authorizeLanguages } from "@/lib/languages-server";

export const { POST, DELETE } = languageHandlers(authorizeLanguages);
