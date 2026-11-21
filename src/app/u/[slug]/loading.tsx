import "./published-site.css";

// Neutral placeholder: visitors to a personal site should not see the workspace's "Loading CareerForge" screen.
export default function Loading() {
  return <main className="published-site published-site-loading" aria-busy="true"><span className="sr-only">Loading portfolio</span></main>;
}
