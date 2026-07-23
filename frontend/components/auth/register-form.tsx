"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const register = useRegister();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setMismatchError("Passwords don't match.");
      return;
    }

    setMismatchError(null);

    register.mutate(
      {
        email,
        full_name: fullName,
        password,
      },
      {
        onSuccess: () => {
          setVerificationSent(true);
        },
      }
    );
  };

  const apiErrorMessage =
    register.error instanceof ApiError
      ? register.error.detail
      : register.error
        ? "Something went wrong. Please try again."
        : null;

  if (verificationSent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-green-600">
          Registration Successful!
        </h2>

        <p className="text-sm text-ink-muted">
          We've sent a verification email to:
        </p>

        <p className="font-medium">{email}</p>

        <p className="text-sm text-ink-muted">
          Please verify your email before signing in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm text-ink-muted">
          Full name
        </label>

        <Input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-ink-muted">
          Email
        </label>

        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-ink-muted">
          Password
        </label>

        <Input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="confirm_password" className="mb-1 block text-sm text-ink-muted">
          Confirm password
        </label>

        <Input
          id="confirm_password"
          type="password"
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {(mismatchError || apiErrorMessage) && (
        <p className="text-sm text-brick">
          {mismatchError ?? apiErrorMessage}
        </p>
      )}

      <Button
        type="submit"
        isLoading={register.isPending}
      >
        Create account
      </Button>
    </form>
  );
}