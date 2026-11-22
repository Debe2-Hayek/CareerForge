import type { Workshop } from "@/lib/workshops/types";

// Hand-picked, genuine resources. Each page was opened on `lastVerifiedAt`; titles,
// access and live times come from the linked page. Hooks and descriptions are
// CareerForge's own words. `durationEstimated` marks lengths the publisher does
// not state. "Staff Pick" is editorial: official, free and practical.

const verified = { sourceType: "curated", verificationStatus: "verified", lastVerifiedAt: "2026-11-22" } as const;
const selfPaced = { ...verified, format: "Self-Paced / Recorded" } as const;
const reactor = { ...verified, format: "Live Online", platform: "Microsoft Reactor", priceType: "Free" } as const;

export const curatedWorkshops: Workshop[] = [
  // ---- Verified live sessions (times as published in UTC by Microsoft) ----
  {
    ...reactor, id: "reactor-27765", sourceId: "reactor:27765", title: "Durable Execution for .NET Workflows with Dapr, Aspire and Diagrid",
    outcomeHook: "See a workflow survive a crash and continue where it stopped.",
    description: "A live build of a durable workflow in .NET with Dapr Workflow, run and debugged locally with Aspire, then moved to a managed engine. Useful if you want services that recover from restarts, timeouts and mid-run deployments.",
    instructorOrHost: "Microsoft Reactor", category: "Cloud & DevOps", difficulty: "Intermediate", startDateTime: "2026-12-09T17:00:00Z", durationMinutes: 60,
    prerequisites: ["Basic C# or another backend language"], keyTakeaways: ["What durable execution means", "How Dapr Workflow keeps state", "How to inspect a running workflow"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27765/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27765/",
    accessNotes: "Free registration with an email address.", isFeatured: true, relatedRoadmaps: ["devops", "csharp", "cloud-engineer"]
  },
  {
    ...reactor, id: "reactor-27746", sourceId: "reactor:27746", title: "Building Multi-Agent Workflows with Microsoft Foundry & Microsoft Agent Framework",
    outcomeHook: "Learn to coordinate several AI agents with people in control.",
    description: "A closer look at graph-based workflows for AI agents: routing messages, branching, running steps in parallel, pausing and resuming, and asking a person to approve an action.",
    instructorOrHost: "Microsoft Reactor", category: "AI & ML", difficulty: "Advanced", startDateTime: "2026-12-09T04:00:00Z", durationMinutes: 60,
    prerequisites: ["Some experience calling a language model from code"], keyTakeaways: ["When agents need an explicit workflow", "Parallel and conditional steps", "Checkpoints and human approval"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27746/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27746/",
    accessNotes: "Free registration with an email address.", relatedRoadmaps: ["ai-agents", "ai-engineer"]
  },
  {
    ...reactor, id: "reactor-27723", sourceId: "reactor:27723", title: "From Insight to Action: Build a Real Workplace App",
    outcomeHook: "Follow a data app from a real problem to a working product.",
    description: "Starts with a problem people have at work and builds a working app on Microsoft Fabric, explaining the decisions, trade-offs and lessons along the way.",
    instructorOrHost: "Microsoft Reactor", category: "AI & ML", difficulty: "Beginner", startDateTime: "2026-12-04T01:00:00Z", durationMinutes: 60,
    prerequisites: [], keyTakeaways: ["Turning a question into data you need", "Moving from insight to an app", "Trade-offs in a small data product"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27723/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27723/",
    accessNotes: "Free registration with an email address.", relatedRoadmaps: ["data-analyst", "power-bi"]
  },

  {
    ...reactor, id: "reactor-27815", sourceId: "reactor:27815", title: "Strengthening Your Cloud Applications: Layer 7 Security Essentials",
    outcomeHook: "Learn how web application firewalls stop real attacks.",
    description: "Key ideas and practical steps for protecting web traffic: why application-layer security matters, how Azure's web application firewall and DDoS protection work, and how to deploy them well.",
    instructorOrHost: "Microsoft Reactor", category: "Cybersecurity", difficulty: "Intermediate", startDateTime: "2026-12-08T02:00:00Z", durationMinutes: 60,
    prerequisites: ["How HTTP works"], keyTakeaways: ["Why layer 7 security matters", "Web application firewalls", "Protection against denial of service"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27815/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27815/",
    accessNotes: "Free registration with an email address.", relatedRoadmaps: ["cyber-security", "devsecops", "cloud-engineer"]
  },
  {
    ...reactor, id: "reactor-27794", sourceId: "reactor:27794", title: "VS Code Live: Release Recap",
    outcomeHook: "See the newest editor features you can use the same day.",
    description: "A monthly live tour of the latest Visual Studio Code features with members of the team, useful from your first project onwards.",
    instructorOrHost: "Microsoft Reactor", category: "Web Dev", difficulty: "Beginner", startDateTime: "2026-12-10T16:00:00Z", durationMinutes: 60,
    prerequisites: [], keyTakeaways: ["New VS Code features", "Faster everyday editing", "Working with the team's tips"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27794/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27794/",
    accessNotes: "Free registration with an email address.", relatedRoadmaps: ["frontend", "ai-coding"]
  },
  {
    ...reactor, id: "reactor-27814", sourceId: "reactor:27814", title: "Bicep 101: Learning the Fundamentals of Microsoft's Infrastructure as Code Language",
    outcomeHook: "Write and deploy your first infrastructure as code file.",
    description: "An introduction for people new to infrastructure as code. The demo writes a Bicep file in VS Code, deploys it, reuses verified modules and previews each change before making it.",
    instructorOrHost: "Microsoft Reactor", category: "Cloud & DevOps", difficulty: "Beginner", startDateTime: "2027-01-13T18:00:00Z", durationMinutes: 60,
    prerequisites: [], keyTakeaways: ["What infrastructure as code solves", "A first Bicep file", "Previewing and deploying changes"],
    registrationOrWatchUrl: "https://developer.microsoft.com/en-us/reactor/events/27814/", sourceUrl: "https://developer.microsoft.com/en-us/reactor/events/27814/",
    accessNotes: "Free registration with an email address.", relatedRoadmaps: ["terraform", "devops", "cloud-engineer"]
  },

  // ---- AI & ML ----
  {
    ...selfPaced, id: "google-ml-crash-course", title: "Machine Learning Crash Course", outcomeHook: "Train your first models and learn to judge whether they work.",
    description: "Google's fast introduction to machine learning with short videos, interactive visualisations and hands-on notebooks, from linear regression to neural networks and fairness.",
    instructorOrHost: "Google", platform: "Google for Developers", category: "AI & ML", difficulty: "Beginner", priceType: "Free", durationMinutes: 810,
    prerequisites: ["Basic Python", "School algebra"], keyTakeaways: ["How models learn from data", "Training and evaluating models", "Spotting overfitting and unfair results"],
    registrationOrWatchUrl: "https://developers.google.com/machine-learning/crash-course", accessNotes: "Length is the total of the module times Google lists.", badge: "Staff Pick", priority: 2, relatedRoadmaps: ["machine-learning", "data-scientist", "ai-engineer"]
  },
  {
    ...selfPaced, id: "dlai-prompt-engineering", title: "ChatGPT Prompt Engineering for Developers", outcomeHook: "Build a small app that gets dependable answers from a model.",
    description: "A short course by DeepLearning.AI with OpenAI: nine video lessons and runnable code on clear prompting, iterating, summarising, transforming text and building a chatbot.",
    instructorOrHost: "DeepLearning.AI and OpenAI", platform: "DeepLearning.AI", category: "AI & ML", difficulty: "Beginner", priceType: "Free", durationMinutes: 100,
    prerequisites: ["Basic Python"], keyTakeaways: ["Clear and testable prompts", "Summarising and transforming text", "A simple chatbot"],
    registrationOrWatchUrl: "https://www.deeplearning.ai/courses/chatgpt-prompt-engineering-for-developers", accessNotes: "Free account needed. The publisher says access is free for a limited time, so check before you start.", priority: 9, relatedRoadmaps: ["prompt-engineering", "ai-engineer", "ai-agents"]
  },
  {
    ...selfPaced, id: "hf-agents-course", title: "AI Agents Course", outcomeHook: "Build an agent that plans, uses tools and passes a final test.",
    description: "Hugging Face's free, hands-on course on AI agents: the ideas, popular libraries, real use cases and a final project with an automatic benchmark.",
    instructorOrHost: "Hugging Face", platform: "Hugging Face", category: "AI & ML", difficulty: "Intermediate", priceType: "Free", durationMinutes: 1200, durationEstimated: true,
    prerequisites: ["Basic Python", "Basic knowledge of language models"], keyTakeaways: ["How agents think and act", "Connecting tools safely", "Evaluating your own agent"],
    registrationOrWatchUrl: "https://huggingface.co/learn/agents-course/unit0/introduction", accessNotes: "Free account. The publisher suggests 3–4 hours a week for each chapter.", priority: 6, relatedRoadmaps: ["ai-agents", "ai-engineer"]
  },
  {
    ...selfPaced, id: "fastai-practical-deep-learning", title: "Practical Deep Learning for Coders", outcomeHook: "Put your own image and text models online.",
    description: "A free course for people who can already code. You train useful models from the first lesson, then learn what happens underneath.",
    instructorOrHost: "Jeremy Howard", platform: "fast.ai", category: "AI & ML", difficulty: "Intermediate", priceType: "Free", durationMinutes: 2400, durationEstimated: true,
    prerequisites: ["About a year of coding"], keyTakeaways: ["Training image and text models", "Publishing a working demo", "How neural networks learn"],
    registrationOrWatchUrl: "https://course.fast.ai/", priority: 14, relatedRoadmaps: ["machine-learning", "computer-vision", "data-scientist"]
  },

  // ---- Web Dev ----
  {
    ...selfPaced, id: "react-tic-tac-toe", title: "Tutorial: Tic-Tac-Toe", outcomeHook: "Build an interactive React game with time travel.",
    description: "The official React tutorial. You build a small game step by step and meet the ideas behind every React app: components, props, state and lifting state up.",
    instructorOrHost: "React team", platform: "react.dev", category: "Web Dev", difficulty: "Beginner", priceType: "Free", durationMinutes: 120, durationEstimated: true,
    prerequisites: ["HTML", "Basic JavaScript"], keyTakeaways: ["Components and props", "State and events", "Sharing state between components"],
    registrationOrWatchUrl: "https://react.dev/learn/tutorial-tic-tac-toe", badge: "Staff Pick", priority: 3, relatedRoadmaps: ["react", "frontend", "full-stack"]
  },
  {
    ...selfPaced, id: "odin-foundations", title: "Foundations", outcomeHook: "Go from zero to your own calculator and drawing app.",
    description: "The Odin Project's open first course: how the web works, the command line, Git, HTML, CSS and JavaScript, taught through projects you build yourself.",
    instructorOrHost: "The Odin Project", platform: "The Odin Project", category: "Web Dev", difficulty: "Beginner", priceType: "Free", durationMinutes: 6000, durationEstimated: true,
    prerequisites: [], keyTakeaways: ["Pages with HTML and CSS", "JavaScript fundamentals", "Working with Git"],
    registrationOrWatchUrl: "https://www.theodinproject.com/paths/foundations/courses/foundations", priority: 10, relatedRoadmaps: ["frontend", "html", "css", "javascript"]
  },
  {
    ...selfPaced, id: "cs50-web", title: "CS50's Web Programming with Python and JavaScript", outcomeHook: "Design and ship complete web apps with Django.",
    description: "Harvard's follow-on course to CS50: nine weeks of lectures and projects covering Git, Django, databases, JavaScript, testing, deployment and security.",
    instructorOrHost: "Harvard University", platform: "CS50 OpenCourseWare", category: "Web Dev", difficulty: "Intermediate", priceType: "Free", durationMinutes: 5400, durationNote: "Harvard: 12 weeks, 6–9 hours a week",
    prerequisites: ["CS50x or some programming experience"], keyTakeaways: ["Server-side apps with Django", "Interactive front ends", "Testing and deployment"],
    registrationOrWatchUrl: "https://cs50.harvard.edu/web/", accessNotes: "Free on Harvard's site. A verified certificate through edX is paid and optional.", priority: 13, relatedRoadmaps: ["full-stack", "django", "backend"]
  },

  // ---- Python ----
  {
    ...selfPaced, id: "cs50p", title: "CS50's Introduction to Programming with Python", outcomeHook: "Write, test and share your own Python programs.",
    description: "Harvard's introduction to Python for people with or without experience. Every week has a lecture, short videos and problems you solve yourself.",
    instructorOrHost: "Harvard University", platform: "CS50 OpenCourseWare", category: "Python", difficulty: "Beginner", priceType: "Free", durationMinutes: 3240, durationNote: "Harvard: 9 weeks, 3–9 hours a week",
    prerequisites: [], keyTakeaways: ["Functions, loops and exceptions", "Libraries, files and unit tests", "A final project of your own"],
    registrationOrWatchUrl: "https://cs50.harvard.edu/python/", accessNotes: "Free on Harvard's site. A verified certificate through edX is paid and optional.", badge: "Staff Pick", priority: 1, relatedRoadmaps: ["python", "data-analyst", "backend"]
  },
  {
    ...selfPaced, id: "automate-boring-stuff", title: "Automate the Boring Stuff with Python", outcomeHook: "Script away a task you do by hand every week.",
    description: "A practical book, free to read online, that takes you from first lines to programs that rename files, read spreadsheets, fill forms and send reminders.",
    instructorOrHost: "Al Sweigart", platform: "automatetheboringstuff.com", category: "Python", difficulty: "Beginner", priceType: "Free", durationMinutes: 1800, durationEstimated: true,
    prerequisites: [], keyTakeaways: ["Python basics through useful tasks", "Files, spreadsheets and the web", "Scheduling your scripts"],
    registrationOrWatchUrl: "https://automatetheboringstuff.com/", accessNotes: "Free to read online under a Creative Commons licence. Printed copies are paid.", priority: 11, relatedRoadmaps: ["python"]
  },
  {
    ...selfPaced, id: "kaggle-python", title: "Learn Python", outcomeHook: "Practise Python in the browser, ready for data work.",
    description: "Short lessons with exercises you run in the browser: syntax, functions, lists, loops, strings, dictionaries and libraries.",
    instructorOrHost: "Kaggle", platform: "Kaggle Learn", category: "Python", difficulty: "Beginner", priceType: "Free", durationMinutes: 300, durationEstimated: true,
    prerequisites: [], keyTakeaways: ["Core Python syntax", "Working with collections", "Using external libraries"],
    registrationOrWatchUrl: "https://www.kaggle.com/learn/python", accessNotes: "Free account needed for exercises.", priority: 8, relatedRoadmaps: ["python", "data-analyst", "data-scientist"]
  },

  // ---- Cybersecurity ----
  {
    ...selfPaced, id: "portswigger-academy", title: "Web Security Academy", outcomeHook: "Find and fix real web flaws in legal practice labs.",
    description: "Free online training from the makers of Burp Suite. Read about a vulnerability, then solve interactive labs, with progress saved to your account.",
    instructorOrHost: "PortSwigger", platform: "PortSwigger", category: "Cybersecurity", difficulty: "Intermediate", priceType: "Free", durationMinutes: 3000, durationEstimated: true,
    prerequisites: ["How HTTP works"], keyTakeaways: ["SQL injection, XSS and access control", "Hands-on lab practice", "How each flaw is prevented"],
    registrationOrWatchUrl: "https://portswigger.net/web-security", badge: "Staff Pick", priority: 4, relatedRoadmaps: ["cyber-security", "devsecops"]
  },
  {
    ...selfPaced, id: "overthewire-bandit", title: "Bandit Wargame", outcomeHook: "Learn the Linux command line by breaking into each next level.",
    description: "A game for absolute beginners played over SSH. Every level hides a password that teaches one more command-line or security idea.",
    instructorOrHost: "OverTheWire", platform: "OverTheWire", category: "Cybersecurity", difficulty: "Beginner", priceType: "Free", durationMinutes: 480, durationEstimated: true,
    prerequisites: [], keyTakeaways: ["Everyday Linux commands", "SSH, permissions and encoding", "Patient problem solving"],
    registrationOrWatchUrl: "https://overthewire.org/wargames/bandit/", priority: 7, relatedRoadmaps: ["cyber-security", "linux", "shell-scripting"]
  },
  {
    ...selfPaced, id: "cs50-cybersecurity", title: "CS50's Introduction to Cybersecurity", outcomeHook: "Protect your accounts, data and code with confidence.",
    description: "Harvard's five-week course for technical and non-technical people: securing accounts, data, systems and software, and preserving privacy.",
    instructorOrHost: "Harvard University", platform: "CS50 OpenCourseWare", category: "Cybersecurity", difficulty: "Beginner", priceType: "Free", durationMinutes: 1200, durationNote: "Harvard: 5 weeks, 2–6 hours a week",
    prerequisites: [], keyTakeaways: ["How accounts and data are attacked", "Practical protections", "Thinking about trade-offs"],
    registrationOrWatchUrl: "https://cs50.harvard.edu/cybersecurity/", accessNotes: "Free on Harvard's site. A verified certificate through edX is paid and optional.", priority: 15, relatedRoadmaps: ["cyber-security", "it-support"]
  },

  // ---- Cloud & DevOps ----
  {
    ...selfPaced, id: "docker-get-started", title: "Get Started with Docker Containers", outcomeHook: "Run a multi-container app with one command.",
    description: "Docker's official beginner path in four guides: what a container is, running your first one, keeping data, and connecting services with Compose.",
    instructorOrHost: "Docker", platform: "Docker Learn", category: "Cloud & DevOps", difficulty: "Beginner", priceType: "Free", durationMinutes: 77,
    prerequisites: ["Comfort with a terminal"], keyTakeaways: ["Containers and images", "Volumes and bind mounts", "Docker Compose"],
    registrationOrWatchUrl: "https://docs.docker.com/learn/paths/get-started-with-docker-containers/", accessNotes: "Length is the total of the four guides.", badge: "Staff Pick", priority: 5, relatedRoadmaps: ["docker", "devops", "backend"]
  },
  {
    ...selfPaced, id: "github-actions-hello", title: "Hello GitHub Actions", outcomeHook: "Automate your first workflow in a real repository.",
    description: "An interactive GitHub exercise. You create a workflow in your own copy of the repository and get feedback as you complete each step.",
    instructorOrHost: "GitHub", platform: "GitHub Skills", category: "Cloud & DevOps", difficulty: "Beginner", priceType: "Free", durationMinutes: 60, durationEstimated: true,
    prerequisites: ["A GitHub account"], keyTakeaways: ["Workflows, jobs and steps", "Triggering automation", "Reading results"],
    registrationOrWatchUrl: "https://github.com/skills/hello-github-actions", accessNotes: "Free in a public repository. Private repositories use Actions minutes.", priority: 12, relatedRoadmaps: ["devops", "git-github"]
  },
  {
    ...selfPaced, id: "kubernetes-basics", title: "Learn Kubernetes Basics", outcomeHook: "Deploy, scale and update an app on a cluster.",
    description: "The official Kubernetes tutorial in six modules: create a cluster, deploy an app, explore it, expose it, scale it and roll out an update.",
    instructorOrHost: "Kubernetes", platform: "kubernetes.io", category: "Cloud & DevOps", difficulty: "Intermediate", priceType: "Free", durationMinutes: 180, durationEstimated: true,
    prerequisites: ["Basic containers"], keyTakeaways: ["Pods and deployments", "Services", "Scaling and rolling updates"],
    registrationOrWatchUrl: "https://kubernetes.io/docs/tutorials/kubernetes-basics/", priority: 16, relatedRoadmaps: ["kubernetes", "devops", "cloud-engineer"]
  },

  // ---- Systems & Algorithms ----
  {
    ...selfPaced, id: "mit-missing-semester", title: "The Missing Semester of Your CS Education", outcomeHook: "Master the tools every programmer is expected to know.",
    description: "MIT lectures with notes and exercises on the shell, editors, version control, debugging, automation and more: the practical skills degree courses often skip.",
    instructorOrHost: "MIT CSAIL", platform: "MIT", category: "Systems & Algorithms", difficulty: "Beginner", priceType: "Free", durationMinutes: 900, durationEstimated: true,
    prerequisites: [], keyTakeaways: ["Shell and scripting", "Git in depth", "Debugging and automation"],
    registrationOrWatchUrl: "https://missing.csail.mit.edu/", badge: "Staff Pick", priority: 6, relatedRoadmaps: ["computer-science", "linux", "shell-scripting", "git-github"]
  },
  {
    ...selfPaced, id: "nand2tetris", title: "From Nand to Tetris", outcomeHook: "Build a working computer from logic gates up.",
    description: "Lectures, projects and free open-source tools for building a computer, assembler, compiler and operating system step by step.",
    instructorOrHost: "Noam Nisan and Shimon Schocken", platform: "nand2tetris.org", category: "Systems & Algorithms", difficulty: "Intermediate", priceType: "Free", durationMinutes: 4800, durationEstimated: true,
    prerequisites: ["Some programming experience"], keyTakeaways: ["How hardware computes", "How compilers work", "How software layers fit together"],
    registrationOrWatchUrl: "https://www.nand2tetris.org/", priority: 17, relatedRoadmaps: ["computer-science", "c", "embedded-engineer"]
  },
  {
    ...selfPaced, id: "princeton-algorithms-1", title: "Algorithms, Part I", outcomeHook: "Implement and measure the structures behind fast software.",
    description: "Princeton's course on union-find, sorting, priority queues, search trees and hash tables, with programming assignments in Java.",
    instructorOrHost: "Robert Sedgewick and Kevin Wayne", platform: "Coursera", category: "Systems & Algorithms", difficulty: "Intermediate", priceType: "Free", durationMinutes: 3000,
    prerequisites: ["Programming in Java or a similar language"], keyTakeaways: ["Sorting and searching", "Trees and hash tables", "Analysing performance"],
    registrationOrWatchUrl: "https://www.coursera.org/learn/algorithms-part1", accessNotes: "Coursera account needed. The course page says its features are free and gives no certificate. Publisher's estimate: 5 weeks at 10 hours.", priority: 18, relatedRoadmaps: ["data-structures-algorithms", "computer-science", "java"]
  },
  {
    ...selfPaced, id: "cs50x-edx", title: "CS50's Introduction to Computer Science", outcomeHook: "Think like a computer scientist and build a final project.",
    description: "HarvardX's well-known introduction on edX: C, algorithms, memory, data structures, Python, SQL and the web, finishing with your own project.",
    instructorOrHost: "Harvard University", platform: "edX", category: "Systems & Algorithms", difficulty: "Beginner", priceType: "Free Audit", durationMinutes: 8640, durationNote: "edX: 12 weeks, 6–18 hours a week",
    prerequisites: [], keyTakeaways: ["Algorithms and data structures", "Memory and how computers work", "A complete final project"],
    registrationOrWatchUrl: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science",
    accessNotes: "Auditing on edX is free; the verified certificate is paid. The same course is also free at cs50.harvard.edu/x.", priority: 19, relatedRoadmaps: ["computer-science", "c"]
  }
];
