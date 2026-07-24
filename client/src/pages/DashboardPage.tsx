import type { Category, WeekSummary } from "@golftracker/shared";
import { formatWeekLabel, shiftWeek, todayDateString, weekBoundsFor } from "@golftracker/shared";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import LogRoundModal from "../components/LogRoundModal";
import LogSessionModal from "../components/LogSessionModal";
import { formatDateLabel, formatMinutes } from "../utils/format";

export default function DashboardPage() {
  const [weekAnchor, setWeekAnchor] = useState(todayDateString());
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showRoundModal, setShowRoundModal] = useState(false);

  const reload = useCallback(async (anchor: string) => {
    setLoading(true);
    try {
      const data = await api.summary.getWeek(anchor);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this week.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload(weekAnchor);
  }, [weekAnchor, reload]);

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => {});
  }, []);

  const currentWeekStart = weekBoundsFor(todayDateString()).weekStart;
  const isCurrentWeek = summary?.weekStart === currentWeekStart;

  function goToWeek(delta: number) {
    const base = summary?.weekStart ?? weekAnchor;
    setWeekAnchor(shiftWeek(base, delta));
  }

  async function deleteSession(id: number) {
    await api.sessions.remove(id);
    reload(weekAnchor);
  }

  async function deleteRound(id: number) {
    await api.rounds.remove(id);
    reload(weekAnchor);
  }

  const activeCategories = summary?.categories.filter((c) => !c.archived) ?? [];

  return (
    <>
      <div className="week-nav">
        <button onClick={() => goToWeek(-1)} aria-label="Previous week">
          ◀
        </button>
        <div className="week-label">
          {summary ? formatWeekLabel(summary.weekStart, summary.weekEnd) : "…"}
          <span className="week-sub">{isCurrentWeek ? "This week" : " "}</span>
        </div>
        <button onClick={() => goToWeek(1)} disabled={isCurrentWeek} aria-label="Next week">
          ▶
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="summary-tiles">
        <div className="summary-tile">
          <div className="label">Practice time</div>
          <div className="value">{formatMinutes(summary?.totalPracticeMinutes ?? 0)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">Holes played</div>
          <div className="value">{summary?.totalHoles ?? 0}</div>
        </div>
      </div>

      <div className="fab-row">
        <button className="btn btn-primary" onClick={() => setShowSessionModal(true)}>
          + Log Practice
        </button>
        <button className="btn btn-primary" onClick={() => setShowRoundModal(true)}>
          + Log Round
        </button>
      </div>

      <div>
        <div className="section-title">Practice by category</div>
        <div className="card">
          {loading && !summary ? (
            <p className="empty-state">Loading…</p>
          ) : activeCategories.length === 0 ? (
            <p className="empty-state">No categories yet. Add one from the Categories tab.</p>
          ) : (
            activeCategories.map((c) => {
              const pct = c.weeklyGoalMinutes ? Math.min(100, Math.round((c.minutes / c.weeklyGoalMinutes) * 100)) : null;
              return (
                <div className="category-row" key={c.categoryId}>
                  <span className="category-dot" style={{ background: c.colorHex }} />
                  <div className="info">
                    <div className="name">{c.name}</div>
                    {c.weeklyGoalMinutes != null && (
                      <>
                        <div className="goal-bar">
                          <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="goal-label">
                          Goal: {formatMinutes(c.weeklyGoalMinutes)}/week
                        </div>
                      </>
                    )}
                  </div>
                  <div className="time">{formatMinutes(c.minutes)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {summary && summary.sessions.length > 0 && (
        <div>
          <div className="section-title">Sessions logged</div>
          <div className="card">
            {summary.sessions.map((s) => {
              const category = summary.categories.find((c) => c.categoryId === s.categoryId);
              return (
                <div className="log-entry" key={s.id}>
                  <div>
                    <div>
                      {category?.name ?? "Unknown"} — {formatMinutes(s.durationMinutes)}
                    </div>
                    <div className="meta">
                      {formatDateLabel(s.date)}
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </div>
                  <button onClick={() => deleteSession(s.id)}>Delete</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary && summary.rounds.length > 0 && (
        <div>
          <div className="section-title">Rounds logged</div>
          <div className="card">
            {summary.rounds.map((r) => (
              <div className="log-entry" key={r.id}>
                <div>
                  <div>{r.holes} holes</div>
                  <div className="meta">
                    {formatDateLabel(r.date)}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <button onClick={() => deleteRound(r.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSessionModal && (
        <LogSessionModal
          categories={categories.filter((c) => !c.archived)}
          onClose={() => setShowSessionModal(false)}
          onSaved={() => {
            setShowSessionModal(false);
            reload(weekAnchor);
          }}
        />
      )}

      {showRoundModal && (
        <LogRoundModal
          onClose={() => setShowRoundModal(false)}
          onSaved={() => {
            setShowRoundModal(false);
            reload(weekAnchor);
          }}
        />
      )}
    </>
  );
}
