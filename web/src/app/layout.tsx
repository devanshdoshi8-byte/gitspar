import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "GitSpar — Verified Change Understanding for AI-Assisted Code",
  description:
    "An editor-agnostic diagnostic gatekeeper that transforms AI-generated code changes into executable comprehension drills.",
  keywords: [
    "gitspar",
    "ai code review",
    "mutation testing",
    "clean-room verification",
    "vitest",
    "ast mutation",
    "pull request guard",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
