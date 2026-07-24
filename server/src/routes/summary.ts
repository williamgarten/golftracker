import { Router } from "express";
import { todayDateString, weekBoundsFor, type CategoryWeekTotal, type PracticeSession, type Round, type WeekSummary } from "@golftracker/shared";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const summaryRouter = Router();
summaryRouter.use(requireAuth);

interface CategoryRow {
  id: number;
  name: string;
  color_hex: string;
  weekly_goal_minutes: number | null;
  archived: boolean;
}

interface MinutesRow {
  category_id: number;
  minutes: string;
}

interface SessionRow {
  id: number;
  user_id: number;
  category_id: number;
  duration_minutes: number;
  date: string;
  notes: string | null;
  created_at: Date;
}

interface RoundRow {
  id: number;
  user_id: number;
  holes: number;
  date: string;
  notes: string | null;
  created_at: Date;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

summaryRouter.get("/week", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  if (dateParam && !isValidDate(dateParam)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }
  const { weekStart, weekEnd } = weekBoundsFor(dateParam ?? todayDateString());

  const [categoriesResult, minutesResult, sessionsResult, roundsResult] = await Promise.all([
    pool.query<CategoryRow>(
      `SELECT c.id, c.name, c.color_hex, c.weekly_goal_minutes, c.archived
       FROM categories c
       WHERE c.user_id = $1
         AND (c.archived = false OR EXISTS (
           SELECT 1 FROM practice_sessions ps
           WHERE ps.category_id = c.id AND ps.date BETWEEN $2 AND $3
         ))
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      [userId, weekStart, weekEnd],
    ),
    pool.query<MinutesRow>(
      `SELECT category_id, SUM(duration_minutes)::text AS minutes
       FROM practice_sessions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY category_id`,
      [userId, weekStart, weekEnd],
    ),
    pool.query<SessionRow>(
      `SELECT * FROM practice_sessions WHERE user_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date DESC, created_at DESC`,
      [userId, weekStart, weekEnd],
    ),
    pool.query<RoundRow>(
      `SELECT * FROM rounds WHERE user_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date DESC, created_at DESC`,
      [userId, weekStart, weekEnd],
    ),
  ]);

  const minutesByCategory = new Map(minutesResult.rows.map((r) => [r.category_id, Number(r.minutes)]));

  const categories: CategoryWeekTotal[] = categoriesResult.rows.map((c) => ({
    categoryId: c.id,
    name: c.name,
    colorHex: c.color_hex,
    weeklyGoalMinutes: c.weekly_goal_minutes,
    archived: c.archived,
    minutes: minutesByCategory.get(c.id) ?? 0,
  }));

  const sessions: PracticeSession[] = sessionsResult.rows.map((s) => ({
    id: s.id,
    userId: s.user_id,
    categoryId: s.category_id,
    durationMinutes: s.duration_minutes,
    date: s.date,
    notes: s.notes,
    createdAt: s.created_at.toISOString(),
  }));

  const rounds: Round[] = roundsResult.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    holes: r.holes,
    date: r.date,
    notes: r.notes,
    createdAt: r.created_at.toISOString(),
  }));

  const summary: WeekSummary = {
    weekStart,
    weekEnd,
    categories,
    totalPracticeMinutes: categories.reduce((sum, c) => sum + c.minutes, 0),
    totalHoles: rounds.reduce((sum, r) => sum + r.holes, 0),
    roundsCount: rounds.length,
    rounds,
    sessions,
  };

  res.json(summary);
});
