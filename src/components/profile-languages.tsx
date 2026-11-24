"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  compareLevel, levelFromScore, levelInfo, levelLabel, LEVELS, resultAge, TEST_IDS, TESTS, testResultText,
  type LanguageLevel, type LanguageTest, type ProfileLanguage
} from "@/lib/languages";

const COMMON = ["Arabic", "English", "French", "German", "Spanish", "Italian", "Turkish", "Armenian", "Chinese", "Portuguese", "Russian", "Japanese"];
type Form = { id: string | null; language: string; level: LanguageLevel | ""; test: LanguageTest | ""; score: string; testDate: string };
const blank: Form = { id: null, language: "", level: "", test: "", score: "", testDate: "" };
const monthYear = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

/** What a test score supports, shown while typing and on each saved language. */
function ScoreHint({ level, test, score, testDate }: { level: LanguageLevel | ""; test: LanguageTest | ""; score: string; testDate: string }) {
  if (!test || !score.trim()) return null;
  const reading = levelFromScore(test, score);
  const verdict = level ? compareLevel(level, reading) : "unknown";
  const age = resultAge(test, testDate || null);
  return <p className="language-hint" data-verdict={verdict}>
    {reading.level === null ? reading.text
      : reading.level === "below" ? `${reading.text} is below B1.`
      : <>{reading.text} supports <strong>{reading.level}</strong>{level && verdict === "below" ? ` — lower than the ${levelLabel(level)} you claim. Reviewers will see this.` : level ? ". ✓" : "."}</>}
    {age?.expired && <> {age.text}</>}
  </p>;
}

export function ProfileLanguages({ initial }: { initial: ProfileLanguage[] }) {
  const [languages, setLanguages] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => current ? { ...current, [key]: value } : current);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    if (!form.language.trim() || !form.level) { setError("Enter the language and choose your level."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/languages", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ id: form.id, fields: { language: form.language.trim(), level: form.level, test: form.test || null, score: form.test ? form.score.trim() || null : null, testDate: form.test && form.testDate ? form.testDate : null } }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.language) { setError(body?.error?.message ?? "Your language could not be saved."); return; }
      const saved = body.language as ProfileLanguage;
      setLanguages(current => form.id ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      setMessage(form.id ? `${saved.language} updated.` : `${saved.language} added. Add proof on the Verify page.`);
      setForm(null);
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function remove(item: ProfileLanguage) {
    if (busy || !window.confirm(`Remove ${item.language} from your profile? Proof sent for it is removed too.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/languages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error?.message ?? "The language could not be removed."); return; }
      setLanguages(current => current.filter(entry => entry.id !== item.id));
      setMessage(`${item.language} removed.`);
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const edit = (item: ProfileLanguage) => { setMessage(""); setError(""); setForm({ id: item.id, language: item.language, level: item.level, test: item.test ?? "", score: item.score ?? "", testDate: item.testDate ?? "" }); };

  return <section id="languages" className="panel profile-languages" aria-labelledby="languages-title">
    <header>
      <div>
        <p className="eyebrow">LANGUAGES</p>
        <h2 id="languages-title">Languages you speak</h2>
        <p>State each language at its CEFR level. A test result (IELTS, TOEFL, DELF…) lets CareerForge check the level; send the score report on the <Link href="/account/verification">Verify page</Link>.</p>
      </div>
      {!form && languages.length < 10 && <button type="button" className="button primary" onClick={() => { setMessage(""); setError(""); setForm({ ...blank }); }} disabled={busy}>Add a language</button>}
    </header>
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    {error && !form && <p className="form-error" role="alert">{error}</p>}

    {languages.length > 0 && <ul className="language-list">
      {languages.map(item => <li key={item.id}>
        <span className="language-level" data-level={item.level}>{levelLabel(item.level)}</span>
        <div>
          <strong>{item.language}</strong>
          <span>{levelInfo[item.level]}{item.test ? ` · ${testResultText(item.test, item.score)}` : " · no test result"}{item.testDate ? ` · ${monthYear.format(new Date(`${item.testDate}T00:00:00Z`))}` : ""}</span>
          {item.test && <ScoreHint level={item.level} test={item.test} score={item.score ?? ""} testDate={item.testDate ?? ""} />}
        </div>
        <div className="language-actions">
          <button type="button" className="text-button" onClick={() => edit(item)} disabled={busy}>Edit</button>
          <button type="button" className="text-button" onClick={() => remove(item)} disabled={busy}>Remove</button>
        </div>
      </li>)}
    </ul>}
    {!languages.length && !form && <p className="claims-empty">No languages yet. Add each language you can work in, with your level.</p>}

    {form && <form className="language-form" onSubmit={save} noValidate>
      <div className="language-grid">
        <label>Language
          <input list="language-suggestions" value={form.language} onChange={event => set("language", event.target.value)} maxLength={40} autoComplete="off" required autoFocus disabled={busy} placeholder="For example: French" />
          <datalist id="language-suggestions">{COMMON.map(name => <option key={name} value={name} />)}</datalist>
        </label>
        <label>Your level
          <select value={form.level} onChange={event => set("level", event.target.value as LanguageLevel)} required disabled={busy}>
            <option value="">Choose…</option>
            {LEVELS.map(level => <option key={level} value={level}>{levelLabel(level)} · {levelInfo[level]}</option>)}
          </select>
        </label>
        <label><span>Test result <small>(optional)</small></span>
          <select value={form.test} onChange={event => set("test", event.target.value as LanguageTest | "")} disabled={busy}>
            <option value="">No test</option>
            {TEST_IDS.map(test => <option key={test} value={test}>{TESTS[test].label}</option>)}
          </select>
        </label>
        {form.test && <>
          <label>Score or level
            <input value={form.score} onChange={event => set("score", event.target.value)} maxLength={20} autoComplete="off" disabled={busy} placeholder={TESTS[form.test].hint} aria-describedby="language-score-hint" />
          </label>
          <label>Test date
            <input type="date" value={form.testDate} onChange={event => set("testDate", event.target.value)} max={new Date().toISOString().slice(0, 10)} disabled={busy} />
          </label>
        </>}
      </div>
      {form.test && <p id="language-score-hint" className="muted-note">{TESTS[form.test].hint}.</p>}
      <ScoreHint level={form.level} test={form.test} score={form.score} testDate={form.testDate} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="language-form-actions">
        <button type="button" className="text-button" onClick={() => { setForm(null); setError(""); }} disabled={busy}>Cancel</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : form.id ? "Save changes" : "Add language"}</button>
      </div>
      {form.id && <p className="muted-note">Changing a language after sending proof means the proof must be checked again.</p>}
    </form>}
  </section>;
}
