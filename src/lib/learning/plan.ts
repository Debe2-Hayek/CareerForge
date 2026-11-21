import type {
  ExperienceLevel, LearningCourse, LearningGoal, LearningProject, LearningTopic,
  ProjectState, ResourceFormat, TopicLevel, TopicState
} from "./schema";

// Deterministic, rule-based personalisation. The same course, settings and
// progress always produce the same plan, and every status or recommendation
// can be explained from those inputs. No AI or external service is involved.

export type LearningSettings = {
  goalId: string;
  level: ExperienceLevel;
  weeklyHours: number;
  format: ResourceFormat;
};

export type ProjectProgress = { state: ProjectState; evidenceUrl: string | null };
export type LearningProgress = {
  topics: Record<string, TopicState>;
  projects: Record<string, ProjectProgress>;
};
export const emptyProgress = (): LearningProgress => ({ topics: {}, projects: {} });

export type PlanTopicStatus = "completed" | "known" | "in_progress" | "available" | "locked";

export type PlanTopic = {
  id: string;
  title: string;
  tier: LearningTopic["tier"];
  level: TopicLevel;
  phaseId: string;
  /** Estimate in hours adjusted for the learner's experience. */
  hours: number;
  /** Counts toward this goal's progress (essential/recommended in an included phase). */
  inPlan: boolean;
  status: PlanTopicStatus;
  missingPrerequisites: { id: string; title: string }[];
  /** Foundation material an experienced learner may be able to mark as known. */
  reviewSuggested: boolean;
  isNext: boolean;
};

export type PlanPhase = {
  id: string;
  title: string;
  goal: string;
  branch: string | null;
  career: boolean;
  included: boolean;
  topics: PlanTopic[];
  required: number;
  done: number;
};

export type ProjectReadiness = "ready" | "almost" | "locked";
export type PlanProject = {
  project: LearningProject;
  readiness: ProjectReadiness;
  missing: { id: string; title: string }[];
  relevant: boolean;
  state: ProjectState | null;
  evidenceUrl: string | null;
};

export type LearningPlan = {
  courseId: string;
  goal: LearningGoal;
  settings: LearningSettings;
  phases: PlanPhase[];
  progress: {
    requiredTotal: number;
    completed: number;
    known: number;
    inProgress: number;
    /** completed / (required - known): skipped material neither inflates nor deflates the figure. */
    percent: number;
    remainingHours: number;
    weeksRemaining: number;
  };
  nextTopic: PlanTopic | null;
  /** True when every required topic is done and the next topic is optional enrichment. */
  nextIsOptional: boolean;
  thisWeek: PlanTopic[];
  currentPhase: PlanPhase | null;
  projects: PlanProject[];
};

const effort: Record<ExperienceLevel, Record<TopicLevel, number>> = {
  new: { foundation: 1, core: 1, advanced: 1 },
  some: { foundation: 0.5, core: 0.85, advanced: 1 },
  experienced: { foundation: 0.25, core: 0.6, advanced: 0.85 }
};

export function adjustedHours(hours: number, topicLevel: TopicLevel, level: ExperienceLevel) {
  return Math.max(0.5, Math.round(hours * effort[level][topicLevel] * 2) / 2);
}

export function resolveGoal(course: LearningCourse, goalId: string): LearningGoal {
  return course.goals.find(goal => goal.id === goalId) ?? course.goals[0];
}

const isDone = (state: TopicState | undefined) => state === "completed" || state === "known";

