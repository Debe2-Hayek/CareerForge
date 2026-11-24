import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { languageRowSchema, type ProfileLanguage } from "./languages";
import { LanguageError, type LanguageAccess } from "./languages-handlers";

const COLUMNS = "id,language,level,test,score,test_date,revision";

/** The owner's languages, oldest first. */
export async function readLanguages(client: SupabaseClient, userId: string): Promise<ProfileLanguage[]> {
  const { data, error } = await client.from("profile_languages").select(COLUMNS).eq("user_id", userId).order("created_at");
  if (error) throw new Error("Languages unavailable");
  return z.array(languageRowSchema).parse(data ?? []);
}

export async function authorizeLanguages(): Promise<(LanguageAccess & { client: SupabaseClient }) | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  return {
    userId: user.id, client,
    async save(id, fields) {
      const { data, error: failed } = await client.rpc("save_profile_language", {
        p_id: id, p_language: fields.language, p_level: fields.level, p_test: fields.test, p_score: fields.score, p_test_date: fields.testDate
      });
      if (failed) {
        if (failed.code === "23505") throw new LanguageError("LANGUAGE_EXISTS", "This language is already on your profile.", 409);
        if (failed.message?.includes("LANGUAGE_LIMIT_REACHED")) throw new LanguageError("LANGUAGE_LIMIT", "You can list up to 10 languages.", 409);
        if (failed.code === "P0002") throw new LanguageError("NOT_FOUND", "This language is no longer on your profile. Reload the page.", 404);
        if (failed.code === "22023" || failed.code === "23514") throw new LanguageError("INVALID_INPUT", "Check the language, level, score and date.", 400);
        throw new Error("Language could not be saved");
      }
      return languageRowSchema.parse(data);
    },
    async remove(id) {
      const { error: failed } = await client.rpc("delete_profile_language", { p_id: id });
      if (failed) {
        if (failed.code === "P0002") throw new LanguageError("NOT_FOUND", "This language is no longer on your profile. Reload the page.", 404);
        throw new Error("Language could not be removed");
      }
    }
  };
}
