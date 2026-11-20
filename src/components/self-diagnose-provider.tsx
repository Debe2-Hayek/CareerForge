"use client";

import { useEffect } from "react";
import { installSelfDiagnosis } from "@/lib/self-diagnose";

export function SelfDiagnoseProvider() {
  useEffect(() => installSelfDiagnosis(), []);
  return null;
}
