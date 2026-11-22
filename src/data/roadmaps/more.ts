import type { RoadmapSource } from "./types";

// Further roles and skills, including some chosen for students: getting hired,
// IT support, embedded systems, accessibility and computer vision.
export const moreRoadmaps: RoadmapSource[] = [
[{ id: "get-hired", kind: "skill", title: "Get Hired in Tech", area: "product", tagline: "From first profile to a signed offer, step by step.", keywords: ["student", "graduate", "job seeker", "internship", "entry level"], courseTopics: ["Computer Science"], related: ["frontend", "data-analyst", "data-structures-algorithms", "git-github"] }, `
## Direction | Choose a target you can explain. | Write one sentence: the role, why, and what you can already do.
- Choosing a role | Compare daily work, entry routes and your strengths. | techinterview
- Reading job descriptions | Separate must-haves from wishes and spot patterns. | techinterview
- Skill gap plan | Pick three gaps and one project that covers them. | techinterview
## Evidence | Show, do not claim. | Finish and publish one project.
- @portfolio
- @github
- Project write-ups | Problem, choices, result and what you would change. | techw:one
- Open source contributions | Start with documentation and small fixes. | web:opensource.guide/how-to-contribute/
## Documents | Make the relevant facts easy to find. | Tailor one CV to one real job.
- CV writing | Evidence-led bullet points and clean layout. | web:www.techinterviewhandbook.org/resume/
- Cover letters | Short, specific and true. | techw:one
- Online profile | A clear headline, work samples and contact. | gh:account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme
## Search | Apply with intent. | Track ten applications with next actions.
- Finding openings | Careers pages, boards, events and referrals. | techinterview
- Networking | Ask for insight before favours. | techinterview
- Tracking applications | Stages, dates and follow-ups. | techinterview
- Avoiding scams | Fees, secrecy and pressure are warnings. | web:consumer.ftc.gov/articles/job-scams
## Interviews | Prepare evidence and practise aloud. | Do two mock interviews.
- @interviews
- Coding interviews | Patterns, clarity and time. | neet
- Behavioural interviews | Situation, action, result and learning. | web:www.techinterviewhandbook.org/behavioral-interview/
- Take-home tasks | Scope, quality and notes on trade-offs. | techinterview
## Offer and start | Decide well and begin strong. | Write a 30-day plan.
- Understanding offers | Pay, growth, hours, contract and team. | web:www.techinterviewhandbook.org/understanding-compensation/
- Negotiating | Be polite, specific and informed. | web:www.techinterviewhandbook.org/negotiation/
- First ninety days | Learn the people, the product and the code. | gitlab
* Evidence portfolio | beginner | Publish two finished projects with write-ups. | Working links; Honest scope; Reviewed by one person | Communication
* Application campaign | intermediate | Twenty targeted applications with a tracker. | Tailored CV; Follow-ups; Weekly review | Planning
* Interview story bank | intermediate | Ten true stories mapped to common questions. | Evidence; Two-minute versions; Practised aloud | Interviewing
`],
[{ id: "it-support", kind: "role", title: "IT Support Specialist", area: "cloud", tagline: "Solve people's technology problems and keep work moving.", keywords: ["it support", "help desk", "technician", "system administrator", "desktop support"], courseTopics: ["Operating Systems", "Networking"], related: ["network-engineer", "linux", "cyber-security", "cloud-engineer"] }, `
## Computers | Know what you are fixing. | Identify every main part of a computer. | cs50x
- Hardware | Processor, memory, storage, power and ports. | cs50x
- Operating systems | Install, update and recover. | ms:windows/
- Peripherals and printers | Drivers, connections and queues. | ms:windows/
- @os-basics
## Networks | Get people connected. | Fix a deliberately broken connection.
- @networking
- @dns
- DHCP | Automatic addresses and common failures. | wiki:Dynamic_Host_Configuration_Protocol
- Wi-Fi problems | Signal, channels, security and interference. | wiki:Wi-Fi
## Accounts and devices | Manage access safely. | Set up a test account with limited rights.
- @authn
- Directory services | Users, groups and policies. | ms:windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview
- Device management | Enrol, update, lock and wipe. | ms:intune/
- Backups and recovery | Copies, tests and restores. | web:www.cisa.gov/stopransomware
## Support | Help people well. | Write one clear guide for a common problem.
- Troubleshooting method | Identify, test, fix, verify and record. | missing
- Tickets and priorities | Impact, urgency and updates. | atl:itsm/service-request-management
- Customer communication | Patience, plain words and expectations. | techw:one
- Knowledge base articles | Solve it once for everyone. | atl:itsm/knowledge-management
## Security and growth | Protect and progress. | Automate one repeated task.
- Security awareness | Phishing, updates and reporting. | web:www.cisa.gov/secure-our-world/recognize-and-report-phishing
- @linux
- PowerShell | Automate Windows tasks. | ms:powershell/scripting/learn/ps101/00-introduction
- @cloud-basics
* Support handbook | beginner | Ten common problems with tested steps. | Clear steps; Screenshots; Tested by a beginner | Documentation
* Small office plan | intermediate | Accounts, backup and network for ten people. | Costs; Security; Recovery test | Planning
* Onboarding automation | advanced | Script account and device setup. | Logged; Safe to rerun; Reversal plan | PowerShell
`],
[{ id: "embedded-engineer", kind: "role", title: "Embedded Systems Engineer", area: "programming", tagline: "Write software that senses and moves the physical world.", keywords: ["embedded", "iot", "firmware", "arduino", "electronics", "robotics"], courseTopics: ["C", "Robotics", "Assembly"], related: ["c", "cpp", "rust", "computer-science"] }, `
## Foundations | Connect code to electricity. | Blink and dim a light.
- C for hardware | Types, pointers and memory. | cs50x, map:c
- Digital logic | Voltage levels, gates and timing. | nand
- Basic electronics | Voltage, current, resistance and safety. | ka:science/physics/circuits-topic
- Reading datasheets | Pins, limits and registers. | wiki:Datasheet
## Microcontrollers | Control a device. | Read a sensor every second without delays.
- Microcontroller basics | Memory, clocks and peripherals. | web:docs.arduino.cc/learn/starting-guide/getting-started-arduino/
- Digital input and output | Buttons, debouncing and pull-ups. | web:docs.arduino.cc/learn/microcontrollers/digital-pins/
- Analogue signals | Conversion, noise and PWM. | web:docs.arduino.cc/learn/microcontrollers/analog-input/
- Interrupts and timers | React on time. | web:docs.arduino.cc/language-reference/en/functions/external-interrupts/attachInterrupt/
## Communication | Talk to parts and networks. | Log sensor data to a computer.
- UART, I2C and SPI | Common wires and their trade-offs. | web:docs.arduino.cc/learn/communication/wire/
- Wireless | Wi-Fi, Bluetooth and low power options. | web:docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/
- MQTT | Light messages for devices. | web:mqtt.org/getting-started/
## Real-time systems | Meet deadlines. | Run two tasks with different priorities.
- Real-time operating systems | Tasks, priorities and queues. | web:www.freertos.org/Documentation/01-FreeRTOS-quick-start/01-Beginners-guide/00-Overview
- @concurrency
- Memory and power | Fit and last longer. | wiki:Low-power_electronics
## Quality | Make devices dependable. | Add a watchdog and test recovery.
- Debugging hardware | Logic analysers, probes and logs. | wiki:JTAG
- Firmware updates | Signed, recoverable and staged. | owasp:www-project-internet-of-things/
- Device security | Keys, interfaces and updates. | owasp:www-project-internet-of-things/
- @git
* Plant monitor | beginner | Measure moisture and alert. | Debounced input; Calibrated; Documented wiring | Sensors
* Weather station | intermediate | Send readings to a dashboard. | Reconnects; Low power; Data checks | IoT
* Line follower | advanced | Robot with closed-loop control. | Tuned control; Safe stop; Test report | Control
`],
[{ id: "accessibility-specialist", kind: "role", title: "Accessibility Specialist", area: "design", tagline: "Make products work for everyone, and prove it.", keywords: ["accessibility", "a11y", "wcag", "inclusive design"], courseTopics: ["UI/UX", "HTML and CSS"], related: ["frontend", "ux-design", "html", "qa"] }, `
## People | Start with real needs. | Use your phone for ten minutes with a screen reader.
- Disability and barriers | Permanent, temporary and situational. | w3:WAI/people-use-web/
- Assistive technology | Screen readers, switches, magnifiers and voice. | w3:WAI/people-use-web/tools-techniques/
- Inclusive design | Solve for one, extend to many. | w3:WAI/fundamentals/accessibility-principles/
## Standards | Know the shared rules. | Explain four principles with examples.
- WCAG | Perceivable, operable, understandable and robust. | w3:WAI/standards-guidelines/wcag/
- Laws and policy | Where rules apply. | w3:WAI/policies/
- ARIA | Use it only when needed. | w3:WAI/ARIA/apg/
## Build | Get the basics right. | Fix a page using only HTML.
- @html
- @a11y
- Keyboard access | Order, focus and traps. | w3:WAI/test-evaluate/
- Forms and errors | Labels, instructions and recovery. | w3:WAI/tutorials/forms/
- Images and media | Alternatives, captions and transcripts. | w3:WAI/tutorials/images/
- Colour and text | Contrast, size and spacing. | webdev:learn/accessibility/color-contrast
## Test | Find what matters. | Audit five pages and rank problems.
- Automated checks | What tools find and miss. | w3:WAI/test-evaluate/tools/selecting/
- Manual testing | Keyboard, zoom and screen reader. | w3:WAI/test-evaluate/preliminary/
- Testing with people | Recruit, respect and pay. | w3:WAI/test-evaluate/involving-users/
- Reporting | Impact, evidence and a fix. | w3:WAI/test-evaluate/report-template/
## Lead | Make it last. | Write a one-page improvement plan.
- Design system access | Fix it once for all. | designsys
- Training teams | Roles, checklists and habits. | w3:WAI/planning-and-managing/
- Documents and mobile | Beyond web pages. | w3:WAI/standards-guidelines/mobile/
* Page rescue | beginner | Fix a badly built page. | Before and after; Keyboard complete; Contrast checked | HTML
* Full audit | intermediate | Audit a site you may test. | Ranked findings; Evidence; Suggested fixes | Auditing
* Accessible pattern library | advanced | Five tested components. | Keyboard; Screen reader notes; Documentation | ARIA
`],
[{ id: "product-designer", kind: "role", title: "Product Designer", area: "design", tagline: "Shape what a product does, how it works and how it feels.", keywords: ["product designer", "product design", "ui designer"], courseTopics: ["UI/UX"], related: ["ux-design", "product-manager", "design-systems"], roadmapSh: "product-design" }, `
## Understand | Learn the problem and the business. | Write a problem statement with evidence. | svpg
- Product thinking | Users, value and viability together. | svpg
- @ux-research
- Framing problems | Turn findings into opportunities. | web:www.designcouncil.org.uk/our-resources/the-double-diamond/
- @product-metrics
## Explore | Make many options. | Sketch eight ideas in eight minutes.
- Ideation | Quantity first, judgement later. | nng:ideation-in-practice/
- @wireframes
- User flows | Steps, choices and failures. | nng:user-journeys-vs-user-flows/
- Content first | Real words shape the layout. | web:design-system.service.gov.uk/
## Design | Make it clear and distinctive. | Design one flow in full. | learnui
- @visual-design
- Interaction states | Empty, loading, error and success. | nng:progress-indicators/
- Motion | Explain change without distraction. | learnui
- @a11y
- @mobile-ux
## Deliver | Work with engineers. | Hand over one feature and review it built.
- @design-system
- Prototyping | Test feel and flow. | figma:categories/360002051613-Get-started
- Design handoff | Decisions, states and tokens. | designsys
- Design quality review | Check the built product. | nng:design-critiques/
## Learn | Prove it helped. | Present a decision with evidence.
- @usability-testing
- @ab-testing
- @stakeholders
- @portfolio
* Onboarding redesign | beginner | Improve a first-run experience. | Problem evidence; Prototype; Three tests | Design
* Feature from scratch | intermediate | Research to tested prototype. | Options shown; States complete; Metrics | Product
* Product case study | advanced | End-to-end work with impact. | Trade-offs; Collaboration; Measured result | Portfolio
`],
[{ id: "forward-deployed-engineer", kind: "role", title: "Forward Deployed Engineer", area: "product", tagline: "Build with customers, on site, until it truly works.", keywords: ["forward deployed", "solutions engineer", "sales engineer", "implementation"], courseTopics: ["Software Engineering", "Python"], related: ["full-stack", "ai-engineer", "product-manager"], roadmapSh: "forward-deployed-engineer" }, `
## Engineering breadth | Be useful quickly. | Build a small tool for a real person in two days.
- @python
- @sql
- @rest
- @linux
- @docker
- @git
## Customer discovery | Find the real problem. | Shadow a process and map it.
- Discovery conversations | Ask about work, not features. | svpg
- Process mapping | Steps, people, data and delays. | atl:work-management/project-management
- @stakeholders
- Scoping | Outcomes, limits and success measures. | shapeup
## Integrate | Fit into what exists. | Connect two systems safely.
- Enterprise integration | Files, APIs, queues and legacy systems. | patterns:
- Data pipelines | Clean and move customer data. | airflow:core-concepts/overview.html
- @oauth
- @iam
- Privacy and compliance | Know the rules before touching data. | web:www.nist.gov/privacy-framework
## Deliver with AI | Apply models with care. | Prototype and evaluate one assistant.
- @llm-apis
- @rag
- @agents
- @llm-evals
## Make it stick | Leave value behind. | Hand over with training.
- Demos that persuade | Real data, clear outcome. | techw:two
- Change management | Help people adopt new ways. | atl:work-management/project-management
- @monitoring
- @tech-writing
- Feeding the product | Turn field lessons into features. | svpg
* Two-day tool | beginner | Solve one person's repeated task. | Problem evidence; Working tool; Measured time saved | Delivery
* System bridge | intermediate | Sync two services reliably. | Retries; Logs; Runbook | Integration
* Field pilot | advanced | Scoped pilot with success measures. | Evaluation; Training; Handover | Consulting
`],
[{ id: "developer-relations", kind: "role", title: "Developer Relations", area: "product", tagline: "Help developers succeed, and bring their voice back.", keywords: ["devrel", "developer advocate", "community", "evangelist"], courseTopics: ["Software Engineering", "Markdown"], related: ["technical-writer", "product-manager", "api-design"], roadmapSh: "devrel" }, `
## Foundations | Earn trust. | List what developers need before and after adopting a product.
- What DevRel does | Enable, listen and represent. | web:github.com/devrelcollective/awesome-devrel
- Developer journey | Discover, try, build and scale. | writethedocs
- Technical credibility | Build with what you promote. | exercism
## Create | Teach clearly. | Publish one tutorial that a beginner completes.
- @tech-writing
- Sample apps | Small, complete and maintained. | gh:repositories/creating-and-managing-repositories/about-repositories
- Talks | One idea, real demos and stories. | techw:two
- Video and streaming | Short, searchable and captioned. | w3:WAI/media/av/
## Community | Build a place people value. | Run one small event.
- Community building | Purpose, welcome and rituals. | web:opensource.guide/building-community/
- Moderation and safety | Clear rules, fairly applied. | web:opensource.guide/code-of-conduct/
- Open source practice | Issues, reviews and governance. | web:opensource.guide/
- Events and hackathons | Plan for inclusion. | web:guide.mlh.io/
## Feedback | Improve the product. | Write a friction log.
- Friction logs | Record every obstacle. | nng:usability-testing-101/
- Developer experience | Docs, errors, SDKs and speed. | web:dora.dev/
- @stakeholders
## Measure | Show real value. | Choose three honest measures.
- @product-metrics
- Content performance | Usefulness over views. | atl:agile/product-management/product-analytics
- Ethics and disclosure | Be open about who pays. | web:www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
* Tutorial series | beginner | Three linked tutorials. | Tested; Accessible; Feedback included | Writing
* Friction report | intermediate | Try a public tool and report. | Evidence; Priorities; Suggestions | Research
* Community launch | advanced | Start a small group. | Rules; Plan; Three events | Community
`],
[{ id: "ai-security", kind: "role", title: "AI Security & Red Teaming", area: "security", tagline: "Test AI systems responsibly, before others misuse them.", keywords: ["ai red team", "ai security", "llm security", "ai safety"], courseTopics: ["Security", "Generative AI"], related: ["cyber-security", "ai-engineer", "prompt-engineering"], roadmapSh: "ai-red-teaming" }, `
## Foundations | Know both fields. | Explain how an assistant uses tools.
- @llm-basics
- @prompting
- @cia
- @threat-modeling
- @python
## Risks | Know what can fail. | Map risks for one AI feature.
- OWASP risks for LLM apps | Common weaknesses and defences. | owasp:www-project-top-10-for-large-language-model-applications/
- Prompt injection | Untrusted text that tries to give orders. | owasp:www-project-top-10-for-large-language-model-applications/
- Data leakage | Secrets in prompts, logs and training. | nist:
- Bias and harmful output | Who could be hurt, and how. | web:www.nist.gov/itl/ai-risk-management-framework
- Model and data poisoning | Trust in sources and supply chain. | web:atlas.mitre.org/
- @supply-chain
## Test responsibly | Only with permission and limits. | Write a scope and stop rules.
- Rules of engagement | Permission, scope, data and stop conditions. | hackerone
- Building test cases | Realistic misuse, recorded and repeatable. | web:atlas.mitre.org/
- @llm-evals
- Automated testing | Broad coverage, human judgement. | web:github.com/NVIDIA/garak
- Severity and reporting | Impact, evidence and fix. | web:www.first.org/cvss/
## Defend | Reduce what success can do. | Remove one dangerous permission.
- Least privilege for agents | Narrow tools and scopes. | owasp:www-project-top-10-for-large-language-model-applications/
- Human approval | Pause before consequences. | effagents
- Input and output controls | Layers, not guarantees. | owasp:www-project-top-10-for-large-language-model-applications/
- Monitoring AI systems | Detect misuse and drift. | otel:what-is-opentelemetry/
- @incidents
## Govern | Make safety routine. | Draft a one-page policy.
- AI risk management | Map, measure, manage and govern. | web:www.nist.gov/itl/ai-risk-management-framework
- Responsible disclosure | Report so people can fix it. | web:www.cisa.gov/coordinated-vulnerability-disclosure-process
- @tech-writing
* Risk map | beginner | Threat model a small assistant. | Data flow; Ranked risks; Mitigations | Threat modelling
* Safety test suite | intermediate | Repeatable checks for your own app. | Permission; Severity; Regression run | Evaluation
* Hardened agent | advanced | Limit an agent's harm. | Least privilege; Approval; Before and after results | Defence
`],
[{ id: "ai-product-builder", kind: "role", title: "AI Product Builder", area: "ai", tagline: "Take an AI idea from problem to people paying attention.", keywords: ["ai product", "founder", "startup", "indie hacker", "no-code"], courseTopics: ["Generative AI", "Web Development"], related: ["ai-engineer", "product-manager", "full-stack", "ai-coding"], roadmapSh: "ai-product-builder" }, `
## Problem | Solve something real. | Find five people with the same problem.
- Finding problems | Watch repeated, costly frustration. | svpg
- @ux-research
- Is AI the right tool? | Prefer the simplest thing that works. | effagents
- Validating demand | Evidence before building. | svpg
## Prototype | Learn fast. | Ship a rough version in a weekend.
- @prompting
- @llm-apis
- Building with AI assistants | Speed with review. | dlai, map:ai-coding
- Simple web stack | One framework, one database, one host. | next:learn, map:nextjs
- @wireframes
## Make it dependable | Move past the demo. | Pass a twenty-case test set.
- @rag
- @llm-evals
- @ai-safety
- Designing for mistakes | Show sources, undo and correction. | web:pair.withgoogle.com/guidebook/
- Unit economics | Cost per use and price. | svpg
## Launch | Reach people honestly. | Get ten active users.
- Positioning | For whom, for what and why you. | svpg
- Landing page | One promise, proof and action. | webdev:learn/design
- @product-metrics
- Payments and law | Terms, privacy, tax and refunds. | web:gdpr.eu/what-is-gdpr/
## Grow | Improve what works. | Talk to three users each week.
- Feedback loops | Listen, choose and follow up. | svpg
- Retention | Do people return? | atl:agile/product-management/product-analytics
- @monitoring
- @roadmapping
* Weekend tool | beginner | One useful AI feature for one group. | Problem evidence; Cost shown; Limits stated | Prototyping
* Beta product | intermediate | Ten users and a test set. | Evaluation; Privacy note; Feedback log | Product
* Sustainable service | advanced | Pricing, reliability and support. | Unit economics; Monitoring; Refund policy | Business
`],
[{ id: "html", kind: "skill", title: "HTML", area: "web", tagline: "The structure beneath every page, done properly.", keywords: ["html", "html5"], courseTopics: ["HTML and CSS"], related: ["css", "javascript", "frontend", "accessibility-specialist"], roadmapSh: "html" }, `
## Start | Write a valid page. | Publish a page about yourself. | webdev:learn/html
- Document structure | Doctype, head and body. | webdev:learn/html/document-structure
- Text | Headings, paragraphs and lists. | webdev:learn/html/text-basics
- Links | Addresses, anchors and good wording. | webdev:learn/html/links
- Images | Formats, sizes and alternatives. | webdev:learn/html/images
## Meaning | Say what things are. | Mark up a news article.
- Semantic elements | Header, main, article and more. | webdev:learn/html/semantic-html
- Tables | Data with headers and captions. | webdev:learn/html/tables
- Lists and definitions | Group related items. | webdev:learn/html/lists
- @a11y
## Interaction | Collect input well. | Build an accessible form.
- Forms | Inputs, labels and grouping. | webdev:learn/html/forms
- Attributes | Data, state and behaviour. | webdev:learn/html/attributes
- Details and dialog | Native interaction. | webdev:learn/html/dialog
- Audio and video | Captions and controls. | webdev:learn/html/audio-video
## Production | Prepare for the world. | Pass a validator.
- Metadata | Titles, previews and icons. | webdev:learn/html/metadata
- Search basics | Structure machines understand. | web:developers.google.com/search/docs/fundamentals/seo-starter-guide, map:seo
- Validation | Find mistakes early. | web:validator.w3.org/
+ Templates and slots | Reusable pieces. | webdev:learn/html/template
* Recipe page | beginner | Semantic recipe with images. | Valid; Alt text; Printable | HTML
* Survey form | beginner | Accessible, grouped form. | Labels; Native validation; Keyboard | Forms
* Documentation site | intermediate | Five linked pages. | Landmarks; Metadata; No errors | Structure
`],
[{ id: "c", kind: "skill", title: "C", area: "programming", tagline: "Understand memory, machines and the roots of modern systems.", keywords: ["c programming", "c language"], courseTopics: ["C"], related: ["cpp", "embedded-engineer", "computer-science", "rust"], roadmapSh: "c" }, `
## Basics | Write, compile and run. | Build a unit converter. | cs50x
- Compiling | Source to program. | cs50x
- Types and operators | Sizes, limits and conversions. | web:en.cppreference.com/w/c/language/type
- Control flow | Choose and repeat. | web:en.cppreference.com/w/c/language/statements
- Functions | Parameters, returns and prototypes. | web:en.cppreference.com/w/c/language/functions
## Memory | The heart of C. | Draw memory for a small program.
- Arrays and strings | Bounds and terminators. | web:en.cppreference.com/w/c/language/array
- Pointers | Addresses and dereferencing. | web:en.cppreference.com/w/c/language/pointer
- Stack and heap | Lifetime and cost. | web:en.cppreference.com/w/c/memory
- Dynamic memory | Allocate, check and free. | web:en.cppreference.com/w/c/memory/malloc
## Structure | Organise programs. | Build a linked list library.
- Structs and unions | Group data. | web:en.cppreference.com/w/c/language/struct
- Files and headers | Split and share. | web:en.cppreference.com/w/c/preprocessor/include
- File input and output | Read and write safely. | web:en.cppreference.com/w/c/io
- Preprocessor | Macros with care. | web:en.cppreference.com/w/c/preprocessor
## Robust code | Find mistakes. | Fix a program with three memory bugs.
- Undefined behaviour | What the language does not promise. | web:en.cppreference.com/w/c/language/behavior
- Debuggers | Step and inspect. | web:www.sourceware.org/gdb/documentation/
- Sanitizers | Detect memory errors. | web:clang.llvm.org/docs/AddressSanitizer.html
- Make | Automate builds. | web:www.gnu.org/software/make/manual/make.html
- Secure C | Bounds, formats and integers. | wiki:Buffer_overflow
## Systems | Use the machine. | Write a tiny shell.
- Processes | Create and wait. | ostep
- Threads | Share memory safely. | ostep
- Sockets | Talk over a network. | web:beej.us/guide/bgnet/
* Address book | beginner | File-backed contacts. | No leaks; Bounds checked; Tests | Memory
* Text editor core | intermediate | Edit text in the terminal. | Dynamic buffer; Undo; Sanitizer clean | Data structures
* HTTP server | advanced | Serve files over sockets. | Concurrency; Limits; Load test | Systems
`],
[{ id: "shell-scripting", kind: "skill", title: "Shell & Bash", area: "cloud", tagline: "Automate the boring parts of every computer.", keywords: ["bash", "shell", "scripting", "terminal"], courseTopics: ["Bash / Shell"], related: ["linux", "devops", "git-github"], roadmapSh: "shell-bash" }, `
## Command line | Be quick and careful. | Find the five largest files. | missing
- Shell basics | Commands, options and help. | missing
- Paths and globbing | Address many files. | bash:Pattern-Matching.html
- Pipes and redirection | Combine tools. | bash:Redirections.html
- Environment | Variables and configuration. | bash:Environment.html
## Scripts | Write reliable automation. | Rename files with a preview.
- Script structure | Shebang, arguments and help. | bash:Shell-Scripts.html
- Variables and quoting | Avoid surprises. | bash:Quoting.html
- Conditions | Tests and exit codes. | bash:Bash-Conditional-Expressions.html
- Loops | Repeat safely. | bash:Looping-Constructs.html
- Shell functions | Reuse steps. | bash:Shell-Functions.html
- Arrays | Lists without breakage. | bash:Arrays.html
## Text | Transform data. | Summarise a log.
- grep and patterns | Find lines. | web:www.gnu.org/software/grep/manual/grep.html
- sed | Edit streams. | web:www.gnu.org/software/sed/manual/sed.html
- awk | Columns and totals. | web:www.gnu.org/software/gawk/manual/gawk.html
- JSON with jq | Query structured data. | web:jqlang.org/tutorial/
## Robust | Fail safely. | Make a script pass ShellCheck.
- Error handling | Options, traps and cleanup. | bash:The-Set-Builtin.html
- ShellCheck | Catch mistakes. | shellcheck
- Scheduling | Run on time. | web:man7.org/linux/man-pages/man5/crontab.5.html
- Security | Input, permissions and secrets. | shellcheck
- When not to use shell | Choose a fuller language. | web:google.github.io/styleguide/shellguide.html
* Backup script | beginner | Copy, rotate and report. | Dry run; Exit codes; Restore tested | Bash
* Log reporter | intermediate | Daily summary from logs. | awk; Handles empty; Scheduled | Text
* Setup tool | advanced | Prepare a machine from scratch. | Idempotent; Flags; Tested in a container | Automation
`],
[{ id: "django", kind: "skill", title: "Django", area: "web", tagline: "Complete, secure Python web apps with batteries included.", keywords: ["django", "python web"], courseTopics: ["Django"], related: ["python", "backend", "sql"], roadmapSh: "django" }, `
## Start | Build your first app. | Finish a small polls app. | web:docs.djangoproject.com/en/stable/intro/
- @python
- Project and apps | Structure and settings. | web:docs.djangoproject.com/en/stable/intro/tutorial01/
- URLs and views | Map requests to responses. | web:docs.djangoproject.com/en/stable/topics/http/urls/
- Templates | Render safe pages. | web:docs.djangoproject.com/en/stable/topics/templates/
## Data | Model it well. | Add related models and queries.
- Models | Fields and relationships. | web:docs.djangoproject.com/en/stable/topics/db/models/
- Migrations | Evolve the schema. | web:docs.djangoproject.com/en/stable/topics/migrations/
- QuerySets | Filter, join and aggregate. | web:docs.djangoproject.com/en/stable/topics/db/queries/
- Query performance | Avoid N+1. | web:docs.djangoproject.com/en/stable/topics/db/optimization/
- Admin | Manage data quickly. | web:docs.djangoproject.com/en/stable/ref/contrib/admin/
## Features | Build real products. | Add accounts and permissions.
- Forms | Validate and save. | web:docs.djangoproject.com/en/stable/topics/forms/
- Authentication | Users and sign-in. | web:docs.djangoproject.com/en/stable/topics/auth/
- Class-based views | Reuse behaviour. | web:docs.djangoproject.com/en/stable/topics/class-based-views/
- REST APIs | Serializers and viewsets. | web:www.django-rest-framework.org/tutorial/quickstart/
- Background tasks | Work outside requests. | web:docs.celeryq.dev/en/stable/getting-started/first-steps-with-celery.html
## Production | Run it safely. | Pass the deployment checklist.
- Testing Django | Client, models and factories. | web:docs.djangoproject.com/en/stable/topics/testing/
- Django security | Built-in protection. | web:docs.djangoproject.com/en/stable/topics/security/
- Caching Django | Faster pages. | web:docs.djangoproject.com/en/stable/topics/cache/
- Deploying Django | Settings and static files. | web:docs.djangoproject.com/en/stable/howto/deployment/checklist/
- @docker
* Reading log | beginner | Track books and notes. | Models; Forms; Tests | Django
* Course platform | intermediate | Lessons and progress. | Permissions; API; Admin | Full stack
* Multi-tenant app | advanced | Separate data per organisation. | Isolation tests; Tasks; Monitoring | Architecture
`],
[{ id: "ruby-on-rails", kind: "skill", title: "Ruby on Rails", area: "web", tagline: "Go from idea to working product with strong conventions.", keywords: ["ruby", "rails", "ruby on rails"], courseTopics: ["Ruby"], related: ["backend", "full-stack", "sql"], roadmapSh: "ruby-on-rails" }, `
## Ruby | Learn the language. | Solve ten exercises. | exercism
- Ruby basics | Objects, strings and symbols. | web:www.ruby-lang.org/en/documentation/quickstart/
- Collections | Arrays, hashes and blocks. | web:www.ruby-lang.org/en/documentation/quickstart/
- Classes and modules | Share behaviour. | web:www.ruby-lang.org/en/documentation/quickstart/2/
## Rails basics | Follow the conventions. | Build a blog. | web:guides.rubyonrails.org/
- Getting started | Structure and generators. | web:guides.rubyonrails.org/getting_started.html
- Routing | Resources and paths. | web:guides.rubyonrails.org/routing.html
- Controllers | Parameters and responses. | web:guides.rubyonrails.org/action_controller_overview.html
- Views and layouts | Templates and partials. | web:guides.rubyonrails.org/layouts_and_rendering.html
## Data | Model the domain. | Add related records with rules.
- Active Record | Models and queries. | web:guides.rubyonrails.org/active_record_basics.html
- Migrations | Change the schema. | web:guides.rubyonrails.org/active_record_migrations.html
- Validations | Keep data correct. | web:guides.rubyonrails.org/active_record_validations.html
- Associations | Connect models. | web:guides.rubyonrails.org/association_basics.html
## Product | Add real features. | Add live updates.
- Hotwire | Interactive pages with little JavaScript. | web:hotwired.dev/
- Authentication | Accounts and sessions. | web:guides.rubyonrails.org/security.html
- Background jobs | Work later. | web:guides.rubyonrails.org/active_job_basics.html
- File uploads | Store and serve. | web:guides.rubyonrails.org/active_storage_overview.html
## Production | Keep it healthy. | Deploy with tests passing.
- Testing Rails | Models to system tests. | web:guides.rubyonrails.org/testing.html
- Rails security | Built-in defences. | web:guides.rubyonrails.org/security.html
- Caching Rails | Faster responses. | web:guides.rubyonrails.org/caching_with_rails.html
* Task board | beginner | Lists and tasks. | Validations; Tests; Responsive | Rails
* Event booking | intermediate | Seats and confirmations. | Transactions; Jobs; Roles | Product
* Live classroom | advanced | Real-time questions. | Hotwire; Moderation; Load test | Real time
`],
[{ id: "scala", kind: "skill", title: "Scala", area: "programming", tagline: "Functional and object-oriented power on the JVM.", keywords: ["scala", "spark"], courseTopics: ["Scala", "Spark"], related: ["java", "data-engineer", "kotlin"], roadmapSh: "scala" }, `
## Basics | Read and write Scala. | Port a Java class. | web:docs.scala-lang.org/scala3/book/introduction.html
- Values and types | Inference and immutability. | web:docs.scala-lang.org/scala3/book/first-look-at-types.html
- Control structures | Expressions everywhere. | web:docs.scala-lang.org/scala3/book/control-structures.html
- Methods and functions | Define and pass. | web:docs.scala-lang.org/scala3/book/fun-intro.html
- Collections | Transform data. | web:docs.scala-lang.org/scala3/book/collections-intro.html
## Modelling | Make illegal states impossible. | Model payments.
- Classes and traits | Compose behaviour. | web:docs.scala-lang.org/scala3/book/domain-modeling-tools.html
- Case classes and enums | Data with meaning. | web:docs.scala-lang.org/scala3/book/domain-modeling-fp.html
- Pattern matching | Handle every case. | web:docs.scala-lang.org/tour/pattern-matching.html
- Option and Either | Absence and failure. | web:docs.scala-lang.org/scala3/book/fp-functional-error-handling.html
## Types | Use the type system. | Write a small type class.
- Scala generics | Reuse and variance. | web:docs.scala-lang.org/scala3/book/types-generics.html
- Given and using | Context passed safely. | web:docs.scala-lang.org/scala3/book/ca-context-parameters.html
- Type classes | Extend without inheritance. | web:docs.scala-lang.org/scala3/book/ca-type-classes.html
## Practice | Build real software. | Publish a tested tool.
- sbt | Build and dependencies. | web:www.scala-sbt.org/1.x/docs/Getting-Started.html
- Scala testing | Unit and property tests. | web:docs.scala-lang.org/scala3/book/tools-sbt.html
- Futures | Asynchronous work. | web:docs.scala-lang.org/overviews/core/futures.html
+ Spark with Scala | Data at scale. | spark:sql-getting-started.html
* Text analyser | beginner | Word statistics. | Immutable; Tests; Files | Collections
* Rules engine | intermediate | Typed pricing rules. | Enums; Errors as values; Tests | Modelling
* Stream processor | advanced | Event aggregation. | Back pressure; Benchmarks; Docs | Data
`],
[{ id: "r-programming", kind: "skill", title: "R", area: "data", tagline: "Statistics, graphics and reports in one language.", keywords: ["r programming", "rstudio", "tidyverse"], courseTopics: ["R"], related: ["data-analyst", "data-scientist", "sql"], roadmapSh: "r" }, `
## Start | Explore data quickly. | Plot a built-in dataset. | web:r4ds.hadley.nz/
- R and RStudio | Set up and run. | web:rstudio-education.github.io/hopr/starting.html
- Vectors | The basic building block. | web:adv-r.hadley.nz/vectors-chap.html
- Data frames | Tables of data. | web:r4ds.hadley.nz/data-transform.html
- Packages | Extend R. | web:rstudio-education.github.io/hopr/packages2.html
## Transform | Shape data. | Clean a messy file.
- Importing | Files and databases. | web:r4ds.hadley.nz/data-import.html
- dplyr | Filter, mutate and summarise. | web:r4ds.hadley.nz/data-transform.html
- Tidy data | One variable per column. | web:r4ds.hadley.nz/data-tidy.html
- Joins | Combine tables. | web:r4ds.hadley.nz/joins.html
- Strings and dates | Parse and format. | web:r4ds.hadley.nz/strings.html
## Communicate | Show findings. | Build a reproducible report.
- ggplot2 | Layered graphics. | web:r4ds.hadley.nz/data-visualize.html
- Quarto | Reports and documents. | web:r4ds.hadley.nz/quarto.html
- Shiny | Interactive apps. | web:shiny.posit.co/r/getstarted/shiny-basics/lesson1/
## Statistics | Reason carefully. | Fit and explain a model.
- @statistics
- Linear models | Fit and check. | islp
- Hypothesis tests in R | Choose and interpret. | openintro
- Machine learning in R | Consistent workflow. | web:www.tidymodels.org/start/
## Program | Write reusable code. | Make a small package.
- Writing functions | Reuse steps. | web:r4ds.hadley.nz/functions.html
- Iteration | Apply over many. | web:r4ds.hadley.nz/iteration.html
- R packages | Share tools. | web:r-pkgs.org/
* Survey report | beginner | Analyse open survey data. | Clean code; Three plots; Limits | R
* Interactive explorer | intermediate | Shiny app for a dataset. | Filters; Accessible; Deployed | Shiny
* Analysis package | advanced | Reusable methods. | Tests; Docs; Example report | Packages
`],
[{ id: "swiftui", kind: "skill", title: "Swift & SwiftUI", area: "mobile", tagline: "Build Apple apps with clear, declarative code.", keywords: ["swift", "swiftui"], courseTopics: ["Swift", "iOS"], related: ["ios", "flutter", "react-native"], roadmapSh: "swift-ui" }, `
## Swift | Learn the language. | Write a small text tool. | hackingswift
- Swift tour | Values, collections and flow. | swift:guidedtour
- Optionals | Missing values made safe. | swift:thebasics
- Structs and protocols | Model and share. | swift:protocols
- Closures | Behaviour as values. | swift:closures
## Views | Compose screens. | Rebuild a settings screen. | apple:tutorials/swiftui
- Views and modifiers | Small pieces. | apple:documentation/swiftui/view-fundamentals
- Layout | Stacks, grids and spacing. | apple:documentation/swiftui/layout-fundamentals
- Lists | Scrolling data. | apple:documentation/swiftui/lists
- Navigation | Move between screens. | apple:documentation/swiftui/navigation
- Controls | Buttons, fields and pickers. | apple:documentation/swiftui/controls-and-indicators
## Data flow | One source of truth. | Share state across screens.
- State and binding | Local and shared. | apple:documentation/swiftui/state
- Observation | React to model changes. | apple:documentation/swiftui/model-data
- Async loading | Tasks and states. | swift:concurrency
- Persistence | Save with SwiftData. | apple:documentation/swiftdata
## Polish | Feel native. | Pass a VoiceOver check.
- SwiftUI animation | Meaningful motion. | apple:documentation/swiftui/animations
- SwiftUI accessibility | Labels, traits and type size. | apple:documentation/swiftui/accessibility-fundamentals
- Previews and testing | See and verify. | apple:documentation/testing
- @mobile-ux
- @app-release
* Countdown app | beginner | Events and reminders. | State; Persistence; Accessible | SwiftUI
* Budget tracker | intermediate | Categories and charts. | SwiftData; Charts; Tests | Data
* Multi-platform notes | advanced | Phone, tablet and Mac. | Sync; Adaptive; Release | Platforms
`],
[{ id: "wordpress", kind: "skill", title: "WordPress", area: "web", tagline: "Build and look after sites for real clients.", keywords: ["wordpress", "cms", "elementor"], courseTopics: ["WordPress"], related: ["php", "seo", "css"], roadmapSh: "wordpress" }, `
## Use it | Run a site well. | Launch a five-page site. | web:learn.wordpress.org/
- Setup and hosting | Install, domain and HTTPS. | web:wordpress.org/documentation/article/how-to-install-wordpress/
- Posts and pages | Content that is organised. | web:wordpress.org/documentation/
- Block editor | Build layouts. | web:wordpress.org/documentation/article/wordpress-block-editor/
- Themes | Choose and customise. | web:wordpress.org/documentation/article/work-with-themes/
- Plugins | Add only what you need. | web:wordpress.org/documentation/article/manage-plugins/
## Develop | Build your own. | Make a block theme. | web:developer.wordpress.org/
- @html
- @css
- PHP | The language beneath. | phpway, map:php
- Block themes | Templates and styles. | web:developer.wordpress.org/themes/
- Custom blocks | React-based editing. | web:developer.wordpress.org/block-editor/getting-started/
- Plugin development | Hooks and settings. | web:developer.wordpress.org/plugins/
## Data | Extend content. | Add a custom content type.
- Content types | Beyond posts. | web:developer.wordpress.org/plugins/post-types/
- REST API | Use content elsewhere. | web:developer.wordpress.org/rest-api/
- Queries | Show the right content. | web:developer.wordpress.org/themes/basics/the-loop/
## Operate | Keep it safe and fast. | Restore from backup.
- WordPress security | Updates, roles and hardening. | web:developer.wordpress.org/advanced-administration/security/hardening/
- Backups | Copy and restore. | web:developer.wordpress.org/advanced-administration/security/backup/
- Performance | Caching and images. | web:developer.wordpress.org/advanced-administration/performance/optimization/
- Search visibility | Structure and metadata. | web:developers.google.com/search/docs/fundamentals/seo-starter-guide, map:seo
- Client work | Scope, handover and care. | techw:one
* Club website | beginner | Pages, news and contact. | Accessible; Fast; Backed up | Sites
* Custom theme | intermediate | Block theme from a design. | Styles; Patterns; Responsive | Themes
* Booking plugin | advanced | Appointments with rules. | Security checks; Tests; Documentation | Plugins
`],
[{ id: "elasticsearch", kind: "skill", title: "Elasticsearch", area: "data", tagline: "Search and analyse large amounts of text and events.", keywords: ["elasticsearch", "elk", "kibana", "search engine"], courseTopics: ["Elastic"], related: ["backend", "data-engineer", "devops"], roadmapSh: "elasticsearch" }, `
## Ideas | Understand search. | Index and find ten documents. | web:www.elastic.co/docs/get-started
- Inverted index | Why text search is fast. | wiki:Inverted_index
- Documents and indices | Store and organise. | web:www.elastic.co/docs/manage-data/data-store/index-basics
- Running it | Install and explore. | web:www.elastic.co/docs/get-started
## Model | Describe your data. | Design mappings for products.
- Mappings | Field types matter. | web:www.elastic.co/docs/manage-data/data-store/mapping
- Text analysis | Tokens, filters and languages. | web:www.elastic.co/docs/manage-data/data-store/text-analysis
- Templates | Consistent new indices. | web:www.elastic.co/docs/manage-data/data-store/templates
## Search | Find what people mean. | Improve one poor search.
- Query DSL | Match, filter and combine. | web:www.elastic.co/docs/explore-analyze/query-filter/languages/querydsl
- Relevance | Scoring and boosts. | web:www.elastic.co/docs/solutions/search/full-text
- Aggregations | Summarise results. | web:www.elastic.co/docs/explore-analyze/query-filter/aggregations
- Autocomplete and typos | Helpful search. | web:www.elastic.co/docs/solutions/search/full-text
+ Vector search | Meaning as well as words. | web:www.elastic.co/docs/solutions/search/vector
## Operate | Keep it healthy. | Recover a lost node.
- Shards and replicas | Scale and survive. | web:www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards
- Ingestion | Pipelines and bulk loads. | web:www.elastic.co/docs/manage-data/ingest
- Data lifecycle | Keep, move and delete. | web:www.elastic.co/docs/manage-data/lifecycle
- Kibana | Explore and alert. | web:www.elastic.co/docs/explore-analyze
- Securing search | Roles and encryption. | web:www.elastic.co/docs/deploy-manage/security
* Product search | beginner | Filters and suggestions. | Mappings; Typos; Tests | Search
* Log explorer | intermediate | Collect and chart logs. | Lifecycle; Dashboard; Alerts | Observability
* Hybrid search | advanced | Words plus meaning. | Labelled set; Metrics; Comparison | Relevance
`],
[{ id: "cloudflare", kind: "skill", title: "Cloudflare", area: "cloud", tagline: "Run fast, protected apps close to users.", keywords: ["cloudflare", "edge", "workers"], courseTopics: ["Cloud Computing", "Networking"], related: ["cloud-engineer", "javascript", "network-engineer"], roadmapSh: "cloudflare" }, `
## Foundations | Know the edge. | Put a site behind a proxy. | web:developers.cloudflare.com/fundamentals/
- @dns
- @https-tls
- @cdn
- How a proxy network works | Requests, caches and rules. | web:developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/
## Protect and speed | Improve a site. | Add caching and measure.
- DNS management | Records and safety. | web:developers.cloudflare.com/dns/
- Cache rules | What, where and how long. | web:developers.cloudflare.com/cache/
- Firewall rules | Filter unwanted traffic. | web:developers.cloudflare.com/waf/
- Rate limits | Slow abuse. | web:developers.cloudflare.com/waf/rate-limiting-rules/
## Build | Run code at the edge. | Deploy a small API.
- Workers | Functions near users. | web:developers.cloudflare.com/workers/
- Static assets | Host front ends. | web:developers.cloudflare.com/workers/static-assets/
- Local development | Test and deploy. | web:developers.cloudflare.com/workers/wrangler/
## Store | Choose storage. | Compare three stores.
- KV | Read-heavy data. | web:developers.cloudflare.com/kv/
- D1 | SQL at the edge. | web:developers.cloudflare.com/d1/
- R2 | Object storage. | web:developers.cloudflare.com/r2/
- Durable Objects | Coordination and state. | web:developers.cloudflare.com/durable-objects/
- Queues | Work later. | web:developers.cloudflare.com/queues/
## Operate | Run responsibly. | Set limits and alerts.
- Logs and metrics | See what happens. | web:developers.cloudflare.com/workers/observability/
- @secrets
- Zero trust access | Protect internal tools. | web:developers.cloudflare.com/cloudflare-one/
- @cloud-cost
* Link page | beginner | Static site on a global network. | HTTPS; Cached; Fast | Hosting
* Edge API | intermediate | Short links with statistics. | Storage choice; Limits; Tests | Workers
* Live room | advanced | Shared state for a group. | Coordination; Reconnect; Cost estimate | State
`],
[{ id: "power-bi", kind: "skill", title: "Power BI", area: "data", tagline: "Turn business data into clear, trusted reports.", keywords: ["power bi", "dax", "power query"], courseTopics: ["Data Science", "SQL"], related: ["bi-analyst", "data-analyst", "sql"], roadmapSh: "power-bi" }, `
## Start | Build a first report. | Report on a public dataset. | powerbi
- Power BI parts | Desktop, service and mobile. | ms:power-bi/fundamentals/power-bi-overview
- Connecting data | Files, databases and web. | ms:power-bi/connect-data/desktop-connect-to-data
- First visuals | Choose and format. | ms:power-bi/visuals/power-bi-report-visualizations
## Prepare | Clean before modelling. | Automate a monthly clean-up.
- Power Query | Shape and combine. | ms:power-query/power-query-what-is-power-query
- @data-cleaning
- Combining sources | Merge and append. | ms:power-query/merge-queries-overview
## Model | Make correct answers easy. | Build a star schema.
- Star schema | Facts and dimensions. | ms:power-bi/guidance/star-schema
- Relationships | Direction and keys. | ms:power-bi/transform-model/desktop-relationships-understand
- Date tables | Time done properly. | ms:power-bi/guidance/model-date-tables
## DAX | Calculate with meaning. | Write year-on-year growth.
- DAX basics | Measures and columns. | ms:dax/dax-overview
- Filter context | How numbers change. | ms:dax/calculate-function-dax
- Time intelligence | Compare periods. | ms:dax/time-intelligence-functions-dax
- Debugging DAX | Variables and checks. | ms:dax/best-practices/dax-variables
## Share | Reach people safely. | Publish with access rules.
- Report design | Clear and accessible. | ms:power-bi/create-reports/desktop-accessibility-overview
- @data-viz
- Row-level security | Show the right data. | ms:fabric/security/service-admin-row-level-security
- Refresh and gateways | Keep it current. | ms:power-bi/connect-data/refresh-data
- Report performance | Find slow parts. | ms:power-bi/create-reports/desktop-performance-analyzer
* Sales report | beginner | Interactive overview. | Clear measures; Filters; Notes | Reports
* Finance model | intermediate | Budget against actual. | Star schema; DAX; Variance | Modelling
* Company dashboard | advanced | Secure, refreshed and documented. | Row security; Performance; Handover | Delivery
`],
[{ id: "design-systems", kind: "skill", title: "Design Systems", area: "design", tagline: "Make good, consistent interfaces the easy choice.", keywords: ["design system", "storybook", "design tokens"], courseTopics: ["UI/UX"], related: ["ux-design", "frontend", "accessibility-specialist"], roadmapSh: "design-system" }, `
## Purpose | Know why and for whom. | Audit one product's inconsistencies.
- What a system is | Principles, parts and people. | designsys
- Interface inventory | See what exists. | web:bradfrost.com/blog/post/interface-inventory/
- Principles | Decisions that guide. | web:principles.design/
- Making the case | Cost, quality and speed. | nng:design-systems-101/
## Foundations | Define the basics. | Create a token set.
- Design tokens | Named decisions. | web:www.designtokens.org/
- Colour systems | Roles, contrast and themes. | learnui
- Type and spacing | Scales that work. | learnui
- Icons and imagery | Style and meaning. | learnui
- @a11y
## Components | Build reliable parts. | Build a tested dialog.
- Component anatomy | Parts, states and variants. | designsys
- API design for components | Clear, small and flexible. | react:learn/passing-props-to-a-component
- Accessible patterns | Keyboard and semantics. | w3:WAI/ARIA/apg/
- Storybook | Develop and document. | web:storybook.js.org/docs
- Visual testing | Catch unintended change. | pw:test-snapshots
## Guidance | Help people use it. | Write usage for one component.
- Documentation | When, how and why not. | writethedocs
- Content guidelines | Words are part of design. | web:design-system.service.gov.uk/
- Figma libraries | Shared design source. | figma:
## Operate | Keep it alive. | Plan a release.
- Versioning | Change without surprise. | web:semver.org/
- Contribution model | Who decides and how. | web:opensource.guide/leadership-and-governance/
- Measuring adoption | Use, gaps and quality. | nng:design-systems-101/
* Token kit | beginner | Colours, type and space. | Two themes; Contrast checked; Documented | Tokens
* Core components | intermediate | Six accessible parts. | Storybook; Tests; Guidance | Components
* System launch | advanced | Versioned system in two apps. | Migration; Governance; Metrics | Operations
`],
[{ id: "seo", kind: "skill", title: "SEO", area: "product", tagline: "Help the right people find useful pages.", keywords: ["seo", "search engine optimization", "digital marketing"], courseTopics: ["Web Development"], related: ["html", "wordpress", "technical-writer"], roadmapSh: "seo" }, `
## How search works | Know the process. | Check how one page appears in search. | web:developers.google.com/search/docs
- Crawling and indexing | How pages are found. | web:developers.google.com/search/docs/fundamentals/how-search-works
- Search intent | What people really want. | web:developers.google.com/search/docs/fundamentals/creating-helpful-content
- Ethical practice | Follow the rules. | web:developers.google.com/search/docs/essentials/spam-policies
## Content | Be genuinely useful. | Improve one page for a real question.
- Keyword research | Words people use. | web:developers.google.com/search/docs/fundamentals/seo-starter-guide
- Helpful content | Original, clear and trustworthy. | web:developers.google.com/search/docs/fundamentals/creating-helpful-content
- Titles and snippets | Earn the click honestly. | web:developers.google.com/search/docs/appearance/title-link
- Internal links | Guide people and crawlers. | web:developers.google.com/search/docs/crawling-indexing/links-crawlable
## Technical | Let it be understood. | Fix three technical problems.
- Sitemaps and robots | Guide crawlers. | web:developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Canonical pages | Handle duplicates. | web:developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Structured data | Describe content. | web:developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- JavaScript pages | Make content visible. | web:developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- @web-performance
- Languages and regions | Reach the right audience. | web:developers.google.com/search/docs/specialty/international
## Reputation | Earn trust. | Get one genuine mention.
- Links from others | Earned, never bought. | web:developers.google.com/search/docs/essentials/spam-policies
- Local search | Be found nearby. | web:support.google.com/business/answer/7091
## Measure | Learn and adjust. | Write a monthly summary.
- Search Console | See queries and problems. | web:developers.google.com/search/docs/monitor-debug/search-console-start
- @product-metrics
- Search and AI answers | Adapt to new formats. | web:developers.google.com/search/docs/appearance/ai-features
* Page improvement | beginner | Improve one page with evidence. | Before and after; Intent; Honest result | Content
* Technical audit | intermediate | Audit a site you may test. | Ranked issues; Fixes; Checks | Technical
* Content plan | advanced | Plan and measure a topic. | Research; Six pages; Report | Strategy
`],
[{ id: "ai-coding", kind: "skill", title: "Coding with AI", area: "ai", tagline: "Work faster with AI assistants without losing judgement.", keywords: ["ai coding", "copilot", "claude code", "cursor", "vibe coding"], courseTopics: ["Generative AI", "Software Engineering"], related: ["ai-engineer", "prompt-engineering", "code-review"], roadmapSh: "vibe-coding" }, `
## Mindset | You own the result. | List three things you will always check.
- What assistants do well | Drafts, tests, explanations and search. | dlai
- What they get wrong | Invented APIs, hidden bugs and outdated advice. | pguide:risks
- Responsibility | You understand and answer for it. | engpractices
- @git
## Ask well | Give what is needed. | Write one request with clear acceptance checks.
- Clear tasks | Goal, limits, examples and done. | promptlearn
- Giving context | Relevant files, rules and decisions. | web:docs.claude.com/en/docs/claude-code/best-practices
- Project instructions | Teach conventions once. | web:docs.claude.com/en/docs/claude-code/memory
- Small steps | Plan, change and check. | web:docs.claude.com/en/docs/claude-code/best-practices
## Verify | Trust evidence. | Catch one wrong suggestion and explain it.
- Reading generated code | Behaviour before style. | engpractices
- @unit-testing
- Running and checking | See it work. | pw:intro
- @code-review
- Security of suggestions | Inputs, secrets and packages. | owasp:www-project-top-10-for-large-language-model-applications/
## Agents in the editor | Delegate carefully. | Give an agent one bounded task.
- Agent workflows | Explore, plan, build and verify. | effagents
- Permissions | Limit what it may do. | web:docs.claude.com/en/docs/claude-code/security
- @mcp
- Parallel work | Branches and reviews. | web:git-scm.com/docs/git-worktree
## Learn still | Grow your own skill. | Rebuild one piece without help.
- Using AI to learn | Ask why, then practise. | elements
- Licences and privacy | Know what you share and reuse. | web:choosealicense.com/
- Team norms | Agree how it is used. | gitlab
* Assisted refactor | beginner | Improve code with tests first. | Tests; Reviewed diff; Notes | Verification
* Documented feature | intermediate | Build with an assistant and log decisions. | Plan; Checks; Reflection | Workflow
* Team playbook | advanced | Rules for safe use. | Examples; Privacy; Measured benefit | Process
`],
[{ id: "software-design", kind: "skill", title: "Software Design", area: "programming", tagline: "Write code that stays easy to change.", keywords: ["software design", "clean code", "architecture"], courseTopics: ["Software Engineering"], related: ["software-architect", "code-review", "system-design"], roadmapSh: "software-design-architecture" }, `
## Readable code | Make intent clear. | Rename and split one confusing file.
- @clean-code
- Naming | Say what it means. | guru:refactoring/smells
- Small functions | One idea each. | guru:refactoring/techniques
- Comments | Explain why. | guru:smells/comments
## Structure | Organise change. | Remove one dependency.
- Coupling and cohesion | What belongs together. | wiki:Coupling_(computer_programming)
- @oop
- @solid
- Functional style | Pure functions and data. | wiki:Functional_programming
- Error design | Make failure explicit. | wiki:Exception_handling
## Improve safely | Change with confidence. | Refactor in ten small commits.
- Code smells | Signs of trouble. | guru:refactoring/smells
- Refactoring | Small, safe steps. | guru:refactoring/techniques
- @unit-testing
- Test-driven development | Design through tests. | fowler:bliki/TestDrivenDevelopment.html
- Working with legacy code | Add safety first. | fowler:bliki/StranglerFigApplication.html
## Patterns | Use shared solutions. | Replace a conditional with a pattern, or decide not to.
- @design-patterns
- Dependency injection | Supply what is needed. | fowler:articles/injection.html
- Repositories and services | Separate concerns. | fowler:eaaCatalog/repository.html
## Architecture | Shape the whole. | Draw the boundaries of an app.
- @monolith
- Layered design | Directions of dependency. | fowler:bliki/PresentationDomainDataLayering.html
- Ports and adapters | Protect the core. | web:alistair.cockburn.us/hexagonal-architecture
- @ddd
- @event-driven
- @adr
* Refactoring diary | beginner | Improve one messy program. | Tests first; Small commits; Notes | Refactoring
* Plugin system | intermediate | Extend without editing. | Clear contract; Two plugins; Tests | Design
* Modular app | advanced | Enforced boundaries. | Dependency rules; Records; Review | Architecture
`],
[{ id: "svelte", kind: "skill", title: "Svelte", area: "web", tagline: "Small, fast interfaces with very little code.", keywords: ["svelte", "sveltekit"], courseTopics: ["Svelte"], related: ["javascript", "react", "vue"] }, `
## Start | Learn the basics. | Build a counter and list. | web:svelte.dev/tutorial
- @javascript
- Components | Markup, script and style. | web:svelte.dev/docs/svelte/svelte-files
- State | Reactive values. | web:svelte.dev/docs/svelte/$state
- Derived values | Computed from state. | web:svelte.dev/docs/svelte/$derived
- Props | Configure components. | web:svelte.dev/docs/svelte/$props
## Build | Make it interactive. | Build a searchable table.
- Logic blocks | Conditions and lists. | web:svelte.dev/docs/svelte/if
- Events | Respond to people. | web:svelte.dev/docs/svelte/basic-markup
- Bindings | Two-way where useful. | web:svelte.dev/docs/svelte/bind
- Effects | Touch the outside world. | web:svelte.dev/docs/svelte/$effect
- Transitions | Smooth change. | web:svelte.dev/docs/svelte/transition
- Stores and context | Share state. | web:svelte.dev/docs/svelte/context
## SvelteKit | Build whole apps. | Deploy a small app.
- Routing | Files become pages. | web:svelte.dev/docs/kit/routing
- Loading data | Server and client. | web:svelte.dev/docs/kit/load
- Form actions | Progressive forms. | web:svelte.dev/docs/kit/form-actions
- Page options | Static, server or client. | web:svelte.dev/docs/kit/page-options
## Quality | Ship with care. | Test one flow.
- TypeScript with Svelte | Typed components. | web:svelte.dev/docs/svelte/typescript
- Svelte testing | Units and flows. | web:svelte.dev/docs/svelte/testing
- @a11y
- @web-performance
* Habit grid | beginner | Track a month of habits. | State; Saved; Accessible | Svelte
* Study planner | intermediate | Plan and progress. | Routes; Forms; Tests | SvelteKit
* Live poll | advanced | Create and vote. | Real time; Limits; Deployed | Full stack
`],
[{ id: "computer-vision", kind: "skill", title: "Computer Vision", area: "ai", tagline: "Teach computers to understand images and video.", keywords: ["computer vision", "opencv", "image processing"], courseTopics: ["Deep Learning", "Machine Learning"], related: ["machine-learning", "data-scientist", "ai-engineer"] }, `
## Images as data | Handle pixels. | Edit an image with arrays.
- @python
- @numpy
- Digital images | Pixels, channels and formats. | web:docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
- OpenCV basics | Read, draw and transform. | web:docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
## Classical vision | Useful without learning. | Count coins in a photo.
- Filtering | Blur, sharpen and edges. | web:docs.opencv.org/4.x/d4/d13/tutorial_py_filtering.html
- Thresholding and contours | Find shapes. | web:docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html
- Features and matching | Compare images. | web:docs.opencv.org/4.x/db/d27/tutorial_py_table_of_contents_feature2d.html
- Camera geometry | Calibration and perspective. | web:docs.opencv.org/4.x/d9/db7/tutorial_py_table_of_contents_calib3d.html
## Deep vision | Learn from examples. | Train a classifier. | fastai
- @neural-nets
- @pytorch
- Convolutional networks | Local patterns. | d2l
- Transfer learning | Start from trained models. | torch:beginner/transfer_learning_tutorial.html
- Data augmentation | Make data go further. | torch:beginner/data_loading_tutorial.html
## Tasks | Choose the right one. | Detect objects in your photos.
- Object detection | Find and label. | torch:intermediate/torchvision_tutorial.html
- Segmentation | Label every pixel. | torch:intermediate/torchvision_tutorial.html
- Tracking and video | Follow over time. | web:docs.opencv.org/4.x/da/dd0/tutorial_table_of_content_video.html
- Vision transformers | Attention for images. | hf:learn/computer-vision-course/unit0/welcome/welcome
+ Image generation | Diffusion models. | hf:learn/diffusion-course/unit0/1
## Responsible use | Deploy with care. | Test on different groups.
- @model-eval
- Bias and privacy | Faces, consent and harm. | gml:crash-course/fairness
- Edge deployment | Fast on small devices. | torch:
* Coin counter | beginner | Count objects in a photo. | Clear steps; Error cases; Accuracy | OpenCV
* Plant identifier | intermediate | Classify leaves. | Own photos; Augmentation; Error study | PyTorch
* Safety monitor | advanced | Detect hazards in video. | Consent; False alarms measured; Edge speed | Detection
`]
];
