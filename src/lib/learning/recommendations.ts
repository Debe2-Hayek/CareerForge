import type { LearningCourse } from "./schema";
import type { LearningPlan, PlanProject } from "./plan";

export type RecommendationKind = "continue" | "start" | "prerequisite" | "review" | "build" | "finish-project" | "evidence" | "portfolio" | "career" | "explore";
export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  reason: string;
  href: string;
  action: string;
};

const list = (titles: string[]) => titles.length <= 1 ? titles.join("") : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
const levelRank = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/**
 * Explainable next steps. Each recommendation states the facts it was derived
 * from (completed topics, prerequisites, project state, goal), and the list is
 * ordered by a fixed priority so it is predictable.
 */
export function recommendNextSteps(course: LearningCourse, plan: LearningPlan, base = `/learning-roadmap/${course.id}`, limit = 4): Recommendation[] {
  const items: Recommendation[] = [];
  const topicHref = (id: string) => `${base}?topic=${encodeURIComponent(id)}`;
  const next = plan.nextTopic;

  // Prerequisite guard: a learner who jumped ahead is pointed back to the foundation first.
  const jumpedAhead = plan.phases.flatMap(phase => phase.topics).find(topic => topic.status === "in_progress" && topic.missingPrerequisites.length);
  if (jumpedAhead) {
    const first = jumpedAhead.missingPrerequisites[0];
    items.push({
      id: `prerequisite-${jumpedAhead.id}`,
      kind: "prerequisite",
      title: `Learn ${first.title} before ${jumpedAhead.title}`,
      reason: `${jumpedAhead.title} builds directly on ${list(jumpedAhead.missingPrerequisites.map(item => item.title))}, which ${jumpedAhead.missingPrerequisites.length === 1 ? "is" : "are"} not complete yet.`,
      href: topicHref(first.id),
      action: "Open prerequisite"
    });
  }

  if (next && next.id !== jumpedAhead?.id) {
    const source = course.topics.find(topic => topic.id === next.id);
    const prerequisites = source?.prerequisites.map(id => course.topics.find(topic => topic.id === id)?.title ?? id) ?? [];
    if (next.status === "in_progress") {
      items.push({ id: `continue-${next.id}`, kind: "continue", title: `Continue ${next.title}`, reason: "You started this topic and it is the next step in your plan.", href: topicHref(next.id), action: "Continue" });
    } else if (next.reviewSuggested) {
      items.push({ id: `review-${next.id}`, kind: "review", title: `Review ${next.title}`, reason: "You said you have some experience. Skim it and check the completion criteria; mark it as known if you can already meet them.", href: topicHref(next.id), action: "Review topic" });
    } else {
      items.push({
        id: `start-${next.id}`,
        kind: plan.nextIsOptional ? "explore" : "start",
        title: `${plan.nextIsOptional ? "Explore" : "Start"} ${next.title}`,
        reason: plan.nextIsOptional
          ? "Your required topics are done. This optional topic deepens your skills."
          : prerequisites.length ? `You have finished its prerequisites: ${list(prerequisites)}.` : "It is the first step in your plan and needs no prior topics.",
        href: topicHref(next.id),
        action: plan.nextIsOptional ? "Explore" : "Start"
      });
    }
  }

  const relevant = plan.projects.filter(project => project.relevant);
  const building = relevant.find(project => project.state === "building");
  if (building) {
    items.push({ id: `finish-${building.project.id}`, kind: "finish-project", title: `Finish ${building.project.title}`, reason: "You started building it. Finished projects are stronger evidence than many started ones.", href: `${base}#project-${building.project.id}`, action: "View project" });
  }

  const finished = relevant.filter(project => project.state === "completed");
  const withoutEvidence = finished.find(project => !project.evidenceUrl);
  if (withoutEvidence) {
    items.push({ id: `evidence-${withoutEvidence.project.id}`, kind: "evidence", title: `Add a public link to ${withoutEvidence.project.title}`, reason: "A repository or live demo lets reviewers check your work; without it, the project is only self-reported.", href: `${base}#project-${withoutEvidence.project.id}`, action: "Add link" });
  }
  const showcase = finished.find(project => project.evidenceUrl);
  if (showcase) {
    items.push({ id: `portfolio-${showcase.project.id}`, kind: "portfolio", title: `Add ${showcase.project.title} to your portfolio`, reason: "It is finished and has a public link, which makes it credible portfolio evidence.", href: `${base}#project-${showcase.project.id}`, action: "Prepare entry" });
  }

  if (!building) {
    const ready = pickProject(relevant.filter(project => project.readiness === "ready" && !project.state));
    if (ready) {
      items.push({
        id: `build-${ready.project.id}`,
        kind: "build",
        title: `Build ${ready.project.title}`,
        reason: `You have completed every topic it needs: ${list(ready.project.requires.map(id => course.topics.find(topic => topic.id === id)?.title ?? id))}.`,
        href: `${base}#project-${ready.project.id}`,
        action: "View brief"
      });
    }
  }

  if (plan.goal.careerTrack && plan.progress.percent >= 25) {
    items.push({ id: "career-gap", kind: "career", title: "Compare your skills with target roles", reason: `Your goal is "${plan.goal.title}". See which role requirements your profile and evidence already cover.`, href: `/learning-roadmap/careers?track=${plan.goal.careerTrack}`, action: "Open career roadmap" });
  }

  return items.slice(0, limit);
}

/** Prefer the least advanced ready project so learners are not pushed past their level. */
function pickProject(projects: PlanProject[]) {
  return [...projects].sort((a, b) => levelRank[a.project.level] - levelRank[b.project.level])[0];
}
