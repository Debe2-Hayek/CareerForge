import type { DiagnosticSignal } from "./product-signals";

const endpoint = "/api/v1/diagnostics";
const slowEndpointMs = 1000;
const knownRouteRoots = new Set([
  "academic-planner", "account", "api", "application-agent", "application-insights", "applications", "auth",
  "career-analysis", "career-assistant", "confirm-email", "cv", "cv-analysis", "dashboard", "documents", "features",
  "forgot-password", "graduation-simulator", "jobs", "learning-roadmap", "p", "portfolio", "profile", "projects",
  "reset-password", "roadmap", "skill-checks", "workshops"
]);

export function normalizeDiagnosticRoute(pathname: string) {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/\d{3,}(?=\/|$)/g, "/:id")
    .slice(0, 160);
}

export function normalizeNotFoundRoute(pathname: string) {
  const [root] = normalizeDiagnosticRoute(pathname).split("/").filter(Boolean);
  return root && knownRouteRoots.has(root) ? `/${root}/*` : "/*";
}

export function fingerprintDiagnostic(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function currentRoute() { return normalizeDiagnosticRoute(window.location.pathname); }

export function installSelfDiagnosis() {
  const lastSent = new Map<string, number>();
  const clicks: Array<{ x: number; y: number; at: number }> = [];
  const emptySearches: number[] = [];
  const flows = new Map<string, number>();

  function record(signal: Omit<DiagnosticSignal, "fingerprint">, fingerprintContext = "") {
    const fingerprint = fingerprintDiagnostic(`${signal.kind}|${signal.route}|${signal.label}|${fingerprintContext}`);
    const now = Date.now();
    if ((lastSent.get(fingerprint) ?? 0) > now - 60_000) return;
    lastSent.set(fingerprint, now);
    const body = JSON.stringify({ ...signal, fingerprint });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  const onError = (event: ErrorEvent) => {
    let source = "unknown";
    try { if (event.filename) source = normalizeDiagnosticRoute(new URL(event.filename, window.location.href).pathname); } catch {}
    record({ kind: "ui-error", route: currentRoute(), label: "Unhandled UI error" }, `${event.error?.name ?? "Error"}|${source}|${event.lineno ?? 0}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const name = event.reason instanceof Error ? event.reason.name : typeof event.reason;
    record({ kind: "promise-rejection", route: currentRoute(), label: "Unhandled promise rejection" }, name);
  };
  const onClick = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const now = Date.now();
    clicks.push({ x: event.clientX, y: event.clientY, at: now });
    while (clicks.length && clicks[0].at < now - 1200) clicks.shift();
    if (clicks.length < 4) return;
    const first = clicks[0];
    if (clicks.every(click => Math.hypot(click.x - first.x, click.y - first.y) <= 32)) {
      record({ kind: "rage-click", route: currentRoute(), label: "Rage click pattern" });
      clicks.length = 0;
    }
  };
  const onEmptySearch = () => {
    const now = Date.now();
    emptySearches.push(now);
    while (emptySearches.length && emptySearches[0] < now - 30_000) emptySearches.shift();
    if (emptySearches.length >= 3) {
      record({ kind: "empty-search", route: currentRoute(), label: "Repeated empty search" });
      emptySearches.length = 0;
    }
  };
  const onNotFound = () => {
    record({ kind: "not-found", route: normalizeNotFoundRoute(window.location.pathname), label: "404 dead end" });
  };
  const onFlowStart = (event: Event) => {
    const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
    if (typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id)) flows.set(id, Date.now());
  };
  const onFlowEnd = (event: Event) => {
    const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
    if (typeof id === "string") flows.delete(id);
  };
  const onPageHide = () => {
    const now = Date.now();
    for (const [id, startedAt] of flows) if (startedAt < now - 15_000) {
      record({ kind: "abandoned-flow", route: currentRoute(), label: "Abandoned flow", durationMs: Math.min(now - startedAt, 120_000) }, id);
    }
  };

  const originalFetch = window.fetch.bind(window);
  const diagnosedFetch: typeof window.fetch = async (...args) => {
    const startedAt = performance.now();
    let url: URL | null = null;
    try {
      const input = args[0];
      const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
      url = new URL(raw, window.location.href);
    } catch {}
    const observed = url?.origin === window.location.origin && url.pathname.startsWith("/api/v1/")
      && url.pathname !== endpoint && url.pathname !== "/api/v1/roadmap-feedback";
    try {
      const response = await originalFetch(...args);
      if (observed && url) {
        const durationMs = Math.round(performance.now() - startedAt);
        const route = normalizeDiagnosticRoute(url.pathname);
        if (response.status >= 500) record({ kind: "api-error", route, label: "API error response", durationMs }, String(response.status));
        if (durationMs > slowEndpointMs) record({ kind: "slow-api", route, label: "Slow API response", durationMs }, response.type);
      }
      return response;
    } catch (error) {
      if (observed && url) record({ kind: "api-error", route: normalizeDiagnosticRoute(url.pathname), label: "API error response", durationMs: Math.min(Math.round(performance.now() - startedAt), 120_000) }, "network");
      throw error;
    }
  };
  window.fetch = diagnosedFetch;
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pointerdown", onClick, { passive: true });
  window.addEventListener("careerforge:empty-search", onEmptySearch);
  window.addEventListener("careerforge:not-found", onNotFound);
  window.addEventListener("careerforge:flow-start", onFlowStart);
  window.addEventListener("careerforge:flow-complete", onFlowEnd);
  window.addEventListener("careerforge:flow-cancel", onFlowEnd);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    if (window.fetch === diagnosedFetch) window.fetch = originalFetch;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pointerdown", onClick);
    window.removeEventListener("careerforge:empty-search", onEmptySearch);
    window.removeEventListener("careerforge:not-found", onNotFound);
    window.removeEventListener("careerforge:flow-start", onFlowStart);
    window.removeEventListener("careerforge:flow-complete", onFlowEnd);
    window.removeEventListener("careerforge:flow-cancel", onFlowEnd);
    window.removeEventListener("pagehide", onPageHide);
  };
}
