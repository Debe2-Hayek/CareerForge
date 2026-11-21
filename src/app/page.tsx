import type { Metadata } from "next";
import { PublicHome } from "@/components/public-home";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, noimageindex: false }
  }
};

export default function Home() { return <PublicHome />; }
