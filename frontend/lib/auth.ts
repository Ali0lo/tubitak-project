const API_BASE =
  process.env.NEXT_PUBLIC_AUTH_API ??
  "http://localhost:8001/api/v1/auth";

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail ?? "Request failed");
  }

  return data;
}

export async function register(payload: {
  full_name: string;
  email: string;
  password: string;
}) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: {
  email: string;
  password: string;
}) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string) {
  return request(`/verify-email?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
}

export async function resendVerification(email: string) {
  return request("/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}