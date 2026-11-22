import type { RoadmapSource } from "./types";

// Data, infrastructure, computer science and AI skills.
export const systemSkills: RoadmapSource[] = [
[{ id: "sql", kind: "skill", title: "SQL", area: "data", tagline: "Ask any question of relational data.", keywords: ["sql", "mysql", "postgresql", "database"], courseTopics: ["SQL", "Databases"], related: ["postgresql-dba", "data-analyst", "backend"], roadmapSh: "sql" }, `
## Read data | Get what you need. | Answer five questions on one table. | sqlbolt
- Relational basics | Tables, rows, keys and types. | pg:tutorial-concepts.html
- SELECT and WHERE | Choose columns and filter. | pg:tutorial-select.html
- Sorting and limiting | Order and page. | pg:queries-order.html
- NULL handling | Missing values without surprises. | pg:functions-comparison.html
- Expressions | Calculate, format and CASE. | pg:functions-conditional.html
## Combine | Connect tables. | Join three tables correctly. | pgex
- Joins | Inner, left, right and full. | pg:tutorial-join.html
- Grouping | Count, sum and HAVING. | pg:tutorial-agg.html
- Set operations | UNION, INTERSECT and EXCEPT. | pg:queries-union.html
- Subqueries | Queries inside queries. | pg:functions-subquery.html
- Common table expressions | Name steps with WITH. | pg:queries-with.html
## Change | Write safely. | Load and correct a dataset.
- INSERT, UPDATE and DELETE | Modify with care. | pg:dml.html
- Creating tables | Types, keys and defaults. | pg:ddl-basics.html
- Constraints | Rules that always hold. | pg:ddl-constraints.html
- @transactions
- Views | Saved queries. | pg:tutorial-views.html
## Advanced | Analyse deeply. | Rank customers by month.
- Window functions | Rank, lag and running totals. | pg:tutorial-window.html
- Recursive queries | Trees and paths. | pg:queries-with.html
- JSON in SQL | Semi-structured columns. | pg:functions-json.html
- Dates and text | Time zones, parsing and search. | pg:functions-datetime.html
## Perform and protect | Make it fast and safe. | Speed up a slow query.
- @db-indexes
- @db-design
- Permissions | Grant the minimum. | pg:ddl-priv.html
- SQL injection | Always use parameters. | owaspcs:SQL_Injection_Prevention_Cheat_Sheet.html
* Film database | beginner | Model and query films. | Keys; Ten queries; Constraints | Modelling
* Retail report | intermediate | Monthly report in SQL. | Windows; CTEs; Documented | Analysis
* Ticketing schema | advanced | Seats without double booking. | Transactions; Indexes; Load test | Design
`],
[{ id: "mongodb", kind: "skill", title: "MongoDB", area: "data", tagline: "Flexible document data, modelled with intent.", keywords: ["mongodb", "nosql", "mongoose"], courseTopics: ["NoSQL"], related: ["nodejs", "sql", "backend"], roadmapSh: "mongodb" }, `
## Basics | Store and find documents. | Load a sample dataset. | mongo:introduction/
- Document model | Documents, collections and BSON. | mongo:core/document/
- CRUD | Create, read, update and delete. | mongo:crud/
- Query operators | Compare, match and arrays. | mongo:reference/operator/query/
- Projections and sorting | Return only what you need. | mongo:tutorial/project-fields-from-query-results/
## Model | Design for how you read. | Compare embedding and referencing.
- Data modelling | Embed or reference. | mongo:data-modeling/
- Schema validation | Rules for documents. | mongo:core/schema-validation/
- Schema patterns | Bucket, computed and subset. | mongo:data-modeling/design-patterns/
- Atlas transactions | When one document is not enough. | mongo:core/transactions/
## Analyse | Transform in the database. | Build a sales summary pipeline.
- Aggregation pipeline | Stages that reshape. | mongo:core/aggregation-pipeline/
- Grouping and lookup | Summaries and joins. | mongo:reference/operator/aggregation/lookup/
- MongoDB text search | Find words. | mongo:text-search/
## Operate | Keep it fast and safe. | Explain and fix one query.
- MongoDB indexes | Single, compound and TTL. | mongo:indexes/
- Explain results | See how a query runs. | mongo:reference/explain-results/
- Replica sets | Availability. | mongo:replication/
- Sharding | Spread data. | mongo:sharding/
- MongoDB security | Users, network and encryption. | mongo:security/
- MongoDB backups | Dump, restore and test. | mongo:core/backups/
* Recipe store | beginner | Flexible recipes. | Validation; Queries; Sample data | Documents
* Event analytics | intermediate | Aggregate activity. | Pipeline; Indexes; Dashboard | Aggregation
* Chat storage | advanced | Millions of messages. | Schema rationale; Benchmarks; Archive | Scale
`],
[{ id: "redis", kind: "skill", title: "Redis", area: "data", tagline: "In-memory data for speed, queues and real time.", keywords: ["redis", "caching"], courseTopics: ["Redis"], related: ["backend", "system-design", "nodejs"], roadmapSh: "redis" }, `
## Basics | Keys, values and expiry. | Cache one slow call. | redis:develop/
- Getting started | Install, connect and explore. | redis:get-started/
- Strings and counters | Values and atomic increments. | redis:develop/data-types/strings/
- Expiration | Let data leave. | redis:commands/expire/
- Key naming | Predictable, searchable keys. | redis:develop/using-commands/keyspace/
## Data types | Choose the right structure. | Build a live leaderboard.
- Hashes | Small objects. | redis:develop/data-types/hashes/
- Lists | Simple queues. | redis:develop/data-types/lists/
- Sets | Unique members. | redis:develop/data-types/sets/
- Sorted sets | Ranking and schedules. | redis:develop/data-types/sorted-sets/
- Redis streams | Event logs and groups. | redis:develop/data-types/streams/
## Patterns | Solve real problems. | Add a rate limiter.
- Caching patterns | Aside, through and invalidation. | aws:whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html
- Rate limiting | Windows and buckets. | redis:commands/incr/
- Pub/Sub | Broadcast messages. | redis:develop/pubsub/
- Redis transactions | Atomic groups. | redis:develop/using-commands/transactions/
- Lua scripting | Logic near data. | redis:develop/programmability/eval-intro/
- Distributed locks | Use and limits. | redis:develop/clients/patterns/distributed-locks/
## Operate | Run it safely. | Recover after a restart.
- Redis persistence | Snapshots and append logs. | redis:operate/oss_and_stack/management/persistence/
- Eviction | What leaves when memory fills. | redis:develop/reference/eviction/
- Redis replication | Copies and failover. | redis:operate/oss_and_stack/management/replication/
- Redis security | Access lists and network. | redis:operate/oss_and_stack/management/security/
- Latency | Find slow commands. | redis:operate/oss_and_stack/management/optimization/latency/
* Page cache | beginner | Cache with expiry. | Hit rate shown; Invalidation; Tests | Caching
* Leaderboard | intermediate | Live ranking. | Sorted sets; Ties; Paging | Data types
* Job scheduler | advanced | Delayed, retried jobs. | Streams; Idempotency; Monitoring | Streams
`],
[{ id: "graphql", kind: "skill", title: "GraphQL", area: "web", tagline: "Let clients ask for exactly what they need.", keywords: ["graphql", "apollo"], courseTopics: ["Web Development"], related: ["api-design", "react", "nodejs"], roadmapSh: "graphql" }, `
## Ideas | Understand the model. | Query a public API. | gql:
- What GraphQL is | Types, one endpoint and clients in control. | gql:introduction/
- Queries | Fields, arguments and fragments. | gql:queries/
- Mutations | Change data. | gql:mutations/
- Subscriptions | Live updates. | gql:subscriptions/
- Schemas and types | The contract. | gql:schema/
## Build | Serve a schema. | Build a small API.
- Resolvers | Turn fields into data. | gql:execution/
- Schema design | Names, nullability and evolution. | gql:schema-design/
- Pagination | Connections and cursors. | gql:pagination/
- GraphQL errors | Partial results and codes. | gql:response/
- Validation | Reject bad queries. | gql:validation/
## Run safely | Protect the server. | Stop an expensive query.
- N+1 and batching | Load efficiently. | gql:performance/
- GraphQL authorisation | Check per field and object. | gql:authorization/
- Depth and cost limits | Prevent abuse. | gql:security/
- GraphQL caching | Identify and reuse. | gql:caching/
## Use it | Connect clients. | Generate typed queries.
- Client caches | Normalised data. | web:www.apollographql.com/docs/react
- Code generation | Types from the schema. | web:the-guild.dev/graphql/codegen/docs/getting-started
+ Federation | One graph, many services. | gql:federation/
* Book graph | beginner | Books and authors API. | Schema; Pagination; Tests | Schema
* Social feed | intermediate | Posts, follows and likes. | Batching; Authorisation; Cost limit | Server
* Federated shop | advanced | Two services, one graph. | Ownership; Tracing; Contract checks | Federation
`],
[{ id: "git-github", kind: "skill", title: "Git and GitHub", area: "programming", tagline: "Track work, undo mistakes and collaborate.", keywords: ["git", "github", "version control"], courseTopics: ["Git"], related: ["code-review", "devops", "frontend"], roadmapSh: "git-github" }, `
## Start | Record your work. | Make five meaningful commits. | git:Getting-Started-About-Version-Control
- Why version control | History, safety and teamwork. | git:Getting-Started-About-Version-Control
- Setup | Name, email and editor. | git:Getting-Started-First-Time-Git-Setup
- Recording changes | Status, stage and commit. | git:Git-Basics-Recording-Changes-to-the-Repository
- Viewing history | Log, show and diff. | git:Git-Basics-Viewing-the-Commit-History
- Ignoring files | Keep noise and secrets out. | gh:get-started/git-basics/ignoring-files
## Branches | Work in parallel. | Resolve a conflict calmly. | learngit
- Branching | Create and switch. | git:Git-Branching-Branches-in-a-Nutshell
- Merging and conflicts | Combine work. | git:Git-Branching-Basic-Branching-and-Merging
- Rebasing | Tidy history, carefully. | git:Git-Branching-Rebasing
- Undoing things | Restore, reset and revert. | git:Git-Basics-Undoing-Things
- Stashing | Set work aside. | git:Git-Tools-Stashing-and-Cleaning
## GitHub | Share and discuss. | Contribute a small fix.
- Remotes | Push, pull and fetch. | git:Git-Basics-Working-with-Remotes
- Pull requests | Propose and review. | gh:pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests
- Issues and projects | Plan in the open. | gh:issues/tracking-your-work-with-issues/about-issues
- @code-review
- README and licences | Explain and permit. | gh:repositories/creating-and-managing-repositories/about-repositories
## Automate and protect | Build good defaults. | Require checks before merge.
- @gh-actions
- Protected branches | Rules for main. | gh:repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Secrets and scanning | Keep keys safe. | gh:code-security/secret-scanning/introduction/about-secret-scanning
- Tags and releases | Mark versions. | gh:repositories/releasing-projects-on-github/about-releases
+ Bisect and reflog | Find and recover. | git:Git-Tools-Debugging-with-Git
+ Hooks | Run checks locally. | git:Customizing-Git-Git-Hooks
* Profile README | beginner | Introduce yourself. | Clear sections; Useful links | GitHub
* Team workflow | intermediate | Set rules for a shared repo. | Templates; Checks; Protected main | Workflow
* Release automation | advanced | Versioned releases from commits. | Changelog; Tags; Signed artefacts | Automation
`],
[{ id: "code-review", kind: "skill", title: "Code Review", area: "programming", tagline: "Improve code and people at the same time.", keywords: ["code review"], courseTopics: ["Software Engineering"], related: ["git-github", "engineering-manager", "software-architect"], roadmapSh: "code-review" }, `
## Purpose | Know what review is for. | Review your own last change first. | engpractices
- Why review | Quality, learning and shared ownership. | engpractices
- What to look for | Design, behaviour, tests and clarity. | web:google.github.io/eng-practices/review/reviewer/looking-for.html
- The standard | Better, not perfect. | web:google.github.io/eng-practices/review/reviewer/standard.html
## As an author | Make it easy to review. | Split one large change.
- Small changes | Easier, faster and safer. | web:google.github.io/eng-practices/review/developer/small-cls.html
- Good descriptions | What, why and how to check. | web:google.github.io/eng-practices/review/developer/cl-descriptions.html
- Responding to comments | Curious, not defensive. | web:google.github.io/eng-practices/review/developer/handling-comments.html
## As a reviewer | Help kindly. | Write three comments that explain why.
- Navigating a change | Big picture first. | web:google.github.io/eng-practices/review/reviewer/navigate.html
- Review speed | Unblock others. | web:google.github.io/eng-practices/review/reviewer/speed.html
- Writing comments | Specific, polite and prioritised. | web:conventionalcomments.org/
- Disagreement | Principles, data and help. | web:google.github.io/eng-practices/review/reviewer/pushback.html
- Security review | Inputs, access and secrets. | owasp:www-project-code-review-guide/
## Support | Let tools do the routine. | Automate one repeated comment.
- Automated checks | Style, types and tests first. | gh:actions/get-started/understand-github-actions
- Templates and owners | Guide and route. | gh:repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- Reviewing AI-written code | Verify behaviour, sources and licence. | engpractices
- Measuring review | Flow without gaming. | web:dora.dev/guides/dora-metrics-four-keys/
* Review journal | beginner | Review three open source changes. | Notes; Kind wording; Lessons | Feedback
* Team guideline | intermediate | Write review rules. | Examples; Response time; Agreed by team | Process
* Review automation | advanced | Build a useful check. | Low noise; Documented; Measured | Tooling
`],
[{ id: "linux", kind: "skill", title: "Linux", area: "cloud", tagline: "Be confident on the system that runs the internet.", keywords: ["linux", "unix", "ubuntu", "bash"], courseTopics: ["Linux", "Bash / Shell"], related: ["devops", "cyber-security", "docker"], roadmapSh: "linux" }, `
## Terminal | Move and act. | Organise a folder without a mouse. | ubuntu
- Navigation | Paths, listing and help. | ubuntu
- Files and folders | Create, copy, move and remove. | ubuntu
- Viewing and editing | less, nano and vim. | missing
- Finding things | find, grep and globs. | missing
- Pipes and redirection | Combine small tools. | bash:Redirections.html
## System | Understand what runs. | Create a user with limited rights.
- Users and groups | Identity and sudo. | web:wiki.archlinux.org/title/Users_and_groups
- File permissions | Read, write and execute. | web:wiki.archlinux.org/title/File_permissions_and_attributes
- Processes | Inspect, signal and prioritise. | web:man7.org/linux/man-pages/man1/ps.1.html
- Services with systemd | Start, enable and read logs. | web:wiki.archlinux.org/title/Systemd
- Package management | Install and update safely. | web:ubuntu.com/server/docs/how-to/software/package-management/
- Storage | Disks, mounts and space. | web:wiki.archlinux.org/title/File_systems
## Scripting | Automate. | Write a safe backup script.
- Shell scripts | Variables, tests and loops. | bash:Shell-Scripts.html
- Text processing | sed, awk, sort and cut. | web:www.gnu.org/software/gawk/manual/gawk.html
- Scheduling | Cron and timers. | web:man7.org/linux/man-pages/man5/crontab.5.html
- Defensive scripting | Quoting, exit codes and traps. | shellcheck
## Network and security | Connect safely. | Harden a fresh server.
- Network tools | ip, ss, dig and curl. | web:wiki.archlinux.org/title/Network_configuration
- @ssh
- Firewall | Allow only what is needed. | web:wiki.archlinux.org/title/Uncomplicated_Firewall
- Logs | journalctl and rotation. | web:wiki.archlinux.org/title/Systemd/Journal
- Linux hardening | Updates, accounts and services. | web:wiki.archlinux.org/title/Security
## Deeper | Understand the kernel's view. | Explain a slow system with evidence.
- Performance tools | CPU, memory, disk and network. | web:www.brendangregg.com/linuxperf.html
- Namespaces and cgroups | What containers are made of. | web:man7.org/linux/man-pages/man7/namespaces.7.html
+ Boot process | Firmware to login. | web:wiki.archlinux.org/title/Arch_boot_process
* Dotfiles | beginner | Personal, versioned setup. | Install script; Documented | Shell
* Backup system | intermediate | Scheduled, tested backups. | Rotation; Restore test; Alerts | Scripting
* Hardened server | advanced | Secure host from scratch. | Checklist; Monitoring; Rebuild script | Security
`],
[{ id: "docker", kind: "skill", title: "Docker", area: "cloud", tagline: "Package software so it runs the same everywhere.", keywords: ["docker", "containers"], courseTopics: ["Docker"], related: ["kubernetes", "devops", "linux"], roadmapSh: "docker" }, `
## Ideas | Know what a container is. | Run three different images. | docker:get-started/
- Why containers | Same environment, isolated processes. | docker:learn/content/what-is-a-container/
- Install and run | First containers. | docker:get-started/
- Images and layers | How images are built and shared. | docker:learn/content/how-image-layers-and-the-build-cache-work/
- Container life cycle | Start, stop, logs and exec. | docker:engine/containers/run/
## Build | Make good images. | Halve an image's size.
- Dockerfile | Instructions and order. | docker:learn/content/write-your-first-dockerfile/
- Build cache | Faster builds. | docker:build/cache/
- Multi-stage builds | Small final images. | docker:build/building/multi-stage/
- Build best practices | Pin, ignore and minimise. | docker:build/building/best-practices/
- Image registries | Tag, push and pull. | docker:docker-hub/
## Connect | Data and networks. | Keep data after a rebuild.
- Volumes | Persist data. | docker:engine/storage/volumes/
- Bind mounts | Develop with live files. | docker:engine/storage/bind-mounts/
- Container networks | Let services talk. | docker:engine/network/
- Environment configuration | Settings and secrets. | docker:compose/how-tos/environment-variables/
- @compose
## Production | Run responsibly. | Pass a security scan.
- Container security | Least privilege and updates. | docker:engine/security/
- Resource limits | CPU and memory. | docker:engine/containers/resource_constraints/
- Health checks | Know when it is ready. | web:docs.docker.com/reference/dockerfile/#healthcheck
- Container logging | Drivers and rotation. | docker:engine/logging/
- @kubernetes
* Containerised app | beginner | Package a small web app. | Small image; Non-root; README | Dockerfile
* Dev environment | intermediate | One-command setup. | Compose; Volumes; Seed data | Compose
* Secure pipeline | advanced | Build, scan, sign and publish. | Multi-platform; Scan gate; Provenance | Delivery
`],
[{ id: "kubernetes", kind: "skill", title: "Kubernetes", area: "cloud", tagline: "Run containers reliably across many machines.", keywords: ["kubernetes", "k8s", "helm"], courseTopics: ["Kubernetes"], related: ["docker", "devops", "cloud-engineer"], roadmapSh: "kubernetes" }, `
## Ideas | Know why it exists. | Run a local cluster. | k8s:concepts/overview/
- @docker
- Cluster architecture | Control plane and nodes. | k8s:concepts/architecture/
- Declarative model | Desired state and reconciliation. | k8s:concepts/overview/working-with-objects/
- kubectl | Inspect and change. | k8s:reference/kubectl/
## Workloads | Run things. | Deploy and roll back.
- Pods | The smallest unit. | k8s:concepts/workloads/pods/
- Deployments | Replicas and rollouts. | k8s:concepts/workloads/controllers/deployment/
- Jobs | Run to completion. | k8s:concepts/workloads/controllers/job/
- Stateful workloads | Identity and storage. | k8s:concepts/workloads/controllers/statefulset/
- Probes | Ready, live and started. | k8s:concepts/configuration/liveness-readiness-startup-probes/
## Connect and configure | Expose and supply. | Serve an app with HTTPS.
- Services | Stable addresses. | k8s:concepts/services-networking/service/
- Ingress and gateways | Route outside traffic. | k8s:concepts/services-networking/gateway/
- Config and secrets | Separate settings. | k8s:concepts/configuration/configmap/
- Cluster storage | Volumes and claims. | k8s:concepts/storage/persistent-volumes/
- Network policies | Limit who talks. | k8s:concepts/services-networking/network-policies/
## Operate | Keep it healthy. | Find why a pod will not start.
- Resources and limits | Requests, limits and quality of service. | k8s:concepts/configuration/manage-resources-containers/
- Autoscaling | Pods and nodes. | k8s:concepts/workloads/autoscaling/
- Scheduling | Place work well. | k8s:concepts/scheduling-eviction/
- Debugging | Events, logs and shells. | k8s:tasks/debug/
- Cluster monitoring | Metrics that matter. | k8s:tasks/debug/debug-cluster/resource-usage-monitoring/
## Secure and package | Grow safely. | Install an app with Helm and policies.
- Access control | Roles and service accounts. | k8s:reference/access-authn-authz/rbac/
- Pod security | Standards and contexts. | k8s:concepts/security/pod-security-standards/
- Helm charts | Package and version. | helm:
- @gitops
+ Operators | Automate with custom resources. | k8s:concepts/extend-kubernetes/operator/
* Web app on a cluster | beginner | Deploy a two-tier app. | Probes; Config; Rollback | Workloads
* Scaled service | intermediate | Autoscale under load. | Limits; Metrics; Report | Operations
* Platform cluster | advanced | Multi-team cluster. | RBAC; Policies; GitOps | Platform
`],
[{ id: "terraform", kind: "skill", title: "Terraform", area: "cloud", tagline: "Describe infrastructure as reviewed, repeatable code.", keywords: ["terraform", "iac", "opentofu"], courseTopics: ["Terraform"], related: ["aws", "cloud-engineer", "devops"], roadmapSh: "terraform" }, `
## Ideas | Code instead of clicks. | Create and destroy one resource. | tf:terraform/intro
- Infrastructure as code | Repeatable and reviewable. | tf:terraform/intro
- Core workflow | Write, plan and apply. | tf:terraform/intro/core-workflow
- Providers | Talk to platforms. | tf:terraform/language/providers
- Resources | Declare what should exist. | tf:terraform/language/resources
## Language | Express configurations. | Remove repetition from one file.
- Variables and outputs | Inputs and results. | tf:terraform/language/values
- Expressions and functions | Compute values. | tf:terraform/language/expressions
- Loops and conditions | count and for_each. | tf:terraform/language/meta-arguments/for_each
- Data sources | Read what exists. | tf:terraform/language/data-sources
## State | Know what Terraform knows. | Move a resource without recreating it.
- State basics | Mapping code to reality. | tf:terraform/language/state
- Remote state and locking | Share safely. | tf:terraform/language/backend
- Importing | Adopt existing resources. | tf:terraform/language/import
- Drift | Detect and fix. | tf:terraform/tutorials/state/resource-drift
## Scale | Work as a team. | Publish a reusable module.
- Modules | Reuse with clear inputs. | tf:terraform/language/modules
- Environments | Separate safely. | tf:terraform/language/state/workspaces
- Testing Terraform | Validate and test. | tf:terraform/language/tests
- Secrets in state | Protect sensitive values. | tf:terraform/language/manage-sensitive-data
- @ci-cd
- Policy checks | Prevent risky changes. | web:www.openpolicyagent.org/docs/terraform
* Static site | beginner | Host a site from code. | Variables; Outputs; Destroy works | Basics
* Network module | intermediate | Reusable private network. | Docs; Tests; Two environments | Modules
* Delivery pipeline | advanced | Plan on review, apply on merge. | Remote state; Policy; Drift alert | Teams
`],
[{ id: "aws", kind: "skill", title: "AWS", area: "cloud", tagline: "Use the core AWS services safely and affordably.", keywords: ["aws", "amazon web services", "ec2", "s3", "lambda"], courseTopics: ["AWS", "Cloud Computing"], related: ["cloud-engineer", "terraform", "devops"], roadmapSh: "aws" }, `
## Start safely | Avoid surprise bills. | Set a budget alert. | awsskill
- @cloud-basics
- Account setup | Root protection and MFA. | aws:accounts/latest/reference/best-practices-root-user.html
- Budgets | Alerts before costs. | aws:cost-management/latest/userguide/budgets-managing-costs.html
- @iam
- CLI and SDKs | Automate access. | aws:cli/latest/userguide/cli-chap-welcome.html
## Core | Use the essentials. | Host an app on a server.
- EC2 | Virtual servers. | aws:AWSEC2/latest/UserGuide/concepts.html
- S3 | Object storage. | aws:AmazonS3/latest/userguide/Welcome.html
- VPC | Private networks. | aws:vpc/latest/userguide/what-is-amazon-vpc.html
- RDS | Managed relational databases. | aws:AmazonRDS/latest/UserGuide/Welcome.html
- DynamoDB | Managed key-value and document data. | aws:amazondynamodb/latest/developerguide/Introduction.html
- Route 53 | DNS and routing. | aws:Route53/latest/DeveloperGuide/Welcome.html
## Scale and deliver | Handle demand. | Survive losing one server.
- Load balancers | Distribute traffic. | aws:elasticloadbalancing/latest/userguide/what-is-load-balancing.html
- Auto Scaling | Match capacity. | aws:autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html
- CloudFront | Global delivery. | aws:AmazonCloudFront/latest/DeveloperGuide/Introduction.html
- ECS and Fargate | Run containers. | aws:AmazonECS/latest/developerguide/Welcome.html
## Serverless and events | Build without servers. | Build an image resizer.
- Lambda | Functions on demand. | aws:lambda/latest/dg/welcome.html
- API Gateway | Front doors for APIs. | aws:apigateway/latest/developerguide/welcome.html
- SQS and SNS | Queues and notifications. | aws:AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
- EventBridge | Route events. | aws:eventbridge/latest/userguide/eb-what-is.html
## Operate | Run well. | Alarm on a real symptom.
- CloudWatch | Metrics, logs and alarms. | aws:AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html
- CloudTrail | Who did what. | aws:awscloudtrail/latest/userguide/cloudtrail-user-guide.html
- Secrets Manager | Store and rotate. | aws:secretsmanager/latest/userguide/intro.html
- Well-Architected | Review designs. | awswell
- @iac
* Personal site | beginner | Static site with CDN. | HTTPS; Private bucket; Budget alert | S3
* Serverless API | intermediate | CRUD with functions. | Least privilege; Logs; Tests | Lambda
* Resilient web app | advanced | Multi-zone with recovery. | Autoscaling; Backups; Cost review | Architecture
`],
[{ id: "api-design", kind: "skill", title: "API Design", area: "web", tagline: "Create interfaces other developers enjoy using.", keywords: ["api", "rest api", "openapi"], courseTopics: ["Web Development"], related: ["backend", "graphql", "nodejs"], roadmapSh: "api-design" }, `
## Foundations | Speak HTTP well. | Critique a public API. | mdn:Web/HTTP
- @http
- HTTP methods | Safe, idempotent and cacheable. | mdn:Web/HTTP/Reference/Methods
- Status codes | Say what happened. | mdn:Web/HTTP/Reference/Status
- Headers and content types | Negotiate and describe. | mdn:Web/HTTP/Reference/Headers
## Design | Model for clients. | Design an API before coding. | web:google.aip.dev/
- Resource modelling | Nouns, relationships and names. | web:google.aip.dev/121
- URIs and parameters | Predictable addresses. | web:google.aip.dev/122
- Filtering and pagination | Large collections. | web:google.aip.dev/158
- API errors | Consistent, helpful problems. | web:www.rfc-editor.org/rfc/rfc9457
- Idempotency | Safe retries. | mdn:Glossary/Idempotent
- Versioning | Change without breaking. | web:google.aip.dev/185
## Styles | Choose with reasons. | Compare three styles for one case.
- Richardson maturity | Levels of REST. | fowler:articles/richardsonMaturityModel.html
- @graphql
- gRPC | Typed, fast calls. | web:grpc.io/docs/what-is-grpc/introduction/
- Webhooks | Call back safely. | gh:webhooks/about-webhooks
- @websockets
## Secure | Protect data. | Find a broken access check.
- @oauth
- API keys and tokens | Issue, scope and rotate. | owaspcs:REST_Security_Cheat_Sheet.html
- API security risks | The common failures. | owasp:API-Security/editions/2023/en/0x11-t10/
- Rate limits | Fair use. | mdn:Web/HTTP/Reference/Status/429
- CORS | Cross-origin rules. | mdn:Web/HTTP/Guides/CORS
## Publish | Make it usable. | Ship docs with working examples.
- OpenAPI | Describe the contract. | openapi:
- Contract testing | Keep promises. | web:docs.pact.io/
- API caching | ETags and freshness. | mdn:Web/HTTP/Guides/Caching
- API observability | Usage, errors and latency. | otel:what-is-opentelemetry/
- Deprecation | Retire kindly. | web:google.aip.dev/185
* Public holidays API | beginner | Read-only, documented. | OpenAPI; Caching; Examples | REST
* Task API | intermediate | Full design and tests. | Pagination; Errors; Idempotency | Design
* Partner platform | advanced | OAuth, webhooks and limits. | Scopes; Signed webhooks; SDK | Platform
`],
[{ id: "system-design", kind: "skill", title: "System Design", area: "cs", tagline: "Design systems that grow, fail safely and make sense.", keywords: ["system design", "distributed systems", "scalability"], courseTopics: ["System Design"], related: ["software-architect", "backend", "data-structures-algorithms"], roadmapSh: "system-design" }, `
## Method | Work from needs to design. | Estimate traffic for a service you use. | sdprimer
- Requirements | Functional, quality and limits. | web:github.com/donnemartin/system-design-primer#how-to-approach-a-system-design-interview-question
- Estimation | Requests, storage and bandwidth. | web:github.com/donnemartin/system-design-primer#back-of-the-envelope-calculations
- Interfaces and data first | Contracts and models. | web:github.com/donnemartin/system-design-primer#step-3-design-core-components
- Latency and throughput | What users feel. | web:github.com/donnemartin/system-design-primer#latency-vs-throughput
## Building blocks | Know each part. | Draw a request's journey.
- @dns
- @cdn
- @load-balancing
- @caching
- @queues
- @object-storage
- API gateways | One entry, shared concerns. | patterns:patterns/apigateway.html
## Data | Choose and scale stores. | Pick a shard key and defend it.
- @db-design
- @db-indexes
- Replication | Copies and lag. | web:github.com/donnemartin/system-design-primer#master-slave-replication
- Sharding | Split data. | web:github.com/donnemartin/system-design-primer#sharding
- @cap
- Consistency models | Strong, causal and eventual. | web:jepsen.io/consistency
- Search and analytics stores | Right store for the question. | web:github.com/donnemartin/system-design-primer#sql-or-nosql
## Reliability | Expect failure. | Find every single point of failure.
- Redundancy and failover | No single point. | web:github.com/donnemartin/system-design-primer#availability-patterns
- Timeouts and retries | Backoff and jitter. | web:aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Circuit breakers | Stop cascades. | fowler:bliki/CircuitBreaker.html
- Back pressure and limits | Protect the system. | sre:sre-book/handling-overload/
- @slo
- @monitoring
## Distributed | Coordinate correctly. | Explain leader election.
- Time and ordering | Clocks and causality. | wiki:Lamport_timestamp
- Consensus | Agree despite failure. | web:raft.github.io/
- Sagas and outbox | Work across services. | patterns:patterns/data/saga.html
- Unique identifiers | At scale. | wiki:Snowflake_ID
- @event-driven
## Practise | Explain trade-offs aloud. | Design one system a week. | sdprimer
- Design a URL shortener | Keys, reads and expiry. | web:github.com/donnemartin/system-design-primer#system-design-interview-questions-with-solutions
- Design a news feed | Fan-out choices. | web:github.com/donnemartin/system-design-primer#system-design-interview-questions-with-solutions
- Design a chat service | Presence and delivery. | web:github.com/donnemartin/system-design-primer#additional-system-design-interview-questions
- Design a rate limiter | Algorithms and storage. | web:github.com/donnemartin/system-design-primer#additional-system-design-interview-questions
* Design document | beginner | Design a link shortener. | Estimates; Diagram; Trade-offs | Design
* Scaled prototype | intermediate | Build and load test it. | Cache; Queue; Measurements | Performance
* Failure study | advanced | Break a prototype and fix it. | Fault injection; Report; Changes | Reliability
`],
[{ id: "data-structures-algorithms", kind: "skill", title: "Data Structures & Algorithms", area: "cs", tagline: "Solve problems efficiently and pass interviews.", keywords: ["algorithms", "data structures", "leetcode", "competitive programming"], courseTopics: ["Algorithms & Data Structures", "Graph Theory"], related: ["computer-science", "system-design", "python"], roadmapSh: "datastructures-and-algorithms" }, `
## Foundations | Reason about cost. | Estimate five functions. | visualgo
- A language you know | Be fluent before solving. | exercism
- @big-o
- Recursion | Solve by smaller cases. | ka:computing/computer-science/algorithms/recursive-algorithms/a/recursion
- Problem-solving method | Understand, plan, test and improve. | techinterview
## Linear structures | Know their costs. | Implement each once. | neet
- Arrays and strings | Two pointers and windows. | neet
- Linked lists | Pointers and reversal. | visualgo
- Stacks and queues | Last and first out. | visualgo
- Hash tables | Fast lookup and collisions. | visualgo
## Trees and heaps | Organise hierarchies. | Traverse without recursion.
- Binary trees | Traversals and depth. | visualgo
- Binary search trees | Ordered search. | visualgo
- Balanced trees | Keep height low. | cp:data_structures/treap.html
- Heaps | Priority queues. | visualgo
- Tries | Prefix search. | cp:string/aho_corasick.html
## Algorithms | Learn the patterns. | Explain each in one minute.
- Binary search | On arrays and answers. | cp:num_methods/binary_search.html
- Sorting | Merge, quick and counting. | visualgo
- Backtracking | Try, undo and prune. | neet
- Greedy | Local choices that work. | neet
- Dynamic programming | Remember subproblems. | cp:dynamic_programming/intro-to-dp.html
- Divide and conquer | Split and combine. | cp:
## Graphs | Model connections. | Solve a maze.
- Graph representation | Lists and matrices. | visualgo
- Breadth and depth first | Explore. | cp:graph/breadth-first-search.html
- Shortest paths | Dijkstra and Bellman-Ford. | cp:graph/dijkstra.html
- Minimum spanning trees | Connect cheaply. | cp:graph/mst_kruskal.html
- Topological order | Respect dependencies. | cp:graph/topological-sort.html
- Union-find | Track groups. | cp:data_structures/disjoint_set_union.html
## Advanced and practice | Sharpen. | Solve under time and explain. | neet
+ Segment trees | Range queries. | cp:data_structures/segment_tree.html
+ String algorithms | KMP and hashing. | cp:string/prefix-function.html
+ Bit manipulation | Compact tricks. | cp:algebra/bit-manipulation.html
- @interviews
* Structure library | beginner | Implement and test core structures. | Tests; Costs documented | Structures
* Path finder | intermediate | Visualise searches on a grid. | Three algorithms; Comparison | Graphs
* Search engine core | advanced | Index and rank text. | Inverted index; Ranking; Benchmarks | Algorithms
`],
[{ id: "computer-science", kind: "skill", title: "Computer Science", area: "cs", tagline: "The ideas beneath every tool, at your own pace.", keywords: ["computer science", "cs student", "software engineering"], courseTopics: ["Computer Science", "Theory", "Operating Systems", "Compilers", "Computer Organization and Architecture"], related: ["data-structures-algorithms", "system-design", "cpp"], roadmapSh: "computer-science" }, `
## Introduction | See the whole field. | Finish the first CS50 problems. | cs50x
- Computational thinking | Abstract, decompose and automate. | cs50x
- Programming | One language well. | cs50x
- How computers represent data | Bits, text, images and numbers. | cs50x
- @git
## Mathematics | Reason precisely. | Prove three statements. | ocw:6-042j-mathematics-for-computer-science-spring-2015/
- Discrete mathematics | Logic, sets and proofs. | ocw:6-042j-mathematics-for-computer-science-spring-2015/
- Combinatorics | Count carefully. | ocw:6-042j-mathematics-for-computer-science-spring-2015/
- @probability
- @linear-algebra
## Algorithms | Solve efficiently. | Implement and compare.
- @big-o
- @data-structures
- @algorithms
- Complexity theory | P, NP and limits. | wiki:P_versus_NP_problem
## Machines | From gates to programs. | Build an adder. | nand
- Digital logic | Gates and circuits. | nand
- Computer architecture | CPU, memory and instructions. | nand
- Memory hierarchy | Caches and locality. | wiki:Memory_hierarchy
- Assembly | What the CPU runs. | nand
## Systems | What runs beneath. | Write a tiny shell. | ostep
- @os-basics
- Virtual memory | Pages and protection. | ostep
- File systems | Persist data. | ostep
- @concurrency
- @networking
- Database systems | Storage, queries and recovery. | cmudb
## Languages and theory | How code becomes action. | Write a calculator parser. | web:craftinginterpreters.com/
- Compilers and interpreters | Scan, parse and run. | web:craftinginterpreters.com/
- Programming paradigms | Object, functional and logic. | wiki:Programming_paradigm
- Automata and languages | What can be computed. | wiki:Automata_theory
- @cryptography
## Software and society | Build responsibly. | Contribute to open source. | ossu
- Software engineering | Requirements to maintenance. | ossu
- @unit-testing
- @design-patterns
- Ethics and law | Privacy, fairness and licences. | wiki:Computer_ethics
- AI overview | Search, learning and limits. | cs50ai
* Calculator language | beginner | Parse and evaluate expressions. | Grammar; Errors; Tests | Languages
* Mini shell | intermediate | Run programs and pipes. | Processes; Signals; Tests | Systems
* Toy database | advanced | Pages, index and queries. | Persistence; B-tree; Recovery | Databases
`],
[{ id: "prompt-engineering", kind: "skill", title: "Prompt Engineering", area: "ai", tagline: "Get dependable results from AI models.", keywords: ["prompt engineering", "chatgpt", "claude", "llm"], courseTopics: ["Generative AI"], related: ["ai-engineer", "ai-agents"], roadmapSh: "prompt-engineering" }, `
## Basics | Understand the tool. | Compare one prompt on two models. | elements
- @llm-basics
- Tokens and context | What the model sees. | pguide:introduction/basics
- Sampling settings | Temperature and limits. | pguide:introduction/settings
- Strengths and limits | Hallucination, dates and maths. | pguide:
## Clear prompts | Ask well. | Improve one prompt five times and log it. | promptlearn
- Clear instructions | Goal, audience, format and limits. | pguide:introduction/tips
- Roles and context | Give what is needed. | promptlearn
- Examples | Show the pattern. | pguide:techniques/fewshot
- Structure and delimiters | Separate data from instructions. | promptlearn
- Output format | Tables, JSON and length. | pguide:introduction/elements
## Techniques | Solve harder tasks. | Choose a technique by test results.
- Step-by-step reasoning | Give room to think. | pguide:techniques/cot
- Prompt chaining | Break work into steps. | pguide:techniques/prompt_chaining
- Self-checking | Review and revise. | pguide:techniques/reflexion
- Grounding | Answer only from sources. | pguide:techniques/rag
- @tool-use
## Reliable use | Make it repeatable. | Build a twenty-case test set.
- @llm-evals
- Prompt versioning | Track change and reason. | pguide:
- Cost control | Shorter context and caching. | dlai
- Prompt injection | Untrusted text is not instructions. | owasp:www-project-top-10-for-large-language-model-applications/
- Privacy and honesty | Protect data and disclose use. | pguide:risks/biases
* Prompt notebook | beginner | Record and compare prompts. | Goals; Versions; Results | Prompting
* Extraction tool | intermediate | Structured data from text. | Schema; Test set; Error report | Reliability
* Prompt test suite | advanced | Automated regression checks. | Graders; Cost tracking; CI | Evaluation
`],
[{ id: "ai-agents", kind: "skill", title: "AI Agents", area: "ai", tagline: "Build assistants that plan, act and stay under control.", keywords: ["ai agents", "agents", "mcp", "langchain"], courseTopics: ["Generative AI", "Artificial Intelligence"], related: ["ai-engineer", "prompt-engineering", "python"], roadmapSh: "ai-agents" }, `
## Before agents | Have the base. | Call a model from code.
- @python
- @rest
- @llm-basics
- @prompting
- @llm-apis
## Core ideas | Know what makes an agent. | Build a loop by hand. | hfagents
- What agents are | Model, tools, loop and goal. | effagents
- Workflows or agents | Use the simplest thing that works. | effagents
- @tool-use
- Planning | Break goals into steps. | hfagents
- Agent loop | Observe, decide and act. | hfagents
## Capability | Give useful abilities. | Add search and a calculator.
- Tool design | Clear names, inputs and errors. | web:www.anthropic.com/engineering/writing-tools-for-agents
- @mcp
- @rag
- Memory | Short and long term. | hfagents
- Context management | Keep only what helps. | web:www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Code execution | Sandboxed computation. | hfagents
## Control | Stay safe. | Add approval to a risky action.
- Human approval | Pause before consequences. | effagents
- Permissions | Least privilege for tools. | owasp:www-project-top-10-for-large-language-model-applications/
- Prompt injection defence | Treat content as data. | owasp:www-project-top-10-for-large-language-model-applications/
- Limits | Steps, time and spending. | effagents
## Quality | Know that it works. | Evaluate twenty tasks.
- @llm-evals
- Tracing agents | See every step. | otel:what-is-opentelemetry/
- Failure analysis | Classify and fix causes. | hfagents
- Agent deployment | Queues, retries and state. | hfagents
+ Agent frameworks | What they add and hide. | hfagents
+ Multi-agent design | Coordinate only when needed. | web:www.anthropic.com/engineering/multi-agent-research-system
* Calculator agent | beginner | Solve word problems with a tool. | Loop by hand; Step limit; Log | Tools
* Inbox helper | intermediate | Sort and draft for approval. | Approval; Tests; No sending | Safety
* Codebase guide | advanced | Answer questions about a repository. | MCP; Citations; Evaluation | Agents
`]
];
