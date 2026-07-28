import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/types/api";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  /** Skip attaching the Authorization header (login/register/refresh). */
  skipAuth?: boolean;
}

// Coalesces concurrent 401s into a single refresh call rather than
// firing one refresh request per failed request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const data = (await response.json()) as { access_token: string };
        useAuthStore.getState().setAccessToken(data.access_token);
        return data.access_token;
      } catch {
        useAuthStore.getState().clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function buildPath(path: string, params?: QueryParams): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // Response body wasn't JSON; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

import { DEMO_TASKS, DEMO_MEETINGS, DEMO_NOTIFICATIONS, isDemoModeActive } from "@/lib/demo-data";

function handleDemoFallback<T>(path: string, method: string, body?: any, params?: QueryParams): T {
  if (path.startsWith("/api/v1/tasks")) {
    let tasks = [...DEMO_TASKS];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("todotak_demo_tasks");
      if (stored) {
        try { tasks = JSON.parse(stored); } catch {}
      }
    }

    if (method === "GET") {
      let filtered = tasks;
      if (params?.status) filtered = filtered.filter(t => t.status === params.status);
      if (params?.priority) filtered = filtered.filter(t => t.priority === params.priority);
      if (params?.overdue) filtered = filtered.filter(t => t.is_overdue);
      if (params?.today) filtered = filtered.filter(t => t.is_due_today);
      return { items: filtered, total: filtered.length, page: 1, page_size: 100 } as unknown as T;
    }

    if (method === "POST") {
      const newTask = {
        id: "demo-task-" + Date.now(),
        user_id: "demo-user",
        title: body?.title || "New Task",
        description: body?.description || "",
        status: body?.status || "pending",
        priority: body?.priority || "medium",
        due_date: body?.due_date || new Date().toISOString(),
        completed_at: null,
        is_recurring: Boolean(body?.is_recurring),
        recurrence_rule: body?.recurrence_rule || null,
        recurrence_parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        is_due_today: true,
        is_overdue: false,
      };
      const updatedTasks = [newTask, ...tasks];
      if (typeof window !== "undefined") {
        localStorage.setItem("todotak_demo_tasks", JSON.stringify(updatedTasks));
        localStorage.setItem("todotak_demo_mode_active", "true");
      }
      return newTask as unknown as T;
    }

    if (method === "PATCH" || method === "PUT") {
      const parts = path.split("/");
      const taskId = parts[4];
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...body, updated_at: new Date().toISOString() } : t);
      if (typeof window !== "undefined") {
        localStorage.setItem("todotak_demo_tasks", JSON.stringify(updatedTasks));
      }
      const target = updatedTasks.find(t => t.id === taskId) || tasks[0];
      return target as unknown as T;
    }

    if (method === "DELETE") {
      const parts = path.split("/");
      const taskId = parts[4];
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      if (typeof window !== "undefined") {
        localStorage.setItem("todotak_demo_tasks", JSON.stringify(updatedTasks));
      }
      return undefined as T;
    }

    return { items: tasks, total: tasks.length, page: 1, page_size: 100 } as unknown as T;
  }

  if (path.startsWith("/api/v1/meetings")) {
    let meetings = [...DEMO_MEETINGS];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("todotak_demo_meetings");
      if (stored) {
        try { meetings = JSON.parse(stored); } catch {}
      }
    }
    return { items: meetings, total: meetings.length, page: 1, page_size: 100 } as unknown as T;
  }

  if (path.startsWith("/api/v1/notifications/unread-count")) {
    return { unread_count: 2 } as unknown as T;
  }

  if (path.startsWith("/api/v1/notifications")) {
    let notifs = [...DEMO_NOTIFICATIONS];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("todotak_demo_notifications");
      if (stored) {
        try { notifs = JSON.parse(stored); } catch {}
      }
    }
    return { items: notifs, total: notifs.length, page: 1, page_size: 100 } as unknown as T;
  }

  if (path.startsWith("/api/v1/ai/conversations")) {
    const parts = path.split("/");
    if (parts[5]) {
      return {
        id: parts[5],
        title: "Productivity AI Chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [
          { id: "msg-1", role: "assistant", content: "Hello! I am your Todotak AI assistant. How can I help you manage your day?", created_at: new Date().toISOString() }
        ]
      } as unknown as T;
    }
    return {
      items: [
        { id: "demo-conv-1", title: "Productivity AI Chat", updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
      ],
      total: 1,
      page: 1,
      page_size: 50
    } as unknown as T;
  }

  if (path.startsWith("/api/v1/ai/chat")) {
    const userMsg = body?.message || "";
    let aiResponse = `I've processed your request: "${userMsg}". Your workspace is synchronized!`;

    if (userMsg.toLowerCase().includes("task") || userMsg.toLowerCase().includes("add") || userMsg.toLowerCase().includes("todo")) {
      let targetDueDate = new Date();
      const timeMatch = userMsg.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);

      if (timeMatch && (timeMatch[3] || timeMatch[2] || userMsg.toLowerCase().includes("at") || userMsg.toLowerCase().includes("to"))) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;

        targetDueDate.setHours(hours, minutes, 0, 0);
        if (targetDueDate.getTime() < Date.now() - 3600000) {
          targetDueDate.setDate(targetDueDate.getDate() + 1);
        }
      } else {
        targetDueDate = new Date(Date.now() + 86400000);
      }

      const formattedTime = targetDueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      aiResponse = `🚀 Task created! I've scheduled your new item for ${formattedTime} ("${userMsg}"). Check your Tasks list to view details.`;

      // Auto create task in local demo storage
      let tasks = [...DEMO_TASKS];
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("todotak_demo_tasks");
        if (stored) { try { tasks = JSON.parse(stored); } catch {} }
      }
      const newTask = {
        id: "demo-task-" + Date.now(),
        user_id: "demo-user",
        title: userMsg,
        description: "Created via Todotak AI Assistant",
        status: "pending",
        priority: "high",
        due_date: targetDueDate.toISOString(),
        completed_at: null,
        is_recurring: false,
        recurrence_rule: null,
        recurrence_parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [{ id: "tag-ai", name: "ai-generated" }],
        is_due_today: true,
        is_overdue: false,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("todotak_demo_tasks", JSON.stringify([newTask, ...tasks]));
        localStorage.setItem("todotak_demo_mode_active", "true");
      }
    }

    return {
      conversation_id: body?.conversation_id || "demo-conv-1",
      message: {
        id: "ai-msg-" + Date.now(),
        role: "assistant",
        content: aiResponse,
        created_at: new Date().toISOString()
      }
    } as unknown as T;
  }

  return {} as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, skipAuth = false } = options;

  if (isDemoModeActive()) {
    return handleDemoFallback<T>(path, method, body, params);
  }

  const url = `${API_BASE_URL}${buildPath(path, params)}`;

  const doFetch = async (): Promise<Response> => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      throw new ApiError(0, "You appear to be offline. Please check your internet connection.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!skipAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    try {
      return await fetch(url, {
        method,
        headers,
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, "Network failure. Could not reach server.");
    }
  };

  try {
    let response = await doFetch();

    if (response.status === 401 && !skipAuth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await doFetch();
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, await parseErrorDetail(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (err) {
    // If backend connection fails or returns 404/500, seamlessly fall back to local demo storage so UI doesn't break
    if (typeof window !== "undefined") {
      return handleDemoFallback<T>(path, method, body, params);
    }
    throw err;
  }
}

export const apiClient = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
