import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkshopError, type WorkshopAccess } from "./handlers";
import { workshopService } from "./service";
import type { WorkshopCatalog } from "./types";

// Bookmarks use the signed-in learner's Supabase session, so row-level security
// (supabase/migrations/202611230001_workshop_bookmarks.sql) applies.

async function readBookmarks(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from("workshop_bookmarks").select("workshop_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error("Bookmarks unavailable");
  return (data ?? []).map(row => String(row.workshop_id));
}

export function workshopAccess(client: SupabaseClient, userId: string): WorkshopAccess {
  return {
    userId,
    async setBookmark(workshopId, saved) {
      if (!saved) {
        const { error } = await client.from("workshop_bookmarks").delete().eq("user_id", userId).eq("workshop_id", workshopId);
        if (error) throw error;
        return;
      }
      const { error } = await client.from("workshop_bookmarks").insert({ user_id: userId, workshop_id: workshopId });
      // Already saved, perhaps from another tab: the wanted state holds.
      if (!error || error.code === "23505") return;
      if (error.code === "23514") throw new WorkshopError("LIMIT_REACHED", "You can save up to 300 workshops. Remove one and retry.", 409);
      throw error;
    }
  };
}

export async function authorizeWorkshops(): Promise<WorkshopAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  return user ? workshopAccess(client, user.id) : null;
}

export type WorkshopsPageData =
  | { status: "unavailable" }
  | {
    status: "ready";
    displayName: string;
    catalog: WorkshopCatalog;
    /** null when account storage is unavailable; the page then saves on this device. */
    bookmarks: string[] | null;
    /** Separates device storage between accounts sharing a browser without exposing the account id. */
    deviceScope: string;
    /** Request time, so the first paint already hides anything that has ended. */
    now: number;
  };

export async function loadWorkshopsPage(): Promise<WorkshopsPageData> {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let client: SupabaseClient;
  let userId: string | null = null;
  try {
    client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user) userId = user.id;
  } catch { return { status: "unavailable" }; }
  if (!userId) redirect("/login");
  const [profile, bookmarks, catalog] = await Promise.all([
    client.from("profiles").select("full_name").eq("id", userId).single(),
    readBookmarks(client, userId).catch(() => null),
    workshopService.catalog()
  ]);
  if (profile.error || !profile.data) return { status: "unavailable" };
  return {
    status: "ready", displayName: String(profile.data.full_name ?? ""), catalog, bookmarks, now: Date.now(),
    deviceScope: createHash("sha256").update(`workshops:${userId}`).digest("hex").slice(0, 16)
  };
}
