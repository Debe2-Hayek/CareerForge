import Link from "next/link";
import { getPlannedFeature } from "@/lib/features";
import { AppIcon } from "./app-shell";
import { FeatureWorkspace } from "./feature-workspace";

export function PlannedFeaturePage({ id }: { id: string }) {
  const feature = getPlannedFeature(id);
  return <FeatureWorkspace title={feature.label}><div className="feature-page planned-feature">
    <Link href="/features" className="feature-back">&#8592; All features</Link>
    <header className="feature-heading"><div className="feature-kicker"><span className="feature-icon"><AppIcon name={feature.icon} /></span><span className="eyebrow">{feature.module} / {feature.group}</span><span className={`feature-status status-${feature.status.toLowerCase()}`}>{feature.status}</span></div><h1>{feature.label}<span className="feature-heading-dot">.</span></h1><p>{feature.description}</p></header>
    <div className="feature-detail-grid"><section className="feature-workflow" aria-labelledby="workflow-title"><p className="eyebrow">THE INTENDED WORKFLOW</p><h2 id="workflow-title">A clear path forward.</h2><ol>{feature.steps.map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span><p>{step}</p></li>)}</ol></section><aside className="feature-readiness"><span className="feature-readiness-symbol" aria-hidden="true"><AppIcon name="checks" /></span><h2>{feature.status === "Stretch" ? "After the core experience." : "Designed. Still to be built."}</h2><p>{feature.prerequisite}</p><p className="feature-readiness-note">This page describes planned scope. It does not run this feature or generate results.</p><Link className="button primary" href={feature.startHref}>{feature.startLabel}<AppIcon name="arrow" /></Link></aside></div>
    <footer className="feature-page-footer"><span>One profile. Connected tools. Clear ownership.</span><Link href="/features">Explore the platform <span aria-hidden="true">&#8599;</span></Link></footer>
  </div></FeatureWorkspace>;
}
