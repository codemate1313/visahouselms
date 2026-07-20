import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

export function InstructorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [bookmark, setBookmark] = useState({ top: 0, height: 0, visible: false });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);

  useLayoutEffect(() => {
    setMobileNavOpen(false);
    const position = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLAnchorElement>("a.active");
      if (!nav || !active) return setBookmark((current) => ({ ...current, visible: false }));
      setBookmark({ top: active.offsetTop, height: active.offsetHeight, visible: true });
    };
    position(); window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [location.pathname]);

  async function logout() {
    if (refreshToken) {
      try { await apiClient.post("/auth/logout", { refresh_token: refreshToken }); } catch { /* best effort */ }
    }
    clear(); navigate("/login");
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();
  return (
    <div className="dashboard instructor-portal">
      <button className="mobile-nav-toggle" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><span /><span /><span /></button>
      {mobileNavOpen && <button className="nav-overlay" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`dashboard-nav${mobileNavOpen ? " mobile-open" : ""}`}>
        <button className="mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button>
        <div className="dashboard-brand"><h2>IELTS LMS</h2><p className="dashboard-role">SA Instructor</p></div>
        <nav ref={navRef}>
          <span className={`nav-bookmark${bookmark.visible ? " is-visible" : ""}`} style={{ height: bookmark.height, transform: `translateY(${bookmark.top}px)` }} aria-hidden="true" />
          <NavLink to="/instructor" end>Dashboard</NavLink>
          <p className="nav-section">Authoring</p>
          <NavLink to="/instructor/modules">Assessment Modules</NavLink>
          <NavLink to="/instructor/grading">Grading Queue</NavLink>
          <p className="nav-section">Account</p>
          <NavLink to="/instructor/profile">My Profile</NavLink>
          <NavLink to="/instructor/sessions">Active Sessions</NavLink>
          <NavLink to="/instructor/change-password">Change Password</NavLink>
        </nav>
        <div className="dashboard-user">
          {user?.avatar_url ? <img src={`${API_BASE_URL}${user.avatar_url}`} alt="" className="nav-avatar" /> : <div className="nav-avatar nav-avatar-initials">{initials || "?"}</div>}
          <div className="dashboard-user-info"><p>{user?.first_name} {user?.last_name}</p><p className="dashboard-email">{user?.email}</p></div>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="dashboard-content"><Outlet /></main>
    </div>
  );
}
