import { z } from "zod";
import roadmapDocument from "@/data/learning-roadmaps.json";
import { normalizeSkill } from "./demo-workspace";

const httpsUrl = z.string().url().refine(value => new URL(value).protocol === "https:");
const roadmapUrl = httpsUrl.refine(value => new URL(value).hostname === "roadmap.sh");

const topicSchema = z.object({
  title: z.string().min(1),
  skillAliases: z.array(z.string().min(1)).min(1),
  focus: z.string().min(1),
  task: z.string().min(1),
  doneWhen: z.string().min(1),
  sourceUrl: roadmapUrl
}).strict();

const capstoneSchema = z.object({
  title: z.string().min(1),
  brief: z.string().min(1),
  proof: z.string().min(1)
}).strict();

const phaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  topicIds: z.array(z.string().min(1)).min(1)
}).strict();

const trackSchema = z.object({
  id: z.enum(["frontend", "backend", "full-stack", "data-analyst", "ux-design", "devops"]),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  audience: z.string().min(1),
  outcome: z.string().min(1),
  sourceUrl: roadmapUrl,
  keywords: z.array(z.string().min(1)).min(1),
  phases: z.array(phaseSchema).min(1),
  capstone: capstoneSchema
}).strict();

const learningRoadmapsSchema = z.object({
  version: z.number().int().positive(),
  source: z.object({
    name: z.literal("roadmap.sh"),
    url: roadmapUrl,
    repository: httpsUrl,
    reviewedAt: z.iso.date(),
    attribution: z.string().min(1)
  }).strict(),
  topics: z.record(z.string(), topicSchema),
  tracks: z.array(trackSchema).min(1)
}).strict();

const learningRoadmaps = learningRoadmapsSchema.parse(roadmapDocument);
const trackIdSchema = trackSchema.shape.id;

export type LearningTrackId = z.infer<typeof trackIdSchema>;
export type LearningStepStatus = "priority" | "covered" | "recommended";

export type LearningTrackSummary = {
  id: LearningTrackId;
  title: string;
  shortTitle: string;
  audience: string;
  outcome: string;
  sourceUrl: string;
  phaseCount: number;
  topicCount: number;
};

export type CareerLearningStep = {
  id: string;
  title: string;
  focus: string;
  task: string;
  doneWhen: string;
  sourceUrl: string | null;
  status: LearningStepStatus;
  reason: string;
  requiredSkill: string | null;
  /** Skill names this step builds, used to match recorded evidence. */
  skills: string[];
  isStart: boolean;
};

export type CareerLearningPhase = {
  id: string;
  title: string;
  goal: string;
  steps: CareerLearningStep[];
};

export type CareerLearningPath = {
  track: LearningTrackSummary;
  phases: CareerLearningPhase[];
  capstone: z.infer<typeof capstoneSchema>;
  targetTitle: string | null;
  targetCoverage: number | null;
  requiredSkillCount: number;
  coveredRequiredCount: number;
  priorityCount: number;
  startStep: CareerLearningStep | null;
  source: typeof learningRoadmaps.source;
};

