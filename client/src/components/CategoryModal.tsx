import type { Category } from "@golftracker/shared";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import Modal from "./Modal";

const SWATCHES = ["#1a472a", "#2d6a4f", "#40916c", "#d4a017", "#9c4221", "#3a5a9c", "#7b3fa0", "#c2410c"];

export default function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [colorHex, setColorHex] = useState(category?.colorHex ?? SWATCHES[0]);
  const [hasGoal, setHasGoal] = useState(category?.weeklyGoalMinutes != null);
  const [goalMinutes, setGoalMinutes] = useState(String(category?.weeklyGoalMinutes ?? 60));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    const weeklyGoalMinutes = hasGoal ? Number(goalMinutes) : null;
    if (hasGoal && (!Number.isFinite(weeklyGoalMinutes) || (weeklyGoalMinutes ?? 0) <= 0)) {
      setError("Enter a valid weekly goal in minutes.");
      return;
    }
    setSubmitting(true);
    try {
      if (category) {
        await api.categories.update(category.id, { name: name.trim(), colorHex, weeklyGoalMinutes });
      } else {
        await api.categories.create({ name: name.trim(), colorHex, weeklyGoalMinutes });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that category.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={category ? "Edit Category" : "Add Category"} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="cat-name">Name</label>
          <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedges" required />
        </div>

        <div className="field">
          <label>Color</label>
          <div className="color-swatches">
            {SWATCHES.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch${c === colorHex ? " selected" : ""}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => setColorHex(c)}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>
            <input type="checkbox" checked={hasGoal} onChange={(e) => setHasGoal(e.target.checked)} /> Set a weekly time
            goal
          </label>
          {hasGoal && (
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(e.target.value)}
              placeholder="Minutes per week"
            />
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
