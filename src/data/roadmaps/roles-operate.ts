import type { RoadmapSource } from "./types";

// Roles that run, protect, design and lead.
export const operateRoles: RoadmapSource[] = [
[{ id: "devops", kind: "role", title: "DevOps Engineer", area: "cloud", tagline: "Deliver software quickly without breaking things.", keywords: ["devops", "sre", "site reliability", "ci/cd", "kubernetes", "docker", "infrastructure"], courseTopics: ["DevOps", "Docker", "Kubernetes", "Linux"], related: ["linux", "docker", "kubernetes", "terraform", "cloud-engineer"], roadmapSh: "devops" }, `
## Systems | Be at home on a server. | Set up a Linux server with a firewall and a service.
- @linux
- @shell
- @ssh
- @os-basics
- Processes and services | Start, stop and inspect with systemd. | web:www.freedesktop.org/software/systemd/man/latest/systemd.service.html
## Networks | Know how traffic reaches your service. | Debug a broken DNS record.
- @networking
- @tcp-udp
- @dns
- @http
- @https-tls
- @nginx
- @load-balancing
## Code and automation | Automate what you repeat. | Replace one manual task with a script.
- @git
- @github
- @python
? Go | The language of much cloud tooling. | go:tour/, map:go
- YAML and JSON | Read and validate configuration. | web:learnxinyminutes.com/yaml/
## Containers | Package once, run anywhere. | Run a three-service app locally. | devopsex
- @docker
- @compose
- Container registries | Store, tag and scan images. | docker:docker-hub/
- @kubernetes
- Helm | Package and configure cluster apps. | helm:intro/using_helm/
## Delivery | Make releases small and reversible. | Deploy with automatic rollback.
- @ci-cd
- @gh-actions
- Deployment strategies | Rolling, blue-green and canary. | k8s:concepts/workloads/controllers/deployment/
- Artifact management | Version and keep what you build. | gh:packages/learn-github-packages/introduction-to-github-packages
- @gitops
- @secrets
## Infrastructure as code | Make environments reproducible. | Create and destroy an environment from code.
- @cloud-basics
- @iac
- @ansible
- @iam
- @vpc
## Reliability | Know it is healthy. | Run a game day and write the review.
- @monitoring
- Dashboards with Grafana | See what matters at a glance. | graf:grafana/latest/getting-started/
- @logging
- @tracing
- @slo
- @incidents
- @cloud-cost
* Server setup script | beginner | Configure a secure web server from one command. | Idempotent; Firewall; HTTPS | Linux, Bash
* Delivery pipeline | intermediate | Build, test, scan and deploy on every merge. | Fails fast; Rollback; Secrets safe | CI/CD
* Observable cluster | advanced | Run an app on Kubernetes with full telemetry. | GitOps; Alerts with runbooks; Load test report | Kubernetes, Observability
`],
[{ id: "cloud-engineer", kind: "role", title: "Cloud Engineer", area: "cloud", tagline: "Design secure, efficient systems on any major cloud.", keywords: ["cloud", "aws", "azure", "gcp", "cloud engineer", "solutions architect"], courseTopics: ["Cloud Computing", "AWS", "Azure", "GCP"], related: ["aws", "terraform", "kubernetes", "devops"], roadmapSh: "cloud-computing" }, `
## Foundations | Understand what the cloud rents you. | Explain shared responsibility with an example.
- @cloud-basics
- @networking
- @linux
- @git
- @python
## Core services | Use the building blocks. | Host a site three different ways and compare. | awsskill, gskills
- @compute
- @object-storage
- Managed databases | Relational and NoSQL without the upkeep. | aws:AmazonRDS/latest/UserGuide/Welcome.html
- @vpc
- @iam
- @dns
## One provider in depth | Learn one well, then compare. | Complete a free fundamentals path.
- AWS | The broadest platform. | awsskill, map:aws
? Microsoft Azure | Strong in organisations using Microsoft. | ms:training/azure/
? Google Cloud | Strong in data and Kubernetes. | gskills
## Modern compute | Match the workload. | Move a small app to functions and containers.
- @docker
- @kubernetes
- @serverless
- Managed containers | Run containers without a cluster to manage. | aws:AmazonECS/latest/developerguide/Welcome.html
- @queues
## Automate | No manual clicks in production. | Rebuild everything from code.
- @iac
- @ci-cd
- @ansible
- Landing zones | Accounts, guardrails and baselines. | aws:controltower/latest/userguide/what-is-control-tower.html
## Design well | Balance reliability, security and cost. | Review a design against a framework. | awswell
- Well-architected reviews | Find risks systematically. | awswell
- High availability | Zones, failover and health checks. | awswell
- Backup and recovery | Objectives, tests and restores. | aws:whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
- @caching
- @cdn
- Cloud security | Encryption, boundaries and detection. | aws:wellarchitected/latest/security-pillar/welcome.html
- @monitoring
- @cloud-cost
- @system-design
* Static site | beginner | Host with storage, CDN and HTTPS. | Custom domain; Infrastructure as code; Cost under control | Storage, CDN
* Three-tier app | intermediate | Web, API and database in private networks. | Least privilege; Autoscaling; Backups tested | Networking, IAM
* Multi-region design | advanced | Survive a regional failure. | Recovery objectives; Failover test; Cost analysis | Reliability
`],
[{ id: "cyber-security", kind: "role", title: "Cyber Security Analyst", area: "security", tagline: "Protect people and systems, ethically and methodically.", keywords: ["security", "cyber", "cybersecurity", "soc", "penetration", "infosec"], courseTopics: ["Security", "Networking", "Cryptography"], related: ["network-engineer", "linux", "devsecops", "cloud-engineer"], roadmapSh: "cyber-security" }, `
## IT foundations | Know the systems you defend. | Build a home lab in virtual machines. | cs50sec
- Hardware and operating systems | How computers start, store and run. | cs50x
- @linux
- Windows basics | Accounts, services, registry and logs. | ms:windows-server/get-started/get-started-with-windows-server
- Virtual machines | Isolated labs you can reset. | web:www.virtualbox.org/manual/
- @shell
## Networks | See what is on the wire. | Capture and explain a TLS handshake. | netacad
- @networking
- @tcp-udp
- @dns
- @https-tls
- Firewalls and VPNs | Filter, segment and protect traffic. | cf:security/what-is-a-firewall/
- Packet analysis | Read traffic with Wireshark. | web:www.wireshark.org/docs/wsug_html_chunked/
## Principles | Think in risk. | Write a risk register for a small company.
- @cia
- @threat-modeling
- @authn
- @authz
- @cryptography
- Security frameworks | NIST CSF, CIS controls and ISO 27001. | nist:projects/cybersecurity-framework
## How attacks work | Learn legally, in labs you own or are allowed to use. | Solve ten beginner challenges. | overthewire, picoctf
- Attack life cycle | Tactics and techniques in ATT&CK. | mitre:
- Social engineering | Phishing and how to resist it. | web:www.cisa.gov/secure-our-world/recognize-and-report-phishing
- Malware basics | Types, spread and containment. | cf:ddos/glossary/malware/
- @owasp-top10
- Web security labs | Practise safely in a training range. | ps:all-labs
- Legal and ethical limits | Permission, scope and disclosure. | hackerone
## Defend | Detect and respond. | Investigate a sample incident from logs. | thm
- Hardening | Reduce the attack surface. | web:www.cisecurity.org/cis-benchmarks
- Vulnerability management | Scan, rank and fix. | web:www.first.org/cvss/
- SIEM and log analysis | Collect, correlate and alert. | owaspcs:Logging_Cheat_Sheet.html
- Incident handling | Prepare, contain, recover and learn. | nist:pubs/sp/800/61/r3/final
- Digital forensics basics | Preserve and examine evidence. | web:www.sleuthkit.org/
+ Threat hunting | Look for what alerts missed. | mitre:resources/
## Specialise | Choose a direction. | Write a professional report of a lab finding.
+ Penetration testing | Structured, authorised testing. | hackerone
+ Cloud security | Identity, configuration and detection in the cloud. | aws:wellarchitected/latest/security-pillar/welcome.html
+ Governance and compliance | Policies, audits and privacy law. | nist:projects/cybersecurity-framework
- Security scripting | Automate checks with Python. | cs50p
- @tech-writing
- @interviews
* Home lab | beginner | Build a segmented lab and document it. | Diagram; Firewall rules; Backup and reset | Networking
* Log investigation | intermediate | Analyse a public incident dataset. | Timeline; Evidence; Recommendations | Detection
* Detection pack | advanced | Write and test detections for common techniques. | Mapped to ATT&CK; False positives measured; Runbooks | SIEM
`],
[{ id: "devsecops", kind: "role", title: "DevSecOps Engineer", area: "security", tagline: "Build security into delivery instead of adding it at the end.", keywords: ["devsecops", "application security", "appsec", "secure development"], courseTopics: ["Security", "DevOps"], related: ["devops", "cyber-security", "kubernetes", "terraform"], roadmapSh: "devsecops" }, `
## Foundations | Deliver and defend. | Draw the trust boundaries of one app.
- @linux
- @networking
- @git
- @docker
- @ci-cd
- @python
## Secure design | Prevent before detecting. | Threat model a feature before building it.
- @cia
- @threat-modeling
- @owasp-top10
- @authn
- @authz
- @cryptography
- Secure coding | Validate input, encode output and fail safely. | owasp:www-project-developer-guide/
## Secure pipeline | Check every change. | Block a vulnerable dependency automatically.
- Static analysis | Find flaws in source. | owasp:www-community/Source_Code_Analysis_Tools
- @supply-chain
- Dynamic testing | Test the running app with ZAP. | web:www.zaproxy.org/getting-started/
- @secrets
- Image scanning | Check containers before release. | web:trivy.dev/latest/docs/
- Artifact signing | Prove what was built and by whom. | web:docs.sigstore.dev/
- Software bills of materials | Know what is inside. | web:cyclonedx.org/
## Secure platform | Reduce blast radius. | Pass a cluster benchmark.
- @kubernetes
- Cluster security | Policies, isolation and admission control. | k8s:concepts/security/
- @iac
- Policy as code | Enforce rules automatically. | web:www.openpolicyagent.org/docs
- @iam
- Zero trust | Verify every request. | nist:pubs/sp/800/207/final
## Operate | Detect, respond and improve. | Run a tabletop exercise.
- @logging
- Runtime detection | Notice suspicious behaviour. | web:falco.org/docs/
- Vulnerability triage | Rank by real risk and fix on time. | web:www.first.org/cvss/
- @incidents
- Security culture | Champions, training and friendly defaults. | owasp:www-project-samm/
- Compliance automation | Evidence from the pipeline. | nist:projects/ssdf
* Secure pipeline | beginner | Add scanning to an existing project. | Code, dependency and image scans; Clear failures | CI/CD
* Hardened cluster | intermediate | Secure a small cluster. | Network policies; Admission rules; Benchmark report | Kubernetes
* Supply-chain proof | advanced | Signed, attested and verified releases. | SBOM; Signature checks on deploy; Response plan | Supply chain
`],
[{ id: "network-engineer", kind: "role", title: "Network Engineer", area: "cloud", tagline: "Keep everything connected, fast and secure.", keywords: ["network", "ccna", "network engineer", "networking", "it support"], courseTopics: ["Networking"], related: ["cyber-security", "linux", "cloud-engineer"], roadmapSh: "network-engineer" }, `
## Fundamentals | Speak the language of networks. | Explain each layer with a real example. | netacad
- @networking
- OSI and TCP/IP models | Layers and what each adds. | cf:ddos/glossary/open-systems-interconnection-model-osi/
- IP addressing | IPv4, IPv6 and private ranges. | web:www.rfc-editor.org/rfc/rfc1918
- Subnetting | Split networks with confidence. | subnet
- @tcp-udp
- Cables, switches and routers | The hardware and what it decides. | cf:network-layer/what-is-a-router/
## Switching | Build the local network. | Configure VLANs in a simulator. | netacad
- Ethernet and MAC addresses | Frames and learning. | wiki:Ethernet_frame
- VLANs and trunks | Separate traffic on shared hardware. | wiki:VLAN
- Spanning tree | Prevent loops. | wiki:Spanning_Tree_Protocol
- Wireless | Channels, security and planning. | wiki:Wi-Fi
## Routing | Move traffic between networks. | Build a three-site lab. | netacad
- Static routing | Explicit, predictable paths. | cf:network-layer/what-is-routing/
- OSPF | Dynamic routing inside an organisation. | wiki:Open_Shortest_Path_First
- BGP | How networks on the internet find each other. | cf:security/glossary/what-is-bgp/
- NAT | Share addresses and its side effects. | wiki:Network_address_translation
## Services | Run what users rely on. | Set up DNS and DHCP on Linux.
- @dns
- DHCP | Automatic addressing. | wiki:Dynamic_Host_Configuration_Protocol
- @https-tls
- @load-balancing
- Quality of service | Prioritise what matters. | wiki:Quality_of_service
## Security | Protect the network. | Segment a network and test the rules.
- Firewalls and ACLs | Allow only what is needed. | cf:security/what-is-a-firewall/
- VPNs | Private links over public networks. | cf:access-management/what-is-a-vpn/
- Intrusion detection | Spot suspicious traffic. | web:docs.suricata.io/en/latest/
- Network access control | Know what connects. | wiki:Network_access_control
## Operate and automate | Find faults and reduce toil. | Automate a config backup.
- Troubleshooting | A method, plus ping, traceroute and captures. | web:www.wireshark.org/docs/wsug_html_chunked/
- @monitoring
- @linux
- Network automation | Python and Ansible for devices. | ansible:projects/ansible/latest/network/getting_started/index.html
- @vpc
- Software-defined networking | Separate control from forwarding. | cf:network-layer/what-is-sdn/
- Network documentation | Diagrams, addressing and changes. | techw:one
* Home network map | beginner | Diagram and secure a home network. | Address plan; Guest network; Report | Addressing
* Office lab | intermediate | Simulate a two-floor office. | VLANs; Routing; Access rules; Tests | Switching, Routing
* Automated backbone | advanced | Configure a lab from code. | Templates; Validation; Rollback | Automation
`],
[{ id: "postgresql-dba", kind: "role", title: "PostgreSQL DBA", area: "data", tagline: "Keep data safe, fast and always available.", keywords: ["dba", "database administrator", "postgresql", "postgres", "database"], courseTopics: ["Databases", "SQL"], related: ["sql", "backend", "data-engineer", "linux"], roadmapSh: "postgresql-dba" }, `
## Relational basics | Know the model under the tool. | Model and load a small domain. | pg:tutorial.html
- @sql
- @db-design
- @transactions
- Data types and constraints | Let the database protect your data. | pg:datatype.html
## Operate PostgreSQL | Install, configure and secure. | Set up a server with least-privilege roles.
- Installation and clusters | Initialise, start and upgrade. | pg:runtime.html
- Configuration | Memory, connections and logging. | pg:runtime-config.html
- Roles and privileges | Grant only what is needed. | pg:user-manag.html
- Authentication rules | Control who connects and how. | pg:client-authentication.html
- Row-level security | Enforce ownership in the database. | pg:ddl-rowsecurity.html
- @linux
## Performance | Find the cause before tuning. | Make a slow query ten times faster and explain why. | useindex
- @db-indexes
- EXPLAIN plans | Read scans, joins and estimates. | pg:using-explain.html
- Vacuum and bloat | Why dead rows matter. | pg:routine-vacuuming.html
- Statistics and planner | Help the planner choose well. | pg:planner-stats.html
- Connection pooling | Serve many clients with few connections. | web:www.pgbouncer.org/usage.html
- Partitioning | Split very large tables. | pg:ddl-partitioning.html
## Protect | Never lose data. | Restore to a point in time and time it.
- Backups | Logical and physical copies. | pg:backup.html
- Point-in-time recovery | Replay the log to any moment. | pg:continuous-archiving.html
- Replication | Streaming and logical copies. | pg:high-availability.html
- Failover | Promote safely and avoid split brain. | web:patroni.readthedocs.io/en/latest/
- Upgrades | Move versions with little downtime. | pg:upgrading.html
## Observe and automate | Prevent surprises. | Alert on three real risks.
- Activity statistics | See what is running and waiting. | pg:monitoring-stats.html
- pg_stat_statements | Find the costliest queries. | pg:pgstatstatements.html
- Locks | Understand waits and deadlocks. | pg:explicit-locking.html
- @monitoring
- @ansible
+ Extensions | PostGIS, pgvector and more. | pg:extend-extensions.html
+ PL/pgSQL | Functions and triggers. | pg:plpgsql.html
* Safe server | beginner | Configure roles, logging and backups. | Least privilege; Tested restore; Checklist | Administration
* Tuning report | intermediate | Improve five slow queries. | Plans before and after; Index rationale; Risks | Performance
* High availability | advanced | Replicated cluster with failover. | Measured recovery; Monitoring; Runbook | Replication
`],
[{ id: "blockchain", kind: "role", title: "Blockchain Developer", area: "programming", tagline: "Write contracts and apps that run without a central owner.", keywords: ["blockchain", "web3", "solidity", "smart contract", "ethereum"], courseTopics: ["Blockchain", "Solidity", "Web3"], related: ["javascript", "cyber-security", "backend"], roadmapSh: "blockchain" }, `
## Concepts | Know what a blockchain guarantees, and what it does not. | Decide whether three ideas really need one. | eth:intro-to-ethereum/
- What a blockchain is | Blocks, transactions and shared history. | eth:intro-to-ethereum/
- @cryptography
- Consensus | Agreement among strangers. | eth:consensus-mechanisms/
- Accounts and wallets | Keys, signatures and safe custody. | eth:accounts/
- Gas and fees | Why computation costs. | eth:gas/
## Programming base | Be fluent before contracts. | Build a small tested app.
- @javascript
- @typescript
- @git
- @unit-testing
## Smart contracts | Write code that cannot easily change. | Deploy to a test network. | cryptozombies, cyfrin
- Solidity | Types, functions, storage and events. | sol:introduction-to-smart-contracts.html
- The EVM | How contracts execute. | eth:evm/
- Token standards | ERC-20, ERC-721 and ERC-1155. | eth:standards/tokens/
- Development tools | Foundry or Hardhat workflows. | web:getfoundry.sh/
- Contract libraries | Reuse audited building blocks. | web:docs.openzeppelin.com/contracts
## Security | Mistakes are public and permanent. | Find and fix three vulnerabilities in a practice range.
- Common vulnerabilities | Reentrancy, access control and oracles. | eth:smart-contracts/security/
- Contract testing | Unit, fuzz and invariant tests. | eth:smart-contracts/testing/
- Audits | Review process and limits. | web:ethernaut.openzeppelin.com/
- Upgradeability | Proxies and their risks. | eth:smart-contracts/upgrading/
## Applications | Connect people safely. | Ship a small dApp on a test network.
- Connecting a front end | Read and write with viem or ethers. | web:viem.sh/docs/getting-started
- Indexing | Query on-chain events. | web:thegraph.com/docs/en/
- Decentralised storage | Content addressing with IPFS. | web:docs.ipfs.tech/
- Wallet experience | Clear prompts and safe defaults. | eth:accounts/
## Scale and responsibility | See the wider picture. | Compare two scaling approaches.
- Layer 2 scaling | Rollups and their trade-offs. | eth:scaling/
+ Zero-knowledge proofs | Prove without revealing. | web:ethereum.org/zero-knowledge-proofs/
+ Other chains | Solana, Cosmos and differences. | web:solana.com/docs
- Law and ethics | Regulation, fraud and user protection. | wiki:Cryptocurrency_and_crime
* Test token | beginner | Token with limits on a test network. | Full tests; Events; Documented risks | Solidity
* Voting app | intermediate | Transparent votes for a small group. | Access control; Front end; Fuzz tests | dApps
* Escrow protocol | advanced | Hold funds with dispute handling. | Invariants; Review report; Pause plan | Security
`],
[{ id: "ux-design", kind: "role", title: "UX Designer", area: "design", tagline: "Design products around how people really think and act.", keywords: ["ux", "ui", "designer", "product design", "figma", "user experience"], courseTopics: ["UI/UX"], related: ["frontend", "product-manager", "css"], roadmapSh: "ux-design" }, `
## Human behaviour | Design for how people work. | Spot five usability laws in an app you use. | ux:
- What UX is | Usefulness, usability and the whole journey. | nng:definition-user-experience/
- Cognitive principles | Attention, memory and mental models. | ux:
- Usability heuristics | Ten rules of thumb for evaluation. | nng:ten-usability-heuristics/
- Inclusive design | Design for a wide range of people. | w3:WAI/fundamentals/accessibility-principles/
- Persuasion and ethics | Influence without deception. | web:www.deceptive.design/
## Research | Learn before you draw. | Interview three people and summarise themes.
- @ux-research
- Interviews | Ask open questions and listen. | nng:user-interviews/
- Surveys | Useful questions at scale. | nng:qualitative-surveys/
- Personas and needs | Represent evidence, not stereotypes. | nng:persona/
- Journey maps | See the experience over time. | nng:customer-journey-mapping/
## Structure | Organise before decorating. | Card-sort a menu with five people.
- Information architecture | Group and label content. | nng:ia-vs-navigation/
- User flows | Steps, branches and errors. | nng:user-journeys-vs-user-flows/
- @wireframes
- Content design | Words that help people act. | web:design-system.service.gov.uk/
## Interface | Make it clear and attractive. | Redesign one screen and explain every choice. | learnui
- @visual-design
- Layout and grids | Alignment, rhythm and spacing. | learnui
- Typography | Readable scale and hierarchy. | web:fonts.google.com/knowledge
- Colour | Meaning, contrast and themes. | webdev:learn/design/theming
- Interaction design | States, feedback and motion. | ixdf:interaction-design
- @a11y
- @mobile-ux
## Tools and systems | Work efficiently with others. | Build a small reusable kit.
- Figma | Frames, auto layout and components. | figma:
- @design-system
- Prototyping | Test an idea cheaply. | figma:categories/360002051613-Get-started
- Developer handoff | Specs, tokens and shared decisions. | designsys
+ Front-end basics | Know what is easy to build. | mdn:Learn_web_development/Core/Structuring_content
## Validate | Let evidence decide. | Test with five people and change the design.
- @usability-testing
- @ab-testing
- @product-metrics
- Design critique | Give and take useful feedback. | nng:design-critiques/
- @stakeholders
- @portfolio
* Heuristic review | beginner | Evaluate an app and propose fixes. | Ten findings; Severity; Before and after | Evaluation
* Feature redesign | intermediate | Research, redesign and test one flow. | Interviews; Prototype; Five tests | Research, Figma
* Design system | advanced | Accessible components with guidance. | Tokens; Contrast checked; Usage docs | Design systems
`],
[{ id: "product-manager", kind: "role", title: "Product Manager", area: "product", tagline: "Decide what to build, why, and how you will know it worked.", keywords: ["product manager", "product owner", "business analyst", "project manager"], courseTopics: ["Software Engineering"], related: ["ux-design", "engineering-manager", "data-analyst"], roadmapSh: "product-manager" }, `
## The role | Own outcomes, not a list. | Describe a product's value in one sentence. | svpg
- What product managers do | Value, usability, feasibility and viability. | svpg
- Product life cycle | Discovery, delivery and retirement. | atl:agile/product-management
- @stakeholders
- Product ethics | Consider harm as well as growth. | web:www.deceptive.design/
## Discover | Find problems worth solving. | Interview five users and state one problem.
- @ux-research
- Market and competitors | Size, alternatives and differences. | atl:agile/product-management
- Jobs to be done | What people hire a product for. | web:jobs-to-be-done.com/
- Opportunity mapping | Link outcomes to problems and ideas. | web:www.producttalk.org/opportunity-solution-trees/
- Testing assumptions | Learn cheaply before building. | svpg
## Decide | Choose with clarity. | Prioritise ten ideas and defend the top two.
- Product strategy | Focus, bets and trade-offs. | svpg
- Prioritisation | Impact, confidence and effort. | atl:agile/product-management/prioritization-framework
- @roadmapping
- OKRs and goals | Outcomes with measurable results. | web:www.whatmatters.com/faqs/okr-meaning-definition-example
- @estimation
## Deliver | Work well with the team. | Write one story with acceptance criteria. | ccskills
- @agile
- @user-stories
- Product requirements | Problem, scope and measures. | atl:agile/product-management/requirements
- @wireframes
- Shaping work | Set appetite and boundaries. | shapeup
- Technical literacy | APIs, data and trade-offs. | cs50x
## Measure | Learn from results. | Define success before a launch.
- @product-metrics
- @ab-testing
- @sql
- Activation and retention | Do people get value and return? | atl:agile/product-management/product-analytics
- Feedback loops | Support, reviews and research together. | atl:agile/product-management
## Launch and grow | Bring it to people. | Write a launch plan and review.
- Go to market | Audience, message and channels. | atl:agile/product-management
- Pricing basics | Value, packaging and tests. | svpg
- Leading without authority | Align through clarity and trust. | svpg
- @tech-writing
- @portfolio
* Product teardown | beginner | Analyse an app's value and gaps. | Users; Metrics; Three opportunities | Strategy
* Discovery sprint | intermediate | Research and test one idea. | Five interviews; Prototype test; Decision | Discovery
* Launch plan | advanced | Plan, measure and review a feature. | Goals; Rollout; Post-launch review | Delivery
`],
[{ id: "engineering-manager", kind: "role", title: "Engineering Manager", area: "product", tagline: "Help engineers do the best work of their careers.", keywords: ["engineering manager", "team lead", "tech lead", "manager", "leadership"], courseTopics: ["Software Engineering"], related: ["software-architect", "product-manager", "code-review"], roadmapSh: "engineering-manager" }, `
## From engineer to manager | Success now comes through others. | Write what you will stop doing. | gitlab
- The manager's role | People, delivery, technology and direction. | web:www.managersclub.com/
- Delegation | Give ownership, not only tasks. | gitlab
- Time and energy | Protect focus and recover. | gitlab
- Technical credibility | Stay close without being the bottleneck. | staffeng
## People | Build trust. | Run one month of weekly one-to-ones.
- One-to-ones | Their agenda, real listening. | web:handbook.gitlab.com/handbook/leadership/1-1/
- Feedback | Timely, specific and kind. | web:handbook.gitlab.com/handbook/people-group/guidance-on-feedback/
- Coaching and growth | Questions, stretch and career plans. | gitlab
- Difficult conversations | Prepare, be direct and follow up. | gitlab
- Inclusion and wellbeing | Safety to speak, and sustainable pace. | gitlab
## Team | Make the whole stronger than the parts. | Write a team charter.
- Team health | Purpose, trust and clear roles. | atl:team-playbook
- Hiring | Fair, structured and evidence-based. | web:handbook.gitlab.com/handbook/hiring/
- Onboarding | First week, month and quarter. | gitlab
- Conflict | Surface it early and solve causes. | atl:team-playbook
- Remote collaboration | Write things down and work asynchronously. | web:handbook.gitlab.com/handbook/company/culture/all-remote/
## Delivery | Ship value predictably. | Run a retrospective that changes something.
- @agile
- @estimation
- Delivery metrics | Lead time, frequency, failures and recovery. | web:dora.dev/guides/dora-metrics-four-keys/
- Managing risk | See it early and say it plainly. | fowler:bliki/TechnicalDebtQuadrant.html
- @incidents
## Technology | Keep quality high. | Agree a technical debt plan.
- @code-review
- @ci-cd
- @adr
- Technical debt | Make it visible and pay deliberately. | fowler:bliki/TechnicalDebt.html
- @system-design
## Direction | Connect work to outcomes. | Present a quarter plan in one page.
- Goals and OKRs | Few, measurable and shared. | web:www.whatmatters.com/faqs/okr-meaning-definition-example
- @stakeholders
- Managing up | No surprises, clear options. | gitlab
- Budgets and planning | People, tools and trade-offs. | gitlab
- @product-metrics
* Team charter | beginner | Agree purpose, roles and working rules. | Written with the team; Reviewed after a month | Leadership
* Hiring kit | intermediate | Structured interview process. | Scorecard; Questions; Bias checks | Hiring
* Delivery improvement | advanced | Improve one delivery metric. | Baseline; Experiment; Honest result | Delivery
`]
];
