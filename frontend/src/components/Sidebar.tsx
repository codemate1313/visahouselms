import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./icons";

export interface SubMenuItem {
  key: string;
  label: string;
  to: string;
  badge?: string | number;
}

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  to?: string;
  badge?: string | number;
  badgeColor?: "red" | "green" | "gray";
  children?: SubMenuItem[];
  isRed?: boolean;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

interface SidebarProps {
  brandTitle?: string;
  brandSubtitle?: string;
  brandLogoUrl?: string | null;
  sections: MenuSection[];
  onLogout?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Ensures ONLY ONE menu item in the entire sidebar is active at any given time.
 * Returns the unique item key for the best matching route.
 */
function getActiveItemKey(sections: MenuSection[], pathname: string): string | null {
  // 1. Exact match check first
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.to === pathname) {
            return child.key;
          }
        }
      }
      if (item.to && item.to === pathname) {
        return item.key;
      }
    }
  }

  // 2. Prefix match check for nested routes
  let bestKey: string | null = null;
  let maxLen = 0;

  for (const section of sections) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.to !== "/" && pathname.startsWith(child.to) && child.to.length > maxLen) {
            maxLen = child.to.length;
            bestKey = child.key;
          }
        }
      }
      if (item.to && item.to !== "/" && pathname.startsWith(item.to) && item.to.length > maxLen) {
        maxLen = item.to.length;
        bestKey = item.key;
      }
    }
  }

  return bestKey;
}

