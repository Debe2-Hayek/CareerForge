import type { RoadmapSource } from "./types";

// Data and AI roles.
export const dataRoles: RoadmapSource[] = [
[{ id: "ai-engineer", kind: "role", title: "AI Engineer", area: "ai", tagline: "Build dependable products on top of modern AI models.", keywords: ["ai engineer", "llm", "generative ai", "rag", "artificial intelligence", "prompt"], courseTopics: ["Generative AI", "Artificial Intelligence"], related: ["prompt-engineering", "ai-agents", "machine-learning", "backend"], roadmapSh: "ai-engineer" }, `
## Build foundations | Be able to ship a normal web service first. | Deploy a small API that returns JSON.
- @python
- @git
- @rest
- @sql
- @docker
## How models work | Know enough to choose and debug. | Explain tokens, context and temperature to a colleague. | hfllm
- @llm-basics
- @transformers
- Model families and trade-offs | Hosted or open, small or large: quality, latency, cost and privacy. | hfllm
- @embeddings
- Multimodal models | Work with images, audio and documents. | hf:learn/computer-vision-course/unit0/welcome/welcome
## Working with models | Get reliable output from an API. | Extract structured data from messy emails.
- @prompting
- @llm-apis
- Structured output | Schemas, validation and retries. | pguide:, dlai
- Streaming interfaces | Show progress and allow cancelling. | mdn:Web/API/Streams_API
- Context engineering | Choose what the model sees, and cut the rest. | web:www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Cost and latency | Caching, batching and choosing smaller models. | dlai
## Your own data | Answer from facts you control. | Build a question-answering page with citations.
- @rag
- @vector-db
- Chunking and parsing | Split documents so meaning survives. | pguide:techniques/rag
- Search quality | Hybrid search, reranking and measuring recall. | web:github.com/ibm-granite-community/granite-snack-cookbook
## Agents | Let models act, carefully. | Build an agent that uses two tools with approval.
- @agents
- @tool-use
- @mcp
- Agent memory | Short-term state, summaries and long-term notes. | hfagents
+ Multi-agent systems | When splitting work helps, and when it only adds cost. | web:www.anthropic.com/engineering/multi-agent-research-system
## Quality and safety | Prove it works and limit harm. | Create a test set of fifty cases with a grader.
- @llm-evals
- @ai-safety
- Guardrails | Input and output checks, limits and fallbacks. | owasp:www-project-top-10-for-large-language-model-applications/
- Privacy and data handling | Minimise, redact and explain what is sent where. | nist:
- Observability for AI | Trace prompts, tool calls, cost and quality. | otel:what-is-opentelemetry/
## Going deeper | Know when prompts are not enough. | Compare a fine-tuned model with a prompted one.
+ @fine-tuning
+ Running open models | Local inference, quantisation and serving. | web:github.com/ggml-org/llama.cpp
- @ci-cd
- @portfolio
* Document question answering | beginner | Ask questions about your own PDFs with citations. | Cited answers; Says when it does not know; Cost shown | RAG
* Support triage assistant | intermediate | Classify and draft replies for human approval. | Structured output; Fifty-case test set; Nothing sent automatically | Evals, Prompting
* Research agent | advanced | Plan, search and write a sourced brief. | Tool limits; Approval step; Traced runs; Evaluated against a baseline | Agents, MCP
`],
[{ id: "data-analyst", kind: "role", title: "Data Analyst", area: "data", tagline: "Turn raw numbers into decisions people trust.", keywords: ["data analyst", "analytics", "excel", "sql", "power bi", "tableau", "reporting"], courseTopics: ["Data Science", "SQL", "Databases"], related: ["sql", "bi-analyst", "data-scientist", "python"], roadmapSh: "data-analyst" }, `
## The analyst's job | Start from the question, not the tool. | Rewrite a vague request as a measurable question.
- Analytical questions | Turn a business problem into something answerable. | dataviz
- Types of analysis | Descriptive, diagnostic, predictive and prescriptive. | wiki:Data_analysis
- @spreadsheets
- Data types and quality | Accuracy, completeness and where numbers come from. | wiki:Data_quality
## Get the data | Pull what you need yourself. | Answer ten questions about a public dataset with SQL.
- @sql
- Joins and grouping | Combine tables and summarise. | sqlbolt
- Window functions | Running totals, ranks and comparisons. | pg:tutorial-window.html
- @db-design
+ Collecting data | APIs, files and surveys, with consent. | mdn:Learn_web_development/Core/Scripting/Network_requests
## Clean and explore | Trust the numbers before using them. | Document every cleaning step on one dataset.
- @data-cleaning
- @python
- @pandas
- @eda
? R for analysis | A statistics-first alternative. | web:r4ds.hadley.nz/
## Reason with statistics | Avoid fooling yourself. | Explain a confidence interval in plain words. | openintro
- @statistics
- @probability
- Correlation and causation | Confounders, and what data alone cannot show. | ka:math/statistics-probability/describing-relationships-quantitative-data
- Regression | Estimate relationships and read residuals. | ka:math/statistics-probability/describing-relationships-quantitative-data
- @ab-testing
## Communicate | Make the point obvious. | Present one insight in three minutes.
- @data-viz
- @dashboards
- Data storytelling | Context, insight and recommendation. | dataviz
- @stakeholders
- @product-metrics
## Work-ready | Show your thinking. | Publish a full analysis with code and limits.
- @git
- Reproducible notebooks | Narrative, code and results together. | web:docs.jupyter.org/en/latest/
- Data ethics and privacy | Consent, anonymity and fair use. | wiki:Big_data_ethics
- @portfolio
* Sales summary | beginner | Summarise a public sales dataset in a spreadsheet. | Cleaning notes; Pivot tables; One-page recommendation | Spreadsheets
* City bike analysis | intermediate | Find when and where demand peaks. | SQL and Python; Three clear charts; Limits stated | SQL, pandas
* Experiment readout | advanced | Analyse an A/B test end to end. | Power and assumptions; Segments; Decision memo | Statistics
`],
[{ id: "data-scientist", kind: "role", title: "Data Scientist", area: "data", tagline: "Combine statistics, code and domain sense to predict and explain.", keywords: ["data scientist", "data science", "statistics", "machine learning", "python", "r"], courseTopics: ["Data Science", "Machine Learning", "Python"], related: ["machine-learning", "data-analyst", "python", "mlops"], roadmapSh: "ai-data-scientist" }, `
## Mathematics | Understand what your tools compute. | Derive a least-squares line by hand. | ka:math
- @linear-algebra
- @calculus
- @probability
- @statistics
## Programming for data | Write clean, repeatable analysis. | Turn a messy notebook into a small package.
- @python
- @numpy
- @pandas
- @sql
- @git
## Explore and explain | Learn from the data first. | Publish an exploratory report.
- @data-cleaning
- @eda
- @data-viz
- Data storytelling | Say what it means and what to do. | dataviz
## Inference | Draw conclusions you can defend. | Plan, run and report one experiment. | openintro
- Hypothesis testing | p-values, effect sizes and power. | ka:math/statistics-probability/significance-tests-one-sample
- @ab-testing
- Regression modelling | Linear and logistic models and their assumptions. | islp
- Causal thinking | Confounding, natural experiments and diagrams. | web:mixtape.scunning.com/
+ Bayesian methods | Update beliefs with evidence. | web:xcelab.net/rm/
+ Time series | Trend, seasonality and forecasts. | web:otexts.com/fpp3/
## Machine learning | Predict with honest evaluation. | Beat a simple baseline on an unseen test set. | mlcc
- @ml-basics
- @sklearn
- @feature-eng
- @model-eval
- Trees and ensembles | Random forests and gradient boosting. | sk:modules/ensemble.html
- Unsupervised learning | Clustering and dimensionality reduction. | sk:unsupervised_learning.html
- Interpretability | Explain predictions and spot leakage. | web:christophm.github.io/interpretable-ml-book/
## Deep learning | Handle images, text and sequence data. | Fine-tune a small pretrained model. | fastai
- @neural-nets
- @pytorch
- @nlp
+ Computer vision | Classify and detect in images. | kaggle:computer-vision
+ @llm-basics
## Deliver | Turn a model into value. | Serve one model behind an API with a model card.
- Model deployment | Batch, API and edge options. | web:fastapi.tiangolo.com/
- Reproducibility | Track data, code, parameters and results. | web:dvc.org/doc
- Responsible AI | Fairness, privacy and accountability. | gml:crash-course/fairness
- @stakeholders
- @portfolio
* House price model | beginner | Predict prices and explain the drivers. | Baseline; Cross-validation; Error analysis | scikit-learn
* Churn study | intermediate | Find who leaves and why. | Interpretable model; Costs considered; Recommendation memo | Classification
* Demand forecaster | advanced | Forecast and monitor weekly demand. | Backtesting; Uncertainty intervals; Scheduled retraining | Time series, MLOps
`],
[{ id: "machine-learning", kind: "role", title: "Machine Learning Engineer", area: "ai", tagline: "Train, ship and improve models that run in production.", keywords: ["machine learning", "ml engineer", "deep learning", "pytorch", "tensorflow"], courseTopics: ["Machine Learning", "Deep Learning", "Artificial Intelligence"], related: ["mlops", "data-scientist", "ai-engineer", "python"], roadmapSh: "machine-learning" }, `
## Mathematics | The language of models. | Implement gradient descent from scratch.
- @linear-algebra
- @calculus
- @probability
- @statistics
## Engineering base | Write code others can run. | Package a project with tests and a lock file.
- @python
- @numpy
- @pandas
- @sql
- @git
- @linux
- @unit-testing
## Classical ML | Solve most problems simply. | Compare three models on one dataset. | mlcc
- @ml-basics
- Linear models | Regression, classification and regularisation. | sk:modules/linear_model.html
- Trees and boosting | Strong tabular baselines. | kaggle:intermediate-machine-learning
- Clustering and reduction | Find structure without labels. | sk:unsupervised_learning.html
- @feature-eng
- @model-eval
- Hyperparameter search | Tune without leaking the test set. | sk:modules/grid_search.html
## Deep learning | Learn representations. | Train an image classifier and study its mistakes. | fastai
- @neural-nets
- @pytorch
- Training well | Optimisers, regularisation and learning rates. | d2l
- Convolutional networks | Models for images. | torch:beginner/blitz/cifar10_tutorial.html
- Sequence models | Recurrent networks and attention. | d2l
- @transformers
+ Generative models | Autoencoders and diffusion. | hf:learn/diffusion-course/unit0/1
+ Reinforcement learning | Learn from rewards. | hf:learn/deep-rl-course/unit0/introduction
## Language and vision | Apply modern pretrained models. | Fine-tune a model for your own labels.
- @nlp
- @embeddings
- @fine-tuning
+ Computer vision | Detection, segmentation and augmentation. | hf:learn/computer-vision-course/unit0/welcome/welcome
+ Recommender systems | Rank items for people. | gml:recommendation
## Production | Make models useful and safe. | Deploy a model with monitoring. | mwml
- Model serving | Latency, batching and hardware. | torch:
- Experiment tracking | Compare runs you can reproduce. | web:mlflow.org/docs/latest/
- Data and model versioning | Know exactly what produced a result. | web:dvc.org/doc
- Drift monitoring | Notice when the world changes. | web:madewithml.com/courses/mlops/monitoring/
- @docker
- @ci-cd
- Responsible ML | Fairness, privacy and documentation. | gml:crash-course/fairness
- @system-design
* Digit recogniser | beginner | Classify handwritten digits from scratch. | Own training loop; Confusion matrix; Error analysis | PyTorch
* Product recommender | intermediate | Suggest items and measure quality. | Baseline; Offline metrics; Cold-start plan | Recommenders
* ML service | advanced | Train, serve and monitor a model. | Reproducible pipeline; Canary release; Drift alert | MLOps
`],
[{ id: "data-engineer", kind: "role", title: "Data Engineer", area: "data", tagline: "Build the pipelines every analyst and model depends on.", keywords: ["data engineer", "etl", "spark", "airflow", "data pipeline", "warehouse"], courseTopics: ["Databases", "Spark", "SQL", "NoSQL"], related: ["sql", "data-analyst", "mlops", "cloud-engineer"], roadmapSh: "data-engineer" }, `
## Foundations | Program, query and automate. | Write a script that loads a file safely twice.
- @python
- @sql
- @linux
- @shell
- @git
- @docker
## Databases | Know how data is stored. | Model a shop for transactions and for analytics.
- @db-design
- @postgres
- @db-indexes
- @transactions
- @nosql
## Modelling for analytics | Make questions easy to answer. | Build a star schema with slowly changing dimensions. | dbt:docs/introduction
- Warehouses and lakes | Warehouse, lake and lakehouse trade-offs. | gcp:learn/what-is-a-data-warehouse
- Dimensional modelling | Facts, dimensions and grain. | wiki:Dimensional_modeling
- File formats | CSV, JSON, Parquet and partitioning. | web:parquet.apache.org/docs/overview/
- dbt | Version, test and document transformations. | dbt:docs/introduction
## Pipelines | Move data reliably. | Schedule a pipeline that retries without duplicates. | zoomde
- ETL and ELT | Extract, load and transform, and in which order. | gcp:learn/what-is-etl
- Orchestration with Airflow | Schedules, dependencies and retries. | airflow:core-concepts/overview.html
- Idempotency and backfills | Run again without harm. | airflow:best-practices.html
- Data quality | Tests, contracts and alerts. | dbt:docs/build/data-tests
- Change data capture | Follow a database's changes. | web:debezium.io/documentation/reference/stable/tutorial.html
## Scale | Process more than one machine can hold. | Run one Spark job and read its plan.
- Distributed processing | Partitions, shuffles and skew. | spark:rdd-programming-guide.html
- Apache Spark | DataFrames and SQL at scale. | spark:sql-programming-guide.html
- Kafka and streaming | Topics, partitions and consumer groups. | kafka:intro
+ Stream processing | Windows, late data and exactly-once. | spark:streaming/index.html
- @cap
## Platform | Operate it responsibly. | Deploy a pipeline from code. | zoomde
- @cloud-basics
- @object-storage
- @iac
- @ci-cd
- @monitoring
- Governance and privacy | Catalogues, lineage, access and retention. | gcp:learn/what-is-data-governance
- @cloud-cost
* Weather pipeline | beginner | Load a public weather API daily. | Idempotent; Tested; Scheduled | Python, SQL
* Analytics warehouse | intermediate | Model open data with dbt. | Star schema; Tests; Docs site | dbt, SQL
* Streaming metrics | advanced | Process live events into dashboards. | Late data handled; Replay; Alerts | Kafka, Spark
`],
[{ id: "bi-analyst", kind: "role", title: "BI Analyst", area: "data", tagline: "Give every team one clear, trusted view of performance.", keywords: ["bi", "business intelligence", "power bi", "tableau", "dashboard", "reporting"], courseTopics: ["SQL", "Data Science"], related: ["data-analyst", "sql", "data-engineer"], roadmapSh: "bi-analyst" }, `
## Business first | Know what drives the organisation. | Map one team's goals to measures.
- Business models | How value and money flow. | svpg
- @product-metrics
- KPI design | Definitions, owners and targets. | wiki:Performance_indicator
- @stakeholders
## Data skills | Work with sources directly. | Reconcile two reports that disagree.
- @spreadsheets
- @sql
- Joins and windows | Combine and compare across time. | pgex
- @data-cleaning
- @statistics
## Data models | Build once, report many times. | Create a star schema in a BI tool.
- Dimensional modelling | Facts, dimensions and consistent grain. | wiki:Dimensional_modeling
- Semantic layers | One definition for every measure. | dbt:docs/use-dbt-semantic-layer/dbt-sl
- Refresh and performance | Incremental loads and fast visuals. | powerbi
## Tools | Master one, know the rest. | Rebuild one report in a second tool.
- Power BI | Model, DAX and publish. | powerbi
? Tableau | Visual analysis and stories. | tableau
? Looker Studio | Free shareable reports. | web:support.google.com/looker-studio/
+ @python
## Design | Let the reader decide quickly. | Cut a crowded dashboard to one question. | dataviz
- @data-viz
- @dashboards
- Dashboard usability | Hierarchy, filters and accessible colour. | nng:dashboards-preattentive/
- Data storytelling | Insight, evidence and action. | dataviz
## Trust | Keep reports right. | Write a data dictionary.
- Data governance | Ownership, access and definitions. | gcp:learn/what-is-data-governance
- Row-level security | Show people only their data. | ms:fabric/security/service-admin-row-level-security
- @portfolio
* Store dashboard | beginner | Track sales by product and week. | Clear measures; Filters; Notes on data | Dashboards
* Finance pack | intermediate | Monthly pack from modelled data. | Star schema; Variance view; Documented refresh | Modelling
* Self-serve portal | advanced | Certified data and guided reports. | Semantic layer; Access rules; Usage review | Governance
`],
[{ id: "mlops", kind: "role", title: "MLOps Engineer", area: "ai", tagline: "Make machine learning repeatable, observable and safe to run.", keywords: ["mlops", "ml platform", "machine learning operations"], courseTopics: ["Machine Learning", "DevOps"], related: ["machine-learning", "devops", "kubernetes", "data-engineer"], roadmapSh: "mlops" }, `
## Foundations | Code, systems and version control. | Containerise a Python app.
- @python
- @linux
- @shell
- @git
- @docker
- @sql
## ML literacy | Know what you operate. | Train and evaluate one model. | mlcc
- @ml-basics
- @model-eval
- @pytorch
- ML system life cycle | From data to decision and back. | mlsys
## Reproducibility | Get the same result twice. | Rebuild an old model exactly. | zoomml
- Data versioning | Snapshot what training used. | web:dvc.org/doc
- Experiment tracking | Parameters, metrics and artefacts. | web:mlflow.org/docs/latest/
- Model registry | Versions, stages and approval. | web:mlflow.org/docs/latest/
- Feature stores | Same features in training and serving. | web:docs.feast.dev/
## Pipelines | Automate training and release. | Retrain on a schedule with a quality gate.
- Workflow orchestration | Dependencies, retries and schedules. | airflow:core-concepts/overview.html
- @ci-cd
- Testing ML systems | Data, model and integration tests. | web:madewithml.com/courses/mlops/testing/
- @iac
## Serving | Deliver predictions reliably. | Serve with a canary release. | zoomml
- Batch and online serving | Choose by latency and cost. | mlsys
- @kubernetes
- Model optimisation | Quantise, batch and cache. | mlsys
- GPU basics | Sharing, sizing and cost. | k8s:tasks/manage-gpus/scheduling-gpus/
+ Serving language models | Throughput, context and streaming. | web:docs.vllm.ai/en/latest/
## Operate | Notice problems first. | Trigger an alert from simulated drift.
- @monitoring
- Drift and data quality | Detect change in inputs and outputs. | web:docs.evidentlyai.com/
- Feedback loops | Collect labels and improve. | mlsys
- Model governance | Cards, access and audit. | nist:
- @cloud-cost
- @incidents
* Tracked training | beginner | Version data and runs for one model. | Reproducible; Compared runs; README | DVC, MLflow
* Continuous training | intermediate | Retrain with automatic checks. | Data tests; Quality gate; Rollback | CI/CD
* Model platform | advanced | Self-serve deploys for a team. | Templates; Canary; Drift and cost dashboards | Kubernetes
`]
];
