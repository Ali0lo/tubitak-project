"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AlertTriangle, MailCheck, X } from "lucide-react";
import Link from "next/link";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, useResendVerification } from "@/hooks/use-auth";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/** Wraps every authenticated page: enforces login and renders the shell. */
export function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();
  const { user, isAuthenticated, isReady } = useAuth();
  const resend = useResendVerification();
  const [resendSent, setResendSent] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  const handleResend = async () => {
    if (!user?.email) return;
    try {
      await resend.mutateAsync(user.email);
      setResendSent(true);
    } catch {
      // Handled
    }
  };

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  const showVerificationBanner = user && !user.is_verified && !isBannerDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />

        {showVerificationBanner && (
          <div className="bg-amber-tint border-b border-amber/20 px-8 py-2.5 flex items-center justify-between text-xs text-amber-dark font-medium animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-dark" />
              <span>
                Your email address (<strong>{user.email}</strong>) is not verified yet.
              </span>
            </div>

            <div className="flex items-center gap-3">
              {resendSent ? (
                <span className="text-forest font-semibold flex items-center gap-1">
                  <MailCheck className="h-3.5 w-3.5" /> Verification code sent!
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resend.isPending}
                  className="underline hover:text-amber-dark font-semibold focus-ring"
                >
                  {resend.isPending ? "Sending..." : "Resend Verification Code"}
                </button>
              )}

              <Link
                href="/verify-email"
                className="px-2.5 py-1 rounded bg-amber text-paper hover:bg-amber-dark font-semibold text-[11px] transition-colors"
              >
                Verify Now
              </Link>

              <button
                type="button"
                onClick={() => setIsBannerDismissed(true)}
                className="text-amber-dark/70 hover:text-amber-dark p-0.5"
                title="Dismiss banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
