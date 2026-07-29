import type { Category } from "@golftracker/shared";
import { todayDateString } from "@golftracker/shared";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import Modal from "./Modal";

const QUICK_MINUTES = [15, 30, 45, 60];

export default function LogSessionModal({
  categories,
  onClose,
  onSaved,
}: {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState<number | "">(categories[0]?.id ?? "");
  const [minutes, setMinutes] = useState<string>("30");
  const [date, setDate] = useState(todayDateString());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const durationMinutes = Number(minutes);
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError("Enter a valid duration in minutes.");
      return;
    }
    setSubmitting(true);
    try {
      await api.sessions.create({ categoryId: Number(categoryId), durationMinutes, date, notes: notes || null });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that session.");
    } finally {
      setSubmitting(false);
    }
  }

  if (categories.length === 0) {
    return (
      <Modal title="Log Practice" onClose={onClose}>
        <p>You need at least one category before logging practice time.</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Log Practice" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="minutes">Duration (minutes)</label>
          <input
            id="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
          <div className="segmented">
            {QUICK_MINUTES.map((m) => (
              <button type="button" key={m} className={minutes === String(m) ? "active" : ""} onClick={() => setMinutes(String(m))}>
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} max={todayDateString()} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tempo, alignment, drills…" />
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
