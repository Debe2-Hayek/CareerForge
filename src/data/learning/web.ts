import type { LearningResource, ResourceType } from "@/lib/learning/schema";

// Original CareerForge curriculum for JavaScript and web development.
// Explanations, exercises and projects are written for CareerForge; every
// resource is linked (not copied) and was checked on the reviewedAt date.
// Re-verify with `npm run check:learning-links`.

const free = (title: string, provider: string, url: string, type: ResourceType): LearningResource =>
  ({ title, provider, url, type, free: true, language: "en" });

const mdn = (title: string, path: string) => free(title, "MDN Web Docs", `https://developer.mozilla.org/en-US/docs/${path}`, "docs");
const mdnLearn = (title: string, path: string) => mdn(title, `Learn_web_development/${path}`);
const jsInfo = (title: string, path: string) => free(`${title} (javascript.info)`, "javascript.info", `https://javascript.info/${path}`, "book");
const webDev = (title: string, path: string) => free(title, "web.dev", `https://web.dev/learn/${path}`, "course");
const odin = free("Foundations course", "The Odin Project", "https://www.theodinproject.com/paths/foundations/courses/foundations", "course");
const fccWeb = free("Responsive Web Design certification", "freeCodeCamp", "https://www.freecodecamp.org/learn/2022/responsive-web-design", "interactive");
const fccJs = free("JavaScript Algorithms and Data Structures", "freeCodeCamp", "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8", "interactive");
const exercism = free("JavaScript track exercises", "Exercism", "https://exercism.org/tracks/javascript", "exercises");
const react = (title: string, path: string) => free(title, "React docs", `https://react.dev/learn${path}`, "docs");

