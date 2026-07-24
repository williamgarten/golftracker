import { Router } from "express";
import type { CreateRoundInput, Round, UpdateRoundInput } from "@golftracker/shared";
import { pool } from "../db/pool.js";
import { weekBoundsFor } from "@golftracker/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const roundsRouter = Router();
roundsRouter.use(requireAuth);

interface RoundRow {
  id: number;
  user_id: number;
  holes: number;
  date: string;
  notes: string | null;
  created_at: Date;
}

function toRound(row: RoundRow): Round {
  return {
    id: row.id,
    userId: row.user_id,
    holes: row.holes,
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function isValidHoles(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

roundsRouter.get("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const weekOf = typeof req.query.weekOf === "string" ? req.query.weekOf : undefined;

  if (weekOf) {
    if (!isValidDate(weekOf)) {
      return res.status(400).json({ error: "weekOf must be a YYYY-MM-DD date" });
    }
    const { weekStart, weekEnd } = weekBoundsFor(weekOf);
    const { rows } = await pool.query<RoundRow>(
      "SELECT * FROM rounds WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date DESC, created_at DESC",
      [userId, weekStart, weekEnd],
    );
    return res.json(rows.map(toRound));
  }

  const { rows } = await pool.query<RoundRow>(
    "SELECT * FROM rounds WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 200",
    [userId],
  );
  res.json(rows.map(toRound));
});

roundsRouter.post("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const { holes, date, notes } = (req.body ?? {}) as Partial<CreateRoundInput>;

  if (!isValidHoles(holes)) {
    return res.status(400).json({ error: "Holes must be a positive whole number" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
  }

  const { rows } = await pool.query<RoundRow>(
    "INSERT INTO rounds (user_id, holes, date, notes) VALUES ($1, $2, $3, $4) RETURNING *",
    [userId, holes, date, notes ?? null],
  );
  res.status(201).json(toRound(rows[0]));
});

roundsRouter.put("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);
  const { holes, date, notes } = (req.body ?? {}) as UpdateRoundInput;

  if (holes !== undefined && !isValidHoles(holes)) {
    return res.status(400).json({ error: "Holes must be a positive whole number" });
  }
  if (date !== undefined && !isValidDate(date)) {
    return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
  }

  const { rows } = await pool.query<RoundRow>(
    `UPDATE rounds SET
       holes = COALESCE($1, holes),
       date = COALESCE($2, date),
       notes = CASE WHEN $3 THEN $4 ELSE notes END
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [holes ?? null, date ?? null, notes !== undefined, notes ?? null, id, userId],
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Round not found" });
  }
  res.json(toRound(rows[0]));
});

roundsRouter.delete("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM rounds WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!rowCount) {
    return res.status(404).json({ error: "Round not found" });
  }
  res.status(204).end();
});
