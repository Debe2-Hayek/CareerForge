"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { BrandMark } from "./career-visuals";
import { ThemeToggle } from "./theme-toggle";
import { hasStrongPasswordShape, PASSWORD_REQUIREMENTS } from "@/lib/account/password-policy";
import { PasswordField } from "./password-field";

const subscribeReady = () => () => {};

export function AccountRecovery({ mode, sessionReady = true }: { mode: "forgot" | "resend" | "reset"; sessionReady?: boolean }) {
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const cooling = wait > 0;
  useEffect(() => {
    if (!cooling) return;
    const timer = setInterval(() => setWait(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooling]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || cooling) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const chosen = String(fields.get("password") ?? "");
    if (mode === "reset" && !hasStrongPasswordShape(chosen)) {
      setError(PASSWORD_REQUIREMENTS);
      (form.elements.namedItem("password") as HTMLInputElement)?.focus();
      return;
    }
    if (mode === "reset" && chosen !== String(fields.get("confirmPassword"))) { setError("Your passwords do not match."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const endpoint = mode === "reset" ? "password" : mode === "forgot" ? "forgot-password" : "resend-confirmation";
      const response = await fetch(`/api/v1/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify(mode === "reset" ? { password: chosen } : { email: String(fields.get("email") ?? "").trim() })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) setWait(Math.max(1, Math.min(3600, Number(response.headers.get("Retry-After")) || 60)));
        setError(result.error?.message ?? "Unable to continue. Please try again."); return;
      }
      if (mode === "reset") { form.reset(); setPassword(""); setRepeat(""); setDone(true); setMessage("Your password has been updated. You can now open your account or sign in with your new password."); }
      else { setWait(60); setMessage("If this address is eligible, a new email will arrive. Open only the newest link in this browser. Check spam too."); }
    } catch { setError("The request could not be confirmed. Check your inbox before trying again."); }
    finally { setPending(false); }
  }
  const title = mode === "reset" ? "Choose a new password." : mode === "forgot" ? "Get back to your account." : "Confirm your email.";
  return <div className="account-page"><header className="account-header"><Link className="brand" href="/"><BrandMark />CareerForge.</Link><div className="account-header-actions"><ThemeToggle /><Link className="text-button" href="/login">Back to sign in</Link></div></header><main className="auth-layout"><section className="auth-story"><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>Your next step<br />starts here.</h1><p>Recover access to your private profile and saved opportunities.</p></section><section className="panel auth-panel"><p className="eyebrow">ACCOUNT RECOVERY</p><h2>{title}</h2>
    {mode === "reset" && !sessionReady ? <div className="confirmation"><h3>A reset link is needed</h3><p>Request a new password reset email and open its newest link in this browser.</p><Link className="button primary" href="/forgot-password">Request reset link</Link></div> : <>
      <p className="auth-intro">{mode === "reset" ? "Use 12–128 characters with lowercase, uppercase, a number and a symbol. Known breached passwords are rejected using a private partial-hash check." : mode === "forgot" ? "Enter your registered email to request a password reset link." : "Request a fresh confirmation link for your registered email. If you already confirmed it, return to sign in or reset your password."}</p>
      {!done && <form className="form-grid" method="post" onSubmit={submit} onInput={() => { if (error) setError(""); }}>{mode === "reset" ? <><PasswordField name="password" label="New password" autoComplete="new-password" disabled={!ready} minLength={12} checklist value={password} onValue={setPassword} /><PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" disabled={!ready} minLength={12} matches={password} value={repeat} onValue={setRepeat} /></> : <label className="full-field">Email address<input disabled={!ready} name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
      <button className="button primary full-field" type="submit" disabled={!ready || pending || cooling}>{pending ? "Please wait…" : cooling ? `Request again in ${wait}s` : mode === "reset" ? "Update password" : mode === "forgot" ? "Send reset link" : "Send confirmation link"}</button></form>}
      {message && <p className="confirmation" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
      {done && <Link className="button primary" href="/account">Open your account</Link>}
    </>}
    <div className="auth-recovery-links"><Link href="/login">Sign in</Link>{mode !== "forgot" && <Link href="/forgot-password">Reset your password</Link>}{mode !== "resend" && <Link href="/confirm-email">Request confirmation</Link>}</div>
    <p className="muted-note">Keep CareerForge running. Use the same device, browser and website address to request and open the link. No account data is deleted.</p>
  </section></main></div>;
}
