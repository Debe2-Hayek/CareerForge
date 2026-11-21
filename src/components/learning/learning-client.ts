"use client";

import type { EnrollmentInput, ProgressInput } from "@/lib/learning/api";

export type SaveResult = { ok: true } | { ok: false; message: string };

async function put(path: string, body: EnrollmentInput | ProgressInput | { courseId: string; confirm: true }, method = "PUT"): Promise<SaveResult> {
  try {
    const response = await fetch(`/api/v1/learning/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.ok) return { ok: true };
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error
      ? String(payload.error.message)
      : "Your change could not be saved. Please retry.";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "You appear to be offline. Your change was not saved." };
  }
}

export const saveEnrollment = (input: EnrollmentInput) => put("enrollments", input);
export const saveProgress = (input: ProgressInput) => put("progress", input);
export const resetProgress = (courseId: string) => put("reset", { courseId, confirm: true }, "POST");