export function buildLearningPlan(course: LearningCourse, settings: LearningSettings, progress: LearningProgress = emptyProgress()): LearningPlan {
  const goal = resolveGoal(course, settings.goalId);
  const resolved: LearningSettings = { ...settings, goalId: goal.id, weeklyHours: Math.min(40, Math.max(1, Math.round(settings.weeklyHours))) };
  const titles = new Map(course.topics.map(topic => [topic.id, topic.title]));
  const includedBranch = (branch: string | null) => branch === null || goal.branches.includes(branch);

  const toPlanTopic = (topic: LearningTopic, phaseIncluded: boolean, careerPhase: boolean): PlanTopic => {
    const state = progress.topics[topic.id];
    const missing = topic.prerequisites.filter(id => !isDone(progress.topics[id])).map(id => ({ id, title: titles.get(id) ?? id }));
    const status: PlanTopicStatus = state ?? (missing.length ? "locked" : "available");
    return {
      id: topic.id,
      title: topic.title,
      tier: topic.tier,
      level: topic.level,
      phaseId: topic.phaseId,
      hours: adjustedHours(topic.hours, topic.level, resolved.level),
      inPlan: phaseIncluded && topic.tier !== "optional" && (!careerPhase || goal.careerFocus),
      status,
      missingPrerequisites: missing,
      reviewSuggested: resolved.level !== "new" && topic.level === "foundation" && !isDone(state),
      isNext: false
    };
  };

  const phases: PlanPhase[] = course.phases.map(phase => {
    const included = includedBranch(phase.branch);
    const topics = course.topics.filter(topic => topic.phaseId === phase.id).map(topic => toPlanTopic(topic, included, phase.career));
    const counted = topics.filter(topic => topic.inPlan);
    return {
      id: phase.id,
      title: phase.title,
      goal: phase.goal,
      branch: phase.branch,
      career: phase.career,
      included,
      topics,
      required: counted.length,
      done: counted.filter(topic => isDone(topic.status as TopicState)).length
    };
  });
  // Included phases keep curriculum order; other specialisations follow for exploration.
  const ordered = [...phases.filter(phase => phase.included), ...phases.filter(phase => !phase.included)];

  const planTopics = ordered.flatMap(phase => phase.topics);
  const required = planTopics.filter(topic => topic.inPlan);
  const completed = required.filter(topic => topic.status === "completed").length;
  const known = required.filter(topic => topic.status === "known").length;
  const inProgress = required.filter(topic => topic.status === "in_progress").length;
  const remaining = required.filter(topic => topic.status !== "completed" && topic.status !== "known");
  const remainingHours = remaining.reduce((sum, topic) => sum + topic.hours, 0);
  const denominator = required.length - known;
  const percent = required.length === 0 ? 0 : denominator === 0 ? 100 : Math.round(completed / denominator * 100);

  const includedTopics = ordered.filter(phase => phase.included).flatMap(phase => phase.topics);
  let nextTopic: PlanTopic | null = remaining.find(topic => topic.status === "in_progress")
    ?? remaining.find(topic => topic.status === "available")
    ?? remaining[0]
    ?? null;
  let nextIsOptional = false;
  if (!nextTopic) {
    nextTopic = includedTopics.find(topic => !topic.inPlan && (topic.status === "available" || topic.status === "in_progress")) ?? null;
    nextIsOptional = nextTopic !== null;
  }
  if (nextTopic) nextTopic.isNext = true;

  // A realistic week: the next topic plus following plan topics whose
  // prerequisites will be satisfied, until the weekly budget is used.
  const thisWeek: PlanTopic[] = [];
  if (nextTopic) {
    const willBeDone = new Set(Object.entries(progress.topics).filter(([, state]) => isDone(state)).map(([id]) => id));
    let budget = resolved.weeklyHours;
    const candidates = nextIsOptional ? [nextTopic] : [nextTopic, ...remaining.filter(topic => topic !== nextTopic)];
    for (const topic of candidates) {
      if (thisWeek.length && topic.hours > budget) break;
      const source = course.topics.find(candidate => candidate.id === topic.id);
      if (thisWeek.length && source?.prerequisites.some(id => !willBeDone.has(id))) continue;
      thisWeek.push(topic);
      willBeDone.add(topic.id);
      budget -= topic.hours;
      if (budget <= 0 || thisWeek.length >= 4) break;
    }
  }

  const currentPhase = nextTopic ? ordered.find(phase => phase.topics.includes(nextTopic as PlanTopic)) ?? null : null;

  const projects: PlanProject[] = course.projects.map(project => {
    const missing = project.requires.filter(id => !isDone(progress.topics[id])).map(id => ({ id, title: titles.get(id) ?? id }));
    const saved = progress.projects[project.id];
    return {
      project,
      readiness: missing.length === 0 ? "ready" : missing.length <= 2 ? "almost" : "locked",
      missing,
      relevant: project.branch === null || goal.branches.includes(project.branch),
      state: saved?.state ?? null,
      evidenceUrl: saved?.evidenceUrl ?? null
    };
  });

  return {
    courseId: course.id,
    goal,
    settings: resolved,
    phases: ordered,
    progress: {
      requiredTotal: required.length,
      completed,
      known,
      inProgress,
      percent,
      remainingHours: Math.round(remainingHours * 2) / 2,
      weeksRemaining: remainingHours ? Math.ceil(remainingHours / resolved.weeklyHours) : 0
    },
    nextTopic,
    nextIsOptional,
    thisWeek,
    currentPhase,
    projects
  };
}

/** Reorder resources so the learner's preferred format appears first, without hiding anything. */
export function orderResources<T extends { type: string }>(resources: T[], format: ResourceFormat): (T & { preferred: boolean })[] {
  const preferredTypes: Record<ResourceFormat, string[]> = {
    mixed: [],
    reading: ["docs", "book", "article"],
    video: ["video", "course"],
    interactive: ["interactive", "exercises"]
  };
  const wanted = preferredTypes[format];
  return resources
    .map((resource, index) => ({ ...resource, preferred: wanted.includes(resource.type), index }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.index - b.index)
    .map(({ index: _index, ...resource }) => resource as T & { preferred: boolean });
}
