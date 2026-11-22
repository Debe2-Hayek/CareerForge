import Link from "next/link";
import { roadmaps } from "@/lib/roadmaps/catalog";
import { catalogCredits, courseArea, courseTopicList, hostOf, searchCourses, searchTutorials, type OpenCourse, type OpenTutorial } from "@/lib/roadmaps/open-catalog";
import { areaLabels, areas, type RoadmapArea } from "@/lib/roadmaps/schema";
import { LearnFooter, LearnHeader, projectIdeaCount } from "./learn-header";
import styles from "./roadmaps.module.css";

// Projects and Free courses: server-rendered lists filtered through the URL, so
// they work without JavaScript, can be bookmarked and never ship the full
// catalogue to the browser.

const pageSize = 36;
type Query = Record<string, string | undefined>;

function href(base: string, query: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

function Chips({ label, base, query, name, options }: { label: string; base: string; query: Query; name: string; options: { id: string; label: string }[] }) {
  return <nav className={styles.chips} aria-label={label}>
    {[{ id: "", label: "All" }, ...options].map(option => <Link key={option.id} href={href(base, { ...query, [name]: option.id || undefined, page: undefined })} scroll={false}
      aria-current={(query[name] ?? "") === option.id ? "true" : undefined}>{option.label}</Link>)}
  </nav>;
}

function SearchForm({ base, query, label, placeholder, subjects }: { base: string; query: Query; label: string; placeholder: string; subjects?: { id: string; label: string }[] }) {
  return <form className={styles.searchBar} action={base} method="get" role="search">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" /></svg>
    <label htmlFor="library-search" className="sr-only">{label}</label>
    <input id="library-search" key={query.q ?? ""} type="search" name="q" defaultValue={query.q ?? ""} maxLength={60} placeholder={placeholder} autoComplete="off" />
    {Object.entries(query).map(([key, value]) => value && key !== "q" && key !== "page" && !(subjects && (key === "area" || key === "topic")) ? <input key={key} type="hidden" name={key} value={value} /> : null)}
    {subjects && <><label htmlFor="library-area" className="sr-only">Subject</label>
      <select id="library-area" key={`area-${query.area ?? ""}`} name="area" defaultValue={query.area ?? ""}><option value="">All subjects</option>{subjects.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></>}
    <button type="submit" className={styles.ghostButton}>Search</button>
  </form>;
}

function Pager({ base, query, page, total }: { base: string; query: Query; page: number; total: number }) {
  const pages = Math.ceil(total / pageSize);
  if (pages < 2) return null;
  return <nav className={styles.pager} aria-label="Pages">
    {page > 1 ? <Link href={href(base, { ...query, page: page > 2 ? String(page - 1) : undefined })}>← Previous</Link> : <span />}
    <span>Page {page} of {pages}</span>
    {page < pages ? <Link href={href(base, { ...query, page: String(page + 1) })}>Next →</Link> : <span />}
  </nav>;
}

const clampPage = (value: string | undefined, total: number) => Math.min(Math.max(1, Math.floor(Number(value)) || 1), Math.max(1, Math.ceil(total / pageSize)));
const slice = <T,>(items: T[], page: number) => items.slice((page - 1) * pageSize, page * pageSize);
const areaOptions = (used: Set<RoadmapArea>) => areas.filter(area => used.has(area)).map(area => ({ id: area, label: areaLabels[area] }));
const parseArea = (value: string | undefined) => areas.find(area => area === value);

function CourseCard({ course }: { course: OpenCourse }) {
  return <a className={styles.courseCard} data-area={courseArea(course.topic)} href={course.url} target="_blank" rel="noopener noreferrer">
    <span className={styles.courseTopic}>{course.topic}</span>
    <strong>{course.title}</strong>
    <small>{course.by ? `${course.by} · ` : ""}{hostOf(course.url)}</small>
    <span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

export function CoursesPage({ search }: { search: Query }) {
  const base = "/learning-roadmap/courses";
  const topic = courseTopicList.find(item => item === search.topic);
  const area = topic ? undefined : parseArea(search.area);
  const query: Query = { q: search.q, area, topic };
  const results = searchCourses({ query: search.q, area, topic });
  const page = clampPage(search.page, results.length);
  const credit = catalogCredits.courses;
  return <div className={styles.page}>
    <LearnHeader active="courses" title="Learn from the best, free." text="Full courses from universities, companies and great teachers. Pick a subject and start." />
    <div className={styles.filters}>
      <SearchForm base={base} query={query} label="Search courses" placeholder="Search courses, teachers or topics" />
      <Chips label="Subject" base={base} query={{ q: search.q, area }} name="area" options={areaOptions(new Set(courseTopicList.map(courseArea)))} />
    </div>
    <p className={styles.count} role="status">{results.length.toLocaleString("en-US")} free {results.length === 1 ? "course" : "courses"}{topic ? <> in {topic} · <Link href={href(base, { q: search.q })}>Show all subjects</Link></> : null}</p>
    {results.length
      ? <ul className={styles.courseGrid}>{slice(results, page).map(course => <li key={course.url}><CourseCard course={course} /></li>)}</ul>
      : <div className={styles.empty}><p>No course matches your search.</p><Link className={styles.ghostButton} href={base}>Show all courses</Link></div>}
    <Pager base={base} query={query} page={page} total={results.length} />
    <LearnFooter>Courses belong to their publishers and open on their own sites; some may ask you to create a free account. List from <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a>, used under <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer">{credit.licence}</a>, with unavailable and non-HTTPS links removed.</LearnFooter>
  </div>;
}

const levels = ["beginner", "intermediate", "advanced"] as const;
const ideas = roadmaps.flatMap(roadmap => roadmap.projects.map(project => ({ roadmap, project })))
  .sort((a, b) => levels.indexOf(a.project.level) - levels.indexOf(b.project.level));

function TutorialCard({ item }: { item: OpenTutorial }) {
  return <a className={styles.courseCard} href={item.url} target="_blank" rel="noopener noreferrer">
    <span className={styles.courseTopic}>{item.tech}</span>
    <strong>{item.title}</strong>
    <small>{item.source === "byox" ? `Build your own: ${item.group}` : item.group} · {hostOf(item.url)}</small>
    <span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

export function ProjectsPage({ search }: { search: Query }) {
  const base = "/learning-roadmap/projects";
  const tutorials = search.type === "tutorials";
  const level = levels.find(item => item === search.level);
  const area = parseArea(search.area);
  const query: Query = tutorials ? { type: "tutorials", q: search.q } : { q: search.q, level, area };
  const terms = (search.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const ideaResults = tutorials ? [] : ideas.filter(({ roadmap, project }) => (!level || project.level === level) && (!area || roadmap.area === area)
    && terms.every(term => `${project.title} ${project.summary} ${project.skills.join(" ")} ${roadmap.title}`.toLowerCase().includes(term)));
  const tutorialResults = tutorials ? searchTutorials(search.q) : [];
  const total = tutorials ? tutorialResults.length : ideaResults.length;
  const page = clampPage(search.page, total);
  return <div className={styles.page}>
    <LearnHeader active="projects" title="Build to learn." text="Choose a project that matches your level. Finished projects with a public link are your strongest evidence." />
    <nav className={styles.switch} aria-label="Kind of project">
      <Link href={href(base, { q: search.q })} aria-current={!tutorials ? "true" : undefined}>Project ideas <span>{projectIdeaCount}</span></Link>
      <Link href={href(base, { type: "tutorials", q: search.q })} aria-current={tutorials ? "true" : undefined}>Step-by-step tutorials <span>{searchTutorials().length}</span></Link>
    </nav>
    <div className={styles.filters}>
      <SearchForm base={base} query={query} label="Search projects" placeholder={tutorials ? "Search tutorials, e.g. database or Go" : "Search projects or skills"} subjects={tutorials ? undefined : areaOptions(new Set(ideas.map(item => item.roadmap.area)))} />
      {!tutorials && <Chips label="Level" base={base} query={query} name="level" options={levels.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }))} />}
    </div>
    <p className={styles.count} role="status">{total.toLocaleString("en-US")} {tutorials ? "tutorials" : "projects"}</p>
    {!total && <div className={styles.empty}><p>No project matches your search.</p><Link className={styles.ghostButton} href={tutorials ? `${base}?type=tutorials` : base}>Clear filters</Link></div>}
    {!tutorials && <ul className={styles.projectGrid}>
      {slice(ideaResults, page).map(({ roadmap, project }) => <li key={`${roadmap.id}/${project.id}`}>
        <Link className={styles.projectCard} data-area={roadmap.area} href={`/learning-roadmap/${roadmap.id}?project=${project.id}`}>
          <span className={styles.projectTop}><span className={styles.level} data-level={project.level}>{project.level}</span><span className={styles.projectTag}>{roadmap.title}</span></span>
          <strong>{project.title}</strong>
          <span>{project.summary}</span>
        </Link>
      </li>)}
    </ul>}
    {tutorials && <ul className={styles.courseGrid}>{slice(tutorialResults, page).map(item => <li key={item.url}><TutorialCard item={item} /></li>)}</ul>}
    <Pager base={base} query={query} page={page} total={total} />
    <LearnFooter>
      {tutorials
        ? <>Tutorials belong to their authors and open on their own sites. Lists from <a href={catalogCredits.byox.url} target="_blank" rel="noopener noreferrer">{catalogCredits.byox.name}</a> ({catalogCredits.byox.licence}) and <a href={catalogCredits.pbl.url} target="_blank" rel="noopener noreferrer">{catalogCredits.pbl.name}</a> ({catalogCredits.pbl.licence}).</>
        : undefined}
    </LearnFooter>
  </div>;
}
