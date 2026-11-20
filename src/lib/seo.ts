import type { Metadata } from "next";

export const privatePageMetadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true }
  }
} satisfies Metadata;
