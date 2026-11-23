import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileAutofillReview } from "./profile-autofill-review";
import { ProfileCVStart } from "./profile-cv-start";
import { emptyProfile } from "@/lib/account/schemas";
import type { ProfileAutofill } from "@/lib/ai/profile-autofill";

const result: ProfileAutofill = {
  profile: { name: "Rana Haddad", headline: "Backend developer", location: "", bio: "", education: "Computer Engineering, Lebanese American University", project: "", skills: ["Java", "React"] },
  education: [{ institution: "Lebanese American University", degree: "Computer Engineering", startDate: null, endDate: null, isCurrent: false, years: "2016 – 2020" }],
  experience: [{ company: "Murex", role: "Backend Developer", description: "Building payment APIs.", startDate: "2020-09-01", endDate: null, isCurrent: true, years: "2020 – Present" }],
  languages: ["Arabic"],
  removed: [{ field: "Institution", value: "<b>Harvard</b>" }]
};
const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

test("review lists suggestions, existing values, removed facts and the self-declared rule", () => {
  const html = renderToStaticMarkup(<ProfileAutofillReview result={result} cached={false} remaining={4} profile={{ ...emptyProfile, name: "Rana", skills: ["react"] }} dirty={false} onSaved={noop} onDiscard={noop} />);
  const plain = text(html);
  for (const phrase of ["Check what the AI found", "self-declared", "Left today 4", "Removed 1", "Replaces: Rana", "Lebanese American University", "Year only", "Murex", "Languages found: Arabic", "1 suggestion removed: not found in your text"]) assert.ok(plain.includes(phrase), phrase);
  // A skill already in the profile (case-insensitive) is not offered again.
  assert.equal(html.includes(">React<"), false);
  assert.ok(html.includes("Java"));
  // AI text is escaped, never rendered as markup.
  assert.equal(html.includes("<b>Harvard</b>"), false);
  assert.ok(html.includes("&lt;b&gt;Harvard&lt;/b&gt;"));
  // Empty fields are pre-selected; an existing name is replaced only if the user ticks it.
  assert.match(plain, /5 items selected/);
});

test("review blocks saving over unsaved form edits and explains cached answers", () => {
  const html = renderToStaticMarkup(<ProfileAutofillReview result={result} cached remaining={null} profile={emptyProfile} dirty onSaved={noop} onDiscard={noop} />);
  const plain = text(html);
  assert.ok(plain.includes("did not use an AI request"));
  assert.ok(plain.includes("unsaved edits in the form below"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Save \d+ to my profile<\/button>/);
});

test("the start card asks for consent naming DeepSeek before any AI action", () => {
  const plain = text(renderToStaticMarkup(<ProfileCVStart profile={emptyProfile} onSaved={noop} />));
  for (const phrase of ["DeepSeek", "servers in China", "file is not stored", "Drop your CV here", "40 more characters to go"]) assert.ok(plain.includes(phrase), phrase);
  const html = renderToStaticMarkup(<ProfileCVStart profile={emptyProfile} onSaved={noop} />);
  assert.match(html, /<button[^>]*disabled=""[^>]*>.*?Read my CV with AI<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>.*?Suggest my details<\/button>/);
  assert.match(html, /aria-current="step"[^>]*>.*?Agree/);
});
