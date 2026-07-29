import type {
  AuthCredentials,
  AuthUserResponse,
  Category,
  CreateCategoryInput,
  CreatePracticeSessionInput,
  CreateRoundInput,
  PracticeSession,
  Round,
  UpdateCategoryInput,
  UpdatePracticeSessionInput,
  UpdateRoundInput,
  WeekSummary,
} from "@golftracker/shared";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong");
  }

  return data as T;
}

export const api = {
  auth: {
    register: (credentials: AuthCredentials) =>
      request<AuthUserResponse>("/auth/register", { method: "POST", body: JSON.stringify(credentials) }),
    login: (credentials: AuthCredentials) =>
      request<AuthUserResponse>("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    me: () => request<AuthUserResponse>("/auth/me"),
  },
  categories: {
    list: (includeArchived = false) =>
      request<Category[]>(`/categories${includeArchived ? "?includeArchived=true" : ""}`),
    create: (input: CreateCategoryInput) =>
      request<Category>("/categories", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: UpdateCategoryInput) =>
      request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),
  },
  sessions: {
    listForWeek: (weekOf: string) => request<PracticeSession[]>(`/sessions?weekOf=${weekOf}`),
    create: (input: CreatePracticeSessionInput) =>
      request<PracticeSession>("/sessions", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: UpdatePracticeSessionInput) =>
      request<PracticeSession>(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/sessions/${id}`, { method: "DELETE" }),
  },
  rounds: {
    listForWeek: (weekOf: string) => request<Round[]>(`/rounds?weekOf=${weekOf}`),
    create: (input: CreateRoundInput) => request<Round>("/rounds", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: UpdateRoundInput) =>
      request<Round>(`/rounds/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/rounds/${id}`, { method: "DELETE" }),
  },
  summary: {
    getWeek: (date?: string) => request<WeekSummary>(`/summary/week${date ? `?date=${date}` : ""}`),
  },
};

export { ApiError };
