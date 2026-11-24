import { z } from "zod";

/**
 * CareerForge-run workshops with verifiable certificates (requirement R4, migration
 * 202611250005). Shapes shared by the server, the pages and the tests.
 */
export const CERTIFICATE_KINDS = ["attendance", "assessed"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];
export const kindLabel: Record<CertificateKind, string> = { attendance: "Certificate of attendance", assessed: "Certificate of assessed completion" };
export const kindHelp: Record<CertificateKind, string> = {
  attendance: "Confirms the learner attended the whole workshop. It does not assess skill.",
  assessed: "Confirms the learner attended and passed the workshop's assessment."
};
/** Always shown with a certificate (requirement R4: no implied accreditation). */
export const CERTIFICATE_LIMITS = "A CareerForge workshop certificate is not an accredited qualification, a degree or proof of professional mastery.";

const datetime = z.string().refine(value => !Number.isNaN(Date.parse(value)), "Enter a valid date and time.");
export const workshopFieldsSchema = z.object({
  title: z.string().trim().min(3, "Give the workshop a title.").max(120),
  summary: z.string().trim().max(600).default(""),
  mode: z.enum(["online", "in_person"]),
  location: z.string().trim().max(120).default(""),
  startsAt: datetime, endsAt: datetime,
  capacity: z.number().int().min(1).max(500),
  certificateKind: z.enum(CERTIFICATE_KINDS),
  passMark: z.number().int().min(1).max(100).nullable().default(null),
  trainerDisplay: z.string().trim().max(80).default(""),
  agreementNote: z.string().trim().max(300).default(""),
  status: z.enum(["draft", "open", "closed", "cancelled"]).default("draft")
}).strict().superRefine((value, context) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) context.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start." });
  if (value.certificateKind === "assessed" && value.passMark === null) context.addIssue({ code: "custom", path: ["passMark"], message: "Set the pass mark for an assessed workshop." });
}).transform(value => ({ ...value, passMark: value.certificateKind === "assessed" ? value.passMark : null }));
export type WorkshopFields = z.output<typeof workshopFieldsSchema>;

export const workshopRowSchema = z.object({
  id: z.uuid(), title: z.string(), summary: z.string(), mode: z.enum(["online", "in_person"]), location: z.string(),
  starts_at: z.string(), ends_at: z.string(), capacity: z.number(), certificate_kind: z.enum(CERTIFICATE_KINDS), pass_mark: z.number().nullable(),
  trainer_display: z.string(), status: z.enum(["draft", "open", "closed", "cancelled"])
}).transform(row => ({
  id: row.id, title: row.title, summary: row.summary, mode: row.mode, location: row.location, startsAt: row.starts_at, endsAt: row.ends_at,
  capacity: row.capacity, certificateKind: row.certificate_kind, passMark: row.pass_mark, trainerDisplay: row.trainer_display, status: row.status
}));
export type CertifiedWorkshop = z.output<typeof workshopRowSchema>;

export const rosterSchema = z.object({
  agreementNote: z.string().nullable().catch(null), trainerEmail: z.string().nullable().catch(null), hasTrainer: z.boolean().catch(false),
  learners: z.array(z.object({
    enrollmentId: z.uuid(), name: z.string(), status: z.enum(["enrolled", "withdrawn"]), attended: z.boolean().nullable(), score: z.number().nullable(), showName: z.boolean(),
    certificate: z.object({ id: z.uuid(), issuedAt: z.string(), revokedAt: z.string().nullable() }).nullable()
  }))
});
export type Roster = z.infer<typeof rosterSchema>;

export const certificateCheckSchema = z.object({
  id: z.uuid(), kind: z.enum(CERTIFICATE_KINDS), scope: z.string(), holderName: z.string().nullable(), issuedAt: z.string(), revokedAt: z.string().nullable(),
  workshop: z.object({ title: z.string(), mode: z.enum(["online", "in_person"]), startsAt: z.string(), endsAt: z.string(), trainer: z.string().nullable() })
});
export type CertificateCheck = z.infer<typeof certificateCheckSchema>;

/** Who would receive a certificate now, by the same rule the database applies. */
export function eligible(learner: Roster["learners"][number], workshop: Pick<CertifiedWorkshop, "certificateKind" | "passMark">): boolean {
  return learner.status === "enrolled" && learner.attended === true && !learner.certificate
    && (workshop.certificateKind === "attendance" || (learner.score ?? -1) >= (workshop.passMark ?? 101));
}

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
/** "12 Dec 2026, 16:00–18:00 UTC" (one day) or "12 Dec 2026 – 13 Dec 2026". */
export function sessionText(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return day.format(start) === day.format(end) ? `${day.format(start)}, ${time.format(start)}–${time.format(end)} UTC` : `${day.format(start)} – ${day.format(end)}`;
}
export const formatDay = (value: string) => day.format(new Date(value));
