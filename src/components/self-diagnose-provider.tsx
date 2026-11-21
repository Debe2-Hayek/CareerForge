"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { installSelfDiagnosis } from "@/lib/self-diagnose";

export function SelfDiagnoseProvider() {
  const pathname = usePathname();
  useEffect(() => installSelfDiagnosis(), []);
  useEffect(() => {
    if (document.querySelector("[data-self-diagnose-not-found]")) {
      window.dispatchEvent(new Event("careerforge:not-found"));
    }
  }, [pathname]);
  return null;
}
