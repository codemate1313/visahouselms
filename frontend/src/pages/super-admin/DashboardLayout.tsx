import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [bookmark, setBookmark] = useState({ top: 0, height: 0, visible: false });
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);

  async function handleLogout() {
    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // best-effort - clear local session regardless
      }
    }
    clear();
    navigate("/login");
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();

  useLayoutEffect(() => {
    const positionBookmark = () => {
      const nav = navRef.current;
      const activeLink = nav?.querySelector<HTMLAnchorElement>("a.active");

      if (!nav || !activeLink) {
        setBookmark((current) => ({ ...current, visible: false }));
        return;
      }

      setBookmark({
        top: activeLink.offsetTop,
        height: activeLink.offsetHeight,
        visible: true,
      });
    };

    positionBookmark();
    window.addEventListener("resize", positionBookmark);
    return () => window.removeEventListener("resize", positionBookmark);
  }, [location.pathname]);

  return (
    <div className="dashboard">
      <aside className="dashboard-nav">
        <div className="dashboard-brand">
          <h2>IELTS LMS</h2>
          <p className="dashboard-role">Super Admin</p>
        </div>
        <nav ref={navRef}>
          <span
            className={`nav-bookmark${bookmark.visible ? " is-visible" : ""}`}
            style={{ height: bookmark.height, transform: `translateY(${bookmark.top}px)` }}
            aria-hidden="true"
          />
          <NavLink to="/super-admin" end>Dashboard</NavLink>
          <NavLink to="/super-admin/accounts">Admin Accounts</NavLink>
          <NavLink to="/super-admin/profile">My Profile</NavLink>
          <NavLink to="/super-admin/sessions">Active Sessions</NavLink>
          <NavLink to="/super-admin/change-password">Change Password</NavLink>
          <p className="nav-section">SaaS</p>
          <NavLink to="/super-admin/institutes">Institutes</NavLink>
          <NavLink to="/super-admin/plans">Plans</NavLink>
          <NavLink to="/super-admin/subscriptions">Subscriptions</NavLink>
          <NavLink to="/super-admin/trial-config">Trial Settings</NavLink>
          <NavLink to="/super-admin/demo-accounts">Demo Accounts</NavLink>
          <NavLink to="/super-admin/coupons">Coupons</NavLink>
          <NavLink to="/super-admin/payments">Payments</NavLink>
          <NavLink to="/super-admin/payment-methods">Payment Methods</NavLink>
          <NavLink to="/super-admin/revenue">Revenue</NavLink>
          <p className="nav-section">System</p>
          <NavLink to="/super-admin/dev-settings">Developer Settings</NavLink>
          <NavLink to="/super-admin/logs">Logs</NavLink>
          <NavLink to="/super-admin/terminal">CMD Terminal</NavLink>
        </nav>
        <div className="dashboard-user">
          {user?.avatar_url ? (
            <img
              src={`${API_BASE_URL}${user.avatar_url}`}
              alt=""
              className="nav-avatar"
            />
          ) : (
            <div className="nav-avatar nav-avatar-initials">{initials || "?"}</div>
          )}
          <div className="dashboard-user-info">
            <p>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="dashboard-email">{user?.email}</p>
          </div>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}
