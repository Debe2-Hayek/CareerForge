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

test("review lists suggestions, existing values, removed facts and the self-declared label", () => {
  const html = renderToStaticMarkup(<ProfileAutofillReview result={result} cached={false} remaining={4} profile={{ ...emptyProfile, name: "Rana", skills: ["react"] }} dirty={false} onSaved={noop} onDiscard={noop} />);
  for (const text of ["Check what the AI found", "Self-declared until verified", "AI requests left today: 4", "Replaces: Rana", "Lebanese American University", "add exact months later", "Murex", "Languages found: Arabic", "Removed because they weren&#x27;t in your text (1)"]) assert.ok(html.includes(text), text);
  // A skill already in the profile (case-insensitive) is not offered again.
  assert.equal(html.includes(">React<"), false);
  assert.ok(html.includes("Java"));
  // AI text is escaped, never rendered as markup.
  assert.equal(html.includes("<b>Harvard</b>"), false);
  assert.ok(html.includes("&lt;b&gt;Harvard&lt;/b&gt;"));
});

test("review blocks saving over unsaved form edits and explains cached answers", () => {
  const html = renderToStaticMarkup(<ProfileAutofillReview result={result} cached remaining={null} profile={emptyProfile} dirty onSaved={noop} onDiscard={noop} />);
  assert.ok(html.includes("No AI use counted"));
  assert.ok(html.includes("unsaved edits in the form below"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Save \d+ selected<\/button>/);
});

test("the start card asks for consent naming DeepSeek before any AI action", () => {
  const html = renderToStaticMarkup(<ProfileCVStart profile={emptyProfile} onSaved={noop} />);
  assert.ok(html.includes("DeepSeek"));
  assert.ok(html.includes("servers are in China"));
  assert.ok(html.includes("is not stored"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Read my CV with AI<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Suggest my details<\/button>/);
});
