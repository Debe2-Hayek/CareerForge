import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseIntro } from "@/components/learning/course-intro";
import { CourseRoadmap, type RoadmapView } from "@/components/learning/course-roadmap";
import { getCourse } from "@/lib/learning/catalog";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { buildLearningPlan, emptyProgress, type LearningSettings } from "@/lib/learning/plan";
import { recommendNextSteps } from "@/lib/learning/recommendations";
import { experienceLevelSchema, resourceFormatSchema, slugSchema } from "@/lib/learning/schema";

type Params = Promise<{ courseId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const course = getCourse((await params).courseId);
  return { title: `${course?.title ?? "Learning path"} roadmap - CareerForge`, robots: { index: false, follow: false } };
}

const single = (value: string | string[] | undefined) => typeof value === "string" && value.length <= 80 ? value : undefined;

/** Preview settings come from the GET setup form; anything invalid is ignored. */
function previewSettings(course: NonNullable<ReturnType<typeof getCourse>>, search: Record<string, string | string[] | undefined>): LearningSettings | null {
  const goal = slugSchema.safeParse(single(search.goal));
  const level = experienceLevelSchema.safeParse(single(search.level));
  const format = resourceFormatSchema.safeParse(single(search.format));
  const hours = Number(single(search.hours));
  if (!goal.success || !course.goals.some(item => item.id === goal.data) || !level.success || !format.success || !Number.isInteger(hours) || hours < 1 || hours > 40) return null;
  return { goalId: goal.data, level: level.data, weeklyHours: hours, format: format.data };
}

export default async function CoursePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  // Verify the session first so guests are redirected before any route detail is revealed.
  const account = await loadLearningAccount();
  const course = getCourse((await params).courseId);
  if (!course) notFound();
  const search = await searchParams;
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>Your learning plan is temporarily unavailable.</h1><p>We could not confirm your account. Your saved progress is unchanged.</p><Link href={`/learning-roadmap/${course.id}`} className="button primary">Try again</Link></div></AppShell>;
  }
  const storageAvailable = account.snapshot !== null;
  const enrollment = account.snapshot?.enrollments.find(item => item.courseId === course.id) ?? null;
  const preview = enrollment ? null : previewSettings(course, search);
  const settings = enrollment ?? preview;

  if (!settings) {
    const defaults: LearningSettings = { goalId: course.goals[0].id, level: "new", weeklyHours: 6, format: "mixed" };
    return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
      <CourseIntro course={course} defaults={defaults} storageAvailable={storageAvailable} />
    </AppShell>;
  }

  const progress = account.snapshot?.progress[course.id] ?? emptyProgress();
  const plan = buildLearningPlan(course, settings, enrollment ? progress : emptyProgress());
  const view: RoadmapView = single(search.view) === "overview" ? "overview" : "path";
  const topicParam = slugSchema.safeParse(single(search.topic));
  const selectedTopicId = topicParam.success && course.topics.some(topic => topic.id === topicParam.data) ? topicParam.data : null;

  const base = `/learning-roadmap/${course.id}`;
  const href = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (preview) {
      query.set("goal", preview.goalId);
      query.set("level", preview.level);
      query.set("hours", String(preview.weeklyHours));
      query.set("format", preview.format);
    }
    for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
    const text = query.toString();
    return text ? `${base}?${text}` : base;
  };
  const viewParam = view === "overview" ? "overview" : undefined;
  const hrefs = {
    topic: (id: string) => href({ view: viewParam, topic: id }),
    view: (next: RoadmapView) => href({ view: next === "overview" ? "overview" : undefined }),
    close: href({ view: viewParam })
  };
  const recommendations = recommendNextSteps(course, plan, base).map(item => item.href.startsWith(`${base}?topic=`)
    ? { ...item, href: hrefs.topic(item.href.slice(`${base}?topic=`.length)) }
    : item.href.startsWith(`${base}#`) ? { ...item, href: `${hrefs.close}${item.href.slice(base.length)}` } : item);

  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <CourseRoadmap course={course} plan={plan} mode={enrollment ? "enrolled" : "preview"} view={view} selectedTopicId={selectedTopicId}
      recommendations={recommendations} hrefs={hrefs} storageAvailable={storageAvailable} />
  </AppShell>;
}
