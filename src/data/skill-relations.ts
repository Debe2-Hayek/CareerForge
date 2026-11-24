/**
 * Reviewed relations between skills, used by CV-to-job matching. How it was made (24 November
 * 2026): a Hugging Face embedding model (Xenova/all-MiniLM-L6-v2, Apache-2.0) proposed the closest
 * skills for 140 names (scripts/suggest-skill-relations.mjs → src/data/skills/model-neighbours.json);
 * a person kept only the true ones and added obvious missing ones. The model alone is not trusted:
 * it also placed Java next to Salesforce and English. The app applies this list with plain code,
 * so matching is instant, free and the same in the browser and on the server.
 *
 * - SHOWS: knowing the first skill demonstrates the second ("PostgreSQL" shows "SQL").
 * - RELATED: a near alternative; it earns partial credit and is shown as related, never as a match.
 * - ALIASES: other spellings people type, mapped to the name used everywhere else.
 */
export const SHOWS: Record<string, string[]> = {
  "PostgreSQL": ["SQL"], "MySQL": ["SQL"], "SQL Server": ["SQL"], "Oracle": ["SQL"], "SQLite": ["SQL"],
  "Django": ["Python"], "Flask": ["Python"], "FastAPI": ["Python"], "Pandas": ["Python", "Data Analysis"], "NumPy": ["Python"],
  "Scikit-learn": ["Python", "Machine Learning"], "TensorFlow": ["Machine Learning"], "PyTorch": ["Machine Learning"], "Deep Learning": ["Machine Learning"],
  "TypeScript": ["JavaScript"], "React": ["JavaScript"], "Vue": ["JavaScript"], "Angular": ["JavaScript", "TypeScript"], "jQuery": ["JavaScript"],
  "Node.js": ["JavaScript"], "Express.js": ["Node.js", "JavaScript"], "NestJS": ["Node.js", "TypeScript"], "Next.js": ["React", "JavaScript"],
  "React Native": ["React", "JavaScript"], "Redux": ["React", "JavaScript"],
  "Tailwind CSS": ["CSS"], "Sass": ["CSS"], "Bootstrap": ["CSS"],
  "Spring": ["Java"], "Laravel": ["PHP"], "ASP.NET": [".NET"], "SwiftUI": ["Swift"],
  "Kubernetes": ["Docker"], "GitHub Actions": ["CI/CD", "Git"], "Jenkins": ["CI/CD"], "GitLab": ["Git"],
  "Power BI": ["Data Analysis"], "Tableau": ["Data Analysis"], "Statistics": ["Data Analysis"],
  "Scrum": ["Agile"], "Penetration Testing": ["Cybersecurity"], "SIEM": ["Cybersecurity"]
};

export const RELATED: string[][] = [
  ["PostgreSQL", "MySQL", "SQL Server", "Oracle", "SQLite"],
  ["React", "Vue", "Angular"],
  ["Django", "Flask", "FastAPI"],
  ["AWS", "Azure", "GCP"],
  ["Power BI", "Tableau"],
  ["Java", "Kotlin"],
  ["Swift", "Kotlin", "Flutter", "React Native"],
  ["MongoDB", "Redis", "NoSQL"],
  ["TensorFlow", "PyTorch"],
  ["Figma", "UI/UX", "Adobe XD"],
  ["GitHub Actions", "Jenkins", "GitLab"],
  ["Terraform", "Ansible"]
];

export const ALIASES: Record<string, string> = {
  "postgres": "PostgreSQL", "psql": "PostgreSQL", "mssql": "SQL Server", "ms sql": "SQL Server",
  "reactjs": "React", "react js": "React", "react.js": "React", "nodejs": "Node.js", "node js": "Node.js", "node": "Node.js",
  "vuejs": "Vue", "vue.js": "Vue", "nextjs": "Next.js", "next js": "Next.js", "expressjs": "Express.js", "express": "Express.js",
  "js": "JavaScript", "ts": "TypeScript", "es6": "JavaScript", "html5": "HTML", "css3": "CSS", "tailwind": "Tailwind CSS",
  "k8s": "Kubernetes", "amazon web services": "AWS", "google cloud": "GCP", "google cloud platform": "GCP", "microsoft azure": "Azure",
  "golang": "Go", "c sharp": "C#", "csharp": "C#", "dotnet": ".NET", "asp.net core": "ASP.NET",
  "ml": "Machine Learning", "dl": "Deep Learning", "ai": "Artificial Intelligence", "sklearn": "Scikit-learn", "scikit learn": "Scikit-learn",
  "ms excel": "Excel", "microsoft excel": "Excel", "powerbi": "Power BI", "ux": "UI/UX", "ui": "UI/UX", "ui ux": "UI/UX", "ux design": "UI/UX",
  "rest": "REST APIs", "rest api": "REST APIs", "restful apis": "REST APIs", "cicd": "CI/CD", "ci cd": "CI/CD", "github": "Git", "gitlab ci": "GitLab",
  "cyber security": "Cybersecurity", "infosec": "Cybersecurity", "scrum master": "Scrum"
};
