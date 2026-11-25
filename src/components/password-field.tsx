"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_SYMBOLS } from "@/lib/account/password-policy";

/** What a new password still needs, in the order people usually type. */
export function passwordChecks(password: string) {
  return [
    { id: "length", label: `${PASSWORD_MIN_LENGTH}+ characters`, met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { id: "lower", label: "a lowercase letter", met: /[a-z]/.test(password) },
    { id: "upper", label: "an uppercase letter", met: /[A-Z]/.test(password) },
    { id: "number", label: "a number", met: /[0-9]/.test(password) },
    { id: "symbol", label: "a symbol", met: [...password].some(character => PASSWORD_SYMBOLS.includes(character)) }
  ];
}

type Props = {
  name: string; label: string; autoComplete: string; disabled?: boolean; minLength?: number;
  /** Show the live checklist for a new password. */ checklist?: boolean;
  /** Another field's value this one must match ("Passwords match"). */ matches?: string;
  value: string; onValue: (value: string) => void; describedBy?: string;
};

/**
 * A password input with a show/hide button and a Caps Lock warning. For new passwords it shows a
 * checklist that ticks as you type, and the confirmation field says when both match.
 */
export function PasswordField({ name, label, autoComplete, disabled, minLength, checklist, matches, value, onValue, describedBy }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const checks = checklist ? passwordChecks(value) : [];
  const met = checks.filter(check => check.met).length;
  const capsCheck = (event: KeyboardEvent<HTMLInputElement>) => setCaps(event.getModifierState?.("CapsLock") ?? false);
  const help = [describedBy, checklist ? `${id}-checks` : null, matches !== undefined ? `${id}-match` : null, caps ? `${id}-caps` : null].filter(Boolean).join(" ") || undefined;
  return <div className="full-field password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-box">
      <input id={id} name={name} aria-label={label} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} maxLength={PASSWORD_MAX_LENGTH}
        disabled={disabled} value={value} onChange={event => onValue(event.target.value)} onKeyUp={capsCheck} onKeyDown={capsCheck} onBlur={() => setCaps(false)} aria-describedby={help} spellCheck={false} />
      <button type="button" className="password-toggle" onClick={() => setVisible(shown => !shown)} aria-pressed={visible} disabled={disabled} title={visible ? "Hide password" : "Show password"}>
        <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
    {caps && <small id={`${id}-caps`} className="password-caps" role="status">Caps Lock is on</small>}
    {checklist && <div className="password-meter" aria-hidden="true"><span style={{ width: `${(met / checks.length) * 100}%` }} data-level={met <= 2 ? "low" : met < checks.length ? "mid" : "high"} /></div>}
    {checklist && <ul id={`${id}-checks`} className="password-checks" aria-label="Password needs">
      {checks.map(check => <li key={check.id} data-met={check.met || undefined}><span aria-hidden="true">{check.met ? "✓" : "·"}</span>{check.label}<span className="sr-only">{check.met ? " (done)" : " (still needed)"}</span></li>)}
    </ul>}
    {matches !== undefined && value && <small id={`${id}-match`} className={`password-match${value === matches ? " is-match" : ""}`} role="status">{value === matches ? "✓ Passwords match" : "Passwords don't match yet"}</small>}
  </div>;
}
