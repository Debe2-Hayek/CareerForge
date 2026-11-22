import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const noIndexSources = [
  "/api/:path*",
  "/auth/:path*",
  "/login",
  "/register",
  "/forgot-password",
  "/confirm-email",
  "/reset-password",
  "/dashboard",
  "/account/:path*",
  "/profile",
  "/features",
  "/career-analysis",
  "/skill-checks",
  "/academic-planner",
  "/learning-roadmap",
  "/learning-roadmap/:path*",
  "/roadmap",
  "/workshops",
  "/projects",
  "/documents",
  "/cv-analysis",
  "/cv/:path*",
  "/portfolio/:path*",
  "/jobs",
  "/applications",
  "/application-agent",
  "/application-insights",
  "/career-assistant",
  "/graduation-simulator",
  "/p/:path*",
  "/u/:path*"
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd()
  },
  experimental: {
    agentUpgrade: "security"
  },
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" }
      ] },
      { source: "/media/workshops/:file", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      ...noIndexSources.map(source => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
      }))
    ];
  },
  // Trust this computer's actual LAN addresses for development assets/HMR.
  // This does not loosen origin checks for account/profile API mutations.
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap(addresses =>
    addresses?.filter(address => !address.internal && address.family === "IPv4").map(address => address.address) ?? []
  )
};

export default nextConfig;
