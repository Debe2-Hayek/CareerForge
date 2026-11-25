"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { hasStrongPasswordShape, PASSWORD_REQUIREMENTS } from "@/lib/account/password-policy";
import { PasswordField } from "./password-field";

/** A greeting for the time of day on this device. */
function greeting(hour: number) {
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const subscribeReady = () => () => {};

export function AuthForm({ mode, callbackMessage }: { mode: "login" | "register"; callbackMessage?: string }) {
  const registering = mode === "register";
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  // Only after the page is running here, so the server and the browser agree on the first paint.
  const hello = ready ? greeting(new Date().getHours()) : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    if (registering && !hasStrongPasswordShape(password)) {
      setMessage(PASSWORD_REQUIREMENTS);
      (event.currentTarget.elements.namedItem("password") as HTMLInputElement)?.focus();
      return;
    }
    if (registering && password !== repeat) {
      setMessage("Passwords do not match. Enter the same password in both fields.");
      (event.currentTarget.elements.namedItem("confirmPassword") as HTMLInputElement)?.focus();
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(fields.get("email") ?? "").trim(), password }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message ?? "Unable to continue. Please try again."); return; }
      if (result.confirmationRequired) { setConfirmation(true); return; }
      router.replace("/account");
      router.refresh();
    } catch { setMessage("Unable to connect. Check your connection and try again."); }
    finally { setPending(false); }
  }
  return <div className="auth-form-content">
        <p className="eyebrow auth-hello">{hello ? <><span className="auth-wave" aria-hidden="true">👋</span>{`${hello.toUpperCase()}${registering ? ", NICE TO MEET YOU" : ", WELCOME BACK"}`}</> : registering ? "NEW TO CAREERFORGE" : "ALREADY HAVE AN ACCOUNT"}</p>
        <h2 id="auth-title">{registering ? "Create your account" : "Sign in to CareerForge"}</h2>
        <p className="auth-intro">{registering ? "Two minutes, then your private workspace is ready. You may need to confirm your email first." : "Pick up right where you left off."}</p>
        {callbackMessage && <p className="form-error" role="alert">{callbackMessage}</p>}
        {confirmation ? <div role="status" className="confirmation">
          <h3>Check your email</h3>
          <p>If registration can proceed, a confirmation link will be sent to your email. Open the newest link in this browser, then sign in. Already registered? Use your existing password to sign in.</p>
          <Link className="text-button" href="/confirm-email">Request a new confirmation</Link>
          <Link className="button primary" href="/login" scroll={false}>Go to sign in <span aria-hidden="true">&#8599;</span></Link>
        </div> : <form className="form-grid" method="post" onSubmit={submit} onInput={() => { if (message) setMessage(""); }} aria-busy={pending}>
          <label className="full-field">Email address<input disabled={!ready || pending} type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required maxLength={254} /></label>
          <PasswordField name="password" label="Password" autoComplete={registering ? "new-password" : "current-password"} disabled={!ready || pending} minLength={registering ? 12 : 1}
            checklist={registering} value={password} onValue={setPassword} describedBy={registering ? "password-help" : undefined} />
          {registering && <small id="password-help" className="full-field auth-help">Known breached passwords are refused, checked privately with a partial-hash lookup.</small>}
          {registering && <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" disabled={!ready || pending} minLength={12} matches={password} value={repeat} onValue={setRepeat} />}
          {message && <p className="form-error full-field" role="alert">{message}</p>}
          <button className="button primary full-field" disabled={!ready || pending} type="submit">{pending ? registering ? "Creating account..." : "Signing in..." : registering ? "Create account" : "Sign in"}</button>
        </form>}
        <p className="auth-switch">{registering ? "Already have an account? " : "New to CareerForge? "}<Link href={registering ? "/login" : "/register"} scroll={false}>{registering ? "Sign in" : "Create an account"}</Link></p>
        {!registering && <div className="auth-recovery-links"><Link href="/forgot-password">Forgot your password?</Link><Link href="/confirm-email">Need a new confirmation?</Link></div>}
        <p className="muted-note">Your profile stays private. You choose what to publish or share.</p>
  </div>;
}
