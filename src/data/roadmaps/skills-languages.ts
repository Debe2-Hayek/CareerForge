import type { RoadmapSource } from "./types";

// Programming languages and application frameworks.
export const languageSkills: RoadmapSource[] = [
[{ id: "javascript", kind: "skill", title: "JavaScript", area: "programming", tagline: "The language of the web, from first variable to async apps.", keywords: ["javascript", "js", "ecmascript"], courseTopics: ["JavaScript"], related: ["typescript", "react", "nodejs", "frontend"], roadmapSh: "javascript" }, `
## First steps | Write and run code. | Build a tip calculator in the browser. | jsinfo:
- Values and variables | Numbers, strings, booleans, let and const. | jsinfo:variables
- Operators | Arithmetic, comparison and logic. | jsinfo:operators
- Conditions and loops | Choose and repeat. | jsinfo:while-for
- JavaScript functions | Parameters, return values and arrows. | jsinfo:function-basics
## Data | Model information. | Summarise a list of orders.
- Arrays | Store, search and transform lists. | jsinfo:array-methods
- Objects | Keys, methods and copying. | jsinfo:object
- Map and Set | Collections with fast lookup. | jsinfo:map-set
- Destructuring and spread | Unpack and combine neatly. | jsinfo:destructuring-assignment
- JSON | Exchange data as text. | jsinfo:json
## How it really works | Remove the mystery. | Explain what a closure remembers.
- Scope and closures | What functions can see and keep. | jsinfo:closure
- The this keyword | How calls decide context. | jsinfo:object-methods
- Prototypes | How objects share behaviour. | jsinfo:prototype-inheritance
- Classes | Structure built on prototypes. | jsinfo:class
- Type conversion | Predict equality and coercion. | jsinfo:type-conversions
## Asynchronous code | Wait without blocking. | Load three requests in parallel with error handling.
- Event loop | Order of tasks and microtasks. | jsinfo:event-loop
- Promises | Represent future results. | jsinfo:promise-basics
- Async and await | Readable asynchronous code. | jsinfo:async-await
- Error handling | Throw, catch and recover. | jsinfo:try-catch
## In the browser | Build interfaces. | Build a to-do list without a framework.
- @dom
- @fetch-async
- Modules | Split code across files. | jsinfo:modules-intro
- Browser storage | Keep small data locally. | jsinfo:localstorage
## Professional habits | Write code others trust. | Add tests and linting to a project.
- @npm
- @unit-testing
- Debugging in the browser | Breakpoints, call stack and console. | jsinfo:debugging-chrome
+ Generators and iterators | Custom sequences on demand. | jsinfo:generators
+ Regular expressions | Match and replace text. | jsinfo:regular-expressions
- @typescript
* Quiz app | beginner | Timed questions with a score. | Data in JSON; Keyboard friendly; Result summary | DOM
* Expense dashboard | intermediate | Track and chart spending. | Modules; Local storage; Tests | Data, Testing
* Mini framework | advanced | Tiny reactive rendering library. | State updates; Components; Documentation | Architecture
`],
[{ id: "typescript", kind: "skill", title: "TypeScript", area: "programming", tagline: "Catch mistakes before you run the code.", keywords: ["typescript", "ts"], courseTopics: ["TypeScript"], related: ["javascript", "react", "nodejs"], roadmapSh: "typescript" }, `
## Basics | Add types to what you know. | Convert a small script to TypeScript. | ts:intro.html
- Setup and compiler | Install, configure and run. | ts:typescript-tooling-in-5-minutes.html
- Everyday types | Primitives, arrays, unions and literals. | ts:2/everyday-types.html
- Functions | Parameters, returns and overloads. | ts:2/functions.html
- Object types | Interfaces, optional and readonly. | ts:2/objects.html
- Strict mode | Why strict settings pay off. | web:www.typescriptlang.org/tsconfig/#strict
## Narrowing | Let code prove the type. | Model a request state without impossible cases.
- Type narrowing | typeof, in, instanceof and guards. | ts:2/narrowing.html
- Discriminated unions | Model states exactly. | ts:2/narrowing.html
- unknown and never | Safe inputs and exhaustive checks. | ts:2/narrowing.html
- Enums and alternatives | Enums, unions and const objects. | ts:enums.html
## Reuse | Write flexible types. | Type a reusable data table.
- Generics | Types as parameters. | ts:2/generics.html
- keyof and indexed access | Derive types from types. | ts:2/indexed-access-types.html
- Utility types | Partial, Pick, Omit and Record. | ts:utility-types.html
- Classes | Visibility, abstract and implements. | ts:2/classes.html
- TypeScript modules | Imports, exports and declarations. | ts:2/modules.html
## Advanced types | Express rules precisely. | Write a typed event emitter.
+ Conditional types | Types that choose. | ts:2/conditional-types.html
+ Mapped types | Transform every property. | ts:2/mapped-types.html
+ Template literal types | Patterns in strings. | ts:2/template-literal-types.html
- Declaration files | Describe untyped code. | ts:declaration-files/introduction.html
## In practice | Use it at work. | Migrate one module safely.
- Validating at runtime | Types vanish; check data with a schema. | web:zod.dev/
- Typed React | Props, events and hooks. | react:learn/typescript
- Linting types | Rules that understand types. | web:typescript-eslint.io/getting-started/
- Migrating JavaScript | Adopt step by step. | ts:migrating-from-javascript.html
* Typed to-do core | beginner | Pure functions with full types. | Strict mode; No any; Tests | Types
* Typed API client | intermediate | Client with validated responses. | Generics; Schemas; Errors as types | Generics
* Form library | advanced | Types inferred from a schema. | Inference; Docs; Type tests | Advanced types
`],
[{ id: "react", kind: "skill", title: "React", area: "web", tagline: "Build interfaces from small, reusable components.", keywords: ["react", "reactjs", "redux"], courseTopics: ["React", "Redux"], related: ["javascript", "typescript", "nextjs", "react-native"], roadmapSh: "react" }, `
## Before React | Be comfortable with the base. | Rewrite a page with array methods.
- @javascript
- @npm
- @html
## Components | Describe the interface. | Build a product list from data. | react:learn
- JSX | Markup inside JavaScript. | react:learn/writing-markup-with-jsx
- Components and props | Split and configure. | react:learn/passing-props-to-a-component
- Conditional rendering | Show what applies. | react:learn/conditional-rendering
- Lists and keys | Render collections correctly. | react:learn/rendering-lists
- Events | Respond to people. | react:learn/responding-to-events
## State | Make it interactive. | Build a multi-step form.
- useState | Remember between renders. | react:learn/state-a-components-memory
- Rendering and updates | Snapshots, batching and immutability. | react:learn/state-as-a-snapshot
- Lifting state | Share one source of truth. | react:learn/sharing-state-between-components
- Reducers | Organise complex updates. | react:learn/extracting-state-logic-into-a-reducer
- Context | Pass data deeply. | react:learn/passing-data-deeply-with-context
- React forms | Controlled inputs and validation. | react:reference/react-dom/components/input
## Effects and reuse | Connect to the outside. | Extract two custom hooks.
- Effects | Synchronise, and when not to. | react:learn/synchronizing-with-effects
- You might not need an effect | Simpler alternatives. | react:learn/you-might-not-need-an-effect
- Refs | Reach the DOM and keep values. | react:learn/referencing-values-with-refs
- Custom hooks | Share behaviour. | react:learn/reusing-logic-with-custom-hooks
## Real apps | Use the ecosystem wisely. | Build an app with routes and server data.
- React routing | Screens, parameters and loaders. | web:reactrouter.com/home
- Server data | Fetch, cache and update. | web:tanstack.com/query/latest/docs/framework/react/overview
? Client state libraries | Redux Toolkit or Zustand. | web:redux-toolkit.js.org/introduction/getting-started
- Styling React | CSS Modules, Tailwind and tokens. | web:tailwindcss.com/docs/installation
- @typescript
## Quality | Make it fast and solid. | Profile and fix one slow screen.
- React testing | Test behaviour, not details. | web:testing-library.com/docs/react-testing-library/intro/
- React performance | Memoise only after measuring. | react:reference/react/memo
- Suspense and transitions | Keep the interface responsive. | react:reference/react/Suspense
- Error boundaries | Contain failures. | react:reference/react/Component
- @a11y
+ Server components | Render on the server by default. | react:reference/rsc/server-components
+ Next.js | A full framework on React. | next:learn, map:nextjs
* Movie explorer | beginner | Search films from a public API. | Loading and error states; Details page; Favourites | Components
* Budget planner | intermediate | Plan and chart a month. | Reducer state; Tests; Accessible forms | State, Testing
* Collaborative board | advanced | Live shared board. | Optimistic updates; Offline queue; Performance budget | Real time
`],
[{ id: "vue", kind: "skill", title: "Vue", area: "web", tagline: "An approachable framework that scales with you.", keywords: ["vue", "vuejs", "nuxt"], courseTopics: ["Vue.js"], related: ["javascript", "typescript", "frontend"], roadmapSh: "vue" }, `
## Start | Build your first component. | Build a counter and a list. | vue:introduction.html
- @javascript
- Creating an app | Project setup with Vite. | vue:quick-start.html
- Template syntax | Bind data to markup. | vue:essentials/template-syntax.html
- Reactivity | ref and reactive. | vue:essentials/reactivity-fundamentals.html
- Conditional and lists | v-if and v-for. | vue:essentials/list.html
- Event handling | Respond to input. | vue:essentials/event-handling.html
## Components | Compose interfaces. | Build a reusable modal.
- Props and emits | Data down, events up. | vue:components/props.html
- Slots | Flexible content. | vue:components/slots.html
- Form bindings | v-model well used. | vue:essentials/forms.html
- Provide and inject | Share without prop chains. | vue:components/provide-inject.html
- Lifecycle | Run code at the right time. | vue:essentials/lifecycle.html
## Logic | Organise behaviour. | Extract a composable.
- Computed values | Derive state. | vue:essentials/computed.html
- Watchers | React to change. | vue:essentials/watchers.html
- Composables | Reuse stateful logic. | vue:reusability/composables.html
- TypeScript with Vue | Typed props and events. | vue:typescript/overview.html
## Applications | Build something real. | Ship a multi-page app.
- Vue Router | Pages, guards and lazy loading. | web:router.vuejs.org/guide/
- Pinia | Shared state. | web:pinia.vuejs.org/introduction.html
- Loading data | Fetch with clear states. | vue:built-ins/suspense.html
- Vue testing | Unit and component tests. | vue:scaling-up/testing.html
- Vue performance | Measure and lazy load. | vue:best-practices/performance.html
+ Nuxt | Server rendering and routing. | web:nuxt.com/docs/getting-started/introduction
* Weather board | beginner | Compare cities. | Reactive search; Saved cities; Errors handled | Vue
* Recipe planner | intermediate | Plan meals and shopping. | Pinia; Routing; Tests | State
* Learning portal | advanced | Courses with progress. | Nuxt; Sign-in; Accessible | Nuxt
`],
[{ id: "angular", kind: "skill", title: "Angular", area: "web", tagline: "A complete framework for large, structured web apps.", keywords: ["angular", "rxjs"], courseTopics: ["Angular"], related: ["typescript", "javascript", "frontend"], roadmapSh: "angular" }, `
## Start | Know the shape of an Angular app. | Run and change a starter app. | ng:overview
- @typescript
- Angular CLI | Create, serve and build. | ng:tools/cli
- Components | Templates, styles and logic. | ng:guide/components
- Templates | Binding and control flow. | ng:guide/templates
- Signals | Reactive state. | ng:guide/signals
## Build | Connect parts. | Build a form with validation.
- Inputs and outputs | Communicate between components. | ng:guide/components/inputs
- Directives and pipes | Reuse behaviour and formatting. | ng:guide/directives
- Dependency injection | Supply services. | ng:guide/di
- Angular routing | Pages, guards and lazy loading. | ng:guide/routing
- Angular forms | Reactive forms. | ng:guide/forms
## Data | Work with servers. | Load, cache and retry requests.
- HTTP client | Requests and interceptors. | ng:guide/http
- RxJS | Streams and operators. | web:rxjs.dev/guide/overview
- State patterns | Signals, services and stores. | ng:guide/signals
## Quality | Keep it maintainable. | Raise coverage on one feature.
- Angular testing | Components and services. | ng:guide/testing
- Angular performance | Change detection and deferral. | ng:best-practices/runtime-performance
- Angular security | Sanitising and trust. | ng:best-practices/security
- Angular accessibility | Built-in tools and checks. | ng:best-practices/a11y
+ Server-side rendering | Faster first view. | ng:guide/ssr
* Contact manager | beginner | Add, edit and search contacts. | Reactive form; Routing; Validation | Angular
* Helpdesk | intermediate | Tickets with roles. | Guards; Interceptors; Tests | RxJS
* Analytics console | advanced | Live charts and filters. | Lazy loading; Signals; Performance budget | Architecture
`],
[{ id: "nextjs", kind: "skill", title: "Next.js", area: "web", tagline: "Full-stack React with routing, rendering and data built in.", keywords: ["next.js", "nextjs"], courseTopics: ["Next.js"], related: ["react", "typescript", "full-stack"], roadmapSh: "nextjs" }, `
## Start | Understand the model. | Create and deploy a starter app. | next:learn
- React | Components, state and hooks first. | react:learn, map:react
- Project setup | Structure and configuration. | next:docs/app/getting-started/installation
- File-based routing | Layouts, pages and nesting. | next:docs/app/getting-started/layouts-and-pages
- Linking and navigation | Fast transitions. | next:docs/app/getting-started/linking-and-navigating
## Render and data | Choose where work happens. | Compare a static and a dynamic page.
- Server and client components | Pick the right side. | next:docs/app/getting-started/server-and-client-components
- Fetching data | Load on the server. | next:docs/app/getting-started/fetching-data
- Caching | What is stored and for how long. | next:docs/app/guides/caching
- Streaming and loading | Show progress early. | next:docs/app/api-reference/file-conventions/loading
- Server actions | Change data from forms. | next:docs/app/getting-started/mutating-data
## Features | Build complete products. | Add sign-in and an upload.
- Route handlers | Build endpoints. | next:docs/app/getting-started/route-handlers
- Images and fonts | Fast by default. | next:docs/app/getting-started/images
- Metadata and SEO | Titles, previews and sitemaps. | next:docs/app/getting-started/metadata-and-og-images
- Errors and not found | Helpful failures. | next:docs/app/getting-started/error-handling
- Authentication in Next.js | Sessions and protected routes. | next:docs/app/guides/authentication
## Production | Run it well. | Pass a production checklist.
- Testing Next.js | Unit and end-to-end. | next:docs/app/guides/testing
- Security headers | Content security policy and more. | next:docs/app/guides/content-security-policy
- Deploying | Build, host and monitor. | next:docs/app/getting-started/deploying
- @web-performance
* Blog | beginner | Markdown posts with tags. | Static pages; Metadata; Feed | Routing
* Event site | intermediate | Browse and register. | Actions; Validation; Emails | Full stack
* SaaS starter | advanced | Teams, roles and billing placeholder. | Auth; Tests; Observability | Production
`],
[{ id: "css", kind: "skill", title: "CSS", area: "web", tagline: "Style anything, on any screen, with confidence.", keywords: ["css", "tailwind", "sass", "bootstrap"], courseTopics: ["HTML and CSS", "Bootstrap"], related: ["frontend", "ux-design", "javascript"], roadmapSh: "css" }, `
## Core | Understand how styles apply. | Predict five winning rules before checking. | webdev:learn/css
- Selectors | Target elements precisely. | webdev:learn/css/selectors
- Cascade and specificity | Which rule wins and why. | webdev:learn/css/the-cascade
- Box model | Size, spacing and borders. | webdev:learn/css/box-model
- Units and sizing | Relative and fluid sizes. | webdev:learn/css/sizing
- Colour and typography | Readable, consistent text. | webdev:learn/css/typography
## Layout | Place things well. | Recreate a magazine layout.
- Flexbox | Space along one axis. | webdev:learn/css/flexbox
- Grid | Two-dimensional layout. | webdev:learn/css/grid
- Positioning | Flow, sticky and stacking. | webdev:learn/css/z-index
- Logical properties | Support every writing direction. | webdev:learn/css/logical-properties
## Responsive | Adapt to context. | Make one component work at three widths.
- Media queries | Respond to screens and preferences. | webdev:learn/design/media-queries
- Container queries | Respond to space. | webdev:learn/css/container-queries
- Responsive images | Right file, right size. | webdev:learn/design/responsive-images
- Dark mode | Themes with custom properties. | webdev:learn/design/theming
## Polish | Make it feel good. | Animate one interaction tastefully.
- Transitions | Smooth changes. | webdev:learn/css/transitions
- Animations | Keyframes with purpose. | webdev:learn/css/animations
- Pseudo-elements and states | Hover, focus and more. | webdev:learn/css/pseudo-classes
- Reduced motion | Respect preferences. | mdn:Web/CSS/@media/prefers-reduced-motion
## At scale | Keep it maintainable. | Refactor a messy stylesheet.
- Custom properties | Design tokens in CSS. | mdn:Web/CSS/Guides/Cascading_variables/Using_custom_properties
- Cascade layers and nesting | Organise and limit. | webdev:learn/css/nesting
- Naming and modules | Avoid collisions. | web:getbem.com/
? Sass | Extra tooling for stylesheets. | web:sass-lang.com/guide/
? Tailwind CSS | Utility-first styling. | web:tailwindcss.com/docs/installation
* Pricing cards | beginner | Three responsive plans. | Grid; Focus states; Contrast checked | Layout
* Landing page | intermediate | Themed page with motion. | Dark mode; Reduced motion; Fast | Design
* Component styles | advanced | Token-based style kit. | Layers; Docs; Right-to-left ready | Systems
`],
[{ id: "nodejs", kind: "skill", title: "Node.js", area: "web", tagline: "Run JavaScript on the server and build fast services.", keywords: ["node", "nodejs", "express", "nestjs"], courseTopics: ["NodeJS", "Nest.js"], related: ["javascript", "typescript", "backend", "api-design"], roadmapSh: "nodejs" }, `
## Start | Run JavaScript outside the browser. | Write a command-line greeter. | node:en/learn/getting-started/introduction-to-nodejs
- @javascript
- What Node.js is | Runtime, engine and event loop. | node:en/learn/getting-started/introduction-to-nodejs
- Modules | Import, export and packages. | node:api/esm.html
- @npm
- Command line programs | Arguments, input and output. | node:en/learn/command-line/run-nodejs-scripts-from-the-command-line
## Core | Use what is built in. | Copy a huge file with low memory.
- Event loop | How work is scheduled. | node:en/learn/asynchronous-work/event-loop-timers-and-nexttick
- Files and paths | Read and write safely. | node:en/learn/manipulating-files/reading-files-with-nodejs
- Streams | Process data in pieces. | node:api/stream.html
- Events | Emit and listen. | node:en/learn/asynchronous-work/the-nodejs-event-emitter
- Node errors | Fail clearly. | node:api/errors.html
- Environment variables | Configure without secrets in code. | node:en/learn/command-line/how-to-read-environment-variables-from-nodejs
## Servers | Build APIs. | Build a tested CRUD API.
- HTTP server | What frameworks do for you. | node:api/http.html
- Express | Routes and middleware. | web:expressjs.com/en/starter/hello-world.html
? Fastify | Fast with schemas. | web:fastify.dev/docs/latest/
? NestJS | Structured, larger apps. | web:docs.nestjs.com/
- @rest
- Validation in Node | Check every input. | web:zod.dev/
## Data and identity | Store and protect. | Add accounts to your API.
- Databases from Node | Queries, pools and migrations. | web:node-postgres.com/
- @orm
- @authn
- @jwt
## Production | Run it reliably. | Find a memory leak on purpose.
- Node testing | Built-in runner and mocks. | node:api/test.html
- @logging
- Worker threads | Move heavy work away. | node:api/worker_threads.html
- Profiling | Find slow code. | node:en/learn/getting-started/profiling
- Node security | Safe defaults and updates. | node:en/learn/getting-started/security-best-practices
- Graceful shutdown | Finish work before exit. | node:api/process.html
* File organiser | beginner | Sort a folder by type. | Dry run; Clear errors; Tests | Files
* Link checker | intermediate | Crawl a site you own. | Concurrency limit; Report; Retries | Streams
* Job queue | advanced | Background jobs with retries. | Persistence; Backoff; Dashboard | Systems
`],
[{ id: "java", kind: "skill", title: "Java", area: "programming", tagline: "A dependable language for large systems.", keywords: ["java", "jvm"], courseTopics: ["Java"], related: ["spring-boot", "backend", "data-structures-algorithms", "android"], roadmapSh: "java" }, `
## Start | Write and run Java. | Build a number game. | java:getting-started, mooc
- Setup and first program | JDK, compile and run. | java:getting-started
- Types and variables | Primitives, strings and arrays. | java:language-basics
- Control flow | Conditions and loops. | java:language-basics
- Methods | Parameters, returns and overloads. | java:classes-objects
## Objects | Model the problem. | Model a library with classes.
- Classes and objects | State and behaviour. | java:classes-objects
- Inheritance and interfaces | Share and abstract. | java:inheritance
- Records and enums | Small, clear data types. | java:records
- Sealed types and patterns | Exhaustive modelling. | web:docs.oracle.com/en/java/javase/21/language/sealed-classes-and-interfaces.html
- Exceptions | Fail and recover clearly. | java:exceptions
## Standard library | Use what is there. | Process a log file.
- Collections | List, Set, Map and queues. | java:api/collections-framework
- Generics | Type-safe reuse. | java:generics
- Lambdas | Behaviour as values. | java:lambdas
- Streams API | Transform collections. | java:api/streams
- Files and I/O | Read and write data. | java:java-io
- Dates and times | Correct time handling. | java:date-time
## Concurrency | Do several things safely. | Fetch pages concurrently.
- Threads and executors | Run tasks. | java:
- Virtual threads | Many tasks cheaply. | java:new-features/virtual-threads
- Synchronisation | Protect shared data. | ostep
## Engineering | Work professionally. | Publish a tested library.
- Maven and Gradle | Build and manage dependencies. | web:maven.apache.org/guides/getting-started/
- JUnit | Automated tests. | web:docs.junit.org/current/user-guide/
- JVM basics | Memory, garbage collection and tuning. | java:jvm
- @design-patterns
- Spring Boot | The most used web framework. | springdoc:spring-boot/tutorial/first-application/index.html, map:spring-boot
* Bank simulator | beginner | Accounts and transfers in the terminal. | Validation; Exceptions; Tests | OOP
* Text search tool | intermediate | Index and search files. | Streams; Concurrency; Benchmarks | Collections
* Chat server | advanced | Rooms over sockets. | Virtual threads; Protocol; Load test | Concurrency
`],
[{ id: "spring-boot", kind: "skill", title: "Spring Boot", area: "web", tagline: "Production Java services with sensible defaults.", keywords: ["spring", "spring boot", "hibernate"], courseTopics: ["Java"], related: ["java", "backend", "api-design", "docker"], roadmapSh: "spring-boot" }, `
## Start | Understand the container. | Run a hello endpoint. | springdoc:spring-boot/tutorial/first-application/index.html
- Java essentials | Classes, collections and lambdas. | java:, map:java
- Spring core | Beans and dependency injection. | springdoc:spring-framework/reference/core/beans.html
- Auto-configuration | What Boot sets up. | springdoc:spring-boot/reference/using/auto-configuration.html
- Configuration | Properties and profiles. | springdoc:spring-boot/reference/features/external-config.html
## Web | Build APIs. | CRUD with validation.
- REST controllers | Map requests to methods. | spring:rest-service
- Validation in Spring | Check input. | spring:validating-form-input
- Error responses | Consistent problems. | springdoc:spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
- API documentation | Describe endpoints. | openapi:
## Data | Store it well. | Fix an N+1 query.
- Spring Data JPA | Repositories and queries. | springdoc:spring-data/jpa/reference/jpa/getting-started.html
- Relationships and fetching | Avoid N+1. | springdoc:spring-data/jpa/reference/jpa/query-methods.html
- Spring transactions | Boundaries and rollback. | springdoc:spring-framework/reference/data-access/transaction.html
- Migrations | Evolve with Flyway. | web:documentation.red-gate.com/flyway
- Spring caching | Cache with care. | springdoc:spring-framework/reference/integration/cache.html
## Security and messaging | Protect and decouple. | Secure one endpoint by role.
- Spring Security | Filters, users and roles. | springdoc:spring-security/reference/servlet/getting-started.html
- OAuth in Spring | Sign in with a provider. | springdoc:spring-security/reference/servlet/oauth2/index.html
- Messaging with RabbitMQ | Asynchronous work. | spring:messaging-rabbitmq
## Ship | Run in production. | Expose health and metrics.
- Spring testing | Slices and Testcontainers. | springdoc:spring-boot/reference/testing/index.html
- Actuator | Health and metrics. | springdoc:spring-boot/reference/actuator/index.html
- @docker
- @ci-cd
+ Reactive Spring | WebFlux when it fits. | springdoc:spring-framework/reference/web/webflux.html
+ Spring Cloud | Patterns for distributed systems. | springdoc:spring-cloud/docs/current/reference/html/
* Notes API | beginner | CRUD with search. | Validation; Tests; Docs | REST
* Library system | intermediate | Loans and reservations. | Transactions; Roles; Migrations | Data, Security
* Order platform | advanced | Event-driven ordering. | Messaging; Tracing; Containers | Distributed
`],
[{ id: "csharp", kind: "skill", title: "C# and .NET", area: "programming", tagline: "One productive platform for web, desktop, cloud and games.", keywords: ["c#", "csharp", ".net", "asp.net", "dotnet"], courseTopics: ["C#"], related: ["backend", "game-developer", "sql"], roadmapSh: "aspnet-core" }, `
## Language | Learn modern C#. | Build a console quiz. | ms:dotnet/csharp/tour-of-csharp/
- C# basics | Types, variables and control flow. | ms:dotnet/csharp/tour-of-csharp/
- Methods and classes | Structure programs. | ms:dotnet/csharp/fundamentals/types/classes
- Records and patterns | Concise data and matching. | ms:dotnet/csharp/fundamentals/types/records
- Nullable references | Prevent null errors. | ms:dotnet/csharp/nullable-references
- C# exceptions | Handle failure. | ms:dotnet/csharp/fundamentals/exceptions/
## Working with data | Query and transform. | Analyse a CSV file.
- .NET collections | Lists, dictionaries and sets. | ms:dotnet/standard/collections/
- LINQ | Query any sequence. | ms:dotnet/csharp/linq/
- Async C# | async, await and tasks. | ms:dotnet/csharp/asynchronous-programming/
- C# generics | Reusable types. | ms:dotnet/csharp/fundamentals/types/generics
## Web | Build APIs with ASP.NET Core. | Publish a documented API. | ms:aspnet/core/
- Minimal APIs | Small, clear endpoints. | ms:aspnet/core/tutorials/min-web-api
- Dependency injection | Built-in container. | ms:aspnet/core/fundamentals/dependency-injection
- Middleware | The request pipeline. | ms:aspnet/core/fundamentals/middleware/
- Entity Framework Core | Data access and migrations. | ms:ef/core/
- ASP.NET security | Identity and policies. | ms:aspnet/core/security/
? Blazor | Interfaces in C#. | ms:aspnet/core/blazor/
## Professional | Test and ship. | Deploy a container.
- .NET testing | xUnit and integration tests. | ms:dotnet/core/testing/
- .NET logging | Structured logs. | ms:dotnet/core/extensions/logging
- .NET containers | Package and run. | ms:dotnet/core/docker/introduction
- @ci-cd
* Contact book | beginner | Console app with file storage. | LINQ; Tests; Validation | C#
* Booking API | intermediate | Appointments with conflicts prevented. | EF Core; Identity; Docs | ASP.NET
* Realtime dashboard | advanced | Live updates with SignalR. | Background jobs; Scaling notes; Tests | SignalR
`],
[{ id: "go", kind: "skill", title: "Go", area: "programming", tagline: "Simple, fast and built for concurrent services.", keywords: ["go", "golang"], courseTopics: ["Go"], related: ["backend", "docker", "kubernetes"], roadmapSh: "golang" }, `
## Basics | Read and write simple Go. | Build a word counter. | go:tour/
- Setup and modules | Install, run and manage packages. | go:doc/tutorial/getting-started
- Types and variables | Basic types and zero values. | go:tour/basics/1
- Functions and errors | Multiple returns and explicit errors. | go:blog/error-handling-and-go
- Control flow | if, for, switch and defer. | go:tour/flowcontrol/1
## Data | Model and transform. | Build an in-memory store.
- Slices and maps | Growable lists and lookups. | go:blog/slices-intro
- Structs and methods | Group data with behaviour. | go:tour/methods/1
- Interfaces | Behaviour without inheritance. | goexample
- Pointers | Share and modify values. | goexample
- Go generics | Reusable type-safe code. | go:doc/tutorial/generics
## Concurrency | Go's strength. | Build a worker pool.
- Goroutines | Lightweight tasks. | go:tour/concurrency/1
- Channels and select | Communicate safely. | go:blog/pipelines
- Context | Cancel and time out. | go:blog/context
- Race detector | Find unsafe sharing. | go:doc/articles/race_detector
## Services | Build and run. | Ship a small API.
- net/http | Servers and clients. | go:doc/articles/wiki/
- JSON in Go | Encode and decode. | go:blog/json
- Databases in Go | database/sql properly. | go:doc/tutorial/database-access
- Go testing | Tables, benchmarks and fuzzing. | go:doc/tutorial/add-a-test
- Profiling Go | CPU and memory. | go:blog/pprof
- Project layout | Simple, clear packages. | go:doc/modules/layout
* Command-line notes | beginner | Add and search notes. | Flags; File storage; Tests | CLI
* URL monitor | intermediate | Check sites concurrently. | Context; Rate limit; Report | Concurrency
* Key-value store | advanced | Networked store with persistence. | Append log; Benchmarks; Race free | Systems
`],
[{ id: "rust", kind: "skill", title: "Rust", area: "programming", tagline: "Speed and memory safety without a garbage collector.", keywords: ["rust", "systems programming"], courseTopics: ["Rust"], related: ["cpp", "computer-science", "linux"], roadmapSh: "rust" }, `
## Basics | Meet the compiler. | Finish the first Rustlings. | rust:book/, rustlings
- Setup and Cargo | Build, run and add crates. | rust:book/ch01-00-getting-started.html
- Variables and types | Immutability by default. | rust:book/ch03-00-common-programming-concepts.html
- Functions and control flow | Expressions and loops. | rust:book/ch03-05-control-flow.html
## Ownership | The central idea. | Fix ten borrow errors.
- Ownership | One owner, clear lifetime. | rust:book/ch04-01-what-is-ownership.html
- References and borrowing | Share without copying. | rust:book/ch04-02-references-and-borrowing.html
- Slices | Views into data. | rust:book/ch04-03-slices.html
- Lifetimes | Prove references stay valid. | rust:book/ch10-03-lifetime-syntax.html
## Modelling | Make invalid states impossible. | Model a vending machine.
- Structs | Group related data. | rust:book/ch05-00-structs.html
- Enums and matching | Express choices. | rust:book/ch06-00-enums.html
- Rust errors | Result, Option and the question mark. | rust:book/ch09-00-error-handling.html
- Traits and generics | Shared behaviour. | rust:book/ch10-00-generics.html
- Collections | Vectors, strings and maps. | rust:book/ch08-00-common-collections.html
## Power | Write real programs. | Build a text search tool.
- Iterators and closures | Expressive, fast pipelines. | rust:book/ch13-00-functional-features.html
- Smart pointers | Box, Rc and RefCell. | rust:book/ch15-00-smart-pointers.html
- Fearless concurrency | Threads and channels. | rust:book/ch16-00-concurrency.html
- Async Rust | Futures and runtimes. | rust:book/ch17-00-async-await.html
- Rust testing | Unit, integration and docs. | rust:book/ch11-00-testing.html
+ Unsafe Rust | When and how carefully. | rust:book/ch20-01-unsafe-rust.html
+ Macros | Code that writes code. | rust:book/ch20-05-macros.html
* Grep clone | beginner | Search files for text. | Errors handled; Tests; Help text | CLI
* HTTP server | intermediate | Serve files with a thread pool. | Graceful shutdown; Benchmarks; Tests | Concurrency
* Tiny database | advanced | Log-structured storage. | Crash recovery; Compaction; Benchmarks | Systems
`],
[{ id: "cpp", kind: "skill", title: "C++", area: "programming", tagline: "Control and performance for systems, games and devices.", keywords: ["c++", "cpp", "embedded"], courseTopics: ["C++", "C"], related: ["game-developer", "rust", "computer-science"], roadmapSh: "cpp" }, `
## Basics | Write safe modern C++. | Build a grade calculator. | cpp:
- Setup and compiling | Toolchains and building. | cpp:cpp-tutorial/introduction-to-the-compiler-linker-and-libraries/
- Types and operators | Fundamental types. | cpp:cpp-tutorial/introduction-to-fundamental-data-types/
- Functions and files | Split programs. | cpp:cpp-tutorial/introduction-to-functions/
- References and pointers | Addresses, done carefully. | cpp:cpp-tutorial/lvalue-references/
## Objects | Own resources safely. | Write a resource-owning class.
- Classes | Encapsulate data. | cpp:cpp-tutorial/introduction-to-classes/
- RAII | Tie resources to lifetime. | cppref:language/raii
- Copy and move | Control cost. | cpp:cpp-tutorial/introduction-to-smart-pointers-move-semantics/
- Smart pointers | Ownership in types. | cpp:cpp-tutorial/stdunique_ptr/
- Inheritance and virtual calls | Polymorphism. | cpp:cpp-tutorial/virtual-functions/
## Standard library | Do not reinvent. | Analyse a large text.
- Containers | vector, map and friends. | cppref:container
- STL algorithms | Sort, search and transform. | cppref:algorithm
- Lambdas | Local behaviour. | cpp:cpp-tutorial/introduction-to-lambdas-anonymous-functions/
- Templates | Generic code. | cpp:cpp-tutorial/function-templates/
- Ranges | Composable views. | cppref:ranges
## Engineering | Build reliably. | Set up CI with sanitizers.
- CMake | Portable builds. | web:cmake.org/cmake/help/latest/guide/tutorial/index.html
- C++ testing | GoogleTest basics. | web:google.github.io/googletest/primer.html
- Debuggers and sanitizers | Find memory bugs. | web:clang.llvm.org/docs/AddressSanitizer.html
- C++ concurrency | Threads, locks and atomics. | cppref:thread
- Core guidelines | Modern best practice. | web:isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines
* Inventory tool | beginner | Manage stock in files. | Classes; Validation; Tests | OOP
* Image filter | intermediate | Process images fast. | RAII; Benchmarks; Threads | Performance
* Ray tracer | advanced | Render simple scenes. | Maths library; Profiling; Parallel | Graphics
`],
[{ id: "php", kind: "skill", title: "PHP and Laravel", area: "web", tagline: "Ship web products quickly on the language behind much of the web.", keywords: ["php", "laravel", "wordpress"], courseTopics: ["PHP", "WordPress"], related: ["backend", "sql", "full-stack"], roadmapSh: "laravel" }, `
## Language | Write modern PHP. | Build a form handler. | phpway
- PHP basics | Syntax, arrays and functions. | php:language.basic-syntax.php
- PHP types | Declare and trust types. | php:language.types.declarations.php
- PHP classes | Objects, interfaces and enums. | php:language.oop5.php
- PHP errors | Exceptions and reporting. | php:class.exception.php
- Composer | Dependencies and autoloading. | web:getcomposer.org/doc/00-intro.md
## Web and data | Handle requests safely. | Build a guestbook.
- Forms and sessions | Input and state. | php:features.sessions.php
- PDO | Safe database queries. | php:book.pdo.php
- PHP security | Escaping, CSRF and passwords. | owaspcs:PHP_Configuration_Cheat_Sheet.html
- @sql
## Laravel | Build complete apps. | Ship a small product. | laravel:
- Routes and controllers | Map requests. | laravel:12.x/routing
- Blade | Templates and components. | laravel:12.x/blade
- Eloquent | Models and relations. | laravel:12.x/eloquent
- Laravel migrations | Evolve the schema. | laravel:12.x/migrations
- Laravel validation | Check input. | laravel:12.x/validation
- Laravel authentication | Users and gates. | laravel:12.x/authentication
## Production | Keep it healthy. | Add queues and tests.
- Laravel queues | Work in the background. | laravel:12.x/queues
- Laravel testing | Feature and unit tests. | laravel:12.x/testing
- Laravel caching | Faster pages. | laravel:12.x/cache
- Deployment | Optimise and release. | laravel:12.x/deployment
- @docker
* Guestbook | beginner | Messages with moderation. | Prepared queries; Escaping; CSRF | PHP
* Invoice app | intermediate | Clients, invoices and PDFs. | Policies; Tests; Queue | Laravel
* Marketplace | advanced | Sellers, orders and messages. | Roles; Search; Monitoring | Architecture
`],
[{ id: "kotlin", kind: "skill", title: "Kotlin", area: "programming", tagline: "Concise, safe code for Android and servers.", keywords: ["kotlin"], courseTopics: ["Kotlin"], related: ["android", "java"], roadmapSh: "kotlin" }, `
## Basics | Learn the syntax. | Port a small Java class. | kotlin:getting-started.html
- Kotlin syntax | Variables, functions and strings. | kotlin:basic-syntax.html
- Control flow | when, loops and ranges. | kotlin:control-flow.html
- Null safety | Nullable types and operators. | kotlin:null-safety.html
- Kotlin collections | Lists, sets, maps and operations. | kotlin:collections-overview.html
## Objects | Model clearly. | Model shapes with sealed classes.
- Classes | Constructors and properties. | kotlin:classes.html
- Data and sealed classes | Values and closed hierarchies. | kotlin:data-classes.html
- Extensions | Add behaviour from outside. | kotlin:extensions.html
- Kotlin generics | Variance made simple. | kotlin:generics.html
- Delegation | Reuse by composition. | kotlin:delegation.html
## Functional style | Express intent. | Rewrite loops as pipelines.
- Lambdas | Functions as values. | kotlin:lambdas.html
- Scope functions | let, apply and friends. | kotlin:scope-functions.html
- Sequences | Lazy processing. | kotlin:sequences.html
## Concurrency | Structured and cancellable. | Load data in parallel.
- Coroutines | Suspend and resume. | kotlin:coroutines-basics.html
- Flow | Asynchronous streams. | kotlin:flow.html
- Cancellation | Stop work cleanly. | kotlin:cancellation-and-timeouts.html
## Use it | Build real software. | Publish a tested library.
- Gradle | Build and dependencies. | kotlin:gradle.html
- Kotlin testing | Unit tests. | kotlin:jvm-test-using-junit.html
? Ktor | Servers and clients. | web:ktor.io/docs/welcome.html
? Multiplatform | Share code across platforms. | kotlin:multiplatform.html
* Text adventure engine | beginner | Original story with choices. | Sealed classes; Save file; Tests | Kotlin
* Currency service | intermediate | Cached rates API. | Coroutines; Ktor; Tests | Server
* Shared module | advanced | Logic for two platforms. | Multiplatform; Flow; Docs | KMP
`],
[{ id: "flutter", kind: "skill", title: "Flutter", area: "mobile", tagline: "One codebase for mobile, web and desktop.", keywords: ["flutter", "dart"], courseTopics: ["Flutter", "Dart"], related: ["android", "ios", "react-native"], roadmapSh: "flutter" }, `
## Dart | Learn the language. | Solve ten exercises. | dart:language
- Dart basics | Variables, functions and types. | dart:language
- Dart classes | Constructors and mixins. | dart:language/classes
- Null safety | Explicit missing values. | dart:null-safety
- Async Dart | Futures and streams. | dart:libraries/async/async-await
## Widgets | Compose interfaces. | Rebuild a simple screen. | flutter:
- Widget basics | Stateless and stateful. | flutter:ui
- Layout | Rows, columns and constraints. | flutter:ui/layout
- Lists and scrolling | Efficient long lists. | flutter:cookbook/lists/long-lists
- Input and forms | Validate and submit. | flutter:cookbook/forms/validation
- Themes | Consistent style. | flutter:cookbook/design/themes
## Apps | Connect screens and data. | Build a three-screen app.
- Flutter navigation | Routes and deep links. | flutter:ui/navigation
- State management | Choose a simple approach. | flutter:data-and-backend/state-mgmt/intro
- Flutter networking | Fetch and parse. | flutter:cookbook/networking/fetch-data
- Persistence | Files and databases. | flutter:cookbook/persistence/sqlite
- Adaptive design | Phones, tablets and desktop. | flutter:ui/adaptive-responsive
## Polish and ship | Make it production ready. | Release a test build.
- Flutter animation | Motion with meaning. | flutter:ui/animations
- Flutter testing | Unit, widget and integration. | flutter:testing/overview
- Flutter performance | Smooth frames. | flutter:perf
- Flutter accessibility | Labels, contrast and scale. | flutter:ui/accessibility
- Platform channels | Call native code. | flutter:platform-integration/platform-channels
- @app-release
* Pomodoro timer | beginner | Focus timer with history. | State; Notifications; Theme | Flutter
* Travel journal | intermediate | Photos and places. | Local database; Maps; Tests | Persistence
* Shop app | advanced | Browse, basket and orders. | Offline; Deep links; CI build | Architecture
`],
[{ id: "react-native", kind: "skill", title: "React Native", area: "mobile", tagline: "Native mobile apps with the React you know.", keywords: ["react native", "expo"], courseTopics: ["React Native"], related: ["react", "android", "ios", "typescript"], roadmapSh: "react-native" }, `
## Start | Run on your phone. | Show a list on a device. | rn:getting-started
- React first | Components, state and hooks. | react:learn, map:react
- Expo | Tooling that gets you started. | expo:get-started/introduction/
- Core components | View, Text, Image and input. | rn:intro-react-native-components
- Styling native | Flexbox and style sheets. | rn:style
- Platform differences | iOS and Android specifics. | rn:platform-specific-code
## Interface | Feel native. | Build a tabbed app.
- Native navigation | Stacks, tabs and deep links. | expo:router/introduction/
- Native lists | Fast long lists. | rn:optimizing-flatlist-configuration
- Gestures and animation | Smooth interactions. | rn:animations
- Native accessibility | Roles, labels and focus. | rn:accessibility
- @mobile-ux
## Data and device | Use the phone. | Work offline for a day.
- Native networking | Requests and states. | rn:network
- Storage | Keys, files and databases. | expo:develop/user-interface/store-data/
- Permissions | Ask in context. | expo:guides/permissions/
- Push notifications | Timely and optional. | expo:push-notifications/overview/
- Native modules | Bridge to platform code. | rn:native-platform
## Ship | Quality on both stores. | Release a beta.
- Native testing | Unit and end-to-end. | rn:testing-overview
- Native performance | Frames, memory and startup. | rn:performance
- Native security | Protect tokens and data. | rn:security
- Build and release | Cloud builds and updates. | expo:build/introduction/
- @app-release
* Water tracker | beginner | Log and remind. | Storage; Notifications; Accessible | Expo
* Local events | intermediate | Find events nearby. | Location consent; Offline cache; Tests | Device APIs
* Delivery tracker | advanced | Live map and status. | Background updates; Performance; Beta release | Native
`]
];
