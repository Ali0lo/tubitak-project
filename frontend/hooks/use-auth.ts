"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginRequest, RegisterRequest, TokenResponse, User } from "@/types";

/** Read-only view of the current session. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return {
    user,
    isAuthenticated: Boolean(accessToken && user),
    isReady: hasHydrated,
  };
}

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: (payload: LoginRequest) =>
      apiClient.post<TokenResponse>("/api/v1/auth/login", payload, {
        skipAuth: true,
      }),
    onSuccess: async (tokens) => {
      // Set the token first so the /me request below is authenticated.
      setAccessToken(tokens.access_token);
      const user = await apiClient.get<User>("/api/v1/auth/me");
      setSession(user, tokens.access_token);
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterRequest) =>
      apiClient.post<User>("/api/v1/auth/register", payload, {
        skipAuth: true,
      }),
    onSuccess: () => {
      router.push("/login?registered=1");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<void>("/api/v1/auth/logout"),
    onSettled: () => {
      clearSession();
      queryClient.clear();
      router.push("/login");
    },
  });
}

export function useVerifyEmail() {
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);

  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<User>(
        "/api/v1/auth/verify-email",
        { token },
        { skipAuth: true }
      ),
    onSuccess: (updatedUser) => {
      if (accessToken) {
        setSession(updatedUser, accessToken);
      }
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.post<{ message: string }>(
        "/api/v1/auth/resend-verification",
        { email },
        { skipAuth: true }
      ),
  });
}

