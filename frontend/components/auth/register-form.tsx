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
  const register = useRegister();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMismatchError("Passwords don't match.");
      return;
    }
    setMismatchError(null);
    register.mutate({ email, full_name: fullName, password });
  };

  const apiErrorMessage =
    register.error instanceof ApiError
      ? register.error.detail
      : register.error
        ? "Something went wrong. Please try again."
        : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm text-ink-muted">
          Full name
        </label>
        <Input
          id="full_name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>
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
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-ink-muted"
        >
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1 block text-sm text-ink-muted"
        >
          Confirm password
        </label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {mismatchError || apiErrorMessage ? (
        <p role="alert" className="text-sm text-brick">
          {mismatchError ?? apiErrorMessage}
        </p>
      ) : null}
      <Button type="submit" isLoading={register.isPending} className="mt-2">
        Create account
      </Button>
    </form>
  );
}
