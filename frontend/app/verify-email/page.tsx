"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { verifyEmail } from "@/lib/auth";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<
    "loading" | "success" | "error"
  >("loading");

  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified.");

        setTimeout(() => {
          router.push("/login");
        }, 2500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-seal border border-paper-line bg-paper-raised p-8 text-center shadow-ledger">
        <h1 className="mb-4 font-display text-2xl text-ink">
          Email Verification
        </h1>

        {status === "loading" && (
          <p className="text-ink-muted">{message}</p>
        )}

        {status === "success" && (
          <>
            <p className="text-green-600">{message}</p>
            <p className="mt-2 text-sm text-ink-muted">
              Redirecting to login...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-red-600">{message}</p>

            <button
              className="mt-6 rounded bg-forest px-4 py-2 text-white"
              onClick={() => router.push("/login")}
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}