import styles from "./learning.module.css";

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return <div>
    <div className={styles.progressLabel}><span>{label}</span><span>{value}%</span></div>
    <div className={styles.progressBar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </div>
  </div>;
}

export function ProgressRing({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
    <circle cx="38" cy="38" r={radius} fill="none" stroke="#2a3424" strokeWidth="8" />
    <circle cx="38" cy="38" r={radius} fill="none" stroke="#c5ed85" strokeWidth="8" strokeLinecap="round"
      strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} transform="rotate(-90 38 38)" />
  </svg>;
}
