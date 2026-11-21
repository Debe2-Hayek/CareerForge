import { z } from "zod";

// Saved state of the visual CV & Portfolio builder and its published website.
// Everything is validated on write (API) and again before public rendering, so a
// client that bypasses the API still cannot publish unsafe or malformed content.

const text = (max: number) => z.string().max(max);
const short = text(200);
const long = text(4000);

// Images only, as base64 data URLs (no remote URLs, no SVG which can carry script).
export const PHOTO_MAX_CHARS = 450_000;
const photoSchema = z.string().max(PHOTO_MAX_CHARS).regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/);

const experienceSchema = z.object({
  company: short.default(""), title: short.default(""), period: short.default(""),
  location: short.optional(), bullets: z.array(long).max(12).default([])
}).strip();
const educationSchema = z.object({
  school: short.default(""), degree: short.default(""), period: short.default(""),
  location: short.optional(), details: long.optional()
}).strip();
const projectSchema = z.object({ name: short.default(""), description: long.default(""), link: short.optional() }).strip();

export const builderDataSchema = z.object({
  name: short.default(""), role: short.default(""), summary: long.default(""),
  email: short.default(""), phone: short.default(""), linkedin: short.default(""), github: short.default(""),
  website: short.default(""), location: short.default(""), interests: long.optional(),
  experience: z.array(experienceSchema).max(20).default([]),
  // "Leadership & Activities" in the Professional bullet CV (same shape as experience).
  activities: z.array(experienceSchema).max(20).default([]),
  education: z.array(educationSchema).max(12).default([]),
  skills: z.array(short).max(60).default([]),
  languages: z.array(short).max(20).default([]),
  projects: z.array(projectSchema).max(24).default([])
}).strip();

export const builderStateSchema = z.object({
  notes: text(8000).default(""),
  data: builderDataSchema,
  theme: z.enum(["indigo", "emerald", "rose", "amber", "sky"]).default("indigo"),
  custom: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  mode: z.enum(["dark", "light"]).default("dark"),
  photo: photoSchema.nullable().default(null),
  cvPhoto: z.boolean().default(true),
  cvStyle: z.enum(["bullet", "modern", "ats"]).default("bullet")
}).strip();
export type BuilderState = z.infer<typeof builderStateSchema>;

// The published site never includes private notes or CV-only preferences.
export function toPublishedState(state: BuilderState) {
  return { data: state.data, theme: state.theme, custom: state.custom, mode: state.mode, photo: state.photo };
}
export const publishedStateSchema = builderStateSchema.pick({ data: true, theme: true, custom: true, mode: true, photo: true });
export type PublishedState = z.infer<typeof publishedStateSchema>;

// Web addresses: /u/<slug>. Lower-case words joined by hyphens, 3-40 characters.
const reserved = new Set(["admin", "api", "app", "careerforge", "login", "logout", "register", "settings", "support", "help", "about", "privacy", "terms", "www", "null", "undefined", "me", "account"]);
export const siteSlugSchema = z.string().trim().toLowerCase().min(3).max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single hyphens")
  .refine(value => !reserved.has(value), "That address is reserved");

export function suggestSlug(name: string) {
  const slug = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  return siteSlugSchema.safeParse(slug).success ? slug : "";
}

export const siteWriteSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), state: builderStateSchema, revision: z.uuid().nullable() }).strict(),
  z.object({ action: z.literal("publish"), slug: siteSlugSchema, revision: z.uuid() }).strict(),
  z.object({ action: z.literal("unpublish") }).strict()
]);
export type SiteWrite = z.infer<typeof siteWriteSchema>;

export const siteStatusSchema = z.object({
  draft: builderStateSchema.nullable(),
  revision: z.uuid().nullable(),
  slug: z.string().nullable(),
  isPublic: z.boolean(),
  publishedAt: z.string().nullable(),
  /** The live site differs from the saved draft. */
  hasUnpublishedChanges: z.boolean()
});
export type SiteStatus = z.infer<typeof siteStatusSchema>;
