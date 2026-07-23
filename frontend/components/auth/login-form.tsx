"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useLogin();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({
      email,
      password,
    });
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.detail
      : login.error
        ? "Something went wrong. Please try again."
        : null;

  const emailNotVerified =
    errorMessage?.toLowerCase().includes("verify") ||
    errorMessage?.toLowerCase().includes("not verified");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-ink-muted">
          Email
        </label>

        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-ink-muted">
          Password
        </label>

        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {errorMessage && (
        <div className="space-y-2">
          <p className="text-sm text-brick">
            {errorMessage}
          </p>

          {emailNotVerified && (
            <p className="text-xs text-amber-600">
              Please verify your email before signing in.
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        isLoading={login.isPending}
      >
        Sign in
      </Button>
    </form>
  );
}