import { Router } from "express";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "@golftracker/shared";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  color_hex: string;
  weekly_goal_minutes: number | null;
  archived: boolean;
  sort_order: number;
  created_at: Date;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    colorHex: row.color_hex,
    weeklyGoalMinutes: row.weekly_goal_minutes,
    archived: row.archived,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
  };
}

categoriesRouter.get("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const includeArchived = req.query.includeArchived === "true";
  const { rows } = await pool.query<CategoryRow>(
    `SELECT * FROM categories WHERE user_id = $1 ${includeArchived ? "" : "AND archived = false"}
     ORDER BY sort_order ASC, created_at ASC`,
    [userId],
  );
  res.json(rows.map(toCategory));
});

categoriesRouter.post("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const { name, colorHex, weeklyGoalMinutes } = (req.body ?? {}) as Partial<CreateCategoryInput>;
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return res.status(400).json({ error: "Category name is required" });
  }
  if (weeklyGoalMinutes != null && (!Number.isFinite(weeklyGoalMinutes) || weeklyGoalMinutes < 0)) {
    return res.status(400).json({ error: "Weekly goal must be a non-negative number of minutes" });
  }

  const { rows: maxRows } = await pool.query<{ max: number | null }>(
    "SELECT MAX(sort_order) AS max FROM categories WHERE user_id = $1",
    [userId],
  );
  const nextSortOrder = (maxRows[0]?.max ?? -1) + 1;

  try {
    const { rows } = await pool.query<CategoryRow>(
      `INSERT INTO categories (user_id, name, color_hex, weekly_goal_minutes, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, trimmedName, colorHex ?? "#1a472a", weeklyGoalMinutes ?? null, nextSortOrder],
    );
    res.status(201).json(toCategory(rows[0]));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "You already have a category with that name" });
    }
    throw err;
  }
});

categoriesRouter.put("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);
  const { name, colorHex, weeklyGoalMinutes, archived, sortOrder } = (req.body ?? {}) as UpdateCategoryInput;

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: "Category name cannot be empty" });
  }
  if (weeklyGoalMinutes != null && (!Number.isFinite(weeklyGoalMinutes) || weeklyGoalMinutes < 0)) {
    return res.status(400).json({ error: "Weekly goal must be a non-negative number of minutes" });
  }

  try {
    const { rows } = await pool.query<CategoryRow>(
      `UPDATE categories SET
         name = COALESCE($1, name),
         color_hex = COALESCE($2, color_hex),
         weekly_goal_minutes = CASE WHEN $3 THEN $4 ELSE weekly_goal_minutes END,
         archived = COALESCE($5, archived),
         sort_order = COALESCE($6, sort_order)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        name?.trim() ?? null,
        colorHex ?? null,
        weeklyGoalMinutes !== undefined,
        weeklyGoalMinutes ?? null,
        archived ?? null,
        sortOrder ?? null,
        id,
        userId,
      ],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(toCategory(rows[0]));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "You already have a category with that name" });
    }
    throw err;
  }
});

categoriesRouter.delete("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = Number(req.params.id);

  const { rows: usageRows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM practice_sessions WHERE category_id = $1 AND user_id = $2",
    [id, userId],
  );
  if (Number(usageRows[0]?.count ?? "0") > 0) {
    return res.status(409).json({
      error: "This category has logged sessions. Archive it instead of deleting.",
    });
  }

  const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!rowCount) {
    return res.status(404).json({ error: "Category not found" });
  }
  res.status(204).end();
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}