export function Sidebar({
  brandTitle = "IELTS LMS",
  brandSubtitle,
  brandLogoUrl,
  sections,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const location = useLocation();

  // Determine the SINGLE active item key
  const activeKey = getActiveItemKey(sections, location.pathname);

  // Keep track of expanded accordions
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Automatically expand parent accordions when current active key belongs to a child
  useEffect(() => {
    if (!activeKey) return;
    setExpandedKeys((current) => {
      const next = { ...current };
      let changed = false;
      sections.forEach((section) => {
        section.items.forEach((item) => {
          if (item.children?.length) {
            const isChildActive = item.children.some((child) => child.key === activeKey);
            if (isChildActive && !next[item.key]) {
              next[item.key] = true;
              changed = true;
            }
          }
        });
      });
      return changed ? next : current;
    });
  }, [activeKey, sections]);

  const navRef = useRef<HTMLElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; left: number; width: number; height: number; opacity: number }>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  // Calculate sliding indicator position whenever activeKey or route changes
  useLayoutEffect(() => {
    const updateIndicator = () => {
      if (!navRef.current) return;
      const activeEl = navRef.current.querySelector<HTMLElement>(
        ".sidebar-item-link.is-active, .sidebar-item-btn.is-active, .sidebar-subitem-link.is-sub-active"
      );
      if (activeEl) {
        const navRect = navRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        setIndicatorStyle({
          top: activeRect.top - navRect.top + navRef.current.scrollTop,
          left: activeRect.left - navRect.left,
          width: activeRect.width,
          height: activeRect.height,
          opacity: 1,
        });
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 60);
    return () => clearTimeout(timer);
  }, [activeKey, location.pathname, expandedKeys, collapsed]);

  const toggleAccordion = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <>
    <aside className={`huge-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-container">
        {brandLogoUrl && (
          <div className="sidebar-brand-logo-box">
            <img src={brandLogoUrl} alt={`${brandTitle} logo`} className="sidebar-brand-logo-image" />
          </div>
        )}
        {!collapsed && (
          <div className="sidebar-brand-text">
            <h1 className="sidebar-brand-title">{brandTitle}</h1>
            {brandSubtitle && (
              <span className="sidebar-brand-subtitle">{brandSubtitle}</span>
            )}
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Icon
              name="chevronDown"
              className={`collapse-chevron ${collapsed ? "rotated" : ""}`}
            />
          </button>
        )}
      </div>

      {/* 3. Navigation Sections */}
      <nav ref={navRef} className="sidebar-nav-scroll" style={{ position: "relative" }}>
        {/* Apple iOS Sliding Active Indicator Pill */}
        <div
          className="apple-sidebar-active-indicator"
          style={{
            transform: `translate(${indicatorStyle.left}px, ${indicatorStyle.top}px)`,
            width: indicatorStyle.width > 0 ? `${indicatorStyle.width}px` : undefined,
            height: indicatorStyle.height > 0 ? `${indicatorStyle.height}px` : undefined,
            opacity: indicatorStyle.opacity,
          }}
        />
        {sections.map((section, sIndex) => (
          <div key={sIndex} className="sidebar-section">
            {section.title && (
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{section.title}</span>
              </div>
            )}
            <ul className="sidebar-menu-list">
              {section.items.map((item) => {
                const isAccordion = !!(item.children && item.children.length > 0);
                const isExpanded = !!expandedKeys[item.key] || collapsed;

                // Check if any child of this accordion is currently active
                const isParentActive =
                  isAccordion &&
                  item.children?.some((child) => child.key === activeKey);

                const isItemDirectlyActive = item.key === activeKey;

                if (isAccordion) {
                  return (
                    <li
                      key={item.key}
                      className={`sidebar-menu-item accordion-item ${
                        isExpanded ? "is-open" : ""
                      } ${isParentActive ? "parent-active" : ""}`}
                    >
                      <button
                        type="button"
                        className={`sidebar-item-btn ${
                          collapsed && isParentActive ? "is-active" : ""
                        }`}
                        onClick={() => toggleAccordion(item.key)}
                        title={collapsed ? item.label : undefined}
                      >
                        <div className="sidebar-item-icon-wrap">
                          <Icon name={item.icon} className="sidebar-icon" />
                        </div>
                        <span className="sidebar-item-label">{item.label}</span>

                        {item.badge !== undefined && (
                          <span
                            className={`sidebar-badge badge-${
                              item.badgeColor || "red"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}

                        <Icon
                          name="chevronDown"
                          className={`sidebar-accordion-arrow ${
                            isExpanded ? "arrow-up" : ""
                          }`}
                        />

                        {collapsed && (
                          <div className="sidebar-tooltip">{item.label}</div>
                        )}
                      </button>

                      {/* Sub-menu Dropdown List with connector line */}
                      <div className={`sidebar-submenu-transition-wrapper ${isExpanded && !collapsed ? 'is-open' : ''}`}>
                        <div className="sidebar-submenu-wrapper">
                          <div className="sidebar-tree-line" />
                          <ul className="sidebar-submenu-list">
                            {item.children?.map((child) => {
                              const isSubActive = child.key === activeKey;
                              return (
                                <li key={child.key} className="sidebar-submenu-item">
                                  <NavLink
                                    to={child.to}
                                    className={`sidebar-subitem-link ${
                                      isSubActive ? "is-sub-active" : ""
                                    }`}
                                  >
                                    <span className="sidebar-subitem-label">
                                      {child.label}
                                    </span>
                                    {child.badge !== undefined && (
                                      <span className="sidebar-badge badge-red">
                                        {child.badge}
                                      </span>
                                    )}
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </li>
                  );
                }

                // Regular Single NavLink Item
                return (
                  <li key={item.key} className="sidebar-menu-item">
                    <NavLink
                      to={item.to || "#"}
                      className={`sidebar-item-link ${
                        isItemDirectlyActive ? "is-active" : ""
                      } ${item.isRed ? "is-red" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <div className="sidebar-item-icon-wrap">
                        <Icon name={item.icon} className="sidebar-icon" />
                      </div>
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          className={`sidebar-badge badge-${
                            item.badgeColor || "red"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {collapsed && (
                        <div className="sidebar-tooltip">{item.label}</div>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 4. Footer Section (Logout) */}
      {onLogout && (
        <div className="sidebar-footer">
          <ul className="sidebar-menu-list">
            <li className="sidebar-menu-item">
              <button
                type="button"
                className="sidebar-item-link sidebar-footer-btn is-red"
                onClick={() => setShowLogoutModal(true)}
                title={collapsed ? "Logout" : undefined}
              >
                <div className="sidebar-item-icon-wrap">
                  <Icon name="logout" className="sidebar-icon" />
                </div>
                <span className="sidebar-item-label">Logout</span>
                {collapsed && (
                  <div className="sidebar-tooltip">Logout</div>
                )}
              </button>
            </li>
          </ul>
        </div>
      )}

    </aside>

      {/* Logout Confirmation Modal - rendered via portal so it covers the full screen */}
      {showLogoutModal && onLogout && createPortal(
        <div
          className="logout-modal-backdrop"
          onClick={() => setShowLogoutModal(false)}
          role="presentation"
          style={{ position: "fixed", inset: 0, zIndex: 9999 }}
        >
          <div
            className="logout-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <div className="logout-modal-icon-badge">
              <Icon name="logout" className="logout-modal-icon" />
            </div>
            <h2 id="logout-dialog-title" className="logout-modal-title">Confirm Logout</h2>
            <p className="logout-modal-description">
              Are you sure you want to log out of your account? You will need to sign back in to access your portal.
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-btn cancel-btn"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-modal-btn confirm-btn"
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogout();
                }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
