import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { instagramSettingsStrings as strings } from "./InstagramSettings.strings";

interface FeedItem {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  views_count?: number;
  timestamp?: string;
}

interface InstagramSettingsData {
  id: number;
  is_enabled: boolean;
  access_token_masked?: string;
  has_access_token: boolean;
  instagram_account_id?: string;
  username: string;
  fetch_limit: number;
  feed_items: FeedItem[];
  last_fetched_at?: string;
  updated_at?: string;
}

const LIMIT_OPTIONS = [
  { value: 4, label: "4 items", sublabel: "Compact row" },
  { value: 6, label: "6 items", sublabel: "2 rows on mobile" },
  { value: 8, label: "8 items", sublabel: "Standard 4x2 showcase" },
  { value: 12, label: "12 items", sublabel: "Expanded gallery" },
  { value: 16, label: "16 items", sublabel: "Maximum" },
];

export function InstagramSettings() {
  const [data, setData] = useState<InstagramSettingsData | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [username, setUsername] = useState("visa_house_imm");
  const [accessToken, setAccessToken] = useState("");
  const [fetchLimit, setFetchLimit] = useState(8);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [showToken, setShowToken] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearingFeed, setClearingFeed] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Add Reel / Post by URL Modal State
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [reelUrl, setReelUrl] = useState("");
  const [reelCaption, setReelCaption] = useState("");
  const [reelThumbnail, setReelThumbnail] = useState("");
  const [reelLikes, setReelLikes] = useState<number | "">(1450);
  const [reelViews, setReelViews] = useState<number | "">(18500);
  const [reelMediaType, setReelMediaType] = useState<"REEL" | "POST">("REEL");
  const [addingByUrl, setAddingByUrl] = useState(false);

  const handleOpenAddUrlModal = () => {
    setReelUrl("");
    setReelCaption("");
    setReelThumbnail("");
    setReelLikes(1450);
    setReelViews(18500);
    setReelMediaType("REEL");
    setShowAddUrlModal(true);
  };

  const handleUrlChange = (val: string) => {
    setReelUrl(val);
    const lower = val.toLowerCase();
    if (lower.includes("/reel/") || lower.includes("/reels/") || lower.includes("/tv/")) {
      setReelMediaType("REEL");
    } else if (lower.includes("/p/")) {
      setReelMediaType("POST");
    }
  };

  const handleAddReelByUrl = (e: FormEvent) => {
    e.preventDefault();
    if (!reelUrl.trim()) {
      useToastStore.getState().showError("Please enter a valid Instagram URL.");
      return;
    }

    setAddingByUrl(true);
    const payload = {
      url: reelUrl.trim(),
      media_type: reelMediaType,
      thumbnail_url: reelThumbnail.trim() || undefined,
      caption: reelCaption.trim() || undefined,
      like_count: typeof reelLikes === "number" ? reelLikes : 1200,
      views_count: typeof reelViews === "number" ? reelViews : 15000,
    };

    apiClient
      .post<InstagramSettingsData>("/super-admin/instagram-settings/feed-items/by-url", payload)
      .then(({ data: res }) => {
        setAddingByUrl(false);
        setShowAddUrlModal(false);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess("Instagram Reel/Post added to live showcase!");
      })
      .catch((err) => {
        setAddingByUrl(false);
        const msg = err?.response?.data?.detail || "Failed to add Instagram item.";
        useToastStore.getState().showError(msg);
      });
  };

  // Edit Reel / Post Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editMediaType, setEditMediaType] = useState<"REEL" | "POST">("REEL");
  const [editPermalink, setEditPermalink] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editLikes, setEditLikes] = useState<number | "">(0);
  const [editViews, setEditViews] = useState<number | "">(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEditModal = (item: FeedItem) => {
    setEditingItemId(item.id);
    const isReel = (item.media_type || "").toUpperCase() === "REEL" || (item.permalink || "").includes("/reel/");
    setEditMediaType(isReel ? "REEL" : "POST");
    setEditPermalink(item.permalink || "");
    setEditThumbnail(item.thumbnail_url || item.media_url || "");
    setEditCaption(item.caption || "");
    setEditLikes(item.like_count ?? 0);
    setEditViews(item.views_count ?? 0);
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingItemId) return;

    setSavingEdit(true);
    const payload = {
      media_type: editMediaType,
      permalink: editPermalink.trim() || undefined,
      thumbnail_url: editThumbnail.trim() || undefined,
      caption: editCaption.trim() || undefined,
      like_count: typeof editLikes === "number" ? editLikes : 0,
      views_count: typeof editViews === "number" ? editViews : 0,
    };

    apiClient
      .put<InstagramSettingsData>(`/super-admin/instagram-settings/feed-items/${editingItemId}`, payload)
      .then(({ data: res }) => {
        setSavingEdit(false);
        setShowEditModal(false);
        setEditingItemId(null);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess("Instagram Reel/Post updated successfully!");
      })
      .catch((err) => {
        setSavingEdit(false);
        const msg = err?.response?.data?.detail || "Failed to update item.";
        useToastStore.getState().showError(msg);
      });
  };

  const handleToggleEnable = (nextValue: boolean) => {
    setIsEnabled(nextValue);
    setToggling(true);

    const payload: {
      is_enabled: boolean;
      username: string;
      fetch_limit: number;
    } = {
      is_enabled: nextValue,
      username: (username || "visa_house_imm").trim().replace(/^@/, ""),
      fetch_limit: Number(fetchLimit || 8),
    };

    apiClient
      .put<InstagramSettingsData>("/super-admin/instagram-settings", payload)
      .then(({ data: res }) => {
        setToggling(false);
        setData(res);
        setIsEnabled(res.is_enabled);
        useToastStore
          .getState()
          .showSuccess(
            nextValue
              ? "Instagram feed is now ENABLED on homepage."
              : "Instagram feed is now DISABLED on homepage."
          );
      })
      .catch((err) => {
        setToggling(false);
        setIsEnabled(!nextValue);
        const msg = err?.response?.data?.detail || "Failed to update feed status.";
        useToastStore.getState().showError(msg);
      });
  };

  const loadSettings = () => {
    setLoading(true);
    apiClient
      .get<InstagramSettingsData>("/super-admin/instagram-settings")
      .then(({ data: res }) => {
        if (res) {
          setData(res);
          setIsEnabled(res.is_enabled);
          setUsername(res.username || "visa_house_imm");
          setFetchLimit(res.fetch_limit || 8);
          setFeedItems(res.feed_items || []);
          if (res.has_access_token) {
            setAccessToken(res.access_token_masked || "••••••••••••••••");
          } else {
            setAccessToken("");
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setTestResult(null);

    const payload: {
      is_enabled: boolean;
      username: string;
      fetch_limit: number;
      access_token?: string;
    } = {
      is_enabled: isEnabled,
      username: username.trim().replace(/^@/, ""),
      fetch_limit: Number(fetchLimit),
    };

    // If user modified token from placeholder
    if (accessToken && !accessToken.startsWith("••") && !accessToken.startsWith("****")) {
      payload.access_token = accessToken.trim();
    }

    apiClient
      .put<InstagramSettingsData>("/super-admin/instagram-settings", payload)
      .then(({ data: res }) => {
        setSaving(false);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess(strings.savedBanner);
      })
      .catch((err) => {
        setSaving(false);
        const msg = err?.response?.data?.detail || "Failed to update Instagram settings.";
        useToastStore.getState().showError(msg);
      });
  };

  const handleSeedSamples = () => {
    setSeeding(true);
    apiClient
      .post<InstagramSettingsData>("/super-admin/instagram-settings/seed-samples", {})
      .then(({ data: res }) => {
        setSeeding(false);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess(strings.seedSuccessBanner);
      })
      .catch(() => {
        setSeeding(false);
        useToastStore.getState().showError("Could not populate sample items.");
      });
  };

  const handleTestConnection = () => {
    setTestingConnection(true);
    setTestResult(null);

    const payload: { access_token?: string } = {};
    if (accessToken && !accessToken.startsWith("••") && !accessToken.startsWith("****")) {
      payload.access_token = accessToken.trim();
    }

    apiClient
      .post<{ success: boolean; message: string }>("/super-admin/instagram-settings/test-connection", payload)
      .then(({ data: res }) => {
        setTestingConnection(false);
        setTestResult(res);
        if (res.success) {
          useToastStore.getState().showSuccess(res.message);
        } else {
          useToastStore.getState().showError(res.message);
        }
      })
      .catch((err) => {
        setTestingConnection(false);
        const msg = err?.response?.data?.detail || "Connection test failed.";
        setTestResult({ success: false, message: msg });
        useToastStore.getState().showError(msg);
      });
  };

  const handleRefreshLiveFeed = () => {
    setRefreshingFeed(true);
    apiClient
      .post<InstagramSettingsData>("/super-admin/instagram-settings/refresh-feed", {})
      .then(({ data: res }) => {
        setRefreshingFeed(false);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess(strings.fetchSuccessBanner);
      })
      .catch((err) => {
        setRefreshingFeed(false);
        const msg = err?.response?.data?.detail || "Failed to fetch live feed from Instagram.";
        useToastStore.getState().showError(msg);
      });
  };

  const handleClearAllFeedItems = () => {
    if (!window.confirm(strings.preview.confirmClear)) return;
    setClearingFeed(true);
    apiClient
      .delete<InstagramSettingsData>("/super-admin/instagram-settings/feed-items")
      .then(({ data: res }) => {
        setClearingFeed(false);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess(strings.clearSuccessBanner);
      })
      .catch((err) => {
        setClearingFeed(false);
        const msg = err?.response?.data?.detail || "Failed to clear feed items.";
        useToastStore.getState().showError(msg);
      });
  };

  const handleDeleteSingleItem = (itemId: string) => {
    if (!window.confirm(strings.preview.confirmDelete)) return;
    setDeletingItemId(itemId);
    apiClient
      .delete<InstagramSettingsData>(`/super-admin/instagram-settings/feed-items/${itemId}`)
      .then(({ data: res }) => {
        setDeletingItemId(null);
        setData(res);
        setFeedItems(res.feed_items || []);
        useToastStore.getState().showSuccess(strings.deleteSuccessBanner);
      })
      .catch((err) => {
        setDeletingItemId(null);
        const msg = err?.response?.data?.detail || "Failed to delete feed item.";
        useToastStore.getState().showError(msg);
      });
  };

  if (loading) {
    return <p className="hint">{strings.loading}</p>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "var(--text)" }}>
            {strings.heading}
          </h2>
          <p className="hint" style={{ margin: 0, maxWidth: 650 }}>
            {strings.subheading}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button secondary"
            onClick={handleSeedSamples}
            disabled={seeding}
            title="Populate test sample reels to preview the layout immediately"
          >
            <Icon name="plus" /> {seeding ? strings.samples.seedBusy : strings.samples.seedBtn}
          </button>
        </div>
      </div>

      {/* Main Form Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        {/* Card 1: Visibility & Master Enable Switch */}
        <div className="form-card wide" style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: isEnabled ? "#10b981" : "#94a3b8",
                  }}
                />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {isEnabled ? strings.toggle.enabledLabel : strings.toggle.disabledLabel}
                </h3>
              </div>
              <p className="hint" style={{ margin: 0, fontSize: 13 }}>
                {isEnabled ? strings.toggle.enabledDesc : strings.toggle.disabledDesc}
              </p>
            </div>

            <button
              type="button"
              disabled={toggling}
              onClick={() => handleToggleEnable(!isEnabled)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
                cursor: toggling ? "wait" : "pointer",
                border: "1px solid",
                borderColor: isEnabled ? "#10b981" : "var(--border)",
                backgroundColor: isEnabled ? "rgba(16, 185, 129, 0.12)" : "var(--chip)",
                color: isEnabled ? "#059669" : "var(--text-muted)",
                transition: "all 0.2s ease",
              }}
            >
              {toggling
                ? "Updating..."
                : isEnabled
                ? "Feed Active (Click to Disable)"
                : "Feed Hidden (Click to Enable)"}
            </button>
          </div>
        </div>

        {/* Card 2: Instagram Graph API Credentials & Settings */}
        <div className="form-card wide" style={{ padding: "28px" }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary)",
              marginBottom: 18,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
            }}
          >
            {strings.credentials.title}
          </h3>

          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div>
              <label>{strings.credentials.usernameLabel}</label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={strings.credentials.usernamePlaceholder}
                  style={{ paddingLeft: 28 }}
                />
              </div>
              <span className="hint" style={{ display: "block", marginTop: 4, fontSize: 11.5 }}>
                {strings.credentials.usernameHint}
              </span>
            </div>

            <div>
              <label htmlFor="instagram-fetch-limit-select" style={{ display: "block", marginBottom: 6 }}>
                {strings.credentials.limitLabel}
              </label>
              <SearchableSelect
                id="instagram-fetch-limit-select"
                options={LIMIT_OPTIONS}
                value={fetchLimit}
                onChange={(val) => setFetchLimit(Number(val))}
                searchable={false}
                ariaLabel={strings.credentials.limitLabel}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ margin: 0 }}>
                {strings.credentials.tokenLabel}
              </label>
              {data?.has_access_token && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    color: "#059669",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  ✓ {strings.credentials.tokenConfigured}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={strings.credentials.tokenPlaceholder}
                  style={{ fontFamily: showToken ? "monospace" : "inherit", fontSize: 13 }}
                />
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowToken(!showToken)}
                style={{ padding: "0 14px", flexShrink: 0 }}
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? "Hide" : "Reveal"}
              </button>
            </div>
            <span className="hint" style={{ display: "block", marginTop: 4, fontSize: 11.5 }}>
              {strings.credentials.tokenHint}
            </span>
          </div>

          {/* Action Buttons: Save Configuration, Test Connection, Live Refresh */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className="button primary"
              onClick={() => handleSave()}
              disabled={saving}
              style={{ minWidth: 160 }}
            >
              {saving ? strings.saveBusy : strings.saveLabel}
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? strings.credentials.testConnectionBusy : strings.credentials.testConnectionBtn}
            </button>

            {data?.has_access_token && (
              <button
                type="button"
                className="button secondary"
                onClick={handleRefreshLiveFeed}
                disabled={refreshingFeed}
              >
                {refreshingFeed ? strings.credentials.refreshFeedBusy : strings.credentials.refreshFeedBtn}
              </button>
            )}

            {testResult && (
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: testResult.success ? "#059669" : "#dc2626",
                  padding: "6px 12px",
                  borderRadius: 6,
                  backgroundColor: testResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(220, 38, 38, 0.1)",
                  border: `1px solid ${testResult.success ? "rgba(16, 185, 129, 0.25)" : "rgba(220, 38, 38, 0.25)"}`,
                }}
              >
                {testResult.success ? "✓ " : "✕ "} {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Live Feed Preview Grid */}
        <div className="form-card wide" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>
                {strings.preview.title}
              </h3>
              <p className="hint" style={{ margin: 0, fontSize: 12.5 }}>
                {strings.preview.subtitle} ({feedItems.length} active items)
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="button primary"
                onClick={handleOpenAddUrlModal}
                style={{
                  fontSize: 12.5,
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #E1306C 0%, #C13584 50%, #833AB4 100%)",
                  border: "none",
                  color: "#ffffff",
                  boxShadow: "0 2px 8px rgba(193, 53, 132, 0.3)",
                }}
                title="Add specific Instagram Reel or Post by URL"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Add Reel by URL
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={handleSeedSamples}
                disabled={seeding}
                style={{ fontSize: 12.5, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Populate test sample reels"
              >
                <Icon name="plus" /> {seeding ? strings.samples.seedBusy : "Add Samples"}
              </button>

              {feedItems.length > 0 && (
                <button
                  type="button"
                  className="button secondary danger"
                  onClick={handleClearAllFeedItems}
                  disabled={clearingFeed}
                  style={{ fontSize: 12.5, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Remove all items from feed"
                >
                  <Icon name="trash" /> {clearingFeed ? strings.preview.clearBusy : strings.preview.clearBtn}
                </button>
              )}
            </div>
          </div>

          {feedItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "var(--chip)", borderRadius: 12 }}>
              <p className="hint" style={{ margin: "0 0 16px" }}>{strings.preview.empty}</p>
              <button type="button" className="button primary" onClick={handleSeedSamples} disabled={seeding}>
                {seeding ? strings.samples.seedBusy : strings.samples.seedBtn}
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {feedItems.map((item) => {
                const isReel = item.media_type === "REEL" || item.media_type === "VIDEO";
                return (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    {/* Media Thumbnail Container */}
                    <div style={{ position: "relative", aspectRatio: "4/5", overflow: "hidden", backgroundColor: "#000" }}>
                      <img
                        src={item.thumbnail_url || item.media_url}
                        alt="Instagram preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />

                      {/* Type Badge */}
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          padding: "3px 8px",
                          borderRadius: 999,
                          backgroundColor: "rgba(0, 0, 0, 0.65)",
                          backdropFilter: "blur(4px)",
                          color: "#ffffff",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {isReel ? "▶ Reel" : "Post"}
                      </span>

                      {/* Actions: Edit & Delete Button Group */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          zIndex: 3,
                        }}
                      >
                        {/* Edit Item Button */}
                        <button
                          type="button"
                          title="Edit Reel / Post"
                          onClick={() => handleOpenEditModal(item)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: "rgba(0, 0, 0, 0.65)",
                            backdropFilter: "blur(4px)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            padding: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.9)";
                            e.currentTarget.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Delete Item Button */}
                        <button
                          type="button"
                          title={strings.preview.deleteItem}
                          onClick={() => handleDeleteSingleItem(item.id)}
                          disabled={deletingItemId === item.id}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: "rgba(0, 0, 0, 0.65)",
                            backdropFilter: "blur(4px)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            padding: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.9)";
                            e.currentTarget.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          {deletingItemId === item.id ? (
                            <span style={{ fontSize: 10 }}>...</span>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Engagement overlay stats */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "16px 10px 8px",
                          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                          color: "#ffffff",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        <span>♥ {item.like_count ? item.like_count.toLocaleString() : 0}</span>
                        {isReel && item.views_count ? (
                          <span>👁 {item.views_count.toLocaleString()}</span>
                        ) : (
                          <span>💬 {item.comments_count ? item.comments_count.toLocaleString() : 0}</span>
                        )}
                      </div>
                    </div>

                    {/* Caption snippet */}
                    <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 12,
                          color: "var(--text)",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.caption || "No caption provided"}
                      </p>
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--primary)",
                          textDecoration: "none",
                        }}
                      >
                        View on Instagram ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 4: Meta Graph API Guide */}
        <div className="form-card wide" style={{ padding: "20px 24px", backgroundColor: "var(--chip)", border: "1px dashed var(--border)" }}>
          <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 8px", color: "var(--text)" }}>
            {strings.guide.title}
          </h4>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <li>{strings.guide.step1}</li>
            <li>{strings.guide.step2}</li>
            <li>{strings.guide.step3}</li>
            <li>{strings.guide.step4}</li>
          </ol>
        </div>
      </div>

      {/* Add Reel / Post by URL Modal */}
      {showAddUrlModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => !addingByUrl && setShowAddUrlModal(false)}
        >
          <div
            className="ig-add-url-modal-card"
            style={{
              backgroundColor: "#182234",
              background: "linear-gradient(180deg, #1e293b 0%, #111827 100%)",
              borderRadius: 20,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              width: "100%",
              maxWidth: 540,
              padding: "28px",
              position: "relative",
              color: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(220, 39, 67, 0.35)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>Add Reel / Post by URL</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>Import any public Instagram Reel or Post directly</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddUrlModal(false)}
                disabled={addingByUrl}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  cursor: "pointer",
                  color: "#cbd5e1",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.2s ease",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddReelByUrl}>
              {/* URL Input */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                  <span>Instagram URL <span style={{ color: "#f43f5e" }}>*</span></span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: reelMediaType === "REEL" ? "rgba(225, 48, 108, 0.18)" : "rgba(59, 130, 246, 0.18)", color: reelMediaType === "REEL" ? "#ff6b8b" : "#60a5fa", border: `1px solid ${reelMediaType === "REEL" ? "rgba(225, 48, 108, 0.3)" : "rgba(59, 130, 246, 0.3)"}` }}>
                    {reelMediaType === "REEL" ? "▶ REEL DETECTED" : "🖼 POST DETECTED"}
                  </span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/reel/DFK8j21s.../"
                  value={reelUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1.5px solid rgba(255, 255, 255, 0.18)",
                    color: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "#94a3b8" }}>
                  Paste any Instagram Reel or Post link.
                </p>
              </div>

              {/* Thumbnail URL Input */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                  Thumbnail / Cover Image URL <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://... image URL (or leave blank for high-res cover)"
                  value={reelThumbnail}
                  onChange={(e) => setReelThumbnail(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1.5px solid rgba(255, 255, 255, 0.18)",
                    color: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "#94a3b8" }}>
                  Leave blank to use our high-res education cover.
                </p>
              </div>

              {/* Caption */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                  Caption / Description <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Master LanguageCert Part 2 with these 3 tips! #Speaking #VisaHouse"
                  value={reelCaption}
                  onChange={(e) => setReelCaption(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1.5px solid rgba(255, 255, 255, 0.18)",
                    color: "#ffffff",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Like Count</label>
                  <input
                    type="number"
                    min="0"
                    value={reelLikes}
                    onChange={(e) => setReelLikes(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>View Count</label>
                  <input
                    type="number"
                    min="0"
                    value={reelViews}
                    onChange={(e) => setReelViews(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddUrlModal(false)}
                  disabled={addingByUrl}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    color: "#ffffff",
                    padding: "10px 20px",
                    borderRadius: 10,
                    fontWeight: 650,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingByUrl}
                  style={{
                    background: "linear-gradient(135deg, #E1306C, #C13584, #833AB4)",
                    border: "none",
                    color: "#ffffff",
                    padding: "10px 24px",
                    borderRadius: 10,
                    fontWeight: 750,
                    fontSize: 13.5,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(225, 48, 108, 0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {addingByUrl ? "Adding..." : "Add to Showcase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reel / Post Modal */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => !savingEdit && setShowEditModal(false)}
        >
          <div
            className="ig-edit-url-modal-card"
            style={{
              backgroundColor: "#182234",
              background: "linear-gradient(180deg, #1e293b 0%, #111827 100%)",
              borderRadius: 20,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              width: "100%",
              maxWidth: 540,
              padding: "28px",
              position: "relative",
              color: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>Edit Reel / Post</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>Modify thumbnail, caption, or engagement metrics</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  cursor: "pointer",
                  color: "#cbd5e1",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.2s ease",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {/* Type Selection & Permalink */}
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Type</label>
                  <select
                    value={editMediaType}
                    onChange={(e) => setEditMediaType(e.target.value as "REEL" | "POST")}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "11px 12px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="REEL" style={{ background: "#1e293b", color: "#fff" }}>▶ Reel</option>
                    <option value="POST" style={{ background: "#1e293b", color: "#fff" }}>🖼 Post</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Instagram URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.instagram.com/reel/.../"
                    value={editPermalink}
                    onChange={(e) => setEditPermalink(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "11px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Thumbnail URL Input */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                  Thumbnail / Cover Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://... image URL"
                  value={editThumbnail}
                  onChange={(e) => setEditThumbnail(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1.5px solid rgba(255, 255, 255, 0.18)",
                    color: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Caption */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                  Caption / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Master LanguageCert Part 2 with these 3 tips! #Speaking #VisaHouse"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1.5px solid rgba(255, 255, 255, 0.18)",
                    color: "#ffffff",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Like Count</label>
                  <input
                    type="number"
                    min="0"
                    value={editLikes}
                    onChange={(e) => setEditLikes(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>View Count</label>
                  <input
                    type="number"
                    min="0"
                    value={editViews}
                    onChange={(e) => setEditViews(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1.5px solid rgba(255, 255, 255, 0.18)",
                      color: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingEdit}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    color: "#ffffff",
                    padding: "10px 20px",
                    borderRadius: 10,
                    fontWeight: 650,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                    border: "none",
                    color: "#ffffff",
                    padding: "10px 24px",
                    borderRadius: 10,
                    fontWeight: 750,
                    fontSize: 13.5,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
