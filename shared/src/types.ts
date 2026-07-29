// Dates are always plain "YYYY-MM-DD" strings (no time/timezone component) —
// a practice session or round happens "on a date", not at an instant.
export type DateString = string;

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  colorHex: string;
  weeklyGoalMinutes: number | null;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PracticeSession {
  id: number;
  userId: number;
  categoryId: number;
  durationMinutes: number;
  date: DateString;
  notes: string | null;
  createdAt: string;
}

export interface Round {
  id: number;
  userId: number;
  date: DateString;
  holes: number;
  notes: string | null;
  createdAt: string;
}

// ---- Auth ----

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUserResponse {
  user: User;
}

// ---- Category requests ----

export interface CreateCategoryInput {
  name: string;
  colorHex?: string;
  weeklyGoalMinutes?: number | null;
}

export interface UpdateCategoryInput {
  name?: string;
  colorHex?: string;
  weeklyGoalMinutes?: number | null;
  archived?: boolean;
  sortOrder?: number;
}

// ---- Practice session requests ----

export interface CreatePracticeSessionInput {
  categoryId: number;
  durationMinutes: number;
  date: DateString;
  notes?: string | null;
}

export interface UpdatePracticeSessionInput {
  categoryId?: number;
  durationMinutes?: number;
  date?: DateString;
  notes?: string | null;
}

// ---- Round requests ----

export interface CreateRoundInput {
  holes: number;
  date: DateString;
  notes?: string | null;
}

export interface UpdateRoundInput {
  holes?: number;
  date?: DateString;
  notes?: string | null;
}

// ---- Weekly summary ----

export interface CategoryWeekTotal {
  categoryId: number;
  name: string;
  colorHex: string;
  weeklyGoalMinutes: number | null;
  archived: boolean;
  minutes: number;
}

export interface WeekSummary {
  weekStart: DateString; // Monday
  weekEnd: DateString; // Sunday
  categories: CategoryWeekTotal[];
  totalPracticeMinutes: number;
  totalHoles: number;
  roundsCount: number;
  rounds: Round[];
  sessions: PracticeSession[];
}
