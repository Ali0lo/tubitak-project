import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Todotak</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink-faint">
            your day, kept
          </p>
        </div>
        <div className="rounded-seal border border-paper-line bg-paper-raised p-6 shadow-ledger">
          <h1 className="mb-6 font-display text-xl text-ink">Sign in</h1>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-forest hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