export const webCourse = {
  id: "web-development",
  version: 1,
  title: "JavaScript & Web Development",
  tagline: "Build real websites and web apps with HTML, CSS and JavaScript, then specialise in React or Node.js.",
  summary: "A dependency-ordered path from how the web works to accessible, responsive pages and interactive JavaScript, then professional tooling, testing and deployment. Specialise in React front ends, Node.js back ends, or both. Every step links to free resources from MDN, web.dev, The Odin Project, freeCodeCamp and official docs.",
  categories: ["web", "programming"],
  difficulty: "Beginner to advanced",
  audience: "Beginners who want to build for the web, and developers who want a structured path into React or Node.js.",
  outcomes: [
    "Build accessible, responsive pages with semantic HTML and modern CSS",
    "Write interactive JavaScript that handles events, forms and network data",
    "Use Git, npm, tests and TypeScript like a professional team",
    "Ship a deployed React app or Node.js API for your portfolio"
  ],
  reviewedAt: "2026-11-22",
  roadmapSh: { title: "Frontend Developer roadmap", url: "https://roadmap.sh/frontend" },
  goals: [
    { id: "foundations", title: "Build websites from scratch", description: "Learn HTML, CSS and JavaScript well enough to build and publish your own sites.", branches: [], careerFocus: false, careerTrack: null },
    { id: "frontend", title: "Become a front-end developer", description: "Build modern interfaces with React, tested and deployed.", branches: ["react"], careerFocus: true, careerTrack: "frontend" },
    { id: "backend", title: "Become a Node.js back-end developer", description: "Build secure REST APIs with Node.js, Express and SQL.", branches: ["node"], careerFocus: true, careerTrack: "backend" },
    { id: "full-stack", title: "Become a full-stack developer", description: "Combine a React front end with a Node.js API and database.", branches: ["react", "node"], careerFocus: true, careerTrack: "full-stack" }
  ],
  phases: [
    { id: "web-basics", title: "How the web works", goal: "Understand browsers, servers and URLs, and set up a professional editing environment.", branch: null, career: false },
    { id: "html-css", title: "HTML & CSS", goal: "Structure content semantically and lay it out responsively and accessibly.", branch: null, career: false },
    { id: "js-fundamentals", title: "JavaScript fundamentals", goal: "Store data, make decisions, repeat work and organise logic in JavaScript.", branch: null, career: false },
    { id: "browser-js", title: "JavaScript in the browser", goal: "Make pages interactive: the DOM, events, forms, network requests and storage.", branch: null, career: false },
    { id: "professional", title: "Professional tooling", goal: "Work like a team: version control, packages, tests, types, performance, security and deployment.", branch: null, career: false },
    { id: "react", title: "Specialisation: React front end", goal: "Build component-based interfaces with state, data fetching and routing.", branch: "react", career: false },
    { id: "node", title: "Specialisation: Node.js back end", goal: "Build, secure and deploy REST APIs backed by a SQL database.", branch: "node", career: false },
    { id: "career", title: "Portfolio and career preparation", goal: "Publish your work and prepare for technical interviews.", branch: null, career: true }
  ],
  topics: [
    {
      id: "how-the-web-works", phaseId: "web-basics", title: "How the web works", tier: "essential", level: "foundation", hours: 2,
      summary: "When you open a URL, your browser asks a server for files using HTTP, receives HTML, CSS and JavaScript, and turns them into the page you see. Knowing who does what (browser, server, DNS) makes everything later easier to reason about.",
      why: "Every web bug, from a broken image to a failed login, happens somewhere in this request–response cycle. A clear model tells you where to look.",
      objectives: ["Describe what happens between typing a URL and seeing a page", "Explain the roles of the browser, server and DNS", "Read a URL's parts: protocol, domain, path and query"],
      prerequisites: [],
      resources: [mdnLearn("How the web works", "Getting_started/Web_standards/How_the_web_works"), mdn("An overview of HTTP", "Web/HTTP/Guides/Overview"), free("Frontend Developer roadmap", "roadmap.sh", "https://roadmap.sh/frontend", "article")],
      exercises: ["Open your browser's Network tab, load a news site and identify the HTML, CSS, JavaScript and image requests.", "Explain in five sentences what happens when you visit a URL, then compare with the MDN article."],
      doneWhen: ["You can explain the request–response cycle to someone else", "You can find a page's requests and their status codes in developer tools"],
      skills: ["Web fundamentals", "HTTP"]
    },
    {
      id: "dev-setup", phaseId: "web-basics", title: "Editor, browser and developer tools", tier: "essential", level: "foundation", hours: 2,
      summary: "Install a code editor such as VS Code and learn your browser's developer tools: inspect elements, edit CSS live, read console errors and watch network requests. These tools are where you will spend most of your time.",
      why: "Developers who can inspect and debug in the browser fix problems in minutes instead of guessing for hours.",
      objectives: ["Create and open a project folder in a code editor", "Inspect and live-edit HTML and CSS in developer tools", "Read errors in the console"],
      prerequisites: [],
      resources: [mdnLearn("Environment setup", "Getting_started/Environment_setup"), mdnLearn("What are browser developer tools?", "Howto/Tools_and_setup/What_are_browser_developer_tools"), odin],
      exercises: ["Use the element inspector to change the colours and text of a website you visit (only in your browser).", "Create a project folder with an index.html file and open it in your browser."],
      doneWhen: ["You can inspect any element and see which CSS rules apply to it", "You can find and read an error in the console"],
      skills: ["Developer tools"]
    },
    {
      id: "html-basics", phaseId: "web-basics", title: "Your first HTML page", tier: "essential", level: "foundation", hours: 2,
      summary: "HTML describes the structure of content with elements such as headings, paragraphs, links and images. Each page has a head (metadata) and a body (visible content), and attributes add details like link destinations and image descriptions.",
      why: "HTML is the foundation every website and web app builds on. Clean structure makes styling, scripting and accessibility far easier.",
      objectives: ["Write a valid HTML document with head and body", "Use headings, paragraphs, lists, links and images", "Add meaningful alt text to images"],
      prerequisites: ["dev-setup"],
      example: { language: "html", code: "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\">\n    <title>Rana's page</title>\n  </head>\n  <body>\n    <h1>Hi, I'm Rana</h1>\n    <p>I'm learning web development.</p>\n    <a href=\"https://developer.mozilla.org\">My favourite docs</a>\n  </body>\n</html>" },
      resources: [mdnLearn("Basic HTML syntax", "Core/Structuring_content/Basic_HTML_syntax"), webDev("Learn HTML", "html"), fccWeb],
      exercises: ["Build an 'about me' page with a heading, a short bio, a list of interests and a link.", "Add an image with alt text that describes it for someone who cannot see it."],
      miniProject: "Personal landing page: one page with your name, a photo, a short bio and links to your profiles.",
      doneWhen: ["Your page passes the W3C validator or has no errors in developer tools", "Every image has descriptive alt text"],
      skills: ["HTML"]
    },
    {
      id: "semantic-html", phaseId: "html-css", title: "Semantic HTML and page structure", tier: "essential", level: "foundation", hours: 3,
      summary: "Semantic elements such as header, nav, main, article, section and footer describe what content is, not how it looks. Browsers, search engines and screen readers use that meaning to navigate pages.",
      why: "Semantic structure is the cheapest accessibility and SEO improvement you can make, and it makes CSS and JavaScript simpler.",
      objectives: ["Choose landmark elements for page regions", "Create a logical heading outline", "Know when a div or span is the right choice"],
      prerequisites: ["html-basics"],
      resources: [mdnLearn("Structuring content with HTML", "Core/Structuring_content"), webDev("Learn HTML: semantic HTML", "html")],
      exercises: ["Restructure a page built only with divs to use landmark elements.", "Check your heading outline with a browser extension or the accessibility tree in developer tools."],
      doneWhen: ["Your pages use main, nav, header and footer appropriately", "Headings form a logical outline without skipped levels"],
      skills: ["HTML", "Accessibility"]
    },
    {
      id: "html-forms", phaseId: "html-css", title: "Forms and inputs", tier: "essential", level: "foundation", hours: 3,
      summary: "Forms collect input with elements such as input, select, textarea and button. Every control needs a label, the right input type and built-in validation attributes like required and minlength.",
      why: "Sign-ups, searches, checkouts and job applications are all forms. Accessible, well-validated forms are a core professional skill.",
      objectives: ["Build forms with labelled controls", "Choose input types such as email, number and date", "Use built-in validation attributes"],
      prerequisites: ["semantic-html"],
      resources: [mdnLearn("Web forms", "Extensions/Forms"), webDev("Learn Forms", "forms")],
      exercises: ["Build a job application form with name, email, a role dropdown and a cover note.", "Test the form using only the keyboard and fix anything you cannot reach."],
      doneWhen: ["Every control has a visible, associated label", "Invalid input is caught by the browser before submission"],
      skills: ["HTML", "Forms", "Accessibility"]
    },
    {
      id: "css-basics", phaseId: "html-css", title: "CSS fundamentals and the box model", tier: "essential", level: "foundation", hours: 4,
      summary: "CSS styles HTML with rules made of selectors and declarations. The cascade and specificity decide which rule wins, and the box model (content, padding, border, margin) controls how much space every element takes.",
      why: "Most layout surprises come from specificity and the box model. Understanding them stops you fighting your own CSS.",
      objectives: ["Write selectors for elements, classes and states", "Explain the cascade and specificity", "Control spacing with the box model and box-sizing"],
      prerequisites: ["html-basics"],
      example: { language: "css", code: "*, *::before, *::after { box-sizing: border-box; }\n\n.card {\n  padding: 1.5rem;\n  border: 1px solid #d0d7de;\n  border-radius: 12px;\n}\n\n.card:hover { border-color: #0969da; }" },
      resources: [mdnLearn("CSS styling basics", "Core/Styling_basics"), mdnLearn("The box model", "Core/Styling_basics/Box_model"), webDev("Learn CSS", "css")],
      exercises: ["Style your about page with a colour palette, font stack and consistent spacing.", "Create two conflicting rules and predict which wins before checking in developer tools."],
      doneWhen: ["You can predict which CSS rule applies using specificity", "Spacing is consistent and uses border-box sizing"],
      skills: ["CSS"]
    },
    {
      id: "flexbox", phaseId: "html-css", title: "Flexbox layout", tier: "essential", level: "foundation", hours: 3,
      summary: "Flexbox lays items out in one direction (a row or a column), with easy control of alignment, spacing and how items grow or shrink. It is ideal for navigation bars, toolbars and card rows.",
      why: "Flexbox solves most everyday alignment problems in a few lines, replacing fragile older techniques.",
      objectives: ["Align and distribute items along both axes", "Use gap, wrap and flex-grow", "Build a responsive navigation bar"],
      prerequisites: ["css-basics"],
      resources: [mdnLearn("Flexbox", "Core/CSS_layout/Flexbox"), fccWeb],
      exercises: ["Build a navigation bar with a logo on the left and links on the right.", "Make a row of cards that wraps onto new lines on narrow screens."],
      doneWhen: ["You can centre content vertically and horizontally without guessing", "Your layouts wrap instead of overflowing on small screens"],
      skills: ["CSS", "Responsive design"]
    },
    {
      id: "css-grid", phaseId: "html-css", title: "CSS Grid layout", tier: "essential", level: "core", hours: 3,
      summary: "Grid lays content out in rows and columns at the same time. With grid-template-columns, auto-fill and minmax you can build responsive galleries and page layouts with very little code.",
      why: "Grid makes two-dimensional layouts that once needed frameworks simple and robust.",
      objectives: ["Define grid columns and rows", "Build responsive grids with auto-fill and minmax", "Place items into named areas"],
      prerequisites: ["flexbox"],
      example: { language: "css", code: ".gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 1rem;\n}" },
      resources: [mdnLearn("Grids", "Core/CSS_layout/Grids"), webDev("Learn CSS: grid", "css")],
      exercises: ["Build a project gallery that shows one to four columns depending on screen width, without media queries.", "Recreate a magazine-style layout using grid-template-areas."],
      doneWhen: ["Your gallery adapts from phone to desktop without overflow", "You can explain when to choose grid over flexbox"],
      skills: ["CSS", "Responsive design"]
    },
    {
      id: "responsive-design", phaseId: "html-css", title: "Responsive design", tier: "essential", level: "core", hours: 3,
      summary: "Responsive pages adapt to any screen using fluid sizes, flexible images, media queries and a mobile-first approach. The viewport meta tag tells phones to use the real screen width.",
      why: "Most visitors browse on phones. A site that breaks on small screens loses users and looks unprofessional.",
      objectives: ["Design mobile-first with fluid units", "Use media queries for larger screens", "Make images and media scale without overflow"],
      prerequisites: ["css-grid"],
      resources: [mdnLearn("Responsive design", "Core/CSS_layout/Responsive_Design"), fccWeb],
      exercises: ["Test your pages at 320px, 768px and 1440px and fix any overflow.", "Convert a fixed-width layout to a fluid, mobile-first one."],
      miniProject: "Responsive product landing page with a hero, feature grid, pricing cards and a sign-up form.",
      doneWhen: ["There is no horizontal scrolling at 320px", "Text stays readable when zoomed to 200%"],
      skills: ["CSS", "Responsive design"]
    },
    {
      id: "accessibility", phaseId: "html-css", title: "Web accessibility", tier: "essential", level: "core", hours: 4,
      summary: "Accessible sites work for everyone, including people using keyboards, screen readers or zoom. Key habits: semantic HTML, labels, sufficient colour contrast, visible focus and never relying on colour alone.",
      why: "Accessibility is both an ethical baseline and often a legal requirement, and employers increasingly test for it.",
      objectives: ["Navigate and operate a page with the keyboard only", "Check colour contrast and visible focus", "Apply core WCAG principles to your own pages"],
      prerequisites: ["semantic-html", "html-forms"],
      resources: [mdnLearn("Accessibility", "Core/Accessibility"), webDev("Learn Accessibility", "accessibility"), free("WCAG 2.2 quick reference", "W3C WAI", "https://www.w3.org/WAI/WCAG22/quickref/", "docs")],
      exercises: ["Complete a keyboard-only test of one of your pages and fix every barrier.", "Check every text colour pair on your site against the 4.5:1 contrast guideline."],
      doneWhen: ["Every interactive element is reachable and visible with the keyboard", "Text meets contrast guidelines"],
      skills: ["Accessibility", "WCAG"]
    },
    {
      id: "js-basics", phaseId: "js-fundamentals", title: "Variables, types and operators", tier: "essential", level: "foundation", hours: 3,
      summary: "JavaScript stores values in variables declared with const (cannot be reassigned) or let. Core types are numbers, strings, booleans, null and undefined. Use strict equality (===) to avoid surprising type conversions.",
      why: "Type confusion causes many JavaScript bugs. Knowing the basics precisely saves debugging time later.",
      objectives: ["Declare variables with const and let", "Recognise JavaScript's primitive types", "Explain why === is safer than =="],
      prerequisites: ["dev-setup"],
      example: { language: "javascript", code: "const name = \"Rana\";\nlet score = 0;\nscore += 10;\nconsole.log(`${name} has ${score} points`);\nconsole.log(\"5\" == 5);   // true  (type conversion)\nconsole.log(\"5\" === 5);  // false (strict)" },
      resources: [jsInfo("JavaScript fundamentals", "first-steps"), mdnLearn("Storing information in variables", "Core/Scripting/Variables"), fccJs],
      exercises: ["Write a script that converts a temperature from Celsius to Fahrenheit and logs a sentence.", "Predict the output of ten expressions mixing strings and numbers, then check them in the console."],
      doneWhen: ["You use const by default and let only when reassigning", "You can predict the result of common type conversions"],
      skills: ["JavaScript"]
    },
    {
      id: "js-control-flow", phaseId: "js-fundamentals", title: "Conditions and loops", tier: "essential", level: "foundation", hours: 3,
      summary: "if/else and switch choose what code runs; for, for...of and while repeat work. Combine them to filter, count and search through data.",
      why: "Decisions and repetition are the building blocks of every program's logic.",
      objectives: ["Write conditions with if/else and logical operators", "Loop over ranges and arrays", "Exit loops early with break when appropriate"],
      prerequisites: ["js-basics"],
      resources: [mdnLearn("Making decisions in your code", "Core/Scripting/Conditionals"), mdnLearn("Looping code", "Core/Scripting/Loops")],
      exercises: ["Write FizzBuzz for 1 to 100.", "Count how many numbers in an array are above the average."],
      doneWhen: ["Your conditions handle boundary values correctly", "You can choose the right loop for a task"],
      skills: ["JavaScript"]
    },
    {
      id: "js-functions", phaseId: "js-fundamentals", title: "Functions and scope", tier: "essential", level: "foundation", hours: 4,
      summary: "Functions package reusable logic with parameters and return values. Arrow functions offer a compact syntax, and scope rules decide which variables a function can access. Functions can be passed to other functions as callbacks.",
      why: "Everything in JavaScript, from event handlers to React components, is built from functions.",
      objectives: ["Write function declarations and arrow functions", "Return values instead of logging them", "Pass functions as callbacks"],
      prerequisites: ["js-control-flow"],
      example: { language: "javascript", code: "const total = (prices) => prices.reduce((sum, price) => sum + price, 0);\n\nfunction formatPrice(amount, currency = \"USD\") {\n  return new Intl.NumberFormat(\"en\", { style: \"currency\", currency }).format(amount);\n}\n\nconsole.log(formatPrice(total([12, 7.5])));" },
      resources: [mdnLearn("Functions", "Core/Scripting/Functions"), jsInfo("Functions", "function-basics")],
      exercises: ["Write a function that validates a password and returns a list of problems.", "Refactor a long script into at least four small named functions."],
      doneWhen: ["Your functions return values and have single responsibilities", "You can explain block scope with let and const"],
      skills: ["JavaScript"]
    },
    {
      id: "js-arrays", phaseId: "js-fundamentals", title: "Arrays and array methods", tier: "essential", level: "foundation", hours: 4,
      summary: "Arrays hold ordered lists. Methods such as map, filter, find, some, sort and reduce transform data declaratively, which is how most modern JavaScript and React code handles lists.",
      why: "Lists of products, messages or jobs are everywhere. Array methods make that code short and readable.",
      objectives: ["Add, remove and find items in arrays", "Transform data with map, filter and reduce", "Sort without surprising results"],
      prerequisites: ["js-functions"],
      example: { language: "javascript", code: "const jobs = [\n  { title: \"Frontend Intern\", remote: true, salary: 800 },\n  { title: \"Junior Developer\", remote: false, salary: 1200 },\n];\nconst remoteTitles = jobs.filter((job) => job.remote).map((job) => job.title);\nconsole.log(remoteTitles); // [\"Frontend Intern\"]" },
      resources: [mdnLearn("Arrays", "Core/Scripting/Arrays"), fccJs, exercism],
      exercises: ["Given a list of products, return the names of those under a price, sorted alphabetically.", "Compute the average rating per category using reduce."],
      doneWhen: ["You reach for map/filter/reduce instead of manual loops where clearer", "You can sort numbers correctly with a compare function"],
      skills: ["JavaScript"]
    },
    {
      id: "js-objects", phaseId: "js-fundamentals", title: "Objects, destructuring and spread", tier: "essential", level: "foundation", hours: 4,
      summary: "Objects group related data under named keys. Destructuring pulls values out concisely, and the spread syntax copies or merges objects and arrays without changing the originals.",
      why: "JSON from APIs, component props and application state are all objects. Immutable updates with spread are essential in React.",
      objectives: ["Create, read and update object properties", "Use destructuring for objects and arrays", "Copy and merge with spread without mutation"],
      prerequisites: ["js-arrays"],
      resources: [mdnLearn("JavaScript object basics", "Core/Scripting/Object_basics"), jsInfo("Objects: the basics", "object-basics")],
      exercises: ["Model a student with nested courses and print a summary using destructuring.", "Update one task in a list of tasks immutably and prove the original array is unchanged."],
      doneWhen: ["You can update nested data without mutating the original", "You use destructuring where it improves readability"],
      skills: ["JavaScript"]
    },
    {
      id: "js-problem-solving", phaseId: "js-fundamentals", title: "Problem-solving with JavaScript", tier: "essential", level: "foundation", hours: 6,
      summary: "Practise turning problems into code: restate the problem, work through examples by hand, write pseudocode, then implement and test small steps. Regular graded exercises build fluency fast.",
      why: "Interviews and real tasks test whether you can solve unfamiliar problems, not whether you memorised syntax.",
      objectives: ["Break problems into inputs, outputs and edge cases", "Write pseudocode before code", "Test solutions with edge cases"],
      prerequisites: ["js-objects"],
      resources: [exercism, fccJs, jsInfo("The Modern JavaScript Tutorial", "")],
      exercises: ["Solve five easy Exercism JavaScript exercises, writing pseudocode first.", "Solve one problem twice with different approaches and compare readability."],
      doneWhen: ["You can solve unfamiliar small problems without copying solutions", "You test edge cases such as empty arrays and missing values"],
      skills: ["JavaScript", "Problem solving"]
    },
    {
      id: "dom", phaseId: "browser-js", title: "The DOM: changing pages with JavaScript", tier: "essential", level: "core", hours: 4,
      summary: "The Document Object Model is the browser's live representation of your page. JavaScript can find elements with querySelector, create new ones and update text, attributes and classes to change what users see.",
      why: "Every interactive feature, from a menu toggle to a live search, works by changing the DOM.",
      objectives: ["Select elements with querySelector", "Create, update and remove elements safely", "Toggle classes to change appearance"],
      prerequisites: ["js-objects", "semantic-html"],
      example: { language: "javascript", code: "const list = document.querySelector(\"#tasks\");\nconst item = document.createElement(\"li\");\nitem.textContent = \"Learn the DOM\"; // textContent, never innerHTML, for user text\nlist.append(item);" },
      resources: [mdnLearn("DOM scripting introduction", "Core/Scripting/DOM_scripting"), odin],
      exercises: ["Render a list of jobs from an array into the page.", "Add a dark-mode toggle that switches a class on the body."],
      doneWhen: ["You render user-provided text with textContent, not innerHTML", "You can build page content from data"],
      skills: ["JavaScript", "DOM"]
    },
    {
      id: "events", phaseId: "browser-js", title: "Events and interactivity", tier: "essential", level: "core", hours: 3,
      summary: "Events such as click, input and submit tell your code that something happened. addEventListener attaches handlers, and event delegation lets one handler manage many elements, including ones added later.",
      why: "Events are how users talk to your app. Correct handling makes interfaces responsive and keyboard-friendly.",
      objectives: ["Handle click, input and keyboard events", "Prevent default form submission when appropriate", "Use event delegation for lists"],
      prerequisites: ["dom"],
      resources: [mdnLearn("Introduction to events", "Core/Scripting/Events"), jsInfo("Introduction to browser events", "introduction-browser-events")],
      exercises: ["Build a live character counter for a textarea.", "Use one delegated listener to delete any item from a list."],
      doneWhen: ["Interactions work with both mouse and keyboard", "Dynamically added items respond without new listeners"],
      skills: ["JavaScript", "DOM"]
    },
    {
      id: "form-validation", phaseId: "browser-js", title: "Client-side form validation", tier: "recommended", level: "core", hours: 3,
      summary: "Combine HTML validation attributes with JavaScript to give clear, accessible error messages as users type. Client-side checks improve experience, but servers must always validate again.",
      why: "Good validation reduces frustration and abandoned forms, and understanding its limits is an important security lesson.",
      objectives: ["Use the Constraint Validation API", "Show accessible, specific error messages", "Explain why server-side validation is still required"],
      prerequisites: ["events", "html-forms"],
      resources: [mdnLearn("Web forms", "Extensions/Forms"), webDev("Learn Forms", "forms")],
      exercises: ["Add live validation with helpful messages to your job application form.", "Make error messages announced to screen readers with aria-live or aria-describedby."],
      doneWhen: ["Errors are specific, visible and announced", "You can explain why the server must validate too"],
      skills: ["JavaScript", "Forms", "Accessibility"]
    },
    {
      id: "async-fetch", phaseId: "browser-js", title: "Async JavaScript, fetch and JSON", tier: "essential", level: "core", hours: 6,
      summary: "Network requests take time, so JavaScript handles them asynchronously with promises and async/await. fetch requests data from APIs, usually as JSON, and you must handle loading, empty and error states.",
      why: "Almost every app loads data from an API. Handling async code correctly prevents frozen pages and confusing failures.",
      objectives: ["Explain promises and async/await", "Call an API with fetch and parse JSON", "Show loading, empty and error states"],
      prerequisites: ["events"],
      example: { language: "javascript", code: "async function loadRepos(user) {\n  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos`);\n  if (!response.ok) throw new Error(`Request failed: ${response.status}`);\n  return response.json();\n}\n\nloadRepos(\"octocat\")\n  .then((repos) => console.log(repos.length))\n  .catch((error) => console.error(error.message));" },
      resources: [mdnLearn("Asynchronous JavaScript", "Extensions/Async_JS"), mdnLearn("Making network requests", "Core/Scripting/Network_requests"), jsInfo("Promises, async/await", "async"), mdnLearn("Working with JSON", "Core/Scripting/JSON")],
      exercises: ["Show a GitHub user's public repositories with loading and error states.", "Handle a failed request by showing a retry button."],
      miniProject: "Weather or currency dashboard: search a city or currency and display live data from a free public API.",
      doneWhen: ["Every request checks response.ok and handles failure", "Users always see loading, empty or error feedback"],
      skills: ["JavaScript", "REST APIs"]
    },
    {
      id: "browser-storage", phaseId: "browser-js", title: "Browser storage", tier: "recommended", level: "core", hours: 2,
      summary: "localStorage and sessionStorage keep small amounts of data in the browser as strings, so apps can remember settings or drafts between visits. Never store passwords or tokens there.",
      why: "Persisting state locally makes small apps feel complete and teaches serialisation with JSON.",
      objectives: ["Save and load data with localStorage", "Serialise objects with JSON", "Know what must never be stored in the browser"],
      prerequisites: ["async-fetch"],
      resources: [mdn("Web Storage API", "Web/API/Web_Storage_API")],
      exercises: ["Make your task list survive page reloads.", "Handle corrupted stored data without crashing the app."],
      doneWhen: ["Data persists across reloads", "Invalid stored data is detected and reset safely"],
      skills: ["JavaScript"]
    },
    {
      id: "js-modules", phaseId: "browser-js", title: "Modules and code organisation", tier: "essential", level: "core", hours: 2,
      summary: "ES modules split code into files with import and export, so each file has a clear purpose. Modern tools and browsers support modules natively.",
      why: "Organised code is easier to test, review and grow, and every framework uses modules.",
      objectives: ["Export and import functions between files", "Use script type=\"module\" in the browser", "Split an app into logical modules"],
      prerequisites: ["js-functions"],
      resources: [mdn("JavaScript modules", "Web/JavaScript/Guide/Modules")],
      exercises: ["Split a single-file app into data, rendering and storage modules.", "Explain the difference between default and named exports."],
      doneWhen: ["Each module has one clear responsibility", "Your app runs as ES modules without errors"],
      skills: ["JavaScript"]
    },
    {
      id: "js-debugging", phaseId: "browser-js", title: "Debugging and error handling", tier: "essential", level: "core", hours: 3,
      summary: "Use breakpoints, the debugger statement and the Sources panel to pause code and inspect values. try/catch handles errors you can recover from, and clear messages help users and teammates.",
      why: "Systematic debugging is faster than guessing, and good error handling keeps small failures from breaking the whole page.",
      objectives: ["Set breakpoints and step through code", "Inspect variables and the call stack", "Handle expected errors with try/catch"],
      prerequisites: ["async-fetch"],
      resources: [mdnLearn("JavaScript debugging and error handling", "Core/Scripting/Debugging_JavaScript")],
      exercises: ["Find a deliberately introduced bug using only breakpoints.", "Wrap an API call so failures show a friendly message and log details for developers."],
      doneWhen: ["You can find a bug's cause with breakpoints", "Expected failures never leave the page broken"],
      skills: ["Debugging"]
    },
    {
      id: "git-github", phaseId: "professional", title: "Git and GitHub", tier: "essential", level: "core", hours: 5,
      summary: "Git tracks every change to your code so you can experiment safely and collaborate. GitHub hosts repositories, reviews and your public portfolio of work.",
      why: "Every development team uses version control, and recruiters look at GitHub profiles.",
      objectives: ["Commit changes with clear messages", "Work on branches and merge them", "Push projects to GitHub with a .gitignore"],
      prerequisites: ["dev-setup"],
      resources: [free("Pro Git book", "git-scm.com", "https://git-scm.com/book/en/v2", "book"), free("Hello World", "GitHub Docs", "https://docs.github.com/en/get-started/using-github/hello-world", "docs"), free("Git and GitHub roadmap", "roadmap.sh", "https://roadmap.sh/git-github", "article")],
      exercises: ["Put a project under version control with meaningful commits.", "Open and merge a pull request from a feature branch."],
      doneWhen: ["Your history tells a clear story", "Dependencies and secrets are excluded via .gitignore"],
      skills: ["Git", "GitHub"]
    },
    {
      id: "npm-tooling", phaseId: "professional", title: "npm and build tools", tier: "essential", level: "core", hours: 3,
      summary: "npm installs packages and runs project scripts defined in package.json. Build tools such as Vite give you a fast dev server, modern JavaScript and optimised production builds.",
      why: "Every modern JavaScript project starts with npm and a build tool, so you need to read and run them confidently.",
      objectives: ["Read package.json and run npm scripts", "Install and remove dependencies", "Start a Vite project and build it for production"],
      prerequisites: ["js-modules", "git-github"],
      resources: [free("About npm", "npm Docs", "https://docs.npmjs.com/about-npm/", "docs"), free("Getting started", "Vite docs", "https://vite.dev/guide/", "docs"), mdnLearn("Understanding client-side tools", "Extensions/Client-side_tools")],
      exercises: ["Create a Vite project, add a dependency and build it.", "Explain the difference between dependencies and devDependencies."],
      doneWhen: ["You can set up a project from an empty folder", "package-lock.json is committed and node_modules is ignored"],
      skills: ["npm", "Vite"]
    },
    {
      id: "js-testing", phaseId: "professional", title: "Automated testing", tier: "essential", level: "core", hours: 5,
      summary: "Automated tests check your code still works after changes. Vitest runs fast unit tests with expect assertions; write tests for normal, edge and error cases.",
      why: "Tests let you refactor without fear and show employers you build reliable software.",
      objectives: ["Write unit tests with Vitest", "Cover edge and error cases", "Run tests in watch mode while developing"],
      prerequisites: ["npm-tooling", "js-problem-solving"],
      example: { language: "javascript", code: "import { describe, expect, it } from \"vitest\";\nimport { formatPrice } from \"./format\";\n\ndescribe(\"formatPrice\", () => {\n  it(\"formats dollars\", () => {\n    expect(formatPrice(12.5)).toBe(\"$12.50\");\n  });\n});" },
      resources: [free("Getting started", "Vitest docs", "https://vitest.dev/guide/", "docs")],
      exercises: ["Write six tests for your password validator.", "Break a function on purpose and confirm the tests catch it."],
      doneWhen: ["Tests cover normal, edge and error cases", "The suite runs with one npm script"],
      skills: ["Testing", "Vitest"]
    },
    {
      id: "typescript", phaseId: "professional", title: "TypeScript essentials", tier: "recommended", level: "core", hours: 6,
      summary: "TypeScript adds static types to JavaScript, catching many mistakes before your code runs. You annotate function parameters, model data with types and interfaces, and narrow union types safely.",
      why: "TypeScript is now standard in many professional teams and job postings, and it makes large codebases far easier to change.",
      objectives: ["Type variables, functions and objects", "Model data with interfaces and union types", "Narrow types before using them"],
      prerequisites: ["npm-tooling"],
      resources: [free("TypeScript in 5 minutes", "TypeScript docs", "https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html", "docs"), free("The TypeScript Handbook", "TypeScript docs", "https://www.typescriptlang.org/docs/handbook/intro.html", "docs"), free("TypeScript roadmap", "roadmap.sh", "https://roadmap.sh/typescript", "article")],
      exercises: ["Convert a small JavaScript project to TypeScript with strict mode.", "Model an API response as a union of success and error states."],
      doneWhen: ["Strict type checking passes without any", "Unexpected data is narrowed or validated before use"],
      skills: ["TypeScript"]
    },
    {
      id: "web-performance", phaseId: "professional", title: "Web performance", tier: "recommended", level: "core", hours: 3,
      summary: "Fast sites load only what they need: optimised images, less JavaScript and good caching. Core Web Vitals measure loading, interactivity and visual stability as users experience them.",
      why: "Slow pages lose users and rank lower in search. Performance is a visible sign of craftsmanship.",
      objectives: ["Measure a page with Lighthouse", "Explain the Core Web Vitals", "Optimise images and reduce unused JavaScript"],
      prerequisites: ["npm-tooling", "responsive-design"],
      resources: [webDev("Learn Performance", "performance"), free("Web Vitals", "web.dev", "https://web.dev/articles/vitals", "article"), mdnLearn("Web performance", "Extensions/Performance")],
      exercises: ["Run Lighthouse on your portfolio and fix the top three issues.", "Serve appropriately sized, modern-format images."],
      doneWhen: ["Your portfolio scores well in Lighthouse performance", "Images have explicit sizes and do not cause layout shift"],
      skills: ["Performance"]
    },
    {
      id: "web-security", phaseId: "professional", title: "Web security basics", tier: "essential", level: "core", hours: 3,
      summary: "Common web attacks include cross-site scripting (XSS), cross-site request forgery and leaked secrets. Escape output, never insert untrusted HTML, use HTTPS and keep API keys off the client.",
      why: "Security mistakes in web apps can expose users' data. Basic habits prevent the most common vulnerabilities.",
      objectives: ["Explain XSS and prevent it", "Keep secrets out of client-side code", "Understand CORS at a basic level"],
      prerequisites: ["dom", "async-fetch"],
      resources: [mdn("Security on the web", "Web/Security"), free("XSS prevention cheat sheet", "OWASP", "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html", "docs"), mdn("Cross-Origin Resource Sharing (CORS)", "Web/HTTP/Guides/CORS")],
      exercises: ["Show how innerHTML with user input enables XSS, then fix it with textContent.", "Audit a project for secrets committed to Git."],
      doneWhen: ["No user input is inserted as HTML", "No API secret ships in client code"],
      skills: ["Security"]
    },
    {
      id: "deploy-static", phaseId: "professional", title: "Deploying websites", tier: "essential", level: "core", hours: 2,
      summary: "Static sites can be published for free with services such as GitHub Pages. Deploying early lets you share work, test on real phones and practise a release workflow.",
      why: "A live URL is far stronger evidence of your skills than code that only runs on your laptop.",
      objectives: ["Publish a site with GitHub Pages", "Build a production version before deploying", "Check the deployed site on a real phone"],
      prerequisites: ["git-github"],
      resources: [free("Creating a GitHub Pages site", "GitHub Docs", "https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site", "docs")],
      exercises: ["Deploy your landing page and share the link.", "Set up a workflow where pushing to main updates the live site."],
      doneWhen: ["Your site has a public HTTPS URL", "Updates go live by pushing to the repository"],
      skills: ["Deployment", "GitHub"]
    },
    {
      id: "react-components", phaseId: "react", title: "React components and props", tier: "essential", level: "core", hours: 6,
      summary: "React builds interfaces from components: functions that return JSX describing UI. Props pass data from parent to child, and lists need stable keys so React can update them correctly.",
      why: "React is the most widely used front-end library in job postings, and its component model shapes modern front-end work.",
      objectives: ["Write function components with JSX", "Pass data with props and compose components", "Render lists with stable keys"],
      prerequisites: ["js-objects", "npm-tooling", "dom"],
      example: { language: "javascript", code: "function JobCard({ title, company, remote }) {\n  return (\n    <article className=\"job-card\">\n      <h3>{title}</h3>\n      <p>{company}{remote && \" · Remote\"}</p>\n    </article>\n  );\n}\n\nexport function JobList({ jobs }) {\n  return jobs.map((job) => <JobCard key={job.id} {...job} />);\n}" },
      resources: [react("Quick Start", ""), react("Thinking in React", "/thinking-in-react"), free("React roadmap", "roadmap.sh", "https://roadmap.sh/react", "article")],
      exercises: ["Rebuild your job list as React components.", "Split a page mock-up into a component tree before coding it."],
      doneWhen: ["Components are small and reusable", "Lists use stable keys from data, not array indexes"],
      skills: ["React", "JavaScript"]
    },
    {
      id: "react-state", phaseId: "react", title: "State and events in React", tier: "essential", level: "core", hours: 6,
      summary: "useState gives components memory. Update state immutably, lift shared state to the closest common parent, and derive values instead of duplicating state.",
      why: "Most React bugs come from duplicated or mutated state. Good state design keeps apps predictable.",
      objectives: ["Manage state with useState", "Update arrays and objects immutably", "Lift state up and derive computed values"],
      prerequisites: ["react-components", "events"],
      resources: [react("Managing State", "/managing-state"), free("Front End Development Libraries", "freeCodeCamp", "https://www.freecodecamp.org/learn/front-end-development-libraries", "interactive")],
      exercises: ["Build a task board with add, edit, complete and delete.", "Add filtering without storing the filtered list in state."],
      doneWhen: ["No state is mutated directly", "Filtered and computed data is derived, not duplicated"],
      skills: ["React"]
    },
    {
      id: "react-data", phaseId: "react", title: "Effects and fetching data", tier: "essential", level: "advanced", hours: 5,
      summary: "Effects synchronise components with external systems such as network requests or timers. Many apparent effects are unnecessary; when you do fetch, handle loading, errors, cleanup and race conditions.",
      why: "Misused effects cause infinite loops and stale data. Knowing when not to use them is a senior-level habit learned early.",
      objectives: ["Fetch data in an effect with cleanup", "Handle loading, error and empty states", "Recognise when an effect is not needed"],
      prerequisites: ["react-state", "async-fetch"],
      resources: [react("Synchronizing with Effects", "/synchronizing-with-effects"), react("You Might Not Need an Effect", "/you-might-not-need-an-effect")],
      exercises: ["Load jobs from an API with loading and error states.", "Prevent a stale response from overwriting newer results when the search changes quickly."],
      doneWhen: ["Effects clean up and never loop", "Fast typing never shows stale results"],
      skills: ["React", "REST APIs"]
    },
    {
      id: "react-routing", phaseId: "react", title: "Routing and multi-page apps", tier: "essential", level: "advanced", hours: 4,
      summary: "Client-side routing maps URLs to views so users can bookmark, share and use the back button. React Router handles routes, links, URL parameters and not-found pages.",
      why: "Real applications have many screens. Shareable URLs are a basic expectation of users.",
      objectives: ["Define routes and navigate with links", "Read URL parameters", "Handle unknown routes gracefully"],
      prerequisites: ["react-state"],
      resources: [free("Installation and routing", "React Router docs", "https://reactrouter.com/start/declarative/installation", "docs")],
      exercises: ["Add list and detail pages to your job board with shareable URLs.", "Keep search filters in the URL so reload preserves them."],
      doneWhen: ["Every screen has its own URL", "Reloading or sharing a URL shows the same view"],
      skills: ["React", "Routing"]
    },
    {
      id: "react-testing", phaseId: "react", title: "Testing React components", tier: "recommended", level: "advanced", hours: 4,
      summary: "React Testing Library tests components the way users use them: finding elements by role and label, clicking and typing, then checking what appears on screen.",
      why: "User-focused tests catch real regressions and also encourage accessible markup.",
      objectives: ["Render components in tests", "Query by role and label", "Simulate user interactions"],
      prerequisites: ["react-state", "js-testing"],
      resources: [free("React Testing Library introduction", "Testing Library", "https://testing-library.com/docs/react-testing-library/intro/", "docs"), free("Getting started", "Vitest docs", "https://vitest.dev/guide/", "docs")],
      exercises: ["Test adding and deleting a task in your task board.", "Write a test that fails if a button loses its accessible name."],
      doneWhen: ["Tests query by role or label, not CSS classes", "Main user flows are covered"],
      skills: ["React", "Testing"]
    },
    {
      id: "nextjs", phaseId: "react", title: "Next.js (React framework)", tier: "optional", level: "advanced", hours: 8,
      summary: "Next.js adds file-based routing, server rendering and API routes to React, and is widely used for production sites.",
      why: "Many companies build React products with a framework like Next.js; knowing one broadens your options.",
      objectives: ["Create pages with file-based routing", "Fetch data on the server", "Deploy a Next.js app"],
      prerequisites: ["react-routing", "react-data"],
      resources: [free("Learn Next.js", "Next.js", "https://nextjs.org/learn", "course")],
      exercises: ["Complete the official Next.js learn course.", "Rebuild one page of your job board with server-side data fetching."],
      doneWhen: ["You can explain server versus client components", "Your Next.js app is deployed"],
      skills: ["Next.js", "React"]
    },
    {
      id: "node-basics", phaseId: "node", title: "Node.js fundamentals", tier: "essential", level: "core", hours: 4,
      summary: "Node.js runs JavaScript on the server. It reads files, handles network requests and runs tools, using the same language you know from the browser but with different APIs and no DOM.",
      why: "Using one language across front end and back end makes you productive on full-stack teams.",
      objectives: ["Run scripts with Node.js", "Read environment variables and files", "Explain how Node differs from the browser"],
      prerequisites: ["js-modules", "async-fetch", "npm-tooling"],
      resources: [free("Introduction to Node.js", "Node.js Learn", "https://nodejs.org/learn/getting-started/introduction-to-nodejs", "docs"), free("Node.js roadmap", "roadmap.sh", "https://roadmap.sh/nodejs", "article")],
      exercises: ["Write a script that reads a JSON file and prints a summary.", "Load a configuration value from an environment variable with a safe default."],
      doneWhen: ["You can run and debug Node scripts", "Configuration comes from environment variables, not code"],
      skills: ["Node.js", "JavaScript"]
    },
    {
      id: "express-api", phaseId: "node", title: "REST APIs with Express", tier: "essential", level: "core", hours: 6,
      summary: "Express maps HTTP methods and paths to handler functions. Good APIs validate input, return meaningful status codes and use a consistent JSON format for success and errors.",
      why: "REST APIs connect front ends, mobile apps and other services; they are a core back-end responsibility.",
      objectives: ["Create routes for CRUD operations", "Validate input and return correct status codes", "Handle errors consistently with middleware"],
      prerequisites: ["node-basics", "how-the-web-works"],
      example: { language: "javascript", code: "import express from \"express\";\nconst app = express();\napp.use(express.json());\n\nconst jobs = new Map();\napp.post(\"/jobs\", (req, res) => {\n  const title = String(req.body?.title ?? \"\").trim();\n  if (!title) return res.status(400).json({ error: \"Title is required\" });\n  const id = crypto.randomUUID();\n  jobs.set(id, { id, title });\n  res.status(201).json(jobs.get(id));\n});\n\napp.listen(3000);" },
      resources: [free("Hello world", "Express docs", "https://expressjs.com/en/starter/hello-world/", "docs"), free("Routing", "Express docs", "https://expressjs.com/en/guide/routing/", "docs"), free("Back End Development and APIs", "freeCodeCamp", "https://www.freecodecamp.org/learn/back-end-development-and-apis", "interactive")],
      exercises: ["Build CRUD endpoints for a job board API.", "Return 400, 404 and 500 responses with a consistent error format."],
      doneWhen: ["Invalid input never reaches your data layer", "Every endpoint returns an appropriate status code"],
      skills: ["Node.js", "Express", "REST APIs"]
    },
    {
      id: "sql-node", phaseId: "node", title: "SQL databases for APIs", tier: "essential", level: "core", hours: 6,
      summary: "Relational databases such as PostgreSQL store data in tables queried with SQL. From Node, always use parameterised queries, and design tables with keys and constraints that keep data consistent.",
      why: "Persistent, consistent data is what turns a demo into a real service, and SQL is one of the most requested skills.",
      objectives: ["Write SELECT, INSERT, UPDATE and JOIN queries", "Design tables with primary and foreign keys", "Use parameterised queries from Node"],
      prerequisites: ["express-api"],
      resources: [free("SQLBolt interactive lessons", "SQLBolt", "https://sqlbolt.com/", "interactive"), free("PostgreSQL tutorial", "PostgreSQL docs", "https://www.postgresql.org/docs/current/tutorial.html", "docs")],
      exercises: ["Complete the first ten SQLBolt lessons.", "Move your job board API from memory to PostgreSQL with parameterised queries."],
      doneWhen: ["Data survives server restarts", "No query concatenates user input"],
      skills: ["SQL", "PostgreSQL", "Databases"]
    },
    {
      id: "node-auth", phaseId: "node", title: "Authentication and authorisation", tier: "essential", level: "advanced", hours: 5,
      summary: "Authentication proves who a user is; authorisation decides what they may do. Hash passwords with a dedicated algorithm, use secure HTTP-only cookies or tokens over HTTPS, and check ownership on every request.",
      why: "Broken access control is one of the most common and serious security failures in web applications.",
      objectives: ["Store passwords only as strong hashes", "Protect routes with authentication", "Enforce that users access only their own data"],
      prerequisites: ["sql-node", "web-security"],
      resources: [free("Authentication cheat sheet", "OWASP", "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html", "docs"), free("Password storage cheat sheet", "OWASP", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html", "docs"), free("OWASP Top 10", "OWASP", "https://owasp.org/projects/top-ten", "article")],
      exercises: ["Add registration and login with hashed passwords.", "Write a test proving one user cannot edit another user's job posting."],
      doneWhen: ["No plain-text passwords exist anywhere", "Ownership checks are covered by tests"],
      skills: ["Authentication", "Security"]
    },
    {
      id: "api-deploy", phaseId: "node", title: "Deploying APIs", tier: "essential", level: "advanced", hours: 4,
      summary: "Deploy your API to a hosting service with environment-based configuration, a managed database and a health-check endpoint. Keep secrets in the host's configuration, never in the repository.",
      why: "A working public API is strong portfolio evidence and teaches real release discipline.",
      objectives: ["Configure an app entirely with environment variables", "Add a health endpoint", "Deploy and verify a live API"],
      prerequisites: ["express-api", "git-github"],
      resources: [free("Introduction to Node.js", "Node.js Learn", "https://nodejs.org/learn/getting-started/introduction-to-nodejs", "docs"), free("Back-end developer roadmap", "roadmap.sh", "https://roadmap.sh/backend", "article")],
      exercises: ["Deploy your API on a free tier and document the steps in the README.", "Make a failed database connection visible in the health endpoint."],
      doneWhen: ["The API has a public URL and a passing health check", "No secrets are committed"],
      skills: ["Deployment", "Node.js"]
    },
    {
      id: "portfolio-docs", phaseId: "career", title: "Portfolio and project documentation", tier: "recommended", level: "core", hours: 3,
      summary: "Present your best two or three projects with live links, readable code and READMEs that explain the problem, features, setup and limitations. Quality beats quantity.",
      why: "Reviewers spend minutes per candidate. Clear, deployed projects are how you stand out.",
      objectives: ["Write READMEs that let others run your project", "Present projects with live links and screenshots", "Describe your decisions honestly"],
      prerequisites: ["git-github", "deploy-static"],
      resources: [free("About READMEs", "GitHub Docs", "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes", "docs"), free("Full Stack JavaScript path", "The Odin Project", "https://www.theodinproject.com/paths/full-stack-javascript", "course")],
      exercises: ["Rewrite the README of your best project and ask a friend to run it from the README alone.", "Publish your portfolio with CareerForge's website publishing or GitHub Pages."],
      doneWhen: ["Each featured project has a live link and a clear README", "Someone else can run your project without help"],
      skills: ["Communication", "GitHub"]
    },
    {
      id: "interview-prep", phaseId: "career", title: "Technical interview preparation", tier: "recommended", level: "core", hours: 8,
      summary: "Practise explaining your projects, solving JavaScript problems aloud and answering common front-end or back-end questions. Short, regular practice beats last-minute cramming.",
      why: "Interviews test communication as much as knowledge. Practice turns skills into offers.",
      objectives: ["Explain a project's design and trade-offs in two minutes", "Solve small problems aloud with a clear method", "Review core web and JavaScript concepts"],
      prerequisites: ["js-problem-solving", "js-testing"],
      resources: [free("Tech Interview Handbook", "Tech Interview Handbook", "https://www.techinterviewhandbook.org/", "article"), free("Coding interview prep", "freeCodeCamp", "https://www.freecodecamp.org/learn/coding-interview-prep", "interactive"), exercism],
      exercises: ["Record a two-minute walkthrough of your best project and refine it.", "Solve two timed problems a week for a month, talking through your approach."],
      doneWhen: ["You can explain each portfolio project clearly", "You solve easy problems within 20 minutes while explaining"],
      skills: ["Interviewing", "Problem solving"]
    }
  ],
  projects: [
    {
      id: "landing-page", title: "Personal landing page", level: "beginner", branch: null,
      objective: "Publish a one-page site that introduces you, with semantic HTML, a clean responsive layout and accessible links.",
      requires: ["semantic-html", "css-basics", "flexbox"],
      stack: ["HTML", "CSS"],
      requirements: ["Header, main and footer landmarks with a logical heading outline", "Profile photo with alt text and links to your profiles", "Readable at 320px and 1440px", "Visible keyboard focus on every link"],
      stretch: ["Dark and light themes", "A contact form"],
      milestones: ["Write the content", "Structure with semantic HTML", "Style and lay out", "Test and deploy"],
      doneWhen: ["The page is live on a public URL", "It passes a keyboard-only check"],
      portfolioValue: "A simple, polished first project that proves you can ship.",
      skills: ["HTML", "CSS"]
    },
    {
      id: "product-landing", title: "Responsive product page", level: "beginner", branch: null,
      objective: "Build a marketing page for a fictional product with a hero, feature grid, pricing cards and sign-up form that works on every screen size.",
      requires: ["css-grid", "responsive-design", "html-forms"],
      stack: ["HTML", "CSS"],
      requirements: ["Mobile-first responsive layout with grid and flexbox", "Accessible sign-up form with validation", "Optimised images", "No horizontal scrolling at 320px"],
      stretch: ["Subtle animations that respect reduced-motion preferences", "A pricing toggle"],
      milestones: ["Wireframe", "Build mobile layout", "Enhance for larger screens", "Accessibility and performance pass"],
      doneWhen: ["Layout works from 320px to 1440px", "Lighthouse accessibility score is high"],
      portfolioValue: "Demonstrates layout skill and attention to detail, which front-end reviewers look for first.",
      skills: ["HTML", "CSS", "Responsive design", "Accessibility"]
    },
    {
      id: "todo-app", title: "Task manager", level: "beginner", branch: null,
      objective: "Build an interactive task manager with add, edit, complete, filter and delete actions that survives reloads.",
      requires: ["dom", "events", "browser-storage"],
      stack: ["HTML", "CSS", "JavaScript"],
      requirements: ["Add, edit, complete and delete tasks", "Filter all, active and completed", "Persist tasks in localStorage", "Works fully with the keyboard"],
      stretch: ["Drag-and-drop reordering", "Due dates with overdue highlighting"],
      milestones: ["Data model and rendering", "Interactions", "Persistence", "Accessibility and polish"],
      doneWhen: ["Tasks survive reloads and corrupted storage is handled", "Every action works with the keyboard"],
      portfolioValue: "Shows DOM skills, state handling and persistence in a familiar domain.",
      skills: ["JavaScript", "DOM"]
    },
    {
      id: "api-dashboard", title: "Live data dashboard", level: "intermediate", branch: null,
      objective: "Search and display live data from a free public API, with loading, empty and error states and a clean responsive layout.",
      requires: ["async-fetch", "js-modules", "responsive-design"],
      stack: ["HTML", "CSS", "JavaScript", "Public API"],
      requirements: ["Search input that calls a public API", "Loading, empty and error states with retry", "Results rendered safely with textContent", "Responsive layout"],
      stretch: ["Cache recent searches", "Charts of the data"],
      milestones: ["Choose an API and read its terms", "Fetch and render", "Error handling", "Polish and deploy"],
      doneWhen: ["Network failures show a helpful retry", "No user or API data is inserted as HTML"],
      portfolioValue: "Demonstrates async JavaScript and API integration, core skills for any front-end role.",
      skills: ["JavaScript", "REST APIs"]
    },
    {
      id: "react-job-board", title: "React job board", level: "intermediate", branch: "react",
      objective: "Build a job board in React with search, filters, a detail page per job and saved jobs.",
      requires: ["react-state", "react-routing", "react-data"],
      stack: ["React", "React Router", "Vite"],
      requirements: ["List and detail pages with shareable URLs", "Search and filters kept in the URL", "Loading, error and empty states", "Saved jobs persisted locally"],
      stretch: ["Component tests with Testing Library", "TypeScript"],
      milestones: ["Component tree and routes", "Data fetching", "Filters and saved jobs", "Tests and deployment"],
      doneWhen: ["Reloading any URL shows the same view", "Main flows are covered by tests"],
      portfolioValue: "A realistic React application of the kind front-end interviews discuss.",
      skills: ["React", "JavaScript", "Routing"]
    },
    {
      id: "react-dashboard", title: "Accessible analytics dashboard", level: "advanced", branch: "react",
      objective: "Build a typed, tested React dashboard that visualises data, handles loading and errors, and meets accessibility standards.",
      requires: ["react-testing", "typescript", "web-performance"],
      stack: ["React", "TypeScript", "Vitest", "Testing Library"],
      requirements: ["Typed data model and components", "Charts with text alternatives", "Keyboard-accessible filters", "Tests for core interactions", "Good Lighthouse performance"],
      stretch: ["Server rendering with Next.js", "Dark mode"],
      milestones: ["Types and data", "Components and charts", "Accessibility pass", "Tests and performance"],
      doneWhen: ["Strict TypeScript passes", "Charts have accessible text equivalents"],
      portfolioValue: "Strong evidence for mid-level front-end roles: types, tests, accessibility and performance together.",
      skills: ["React", "TypeScript", "Testing", "Accessibility"]
    },
    {
      id: "rest-api", title: "Job board REST API", level: "intermediate", branch: "node",
      objective: "Build a documented REST API for job postings with validation, SQL persistence and tests.",
      requires: ["express-api", "sql-node", "js-testing"],
      stack: ["Node.js", "Express", "PostgreSQL"],
      requirements: ["CRUD endpoints with validation", "PostgreSQL storage with parameterised queries", "Consistent JSON errors", "Automated endpoint tests"],
      stretch: ["Pagination and search", "OpenAPI documentation"],
      milestones: ["Endpoint design", "Express routes", "Database", "Tests and docs"],
      doneWhen: ["Every endpoint has tests including errors", "No query concatenates input"],
      portfolioValue: "A core back-end portfolio piece covering API design, SQL and testing.",
      skills: ["Node.js", "Express", "SQL", "REST APIs"]
    },
    {
      id: "full-stack-app", title: "Full-stack job tracker", level: "advanced", branch: "node",
      objective: "Combine a React front end with your Node.js API so users can sign up and track their own job applications.",
      requires: ["node-auth", "api-deploy", "react-data", "react-routing"],
      stack: ["React", "Node.js", "Express", "PostgreSQL"],
      requirements: ["Sign-up and login with hashed passwords", "Users see and edit only their own applications", "Deployed front end and API", "README with architecture and setup"],
      stretch: ["Email reminders", "Continuous integration running tests"],
      milestones: ["API with auth", "React client", "Integration and ownership tests", "Deployment"],
      doneWhen: ["Both parts are live and connected", "Ownership is enforced by tests"],
      portfolioValue: "End-to-end proof that you can build, secure and ship a complete product.",
      skills: ["React", "Node.js", "Authentication", "PostgreSQL"]
    }
  ]
};
