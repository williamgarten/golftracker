import type { Category } from "@golftracker/shared";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import CategoryModal from "../components/CategoryModal";
import { formatMinutes } from "../utils/format";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<Category | "new" | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.categories.list(true);
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleArchived(category: Category) {
    await api.categories.update(category.id, { archived: !category.archived });
    reload();
  }

  async function remove(category: Category) {
    if (!confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    try {
      await api.categories.remove(category.id);
      reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't delete that category.");
    }
  }

  return (
    <>
      <div className="fab-row">
        <button className="btn btn-primary btn-block" onClick={() => setModalCategory("new")}>
          + Add Category
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading && categories.length === 0 ? (
          <p className="empty-state">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="empty-state">No categories yet. Add your first one above.</p>
        ) : (
          categories.map((c) => (
            <div className="category-manage-row" key={c.id}>
              <span className="category-dot" style={{ background: c.colorHex }} />
              <div className="info">
                <div className="name">
                  {c.name}
                  {c.archived && <span className="archived-tag">Archived</span>}
                </div>
                <div className="sub">{c.weeklyGoalMinutes != null ? `Goal: ${formatMinutes(c.weeklyGoalMinutes)}/week` : "No weekly goal"}</div>
              </div>
              <button className="icon-btn" onClick={() => setModalCategory(c)} aria-label={`Edit ${c.name}`}>
                ✏️
              </button>
              <button className="icon-btn" onClick={() => toggleArchived(c)} aria-label={c.archived ? `Unarchive ${c.name}` : `Archive ${c.name}`}>
                {c.archived ? "↩️" : "🗄️"}
              </button>
              <button className="icon-btn" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {modalCategory && (
        <CategoryModal
          category={modalCategory === "new" ? undefined : modalCategory}
          onClose={() => setModalCategory(null)}
          onSaved={() => {
            setModalCategory(null);
            reload();
          }}
        />
      )}
    </>
  );
}
