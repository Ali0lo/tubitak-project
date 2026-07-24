"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Mail, ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";

import { useVerifyEmail, useResendVerification, useAuth } from "@/hooks/use-auth";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const verifyEmail = useVerifyEmail();
  const resend = useResendVerification();

  const [tokenInput, setTokenInput] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");

  const urlToken = searchParams?.get("token");

  useEffect(() => {
    if (urlToken) {
      setTokenInput(urlToken);
      handleVerify(urlToken);
    }
  }, [urlToken]);

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || tokenInput;
    if (!code.trim()) return;

    try {
      await verifyEmail.mutateAsync(code.trim());
      setSuccessMessage("Email verified successfully! Redirecting...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      // Error handled via mutation state
    }
  };

  const handleResend = async () => {
    const emailToUse = user?.email;
    if (!emailToUse) return;

    try {
      await resend.mutateAsync(emailToUse);
      setResendSuccess(`Verification token sent to ${emailToUse}`);
    } catch {
      // Handled
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="bg-paper-raised border border-paper-line rounded-2xl shadow-xl p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-forest-tint text-forest">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl text-ink">Verify Your Email</h1>
          <p className="text-xs text-ink-muted">
            Enter your email verification token below to verify your Todotak account.
          </p>
        </div>

        {user?.is_verified ? (
          <div className="bg-forest-tint p-4 rounded-xl border border-forest/20 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 text-forest mx-auto" />
            <p className="text-sm font-semibold text-forest">Your email is already verified!</p>
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 text-xs font-medium text-paper bg-forest hover:bg-forest-dark rounded-seal transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-4"
          >
            {successMessage && (
              <div className="p-3 bg-forest-tint border border-forest/20 rounded-xl text-forest text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {verifyEmail.isError && (
              <div className="p-3 bg-brick-tint border border-brick/20 rounded-xl text-brick text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{(verifyEmail.error as any)?.detail || "Invalid or expired verification token."}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1 flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" /> Verification Token / Code
              </label>
              <input
                type="text"
                required
                placeholder="Paste token or enter verification code"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full bg-paper text-ink text-sm p-3 rounded-xl border border-paper-line focus-ring font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={verifyEmail.isPending}
              className="w-full py-3 text-xs font-semibold text-paper bg-forest hover:bg-forest-dark rounded-seal transition-colors focus-ring"
            >
              {verifyEmail.isPending ? "Verifying..." : "Verify Account"}
            </button>

            {user?.email && (
              <div className="pt-2 text-center space-y-2 border-t border-paper-line">
                {resendSuccess ? (
                  <p className="text-xs text-forest font-medium">{resendSuccess}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resend.isPending}
                    className="text-xs text-ink-muted hover:text-ink underline"
                  >
                    {resend.isPending ? "Sending token..." : `Resend token to ${user.email}`}
                  </button>
                )}
              </div>
            )}
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-ink-muted">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
