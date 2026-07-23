import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { API_BASE_URL } from "../api/client";
import { logoutAndRedirectHome } from "../auth/logout";
import { useAuthStore } from "../store/authStore";
import { Icon, type IconName } from "./icons";
import { NotificationBell } from "./StudentNotificationBell";

const HOVER_CLOSE_DELAY = 220;

interface QuickLink {
  title: string;
  description: string;
  path: string;
  icon: IconName;
}

interface PortalTopBarProps {
  fallbackRoute: string;
  notificationEyebrow?: string;
  notificationsPath?: string;
  notificationsHref?: string;
  roleLabel?: string;
}

function avatarUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function userInitials(firstName: string | undefined, lastName: string | undefined, email: string | undefined) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim();
  if (initials) return initials.toUpperCase();
  return (email?.[0] ?? "U").toUpperCase();
}

function displayName(firstName: string | undefined, lastName: string | undefined, email: string | undefined) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || "User";
}

function readableRole(role: string | undefined) {
  if (!role) return "User";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function quickLinksForRole(role: string | undefined): QuickLink[] {
  const commonSettings: QuickLink[] = [
    { title: "My Profile", description: "Account details and avatar", path: "/profile", icon: "user" },
    { title: "Active Sessions", description: "Signed-in devices and sessions", path: "/sessions", icon: "session" },
    { title: "Change Password", description: "Update account password", path: "/change-password", icon: "lock" },
  ];

  if (role === "SUPER_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/super-admin${item.path}` }));
  if (role === "SA_INSTRUCTOR") return commonSettings.map((item) => ({ ...item, path: `/super-admin/instructor${item.path}` }));
  if (role === "INSTITUTE_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/institute-portal${item.path}` }));
  if (role === "INST_INSTRUCTOR") return commonSettings.slice(1).map((item) => ({ ...item, path: `/institute-instructor${item.path}` }));
  return commonSettings.map((item) => ({ ...item, path: `/student${item.path}` }));
}

export function PortalTopBar({
  fallbackRoute,
  notificationEyebrow,
  notificationsPath,
  notificationsHref,
  roleLabel,
}: PortalTopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const resolvedAvatarUrl = avatarUrl(user?.avatar_url);
  const name = displayName(user?.first_name, user?.last_name, user?.email);
  const initials = userInitials(user?.first_name, user?.last_name, user?.email);
  const subtitle = roleLabel ?? readableRole(user?.role);
  const quickLinks = useMemo(() => quickLinksForRole(user?.role), [user?.role]);

  function cancelScheduledClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    cancelScheduledClose();
    setMenuOpen(true);
  }

  function closeMenuNow() {
    cancelScheduledClose();
    setMenuOpen(false);
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      closeTimer.current = null;
    }, HOVER_CLOSE_DELAY);
  }

  useEffect(() => {
    if (!menuOpen || !dropdownRef.current) return;
    gsap.fromTo(
      dropdownRef.current,
      { opacity: 0, y: -16, scale: 0.86, transformOrigin: "top right" },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.65)" },
    );
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenuNow();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenuNow();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => () => cancelScheduledClose(), []);

  async function handleLogout() {
    closeMenuNow();
    await logoutAndRedirectHome();
  }

  return (
    <header className="portal-app-bar">
      <div className="portal-app-actions">
        <NotificationBell eyebrow={notificationEyebrow} fallbackRoute={fallbackRoute} notificationsPath={notificationsPath} notificationsHref={notificationsHref} />
        <div
          className="portal-user-menu"
          ref={menuRef}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            className="portal-user-chip"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeMenuNow() : openMenu())}
          >
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt="" className="portal-user-avatar" />
            ) : (
              <span className="portal-user-avatar is-initials">{initials}</span>
            )}
            <span className="portal-user-text">
              <strong>{name}</strong>
              <span>{subtitle}</span>
            </span>
            <Icon name="chevronDown" className={`portal-user-chevron${menuOpen ? " is-open" : ""}`} />
          </button>

          {menuOpen && (
            <div className="portal-user-dropdown" role="menu" ref={dropdownRef}>
              {quickLinks.map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  key={item.path}
                  className="portal-user-dropdown-item"
                  onClick={() => {
                    closeMenuNow();
                    navigate(item.path);
                  }}
                >
                  <Icon name={item.icon} />
                  <span>
                    <strong>{item.title}</strong>
                    <em>{item.description}</em>
                  </span>
                </button>
              ))}
              <span className="portal-user-dropdown-divider" />
              <button type="button" role="menuitem" className="portal-user-dropdown-item is-logout" onClick={handleLogout}>
                <Icon name="logout" />
                <span><strong>Logout</strong></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
