import type { Workshop, WorkshopCategory } from "@/lib/workshops/types";

// Photographs for workshops. Every one is CC0 or in the public domain, was looked
// at before it was added, and is served from /public/media/workshops (nothing is
// hot-linked and no publisher's logo or artwork is used). Files come in two
// widths: <key>-640.webp and <key>-1280.webp, both 16:9.

export type Picture = { caption: string; author: string; license: "CC0 1.0" | "Public domain"; page: string; /** Shown while the photo loads. */ tone: string };

export const pictures = {
  containers: { caption: "Shipping containers, Port of Barcelona", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/3305642/free-photo-image-shipping-cargo-transportation-containers", tone: "#081828" },
  helm: { caption: "Ship's helm at dusk", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5942736/free-public-domain-cc0-photo", tone: "#180808" },
  servers: { caption: "Server room", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5906639/photo-image-light-desktop-wallpapers-public-domain", tone: "#080828" },
  "code-lines": { caption: "Colorful lines of code", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/3289770/free-photo-image-wallpaper-programmer-java-technology-cc0", tone: "#284858" },
  "code-close": { caption: "Close-up of code", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/3295877/free-photo-image-language-learning-code-technology-background-digital", tone: "#384858" },
  chip: { caption: "Circuit board macro", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5966842/computer-circuit-board-macro", tone: "#383848" },
  padlock: { caption: "Padlock", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/6021131/photo-image-public-domain-free", tone: "#686818" },
  keys: { caption: "Old keys", author: "Silas Köhler", license: "CC0 1.0", page: "https://wordpress.org/photos/photo/5146798827/", tone: "#985818" },
  "lecture-hall": { caption: "Lecture hall", author: "cogdogblog", license: "CC0 1.0", page: "https://www.flickr.com/photos/37996646802@N01/6288971", tone: "#684828" },
  microphone: { caption: "Microphone", author: "Maciej Korsan", license: "CC0 1.0", page: "https://stocksnap.io/photo/microphone-audio-IQVHQYS3GL", tone: "#181818" },
  "tic-tac-toe": { caption: "Tic-tac-toe on slate", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5908357/love-tic-tac-toe-free-public-domain-cc0-photo", tone: "#384848" },
  "laptop-code": { caption: "CSS on a laptop", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5966952/macbook-css-code-web-design-desk", tone: "#d8d8e8" },
  typing: { caption: "Web design on a laptop", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5968585/web-design-computer", tone: "#282828" },
  desk: { caption: "Laptop and notebook", author: "Matthew Henry", license: "CC0 1.0", page: "https://stocksnap.io/photo/laptop-mac-OR7D4PANCK", tone: "#382818" },
  watch: { caption: "Pocket watch movement", author: "jeremy_buttler", license: "CC0 1.0", page: "https://www.flickr.com/photos/134361078@N06/21769855800", tone: "#080808" },
  maze: { caption: "Hedge maze", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5924723/photo-image-public-domain-plant-green", tone: "#081808" },
  chess: { caption: "Chess pieces", author: "Kristin Hardwick", license: "CC0 1.0", page: "https://stocksnap.io/photo/chess-board-NUAITIXILP", tone: "#787878" },
  plans: { caption: "Floor plan", author: "Open Grid Scheduler / Grid Engine", license: "CC0 1.0", page: "https://www.flickr.com/photos/29155878@N03/36863097644", tone: "#f8f8f8" },
  "light-waves": { caption: "City lights, long exposure", author: "Artem Beliaikin", license: "CC0 1.0", page: "https://www.flickr.com/photos/157635012@N07/48124795256", tone: "#080808" },
  "star-trails": { caption: "Star trails from the International Space Station", author: "NASA, via dullhunk", license: "Public domain", page: "https://www.flickr.com/photos/14829735@N00/52086229981", tone: "#281818" },
  typewriter: { caption: "Typewriter keys", author: "comedy_nose", license: "Public domain", page: "https://www.flickr.com/photos/23408922@N07/8613969965", tone: "#080808" },
  robot: { caption: "Robot", author: "Alex Knight", license: "CC0 1.0", page: "https://stocksnap.io/photo/robot-technology-WUBMLJRYEK", tone: "#482818" },
  hands: { caption: "Robot hand and glove", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5945128/free-public-domain-cc0-photo", tone: "#181818" },
  nebula: { caption: "Star cluster Westerlund 2", author: "HubbleColor {Zolt}", license: "Public domain", page: "https://www.flickr.com/photos/8572247@N03/17290564055", tone: "#181818" },
  "tree-python": { caption: "Green tree python", author: "Sergeant Matt Hecht", license: "CC0 1.0", page: "https://www.rawpixel.com/image/3578722/free-photo-image-animal-cc0", tone: "#384808" },
  magnifier: { caption: "Magnifying glass on newsprint", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5904368/photo-image-public-domain-black-newspaper", tone: "#080808" },
  "neon-keyboard": { caption: "Backlit keyboard", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/3298523/free-photo-image-laptop-computer-awesome", tone: "#080818" },
  pipes: { caption: "Industrial pipes", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5914172/image-light-public-domain-blue", tone: "#082858" },
  tools: { caption: "Screwdrivers on a wall", author: "Markus Spiske", license: "CC0 1.0", page: "https://www.rawpixel.com/image/432241/free-photo-image-garage-workshop-cc0", tone: "#a8b8a8" },
  fiber: { caption: "Optical fiber", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5925623/photo-image-background-light-public-domain", tone: "#080808" },
  "patch-cables": { caption: "Network patch cables", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5919227/image-background-public-domain-technology", tone: "#381808" },
  switch: { caption: "Ethernet switch", author: "Open Grid Scheduler / Grid Engine", license: "CC0 1.0", page: "https://www.flickr.com/photos/29155878@N03/16480450157", tone: "#080808" },
  abacus: { caption: "Abacus", author: "D Coetzee", license: "CC0 1.0", page: "https://www.flickr.com/photos/29507259@N02/6773900661", tone: "#e8e8e8" },
  "sticky-notes": { caption: "Sticky notes", author: "rawpixel", license: "CC0 1.0", page: "https://www.rawpixel.com/image/5907619/photo-image-paper-sticky-notes-public-domain", tone: "#d8d8d8" },
  "dev-desk": { caption: "Developer's desk", author: "Anita Peeples", license: "CC0 1.0", page: "https://stocksnap.io/photo/computer-desk-GVYM0DWG9D", tone: "#d8d8d8" },
  books: { caption: "Library shelves", author: "comedy_nose", license: "Public domain", page: "https://www.flickr.com/photos/23408922@N07/45515063892", tone: "#080808" }
} as const satisfies Record<string, Picture>;
export type PictureKey = keyof typeof pictures;

/** Hand-matched: what the workshop teaches, shown as a thing. */
const curated: Record<string, PictureKey> = {
  "reactor-27765": "star-trails", "reactor-27746": "hands", "reactor-27723": "sticky-notes", "reactor-27815": "padlock", "reactor-27794": "code-lines", "reactor-27814": "plans",
  "google-ml-crash-course": "light-waves", "dlai-prompt-engineering": "typewriter", "hf-agents-course": "robot", "fastai-practical-deep-learning": "nebula",
  "react-tic-tac-toe": "tic-tac-toe", "odin-foundations": "laptop-code", "cs50-web": "typing",
  cs50p: "code-close", "automate-boring-stuff": "watch", "kaggle-python": "tree-python",
  "portswigger-academy": "magnifier", "overthewire-bandit": "neon-keyboard", "cs50-cybersecurity": "keys",
  "docker-get-started": "containers", "github-actions-hello": "pipes", "kubernetes-basics": "helm",
  "mit-missing-semester": "tools", nand2tetris: "chip", "princeton-algorithms-1": "maze", "cs50x-edx": "lecture-hall"
};

/** For calendar feeds and learners' own workshops: the first subject found in the title decides. */
const subjects: readonly (readonly [RegExp, readonly PictureKey[]])[] = [
  [/\b(docker|containers?)\b/, ["containers"]],
  [/\b(kubernetes|k8s|helm)\b/, ["helm"]],
  [/\b(pipelines?|etl|streaming|kafka|airflow|workflows?)\b|\bci\s*\/?\s*cd\b/, ["pipes", "patch-cables"]],
  [/\b(sql|databases?|postgres\w*|warehouse|storage)\b/, ["servers", "books"]],
  [/\b(cost|price|pricing|budget|finops)\b/, ["abacus"]],
  [/\b(reports?|analytics|metrics|dashboards?|statistics)\b/, ["sticky-notes", "abacus"]],
  [/\b(llms?|prompts?|prompting|language models?|nlp|rag)\b/, ["typewriter", "fiber"]],
  [/\bagents?\b.*\b(web|browser|internet)\b/, ["fiber"]],
  [/\b(agents?|agentic|robots?|robotics|assistants?|copilot)\b/, ["robot", "hands", "nebula"]],
  [/\b(deep learning|neural|vision|generative)\b/, ["nebula", "light-waves"]],
  [/\bpython\b/, ["tree-python", "code-close"]],
  [/\b(passwords?|encryption|cryptography|identity|authentication)\b/, ["keys", "padlock"]],
  [/\b(hacking|ctf|forensics|malware|threats?|vulnerabilit\w+)\b/, ["magnifier", "neon-keyboard"]],
  [/\b(networks?|networking|tcp|dns)\b/, ["switch", "patch-cables"]],
  [/\b(react|javascript|typescript|css|html|front[- ]?end)\b/, ["laptop-code", "code-lines"]],
  [/\b(algorithms?|data structures?|interviews?)\b/, ["maze", "chess"]],
  [/\b(architecture|infrastructure|terraform|bicep)\b/, ["plans", "servers"]],
  [/\b(hardware|arduino|embedded|electronics|cpu|assembly)\b/, ["chip"]],
  [/\b(git|linux|bash|terminal|command line)\b/, ["tools", "neon-keyboard"]]
];

const byCategory: Record<WorkshopCategory, readonly PictureKey[]> = {
  "AI & ML": ["fiber", "light-waves", "nebula", "microphone", "hands"],
  "Web Dev": ["typing", "laptop-code", "desk", "dev-desk"],
  Python: ["code-close", "dev-desk", "tree-python"],
  Cybersecurity: ["padlock", "keys", "magnifier"],
  "Cloud & DevOps": ["servers", "patch-cables", "switch"],
  "Systems & Algorithms": ["chess", "maze", "chip", "books"]
};

/** The cover of a whole topic; not used by that topic's own curated workshops. */
export const topicPicture: Record<WorkshopCategory, PictureKey> = {
  "AI & ML": "fiber", "Web Dev": "desk", Python: "dev-desk", Cybersecurity: "code-lines", "Cloud & DevOps": "servers", "Systems & Algorithms": "chess"
};

/** Spreads similar workshops over the matching photos; the same workshop always gets the same one. */
function pick(keys: readonly PictureKey[], id: string): PictureKey {
  let hash = 7;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return keys[hash % keys.length];
}

export function pictureFor(workshop: Pick<Workshop, "id" | "title" | "category">): PictureKey {
  const chosen = Object.hasOwn(curated, workshop.id) ? curated[workshop.id] : undefined;
  if (chosen) return chosen;
  const title = workshop.title.toLowerCase();
  return pick(subjects.find(([pattern]) => pattern.test(title))?.[1] ?? byCategory[workshop.category], workshop.id);
}
