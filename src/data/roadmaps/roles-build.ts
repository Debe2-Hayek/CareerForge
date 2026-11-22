import type { RoadmapSource } from "./types";

// Roles that build products: web, mobile, games, quality and architecture.
export const buildRoles: RoadmapSource[] = [
[{ id: "frontend", kind: "role", title: "Frontend Developer", area: "web", tagline: "Build fast, accessible interfaces people enjoy using.", keywords: ["frontend", "front-end", "html", "css", "javascript", "react", "ui developer", "web developer"], courseTopics: ["HTML and CSS", "JavaScript", "React", "TypeScript"], related: ["javascript", "react", "typescript", "full-stack", "ux-design"], roadmapSh: "frontend" }, `
## The web | Know what happens between typing an address and seeing a page. | Explain each step of loading a page, from DNS to paint.
- @internet
- @http
- @dns
+ @hosting
- Browsers and rendering | Parsing, the render tree, layout, paint and developer tools. | mdn:Web/Performance/Guides/How_browsers_work
## Pages | Structure and style any page without a framework. | Rebuild a news article page from scratch, readable on a phone. | odin
- @html
- @css
- @css-layout
- @responsive
- @a11y
## Interaction | Make pages respond to people and data. | Build a search box that loads results from a public API. | jsinfo:
- @javascript
- @dom
- @fetch-async
- Forms and validation | Native validation, helpful errors and safe submission. | mdn:Learn_web_development/Extensions/Forms
- Browser storage | Cookies, localStorage and IndexedDB, and when not to use them. | mdn:Web/API/Web_Storage_API
## Working like a team | Track, share and package your code. | Open a pull request with a clear description and review someone else's.
- @git
- @github
- @npm
- Linting and formatting | Let ESLint and Prettier settle style and catch bugs. | web:eslint.org/docs/latest/use/getting-started
- Build tools | Bundle, transpile and run a fast dev server with Vite. | web:vite.dev/guide/
## A framework | Build interfaces from components. | Build a multi-page task app with shared state.
- @typescript
- React | Components, props, state, effects and data flow. | react:learn, map:react
? Vue | An approachable alternative with single-file components. | vue:introduction.html, map:vue
? Angular | A full framework common in large organisations. | ng:overview, map:angular
- Routing | Map addresses to screens and load data for them. | web:reactrouter.com/home
- State management | Local state first, then shared and server state. | react:learn/managing-state
+ Component styling | CSS Modules, Tailwind CSS and design tokens. | web:tailwindcss.com/docs/installation
## Quality | Ship with confidence. | Get a Lighthouse score above 90 and fix what it flags.
- @unit-testing
- Component testing | Test what users see with Testing Library. | testingjs
- @e2e-testing
- @web-performance
- @web-security
## Going further | Grow from building screens to shaping products. | Deploy a server-rendered app with an automated pipeline.
+ Server rendering | SSR, static generation and streaming with Next.js. | next:learn, map:nextjs
+ Progressive web apps | Offline support and installable sites. | webdev:learn/pwa
+ @graphql
+ @design-system
+ @ci-cd
- @portfolio
* Personal portfolio | beginner | A responsive site that presents you and your work. | Semantic HTML with one h1 per page; Works from 320px to desktop; Passes an automated accessibility check; Deployed on a free host | HTML, CSS, Accessibility
* Recipe finder | beginner | Search a public recipe API and save favourites. | Loading, empty and error states; Debounced search; Favourites survive a reload | JavaScript, APIs
* Kanban board | intermediate | Drag cards between columns with full keyboard support. | Keyboard and pointer moves; State saved locally; Component tests for the main flow | React, TypeScript, Testing
* Accessible component kit | advanced | Dialog, menu, tabs and combobox following ARIA patterns. | Documented with examples; Keyboard tested; Published as a package; Visual tests in CI | Accessibility, Design systems
`],
[{ id: "backend", kind: "role", title: "Backend Developer", area: "web", tagline: "Build the APIs, data and services behind every product.", keywords: ["backend", "back-end", "api", "server", "node", "java", "python", "sql"], courseTopics: ["NodeJS", "Java", "Databases", "SQL", "Django"], related: ["nodejs", "java", "api-design", "sql", "system-design"], roadmapSh: "backend" }, `
## Foundations | Understand the platform your code runs on. | Trace a request to a server with curl and explain each header.
- @internet
- @http
- @dns
- @linux
- @shell
- @git
- @github
## One language, well | Become productive in a single backend language before adding another. | Build a command-line tool with tests and a README. | exercism
- @python
? JavaScript and Node.js | One language across browser and server. | node:en/learn/getting-started/introduction-to-nodejs, map:nodejs
? Java | Strongly typed and widely used in large companies. | java:, map:java
? Go | Small, fast and popular for services. | go:tour/, map:go
? C# and .NET | A productive platform for services and cloud. | ms:dotnet/csharp/tour-of-csharp/, map:csharp
- @clean-code
- Debugging | Reproduce, isolate and fix with a debugger, not guesses. | missing
## Data | Store and query information correctly. | Design a schema for a library system and write ten useful queries.
- @sql
- @db-design
- @postgres
- @db-indexes
- @transactions
- @orm
+ @nosql
## APIs | Offer your data safely to other programs. | Publish a documented CRUD API with pagination and validation.
- @rest
- Input validation | Reject bad data at the edge with clear errors. | owaspcs:Input_Validation_Cheat_Sheet.html
- API documentation | Describe endpoints with OpenAPI so clients can rely on them. | openapi:
+ @graphql
+ @websockets
+ gRPC | Fast typed calls between services. | web:grpc.io/docs/what-is-grpc/introduction/
## Identity and security | Protect accounts and data. | Add sign-in, roles and rate limits, then attack your own API.
- @authn
- @authz
- @oauth
- @password-storage
- @owasp-top10
- @secrets
## Reliable delivery | Test, package and run it. | Deploy with a pipeline that blocks failing tests.
- @unit-testing
- @integration-testing
- @docker
- @ci-cd
- @nginx
- @logging
- @monitoring
## Scale | Handle growth without rewriting everything. | Load test an endpoint, find the bottleneck and fix it.
- @caching
- @redis
- @queues
- @monolith
+ @microservices
+ @event-driven
- @system-design
* Expense tracker API | beginner | Record and report spending per category. | CRUD endpoints; Validation with useful errors; Monthly summary; Automated tests | REST, SQL
* URL shortener | intermediate | Create short links and count visits. | Collision-safe codes; Expiry; Rate limiting; Visit statistics | API design, Redis
* Booking service | intermediate | Reserve seats without double booking. | Transactions prevent conflicts; Sign-in and roles; Email sent from a queue | SQL, Queues, Auth
* Event-driven store | advanced | Orders, payments and stock as separate services. | Idempotent consumers; Retries and dead letters; Tracing across services; One-command local setup | Microservices, Messaging
`],
[{ id: "full-stack", kind: "role", title: "Full Stack Developer", area: "web", tagline: "Take an idea from database to deployed interface.", keywords: ["full stack", "fullstack", "web developer", "react", "node", "mern"], courseTopics: ["Web Development", "JavaScript", "NodeJS", "React"], related: ["frontend", "backend", "nextjs", "web-development"], roadmapSh: "full-stack" }, `
## Front end basics | Build pages people can use. | Ship a responsive three-page site. | odin
- @html
- @css
- @css-layout
- @javascript
- @dom
- @a11y
## Tools | Work in small, safe steps. | Publish a project with a clear README and history.
- @git
- @github
- @npm
- @shell
## Modern interface | Build an app, not just pages. | Create a dashboard with routes and loading states. | fso
- @typescript
- React | Components, state, effects and composition. | react:learn, map:react
- @fetch-async
- Server state | Cache, refetch and update remote data predictably. | web:tanstack.com/query/latest/docs/framework/react/overview
+ Styling systems | Utility classes, tokens and reusable components. | web:tailwindcss.com/docs/installation
## Server and data | Give the interface something real to talk to. | Replace mock data with your own API. | fso
- Node.js server | Routes, middleware and error handling. | node:en/learn/getting-started/introduction-to-nodejs, map:nodejs
- @rest
- @sql
- @postgres
- @orm
+ @redis
## Accounts and safety | Protect people's data. | Add sign-up, sign-in and owner-only records.
- @authn
- @authz
- @jwt
- @web-security
## One framework for both | Combine server and client where it helps. | Rebuild your app with server rendering.
- Next.js | Routing, server components, actions and caching. | next:learn, map:nextjs
+ @websockets
+ File uploads | Validate, store and serve files safely. | owaspcs:File_Upload_Cheat_Sheet.html
## Ship it | Make delivery boring. | Deploy automatically after tests pass.
- @unit-testing
- @e2e-testing
- @docker
- @ci-cd
- @monitoring
- @web-performance
- @portfolio
* Notes app | beginner | Create, search and organise notes with an account. | Sign-in; Owner-only data; Works on phones | React, Node.js, SQL
* Job application tracker | intermediate | Track applications, stages and reminders. | Filters and search; Email reminders; Tests for key flows; Deployed | Full stack, Testing
* Team chat | advanced | Channels, presence and message history. | Real-time updates; Permissions; File sharing with limits; Horizontal scaling plan | WebSockets, Redis
`],
[{ id: "android", kind: "role", title: "Android Developer", area: "mobile", tagline: "Build native apps for billions of devices with Kotlin.", keywords: ["android", "kotlin", "mobile developer", "jetpack compose"], courseTopics: ["Android", "Kotlin"], related: ["ios", "flutter", "react-native", "java"], roadmapSh: "android" }, `
## Kotlin | Learn the language Android is written in. | Solve twenty Kotlin exercises. | exercism
- Kotlin basics | Variables, functions, control flow and collections. | kotlin:basic-syntax.html
- Null safety | Make missing values explicit and safe. | kotlin:null-safety.html
- Classes and objects | Data classes, sealed types and interfaces. | kotlin:classes.html
- Coroutines | Run work off the main thread without callbacks. | kotlin:coroutines-overview.html
- @git
## Android basics | Create, run and debug an app. | Run your own app on a real device. | android:courses/android-basics-compose/course
- Android Studio | Projects, emulators, logs and the debugger. | android:studio/intro
- Activities and lifecycle | What happens when the user leaves and returns. | android:guide/components/activities/activity-lifecycle
- Resources and localisation | Strings, images and layouts per language and screen. | android:guide/topics/resources/providing-resources
- Permissions | Ask only when needed and handle refusal. | android:guide/topics/permissions/overview
## Interface | Build screens with Jetpack Compose. | Rebuild a screen from an app you use. | android:develop/ui/compose/documentation
- Compose layouts | Rows, columns, lists and modifiers. | android:develop/ui/compose/layouts/basics
- State in Compose | Hoist state and keep one source of truth. | android:develop/ui/compose/state
- Navigation | Move between screens and pass arguments. | android:develop/ui/compose/navigation
- Theming | Material 3 colour, type and dark mode. | android:develop/ui/compose/designsystems/material3
- @mobile-ux
? Views and XML | The older toolkit you will meet in existing apps. | android:develop/ui/views/layout/declaring-layout
## Data | Work online and offline. | Cache a list so it opens without a connection.
- Room | Local relational storage. | android:training/data-storage/room
- DataStore | Simple preferences stored safely. | android:topic/libraries/architecture/datastore
- Networking with Retrofit | Call APIs and map the responses. | android:courses/pathways/android-basics-compose-unit-5-pathway-1
- Background work | Reliable deferred jobs with WorkManager. | android:topic/libraries/architecture/workmanager
## Architecture | Keep the app understandable as it grows. | Split an app into data, domain and interface layers. | android:topic/architecture
- ViewModel and UI state | Survive rotation and separate logic from screens. | android:topic/libraries/architecture/viewmodel
- Repositories | One place that decides where data comes from. | android:topic/architecture/data-layer
- Dependency injection | Supply dependencies with Hilt. | android:training/dependency-injection/hilt-android
- App testing | Unit tests and Compose interface tests. | android:training/testing/fundamentals
## Release | Put it in people's hands. | Publish to an internal test track.
- App performance | Startup time, smooth scrolling and memory. | android:topic/performance/overview
+ Notifications | Useful, timely and respectful. | android:develop/ui/views/notifications
+ App security | Protect data, keys and network traffic. | android:privacy-and-security/security-tips
- @app-release
* Habit tracker | beginner | Track daily habits and streaks offline. | Compose interface; Local storage; Dark mode | Kotlin, Compose
* News reader | intermediate | Browse articles with offline caching. | Paged list; Saved articles; Error states; Unit tests | Retrofit, Room
* Fitness companion | advanced | Record activities with location and reminders. | Background location with consent; Charts; Battery-aware; Published test build | Architecture, Background work
`],
[{ id: "ios", kind: "role", title: "iOS Developer", area: "mobile", tagline: "Craft polished apps for iPhone and iPad with Swift.", keywords: ["ios", "swift", "swiftui", "mobile developer", "apple"], courseTopics: ["Swift", "iOS"], related: ["android", "flutter", "react-native"], roadmapSh: "ios" }, `
## Swift | Learn a safe, expressive language. | Write a small command-line game. | hackingswift
- Swift basics | Values, collections, control flow and functions. | swift:guidedtour
- Optionals | Handle missing values safely. | swift:thebasics
- Structures and classes | Value and reference types, and when to use each. | swift:classesandstructures
- Protocols and generics | Share behaviour without inheritance. | swift:protocols
- Swift concurrency | async/await, tasks and actors. | swift:concurrency
- @git
## First apps | Build and run on a device. | Put a working app on your own phone. | apple:tutorials/app-dev-training
- Xcode | Projects, simulators, previews and debugging. | apple:documentation/xcode
- App lifecycle | Scenes, foreground and background. | apple:documentation/swiftui/managing-model-data-in-your-app
- SwiftUI views | Compose screens from small views. | apple:tutorials/swiftui
- State and data flow | State, bindings and observable models. | apple:documentation/swiftui/model-data
## Interface | Feel at home on the platform. | Pass a VoiceOver walkthrough of your app.
- Human Interface Guidelines | Platform patterns users already know. | hig
- Lists and navigation | Stacks, tabs and detail screens. | apple:documentation/swiftui/navigation
- Animation | Motion that explains change. | apple:documentation/swiftui/animations
- iOS accessibility | VoiceOver, Dynamic Type and contrast. | apple:documentation/accessibility
? UIKit | The established toolkit in many existing apps. | apple:documentation/uikit
## Data | Save, sync and fetch. | Make the app fully usable offline.
- URLSession and Codable | Load JSON and decode it into types. | apple:documentation/foundation/urlsession
- SwiftData | Persist models on the device. | apple:documentation/swiftdata
- Keychain | Store secrets safely. | apple:documentation/security/keychain-services
+ CloudKit | Sync through the user's own account. | apple:documentation/cloudkit
## Engineering | Keep quality high as the app grows. | Reach meaningful test coverage of your core logic.
- App architecture | Separate interface, logic and data. | guru:design-patterns/catalog
- Swift Testing and XCTest | Unit and interface tests. | apple:documentation/testing
- Instruments | Find leaks, hangs and slow launches. | apple:tutorials/instruments
- Swift packages | Share and reuse code. | apple:documentation/xcode/swift-packages
## Release | Reach the App Store. | Send a TestFlight build to three people.
- Signing and TestFlight | Certificates, profiles and beta testing. | apple:testflight/
- Privacy on iOS | Permission prompts, privacy labels and tracking rules. | apple:app-store/app-privacy-details/
- @app-release
+ @ci-cd
* Tip and split calculator | beginner | Split a bill with clear inputs. | SwiftUI; Accessible labels; Unit-tested maths | Swift, SwiftUI
* Reading list | intermediate | Save books, notes and progress. | SwiftData; Search; Widgets; Works offline | SwiftData
* Trip planner | advanced | Plan days with maps and sharing. | MapKit; Cloud sync; Tests; TestFlight release | Architecture, MapKit
`],
[{ id: "game-developer", kind: "role", title: "Game Developer", area: "games", tagline: "Turn ideas into worlds people want to play.", keywords: ["game", "unity", "unreal", "godot", "game developer", "c++", "c#"], courseTopics: ["Game Development", "C#", "C++"], related: ["cpp", "csharp", "computer-science", "ux-design"], roadmapSh: "game-developer" }, `
## Foundations | Program and think in frames. | Make an original one-screen game with keyboard input. | cs50g
- Programming basics | Variables, functions, loops and objects in C#, C++ or GDScript. | cs50x, map:csharp
- The game loop | Input, update, render and frame-independent timing. | web:gameprogrammingpatterns.com/game-loop.html
- @git
- @oop
## Maths and physics | Make things move believably. | Write your own bouncing-ball collision. | noc
- Vectors | Position, velocity and direction. | ka:math/linear-algebra/vectors-and-spaces
- Matrices and transforms | Move, rotate and scale objects. | b3b1
- Trigonometry | Angles, circles and oscillation. | ka:math/trigonometry
- Collision detection | Boxes, circles and swept tests. | mdn:Games/Techniques/2D_collision_detection
- Game physics | Forces, friction and integration. | noc
## An engine | Use one engine well. | Finish a small complete game, menus included.
- Godot | Free and open source, with a friendly scene system. | godot:getting_started/introduction/index.html
? Unity | Widely used with a large asset ecosystem. | unity:pathway/unity-essentials
? Unreal Engine | High-end 3D with C++ and Blueprints. | web:dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-documentation
- Scenes and components | Build objects from reusable parts. | godot:getting_started/step_by_step/nodes_and_scenes.html
- Animation and input | Responsive controls and readable motion. | godot:tutorials/animation/introduction.html
- Game audio | Effects, music and mixing. | godot:tutorials/audio/audio_buses.html
## Design | Make it fun and fair. | Run five playtests and change three things.
- Core loops | What the player does, why and what they gain. | web:www.gamedeveloper.com/design
- Level design | Teach, test and surprise. | web:www.gamedeveloper.com/design
- Balancing | Difficulty curves and tuning from data. | web:www.gamedeveloper.com/design
- Playtesting | Watch silently, note confusion and iterate. | nng:usability-testing-101/
- Game accessibility | Remapping, subtitles, contrast and difficulty options. | web:gameaccessibilityguidelines.com/
## Deeper systems | Build what engines hide. | Write a state-machine enemy. | gamemath
- Game programming patterns | State, observer, object pool and component. | gamemath
- Game AI | Pathfinding, state machines and behaviour trees. | web:www.redblobgames.com/
+ Shaders | Draw with code on the GPU. | web:thebookofshaders.com/
+ Graphics programming | Pipelines, buffers and lighting. | learnopengl
+ Multiplayer networking | Authority, prediction and lag compensation. | web:gafferongames.com/
- Optimisation | Profile, batch, pool and budget frames. | godot:tutorials/performance/index.html
## Publish | Get it played. | Release a free build on itch.io.
- Build and release | Export, store pages and updates. | web:itch.io/docs/creators/getting-started
- @portfolio
* Arcade dodger | beginner | Avoid obstacles for as long as possible. | Own characters and rules; Score and restart; Sound | Game loop, Input
* Puzzle platformer | intermediate | Ten levels around one original mechanic. | Save progress; Remappable controls; Tutorial without text walls | Level design
* Co-op survival prototype | advanced | Two players survive waves online. | Server authority; Reconnection; Performance budget met | Networking, AI
`],
[{ id: "qa", kind: "role", title: "QA Engineer", area: "programming", tagline: "Find problems before users do, and prevent the next ones.", keywords: ["qa", "quality assurance", "tester", "test automation", "sdet", "testing"], courseTopics: ["Cypress", "Software Engineering"], related: ["frontend", "backend", "devops", "code-review"], roadmapSh: "qa" }, `
## Testing mindset | Know what testing can and cannot prove. | Write a one-page test strategy for an app you use. | ministry
- Why we test | Risk, cost of defects and quality beyond bugs. | ministry
- Test levels | Unit, integration, system and acceptance. | fowler:articles/practical-test-pyramid.html
- Test types | Functional, regression, smoke and non-functional. | atl:continuous-delivery/software-testing/types-of-software-testing
- @agile
## Manual testing | Explore with purpose. | Find and report five real issues in an open source project. | ministry
- Test cases and checklists | Clear steps, data and expected results. | ministry
- Test design techniques | Equivalence classes, boundaries and decision tables. | wiki:Boundary-value_analysis
- Exploratory testing | Charters, notes and time boxes. | wiki:Exploratory_testing
- Bug reports | Reproducible, minimal and prioritised. | atl:software/jira/guides/getting-started/introduction
- Browser developer tools | Network, console and storage inspection. | mdn:Learn_web_development/Howto/Tools_and_setup/What_are_browser_developer_tools
## Technical base | Talk to systems directly. | Query a database to confirm what the screen shows.
- @http
- @sql
- @linux
- @git
- Programming for testers | Enough JavaScript or Python to automate. | cs50p, map:javascript
## Automation | Automate the checks worth repeating. | Automate a sign-in and checkout flow.
- @unit-testing
- API testing | Status, schema, errors and contracts. | pw:api-testing
- @e2e-testing
- Page objects and fixtures | Keep suites readable and isolated. | pw:pom
- Flaky tests | Find causes: timing, data and shared state. | pw:test-retries
? Selenium | The long-standing browser automation standard. | web:www.selenium.dev/documentation/
+ Mobile testing | Devices, emulators and Appium. | web:appium.io/docs/en/latest/
## Beyond functional | Test what users feel. | Produce a load-test report with a recommendation.
- Performance testing | Load, stress and soak with k6. | web:grafana.com/docs/k6/latest/
- Accessibility testing | Automated rules plus keyboard and screen reader. | w3:WAI/test-evaluate/
- Security testing basics | Common flaws and safe probing. | ps:all-topics
+ Visual testing | Catch unintended interface changes. | pw:test-snapshots
## In the team | Build quality in. | Add a test gate to a pipeline.
- @ci-cd
- Test reporting | Show risk, coverage and trends honestly. | pw:test-reporters
- @monitoring
- @interviews
* Bug hunt report | beginner | Test a public demo shop and report clearly. | Charter; Ten reproducible reports; Severity explained | Manual testing
* API test suite | intermediate | Cover a public API with contract tests. | Positive and negative cases; Runs in CI; Readable report | API testing
* Automation framework | advanced | Reusable end-to-end framework. | Page objects; Parallel runs; Traces on failure; No shared state | Playwright, CI
`],
[{ id: "software-architect", kind: "role", title: "Software Architect", area: "programming", tagline: "Make the decisions that are hard to change later.", keywords: ["architect", "software architect", "solution architect", "tech lead"], courseTopics: ["Software Engineering", "System Design"], related: ["system-design", "backend", "cloud-engineer", "engineering-manager"], roadmapSh: "software-architect" }, `
## Solid engineering | Architecture rests on good code. | Refactor a module and explain every step. | guru:refactoring
- @clean-code
- @solid
- @design-patterns
- @unit-testing
- @code-review
## Architecture thinking | See structure, forces and trade-offs. | Describe a system you know with three diagrams. | cleanarch
- What architecture is | Decisions, qualities and the people affected. | cleanarch
- Quality attributes | Performance, security, availability, modifiability and cost. | wiki:List_of_system_quality_attributes
- Diagrams with C4 | Context, containers, components and code. | web:c4model.com/
- @adr
- Trade-off analysis | Compare options against what matters most. | fowler:articles/is-quality-worth-cost.html
## Styles | Choose a shape on purpose. | Argue for and against microservices for one product.
- @monolith
- Layered and hexagonal design | Keep business rules independent of technology. | web:alistair.cockburn.us/hexagonal-architecture
- @microservices
- @event-driven
- @ddd
+ CQRS and event sourcing | Separate reads from writes, and store facts. | fowler:bliki/CQRS.html
+ @serverless
## Data and integration | Connect parts without tangling them. | Design an API and its versioning policy.
- @rest
- @queues
- @db-design
- @cap
- Data consistency patterns | Sagas, outbox and idempotency. | patterns:patterns/data/saga.html
## Running well | Design for failure. | Write a resilience plan for one dependency failing.
- @scalability
- @caching
- Resilience patterns | Timeouts, retries, circuit breakers and bulkheads. | azurearch
- @monitoring
- @slo
- Security by design | Boundaries, least privilege and review. | owasp:www-project-developer-guide/
- @threat-modeling
## Influence | Lead without writing every line. | Present a decision to engineers and to executives.
- @stakeholders
- @tech-writing
- Technical leadership | Align teams, mentor and delegate. | staffeng
- Evolving legacy systems | Strangler fig and safe, incremental change. | fowler:bliki/StranglerFigApplication.html
- Cost awareness | Make price a design input. | web:www.finops.org/introduction/what-is-finops/
* Architecture review | intermediate | Review an open source project's architecture. | C4 diagrams; Three risks; Two decision records | Architecture
* Modernisation plan | advanced | Plan moving a monolith to clearer modules. | Boundaries justified; Incremental steps; Rollback for each step | DDD, Migration
* High-availability design | advanced | Design a ticket-sale system for a sudden rush. | Capacity estimate; Failure analysis; Cost range; Decision records | System design
`],
[{ id: "technical-writer", kind: "role", title: "Technical Writer", area: "product", tagline: "Make complex things clear for the people who need them.", keywords: ["technical writer", "documentation", "writer", "content"], courseTopics: ["Markdown"], related: ["api-design", "ux-design", "git-github", "product-manager"], roadmapSh: "technical-writer" }, `
## Writing well | Say it simply and accurately. | Rewrite a confusing help page at half the length. | techw:one
- @tech-writing
- Plain language | Short sentences, active voice and familiar words. | web:www.plainlanguage.gov/guidelines/
- Audience analysis | Who reads, what they know and what they need. | techw:one/audience
- Editing | Cut, order and check facts. | techw:two
## Types of docs | Use the right form for the need. | Write one tutorial, how-to, reference and explanation. | diataxis
- Tutorials | Teach by guiding a first success. | web:diataxis.fr/tutorials/
- How-to guides | Solve one real problem. | web:diataxis.fr/how-to-guides/
- Reference | Complete, consistent and scannable facts. | web:diataxis.fr/reference/
- Explanation | Give context and reasons. | web:diataxis.fr/explanation/
- Release notes | What changed and what to do. | web:keepachangelog.com/en/1.1.0/
## Tools | Write where engineers work. | Publish a docs site from a repository. | writethedocs
- Markdown | Lightweight formatting used everywhere. | web:www.markdownguide.org/getting-started/
- @git
- @github
- Docs as code | Review, version and publish docs like software. | web:www.writethedocs.org/guide/docs-as-code/
- Static site generators | Build searchable doc sites. | web:docusaurus.io/docs
- Diagrams | Explain flows with simple visuals. | web:mermaid.js.org/intro/
## Technical depth | Understand what you document. | Document a public API endpoint by trying it.
- @http
- API documentation | Endpoints, parameters, errors and examples. | openapi:, map:api-design
- Code samples | Short, tested and copyable. | writethedocs
- Testing documentation | Follow your own steps on a clean machine. | writethedocs
## Structure and impact | Help people find answers. | Reorganise a docs menu and test it with two people.
- Information architecture | Group, label and link. | nng:ia-vs-navigation/
- Search and discoverability | Titles, headings and metadata people search for. | nng:ia-vs-navigation/
- Accessible documentation | Headings, alt text and readable tables. | w3:WAI/tips/writing/
- Measuring docs | Feedback, search logs and support tickets. | writethedocs
- @portfolio
* Quick-start guide | beginner | Write a five-minute start for an open source tool. | Tested on a clean machine; Prerequisites listed; Reviewed by a beginner | Writing
* API guide | intermediate | Document a public API end to end. | Authentication; Errors; Working samples in two languages | API docs
* Documentation site | advanced | Build a versioned site with search. | Four doc types; Automated link checks; Contribution guide | Docs as code
`]
];
