"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/** Wraps every authenticated page: enforces login and renders the shell. */
export function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
