import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkspaceEngine - Block-Based Collaborative Workspace",
  description:
    "Production-grade, extensible block-based workspace platform with real-time CRDT collaboration, nested page hierarchies, and instant fuzzy search.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
