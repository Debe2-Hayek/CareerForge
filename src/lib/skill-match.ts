import { ALIASES, RELATED, SHOWS } from "../data/skill-relations";

/**
 * Matching one required skill against a profile's skills, using the reviewed relations in
 * src/data/skill-relations.ts (proposed by a Hugging Face embedding model, kept by a person).
 * Plain code: safe in the browser and on the server, and always gives the same answer.
 */
export type SkillLink = { relation: "exact" | "shows" | "related"; via: string };

const norm = (value: string) => value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}+#./ ]+/gu, " ").replace(/\s+/g, " ").trim();
const key = (value: string) => norm(value).replace(/[ .]/g, "");
const canonicalByKey = new Map<string, string>();
for (const name of [...Object.keys(SHOWS), ...Object.values(SHOWS).flat(), ...RELATED.flat()]) canonicalByKey.set(key(name), name);
for (const [alias, name] of Object.entries(ALIASES)) canonicalByKey.set(key(alias), name);

/** The usual name for a skill as people type it ("postgres" → "PostgreSQL"); unknown names stay as typed. */
export function canonicalSkill(name: string): string {
  return canonicalByKey.get(key(name)) ?? name.trim();
}
export const sameSkill = (a: string, b: string) => key(canonicalSkill(a)) === key(canonicalSkill(b));

/** Everything a skill demonstrates, following SHOWS transitively ("Next.js" → React → JavaScript). */
export function demonstrated(name: string): string[] {
  const seen = new Set<string>();
  const queue = [canonicalSkill(name)];
  while (queue.length) {
    for (const next of SHOWS[queue.shift()!] ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return [...seen];
}

/**
 * How the profile covers a required skill: the same skill, a skill that shows it, or a related
 * alternative. Null when nothing on the profile covers it.
 */
export function linkSkill(required: string, profile: string[]): SkillLink | null {
  const exact = profile.find(own => sameSkill(own, required));
  if (exact) return { relation: "exact", via: exact };
  const shows = profile.find(own => demonstrated(own).some(skill => sameSkill(skill, required)));
  if (shows) return { relation: "shows", via: shows };
  const group = RELATED.find(names => names.some(name => sameSkill(name, required)));
  const related = group && profile.find(own => group.some(name => sameSkill(name, own)));
  return related ? { relation: "related", via: related } : null;
}
