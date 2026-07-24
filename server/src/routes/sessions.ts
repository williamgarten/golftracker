import { Router } from "express";
import type { CreatePracticeSessionInput, PracticeSession, UpdatePracticeSessionInput } from "@golftracker/shared";
import { pool } from "../db/pool.js";
import { weekBoundsFor } from "@golftracker/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

interface SessionRow {
  id: number;
  user_id: number;
  category_id: number;
  duration_minutes: number;
  date: string;
  notes: string | null;
  created_at: Date;
}

function toSession(row: SessionRow): PracticeSession {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    durationMinutes: row.duration_minutes,
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

async function categoryBelongsToUser(categoryId: number, userId: number): Promise<boolean> {
  const { rowCount } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [
    categoryId,
    userId,
  ]);
  return !!rowCount;
}

function isValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

sessionsRouter.get("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const weekOf = typeof req.query.weekOf === "string" ? req.query.weekOf : undefined;

  if (weekOf) {
    if (!isValidDate(weekOf)) {
      return res.status(400).json({ error: "weekOf must be a YYYY-MM-DD date" });
    }
    const { weekStart, weekEnd } = weekBoundsFor(weekOf);
    const { rows } = await pool.query<SessionRow>(
      "SELECT * FROM practice_sessions WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date DESC, created_at DESC",
      [userId, weekStart, weekEnd],
    );
    return res.json(rows.map(toSession));
  }

  const { rows } = await pool.query<SessionRow>(
    "SELECT * FROM practice_sessions WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 200",
    [userId],
  );
  res.json(rows.map(toSession));
});

sessionsRouter.post("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const { categoryId, durationMinutes, date, notes } = (req.body ?? {}) as Partial<CreatePracticeSessionInput>;

  if (!categoryId || !(await categoryBelongsToUser(categoryId, userId))) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (!isValidDuration(durationMinutes)) {
    return res.status(400).json({ error: "Duration must be a positive number of minutes" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
  }

  const { rows } = await pool.query<SessionRow>(
    `INSERT INTO practice_sessions (user_id, category_id, duration_minutes, date, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, categoryId, durationMinutes, date, notes ?? null],
  );
  res.status(201).json(toSession(rows[0]));
});

sessionsRouter.put("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);
  const { categoryId, durationMinutes, date, notes } = (req.body ?? {}) as UpdatePracticeSessionInput;

  if (categoryId !== undefined && !(await categoryBelongsToUser(categoryId, userId))) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
    return res.status(400).json({ error: "Duration must be a positive number of minutes" });
  }
  if (date !== undefined && !isValidDate(date)) {
    return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
  }

  const { rows } = await pool.query<SessionRow>(
    `UPDATE practice_sessions SET
       category_id = COALESCE($1, category_id),
       duration_minutes = COALESCE($2, duration_minutes),
       date = COALESCE($3, date),
       notes = CASE WHEN $4 THEN $5 ELSE notes END
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [categoryId ?? null, durationMinutes ?? null, date ?? null, notes !== undefined, notes ?? null, id, userId],
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(toSession(rows[0]));
});

sessionsRouter.delete("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM practice_sessions WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  if (!rowCount) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.status(204).end();
});
