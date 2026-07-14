import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
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
          <h1 className="mb-6 font-display text-xl text-ink">
            Create your account
          </h1>
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-forest hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