function normalized(value: string) {
  return normalizeSkill(value).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function aliasesMatchSkill(aliases: string[], skill: string) {
  const candidate = normalized(skill);
  return aliases.some(alias => normalized(alias) === candidate);
}

function inferTrackId(targetTitle: string, requiredSkills: string[]): LearningTrackId {
  const title = targetTitle.toLowerCase();
  const skills = new Set(requiredSkills.map(normalized));
  if (/data analyst|analytics|business intelligence|\bbi\b/.test(title)) return "data-analyst";
  if (/devops|platform|cloud|site reliability|\bsre\b/.test(title)) return "devops";
  if (/full[ -]?stack|software engineer|software developer/.test(title)) return "full-stack";
  if (/back[ -]?end|api developer|server developer/.test(title)) return "backend";
  if (/front[ -]?end|ui developer|web developer|react developer/.test(title)) return "frontend";
  if (/\bux\b|user experience|product designer|interaction designer/.test(title)) return "ux-design";
  if (skills.has("figma") && !skills.has("react")) return "ux-design";
  if (skills.has("python") && skills.has("sql") && !skills.has("react")) return "data-analyst";
  if (skills.has("node.js") || skills.has("docker")) return skills.has("react") ? "full-stack" : "backend";
  if (skills.has("react") || skills.has("css")) return "frontend";
  return "full-stack";
}

export function parseLearningTrackId(value: unknown): LearningTrackId | undefined {
  const parsed = trackIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function getLearningTracks(): LearningTrackSummary[] {
  return learningRoadmaps.tracks.map(track => ({
    id: track.id,
    title: track.title,
    shortTitle: track.shortTitle,
    audience: track.audience,
    outcome: track.outcome,
    sourceUrl: track.sourceUrl,
    phaseCount: track.phases.length,
    topicCount: track.phases.reduce((total, phase) => total + phase.topicIds.length, 0)
  }));
}

function findTopicForSkill(skill: string) {
  return Object.entries(learningRoadmaps.topics).find(([, topic]) => aliasesMatchSkill(topic.skillAliases, skill));
}

export function buildCareerLearningPath(profileSkills: string[], options: {
  trackId?: LearningTrackId;
  targetTitle?: string;
  requiredSkills?: string[];
}): CareerLearningPath {
  const requiredSkills = [...new Map((options.requiredSkills ?? []).filter(Boolean).map(skill => [normalized(skill), skill])).values()];
  const selectedTrackId = options.trackId ?? inferTrackId(options.targetTitle ?? "", requiredSkills);
  const track = learningRoadmaps.tracks.find(candidate => candidate.id === selectedTrackId);
  if (!track) throw new Error("Learning track unavailable");

  const owned = new Set(profileSkills.map(normalized));
  const coveredRequiredCount = requiredSkills.filter(skill => owned.has(normalized(skill))).length;
  const mappedRequired = new Set<string>();

  const phases: CareerLearningPhase[] = track.phases.map(phase => ({
    id: phase.id,
    title: phase.title,
    goal: phase.goal,
    steps: phase.topicIds.map(topicId => {
      const topic = learningRoadmaps.topics[topicId];
      if (!topic) throw new Error(`Unknown topic in learning roadmap: ${topicId}`);
      const requiredSkill = requiredSkills.find(skill => aliasesMatchSkill(topic.skillAliases, skill)) ?? null;
      if (requiredSkill) mappedRequired.add(normalized(requiredSkill));
      const coveredAlias = topic.skillAliases.find(alias => owned.has(normalized(alias))) ?? null;
      const status: LearningStepStatus = coveredAlias ? "covered" : requiredSkill ? "priority" : "recommended";
      const reason = status === "covered"
        ? `Your profile lists ${coveredAlias}. Treat this as self-reported coverage and use the task to test your depth.`
        : status === "priority"
          ? `${options.targetTitle ?? "Your selected role"} lists ${requiredSkill}, and it is not in your saved skills.`
          : `CareerForge includes this in the ${track.title} progression so later work has a stronger foundation.`;
      return {
        id: topicId,
        title: topic.title,
        focus: topic.focus,
        task: topic.task,
        doneWhen: topic.doneWhen,
        sourceUrl: topic.sourceUrl,
        status,
        reason,
        requiredSkill,
        skills: topic.skillAliases,
        isStart: false
      };
    })
  }));

  const extraSteps: CareerLearningStep[] = requiredSkills
    .filter(skill => !mappedRequired.has(normalized(skill)))
    .map(skill => {
      const known = findTopicForSkill(skill);
      const topic = known?.[1];
      return {
        id: known?.[0] ?? `role-${normalized(skill).replace(/[^a-z0-9]+/g, "-")}`,
        title: topic?.title ?? skill,
        focus: topic?.focus ?? `${skill} fundamentals and one realistic use case`,
        task: topic?.task ?? `Build a small, demonstrable project using ${skill}. Document the problem, implementation and limitations.`,
        doneWhen: topic?.doneWhen ?? "Show a working example, test one failure case and ask a qualified reviewer to assess the evidence.",
        sourceUrl: topic?.sourceUrl ?? null,
        status: owned.has(normalized(skill)) ? "covered" : "priority",
        reason: owned.has(normalized(skill))
          ? `Your profile lists ${skill}. Treat this as self-reported coverage and use the task to test your depth.`
          : `${options.targetTitle ?? "Your selected role"} lists ${skill}, and it is not in your saved skills.`,
        requiredSkill: skill,
        skills: topic?.skillAliases ?? [skill],
        isStart: false
      };
    });

  if (extraSteps.length) {
    phases.unshift({
      id: "role-specific",
      title: "Close the role-specific gaps",
      goal: "Address requirements from this role that sit outside the core track.",
      steps: extraSteps
    });
  }

  const allSteps = phases.flatMap(phase => phase.steps);
  const startStep = allSteps.find(step => step.status === "priority")
    ?? allSteps.find(step => step.status === "recommended")
    ?? null;
  if (startStep) startStep.isStart = true;

  const summary = getLearningTracks().find(candidate => candidate.id === track.id);
  if (!summary) throw new Error("Learning track summary unavailable");
  const priorityCount = allSteps.filter(step => step.status === "priority").length;

  return {
    track: summary,
    phases,
    capstone: track.capstone,
    targetTitle: options.targetTitle ?? null,
    targetCoverage: requiredSkills.length ? Math.round(coveredRequiredCount / requiredSkills.length * 100) : null,
    requiredSkillCount: requiredSkills.length,
    coveredRequiredCount,
    priorityCount,
    startStep,
    source: learningRoadmaps.source
  };
}
