import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { certificateCheckSchema, rosterSchema, workshopRowSchema, type CertificateCheck, type CertifiedWorkshop, type Roster } from "./certified-workshops";
import { WorkshopError, type AdminAccess, type LearnerAccess, type StaffAccess } from "./certified-workshops-handlers";

const COLUMNS = "id,title,summary,mode,location,starts_at,ends_at,capacity,certificate_kind,pass_mark,trainer_display,status";

async function signedIn(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  return user;
}

function failed(error: { code?: string; message?: string }): never {
  const message = error.message ?? "";
  if (error.code === "42501") throw new WorkshopError("FORBIDDEN", "You are not staff for this workshop.", 403);
  if (error.code === "P0002") throw new WorkshopError("NOT_FOUND", message.includes("open") ? "This workshop is not open for enrollment." : message.includes("enrolled") ? "You are not enrolled." : "This item no longer exists. Reload the page.", 404);
  if (error.code === "23514") throw new WorkshopError("FULL", "This workshop is full.", 409);
  if (error.code === "55000") {
    const reasons: [string, string][] = [
      ["already started", "The workshop has already started."], ["has not started", "Attendance can be recorded once the workshop starts."],
      ["has not ended", "Certificates can be issued once the workshop ends."], ["agreement required", "Assign a trainer and record the trainer agreement first."],
      ["already issued", "This learner's certificate is already issued; revoke it to correct it."], ["withdrew", "This learner withdrew."],
      ["not running", "Open the workshop before issuing certificates."], ["locked", "Certificates are issued, so the certificate type and pass mark can no longer change."]
    ];
    throw new WorkshopError("NOT_ALLOWED", reasons.find(([key]) => message.includes(key))?.[1] ?? "This is not allowed right now.", 409);
  }
  if (error.code === "22023") throw new WorkshopError("INVALID_INPUT", message.includes("reason") ? "A reason is required to revoke." : "Check the values.", 400);
  throw new Error("Workshops storage unavailable");
}

/** Workshops the signed-in user may see: open and closed ones, plus drafts for staff. */
export async function readWorkshops(client: SupabaseClient): Promise<CertifiedWorkshop[]> {
  const { data, error } = await client.from("certified_workshops").select(COLUMNS).order("starts_at");
  if (error) throw new Error("Workshops unavailable");
  return z.array(workshopRowSchema).parse(data ?? []);
}

export type LearnerView = {
  workshops: CertifiedWorkshop[];
  enrollments: { workshopId: string; status: "enrolled" | "withdrawn"; showName: boolean; attended: boolean | null }[];
  certificates: { id: string; workshopId: string; kind: "attendance" | "assessed"; scope: string; issuedAt: string; revokedAt: string | null }[];
  teaching: string[];
};
export async function readLearnerView(client: SupabaseClient, userId: string): Promise<LearnerView> {
  const [workshops, enrollments, certificates, teaching] = await Promise.all([
    readWorkshops(client),
    client.from("workshop_enrollments").select("workshop_id,status,show_name,attended").eq("user_id", userId),
    client.from("workshop_certificates").select("id,workshop_id,kind,scope,issued_at,revoked_at").eq("user_id", userId).order("issued_at", { ascending: false }),
    client.rpc("my_taught_workshops")
  ]);
  if (enrollments.error || certificates.error || teaching.error) throw new Error("Workshops unavailable");
  return {
    workshops,
    enrollments: (enrollments.data ?? []).map(row => ({ workshopId: row.workshop_id, status: row.status, showName: row.show_name, attended: row.attended })),
    certificates: (certificates.data ?? []).map(row => ({ id: row.id, workshopId: row.workshop_id, kind: row.kind, scope: row.scope, issuedAt: row.issued_at, revokedAt: row.revoked_at })),
    teaching: z.array(z.uuid()).catch([]).parse(teaching.data ?? [])
  };
}

export async function readRoster(client: SupabaseClient, workshopId: string): Promise<Roster> {
  const { data, error } = await client.rpc("certified_workshop_roster", { p_workshop: workshopId });
  if (error) failed(error);
  return rosterSchema.parse(data);
}

/** Public: a certificate's verification record, or null when the id is unknown. */
export async function verifyCertificate(id: string): Promise<CertificateCheck | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("verify_workshop_certificate", { p_id: id }).abortSignal(AbortSignal.timeout(10000));
  if (error) throw new Error("Certificate check unavailable");
  const parsed = certificateCheckSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function authorizeLearner(): Promise<LearnerAccess | null> {
  const client = await createClient();
  const user = await signedIn(client);
  if (!user) return null;
  return {
    userId: user.id,
    async enroll(workshopId, showName) { const { error } = await client.rpc("enroll_certified_workshop", { p_workshop: workshopId, p_show_name: showName }); if (error) failed(error); },
    async withdraw(workshopId) { const { error } = await client.rpc("withdraw_certified_workshop", { p_workshop: workshopId }); if (error) failed(error); }
  };
}

export async function authorizeStaff(): Promise<StaffAccess | null> {
  const client = await createClient();
  const user = await signedIn(client);
  if (!user) return null;
  return {
    userId: user.id,
    async mark(enrollmentId, attended, score) { const { error } = await client.rpc("mark_workshop_completion", { p_enrollment: enrollmentId, p_attended: attended, p_score: score }); if (error) failed(error); },
    async issue(workshopId) { const { data, error } = await client.rpc("issue_workshop_certificates", { p_workshop: workshopId }); if (error) failed(error); return z.number().parse(data); },
    async revoke(certificateId, reason) { const { error } = await client.rpc("revoke_workshop_certificate", { p_certificate: certificateId, p_reason: reason }); if (error) failed(error); }
  };
}

export async function authorizeWorkshopAdmin(): Promise<(AdminAccess & { client: SupabaseClient }) | null> {
  const client = await createClient();
  const user = await signedIn(client);
  if (!user) return null;
  const { data, error } = await client.rpc("careerforge_is_admin");
  if (error) throw new Error("Role check unavailable");
  if (data !== true) return null;
  return {
    userId: user.id, client,
    async save(id, fields) { const { data: saved, error: problem } = await client.rpc("save_certified_workshop", { p_id: id, p: fields }); if (problem) failed(problem); return z.uuid().parse(saved); },
    async assign(workshopId, email) { const { data: done, error: problem } = await client.rpc("assign_workshop_trainer", { p_workshop: workshopId, p_email: email }); if (problem) failed(problem); return done === true; }
  };
}
