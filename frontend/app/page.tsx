"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isReady, isAuthenticated, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <Spinner label="Loading Todotak" />
    </div>
  );
}
