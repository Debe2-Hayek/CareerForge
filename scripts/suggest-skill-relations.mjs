// Suggests related skills with a Hugging Face embedding model (Xenova/all-MiniLM-L6-v2, Apache-2.0),
// run offline by a person. Output: src/data/skills/model-neighbours.json, which is only a list of
// CANDIDATES: a person reviews them into src/data/skill-relations.ts (the model also links
// unrelated skills, e.g. Java with Salesforce). The app never loads the model.
//   npm install --no-save @huggingface/transformers@4.3.2 && node scripts/suggest-skill-relations.mjs
import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("src/lib/jobs/text-signals.ts", "utf8");
const vocabulary = [...source.matchAll(/\["([^"]+)", \//g)].map(match => match[1]);
const extra = ["Data Structures", "Algorithms", "OOP", "NoSQL", "Express.js", "NestJS", "jQuery", "Bootstrap", "Sass", "Redux", "Jest", "Unit Testing", "Selenium", "Cypress", "Pandas", "NumPy", "Scikit-learn", "Deep Learning", "NLP", "Computer Vision", "Statistics", "R", "MATLAB", "Spark", "Airflow", "ETL", "Data Engineering", "Snowflake", "BigQuery", "Microservices", "System Design", "Networking", "Penetration Testing", "SIEM", "Firebase", "Supabase", "Prisma", "Android", "iOS", "Unity", "C", "Bash", "PowerShell", "Jira", "Digital Marketing", "Google Analytics", "Content Writing", "Photoshop", "Illustrator", "Adobe XD", "Product Management", "Business Analysis", "SAP", "English", "Ansible", "Jenkins", "GitHub Actions", "Nginx", "Oracle", "SQL Server", "SQLite", "Elasticsearch", "Kafka", "LLMs", "Prompt Engineering", "Data Visualization", "Web Development", "Frontend Development", "Backend Development", "Mobile Development", "DevOps", "Cloud Computing", "Data Science", "Artificial Intelligence", "Responsive Design", "Accessibility", "Testing", "Security"];
const skills = [...new Set([...vocabulary, ...extra])];
const embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const vectors = [];
for (const skill of skills) vectors.push(Array.from((await embed(`${skill} (software / professional skill)`, { pooling: "mean", normalize: true })).data));
const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const out = {};
for (const [i, skill] of skills.entries()) {
  out[skill] = skills.map((other, j) => [other, cosine(vectors[i], vectors[j])]).filter(([other, score]) => other !== skill && score >= 0.6).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([other, score]) => `${other} ${score.toFixed(2)}`);
}
writeFileSync("src/data/skills/model-neighbours.json", JSON.stringify({ model: "Xenova/all-MiniLM-L6-v2 (q8)", skills: skills.length, neighbours: out }, null, 1));
console.log(skills.length, "skills");
