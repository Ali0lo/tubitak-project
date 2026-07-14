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
    login.mutate({ email, password });
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.detail
      : login.error
        ? "Something went wrong. Please try again."
        : null;

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
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-brick">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" isLoading={login.isPending} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
