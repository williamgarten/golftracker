import { todayDateString } from "@golftracker/shared";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import Modal from "./Modal";

export default function LogRoundModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [holes, setHoles] = useState<string>("18");
  const [date, setDate] = useState(todayDateString());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const holesNum = Number(holes);
    if (!Number.isInteger(holesNum) || holesNum <= 0) {
      setError("Enter a valid number of holes.");
      return;
    }
    setSubmitting(true);
    try {
      await api.rounds.create({ holes: holesNum, date, notes: notes || null });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that round.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Log Round" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="holes">Holes played</label>
          <input id="holes" type="number" inputMode="numeric" min={1} value={holes} onChange={(e) => setHoles(e.target.value)} required />
          <div className="segmented">
            {[9, 18].map((h) => (
              <button type="button" key={h} className={holes === String(h) ? "active" : ""} onClick={() => setHoles(String(h))}>
                {h} holes
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="round-date">Date</label>
          <input id="round-date" type="date" value={date} max={todayDateString()} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="round-notes">Notes (optional)</label>
          <textarea id="round-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Course, score, conditions…" />
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
