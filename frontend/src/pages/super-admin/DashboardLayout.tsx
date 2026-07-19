import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

export function DashboardLayout() {
  const navigate = useNavigate();
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

  return (
    <div className="dashboard">
      <aside className="dashboard-nav">
        <div className="dashboard-brand">
          <h2>IELTS LMS</h2>
          <p className="dashboard-role">Super Admin</p>
        </div>
        <nav>
          <NavLink to="/super-admin/accounts">Admin Accounts</NavLink>
          <NavLink to="/super-admin/profile">My Profile</NavLink>
          <NavLink to="/super-admin/sessions">Active Sessions</NavLink>
          <NavLink to="/super-admin/change-password">Change Password</NavLink>
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
