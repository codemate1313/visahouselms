import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [bookmark, setBookmark] = useState({ top: 0, height: 0, visible: false });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({ saas: location.pathname.includes("/super-admin/institutes") || location.pathname.includes("/super-admin/plans") || location.pathname.includes("/super-admin/subscriptions") || location.pathname.includes("/super-admin/trial-config") || location.pathname.includes("/super-admin/demo-accounts") || location.pathname.includes("/super-admin/coupons") || location.pathname.includes("/super-admin/payments") || location.pathname.includes("/super-admin/revenue"), system: location.pathname.includes("/super-admin/dev-settings") || location.pathname.includes("/super-admin/logs") || location.pathname.includes("/super-admin/terminal") });
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
    navigate("/super-admin/login");
  }

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase();

  useEffect(() => {
    setOpenGroups((current) => ({
      saas: current.saas || location.pathname.includes("/super-admin/institutes") || location.pathname.includes("/super-admin/plans") || location.pathname.includes("/super-admin/subscriptions") || location.pathname.includes("/super-admin/trial-config") || location.pathname.includes("/super-admin/demo-accounts") || location.pathname.includes("/super-admin/coupons") || location.pathname.includes("/super-admin/payments") || location.pathname.includes("/super-admin/revenue"),
      system: current.system || location.pathname.includes("/super-admin/dev-settings") || location.pathname.includes("/super-admin/logs") || location.pathname.includes("/super-admin/terminal"),
    }));
  }, [location.pathname]);

  useLayoutEffect(() => {
    setMobileNavOpen(false);
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
  }, [location.pathname, openGroups]);

  return (
    <div className="dashboard">
      <button className="mobile-nav-toggle" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><span /><span /><span /></button>
      {mobileNavOpen && <button className="nav-overlay" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`dashboard-nav${mobileNavOpen ? " mobile-open" : ""}`}>
        <button className="mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button>
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
          <NavLink className="nav-icon-dashboard" to="/super-admin/dashboard">Dashboard</NavLink>
          <NavLink className="nav-icon-admin" to="/super-admin/accounts">Admin Accounts</NavLink>
          <NavLink className="nav-icon-instructor" to="/super-admin/instructors">SA Instructors</NavLink>
          <NavLink className="nav-icon-course" to="/super-admin/courses">Course Catalog</NavLink>
          <NavLink className="nav-icon-user" to="/super-admin/profile">My Profile</NavLink>
          <NavLink className="nav-icon-session" to="/super-admin/sessions">Active Sessions</NavLink>
          <NavLink className="nav-icon-lock" to="/super-admin/change-password">Change Password</NavLink>
          <button className="nav-group-toggle" type="button" aria-expanded={openGroups.saas} onClick={() => setOpenGroups((current) => ({ ...current, saas: !current.saas }))}><span>SaaS</span></button>
          {openGroups.saas && <div className="nav-group-panel">
            <NavLink className="nav-icon-building" to="/super-admin/institutes">Institutes</NavLink>
            <NavLink className="nav-icon-plan" to="/super-admin/plans">Plans</NavLink>
            <NavLink className="nav-icon-subscription" to="/super-admin/subscriptions">Subscriptions</NavLink>
            <NavLink className="nav-icon-trial" to="/super-admin/trial-config">Trial Settings</NavLink>
            <NavLink className="nav-icon-demo" to="/super-admin/demo-accounts">Demo Accounts</NavLink>
            <NavLink className="nav-icon-coupon" to="/super-admin/coupons">Coupons</NavLink>
            <NavLink className="nav-icon-payment" to="/super-admin/payments">Payments</NavLink>
            <NavLink className="nav-icon-wallet" to="/super-admin/payment-methods">Payment Methods</NavLink>
            <NavLink className="nav-icon-revenue" to="/super-admin/revenue">Revenue</NavLink>
          </div>}
          <button className="nav-group-toggle" type="button" aria-expanded={openGroups.system} onClick={() => setOpenGroups((current) => ({ ...current, system: !current.system }))}><span>System</span></button>
          {openGroups.system && <div className="nav-group-panel">
            <NavLink className="nav-icon-settings" to="/super-admin/dev-settings">Developer Settings</NavLink>
            <NavLink className="nav-icon-logs" to="/super-admin/logs">Logs</NavLink>
            <NavLink className="nav-icon-terminal" to="/super-admin/terminal">CMD Terminal</NavLink>
          </div>}
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
