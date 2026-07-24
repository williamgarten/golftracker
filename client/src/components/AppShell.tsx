import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppShell() {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          <span aria-hidden="true">⛳</span> Golf Tracker
        </h1>
        <button onClick={() => logout()}>Log out</button>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon" aria-hidden="true">
            📅
          </span>
          This Week
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon" aria-hidden="true">
            🏷️
          </span>
          Categories
        </NavLink>
      </nav>
    </div>
  );
}
