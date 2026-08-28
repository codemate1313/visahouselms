import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";
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
  const [uploadingAddCover, setUploadingAddCover] = useState(false);
  const [uploadingEditCover, setUploadingEditCover] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCoverFileChange = async (e: ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isEdit) {
      setUploadingEditCover(true);
    } else {
      setUploadingAddCover(true);
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const { data: res } = await apiClient.post<{ url: string }>("/super-admin/instagram-settings/upload-cover", form);
      if (isEdit) {
        setEditThumbnail(res.url);
      } else {
        setReelThumbnail(res.url);
      }
      useToastStore.getState().showSuccess("Cover image uploaded successfully!");
    } catch {
      useToastStore.getState().showError("Failed to upload cover image. Please check image format.");
    } finally {
      if (isEdit) {
        setUploadingEditCover(false);
        if (editFileInputRef.current) editFileInputRef.current.value = "";
      } else {
        setUploadingAddCover(false);
        if (addFileInputRef.current) addFileInputRef.current.value = "";
      }
    }
  };

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

  const handleClearAllFeedItems = async () => {
    if (!(await confirmDelete(strings.preview.confirmClear, "Clear Instagram feed?"))) return;
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

  const handleDeleteSingleItem = async (itemId: string) => {
    if (!(await confirmAction(strings.preview.confirmDelete, {
      title: "Delete Instagram item?",
      confirmText: "Delete item",
      variant: "danger",
    }))) return;
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
      {/* Main Form Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {/* Card 1: Visibility & Master Enable Switch */}
        <div className="form-card wide" style={{ padding: "18px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    backgroundColor: isEnabled ? "#10b981" : "#94a3b8",
                  }}
                />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {isEnabled ? strings.toggle.enabledLabel : strings.toggle.disabledLabel}
                </h3>
              </div>
              <p className="hint" style={{ margin: 0, fontSize: 12.5 }}>
                {isEnabled ? strings.toggle.enabledDesc : strings.toggle.disabledDesc}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={handleSeedSamples}
                disabled={seeding}
                title="Populate test sample reels & posts"
                style={{
                  background: "#a31c28",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontWeight: 700,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(163, 28, 40, 0.28)",
                  cursor: seeding ? "not-allowed" : "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <Icon name="plus" /> {seeding ? strings.samples.seedBusy : "Populate Samples"}
              </button>

              <ToggleSwitch
                checked={isEnabled}
                onChange={() => handleToggleEnable(!isEnabled)}
                disabled={toggling}
                tooltip={isEnabled ? "Click to disable Instagram feed on homepage" : "Click to enable Instagram feed on homepage"}
              />
            </div>
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
              onClick={() => handleSave()}
              disabled={saving}
              style={{
                background: "#a31c28",
                color: "#ffffff",
                border: "1px solid #a31c28",
                borderRadius: 10,
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 13.5,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 8px rgba(163, 28, 40, 0.3)",
                cursor: saving ? "not-allowed" : "pointer",
                minWidth: 170,
                justifyContent: "center",
                transition: "all 150ms ease",
              }}
            >
              <Icon name="check" /> {saving ? strings.saveBusy : strings.saveLabel}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{
                background: "#0d9488",
                color: "#ffffff",
                border: "1px solid #0d9488",
                borderRadius: 10,
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: 13.5,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
                cursor: testingConnection ? "not-allowed" : "pointer",
                transition: "all 150ms ease",
              }}
            >
              <Icon name="play" /> {testingConnection ? strings.credentials.testConnectionBusy : strings.credentials.testConnectionBtn}
            </button>

            {data?.has_access_token && (
              <button
                type="button"
                onClick={handleRefreshLiveFeed}
                disabled={refreshingFeed}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "1px solid #2563eb",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontWeight: 700,
                  fontSize: 13.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                  cursor: refreshingFeed ? "not-allowed" : "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <Icon name="restore" /> {refreshingFeed ? strings.credentials.refreshFeedBusy : strings.credentials.refreshFeedBtn}
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
                onClick={handleSeedSamples}
                disabled={seeding}
                style={{
                  fontSize: 12.5,
                  padding: "7px 15px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  color: "#ffffff",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.28)",
                  cursor: seeding ? "not-allowed" : "pointer",
                  transition: "all 150ms ease",
                }}
                title="Populate test sample reels"
              >
                <Icon name="plus" /> {seeding ? strings.samples.seedBusy : "Add Samples"}
              </button>

              {feedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllFeedItems}
                  disabled={clearingFeed}
                  style={{
                    fontSize: 12.5,
                    padding: "7px 15px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#dc2626",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    color: "#ffffff",
                    boxShadow: "0 2px 8px rgba(220, 38, 38, 0.28)",
                    cursor: clearingFeed ? "not-allowed" : "pointer",
                    transition: "all 150ms ease",
                  }}
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
              <button
                type="button"
                onClick={handleSeedSamples}
                disabled={seeding}
                style={{
                  background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontWeight: 700,
                  fontSize: 13.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 10px rgba(79, 70, 229, 0.35)",
                  cursor: seeding ? "not-allowed" : "pointer",
                }}
              >
                <Icon name="plus" /> {seeding ? strings.samples.seedBusy : strings.samples.seedBtn}
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
      {showAddUrlModal && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => !addingByUrl && setShowAddUrlModal(false)}
        >
          <div
            className="ig-add-url-modal-card"
            style={{
              backgroundColor: "var(--card, #ffffff)",
              background: "var(--card, #ffffff)",
              borderRadius: 20,
              border: "1px solid var(--border)",
              boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)",
              width: "100%",
              maxWidth: 540,
              padding: "28px",
              position: "relative",
              color: "var(--text)",
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
                    color: "#ffffff",
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
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>Add Reel / Post by URL</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Import any public Instagram Reel or Post directly</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddUrlModal(false)}
                disabled={addingByUrl}
                style={{
                  background: "var(--chip, #f1f5f9)",
                  backgroundColor: "var(--chip, #f1f5f9)",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  cursor: "pointer",
                  color: "var(--text)",
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
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  <span>Instagram URL <span style={{ color: "var(--danger)" }}>*</span></span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: reelMediaType === "REEL" ? "rgba(225, 48, 108, 0.12)" : "rgba(59, 130, 246, 0.12)", color: reelMediaType === "REEL" ? "#E1306C" : "#2563eb", border: `1px solid ${reelMediaType === "REEL" ? "rgba(225, 48, 108, 0.28)" : "rgba(59, 130, 246, 0.28)"}` }}>
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
                    background: "var(--input-bg, #ffffff)",
                    backgroundColor: "var(--input-bg, #ffffff)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  Paste any Instagram Reel or Post link.
                </p>
              </div>

              {/* Thumbnail / Cover Image Input & Upload */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    Cover Image <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>(Upload or URL)</span>
                  </label>
                  {reelThumbnail && (
                    <button
                      type="button"
                      onClick={() => setReelThumbnail("")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger, #ef4444)",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      Clear Cover
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="file"
                    ref={addFileInputRef}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleCoverFileChange(e, false)}
                  />

                  <button
                    type="button"
                    onClick={() => addFileInputRef.current?.click()}
                    disabled={uploadingAddCover}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      background: "var(--chip, #f1f5f9)",
                      backgroundColor: "var(--chip, #f1f5f9)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      cursor: uploadingAddCover ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="Upload cover image file from device"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {uploadingAddCover ? "Uploading..." : "Upload File"}
                  </button>

                  <input
                    type="url"
                    placeholder="Or paste image URL (https://...)"
                    value={reelThumbnail}
                    onChange={(e) => setReelThumbnail(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {reelThumbnail ? (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: "var(--surface-muted, rgba(0,0,0,0.03))", border: "1px solid var(--border)" }}>
                    <img
                      src={reelThumbnail}
                      alt="Cover preview"
                      style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
                      {reelThumbnail}
                    </div>
                  </div>
                ) : (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Upload an image or paste a direct image URL (or leave blank for high-res cover).
                  </p>
                )}
              </div>

              {/* Caption */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  Caption / Description <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>(Optional)</span>
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
                    background: "var(--input-bg, #ffffff)",
                    backgroundColor: "var(--input-bg, #ffffff)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
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
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Like Count</label>
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
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>View Count</label>
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
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
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
                    background: "var(--chip, #f1f5f9)",
                    backgroundColor: "var(--chip, #f1f5f9)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
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
        </div>,
        document.body
      )}

      {/* Edit Reel / Post Modal */}
      {showEditModal && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => !savingEdit && setShowEditModal(false)}
        >
          <div
            className="ig-edit-url-modal-card"
            style={{
              backgroundColor: "var(--card, #ffffff)",
              background: "var(--card, #ffffff)",
              borderRadius: 20,
              border: "1px solid var(--border)",
              boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)",
              width: "100%",
              maxWidth: 540,
              padding: "28px",
              position: "relative",
              color: "var(--text)",
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
                    color: "#ffffff",
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
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>Edit Reel / Post</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Modify thumbnail, caption, or engagement metrics</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={savingEdit}
                style={{
                  background: "var(--chip, #f1f5f9)",
                  backgroundColor: "var(--chip, #f1f5f9)",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  cursor: "pointer",
                  color: "var(--text)",
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
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Type</label>
                  <select
                    value={editMediaType}
                    onChange={(e) => setEditMediaType(e.target.value as "REEL" | "POST")}
                    style={{
                      width: "100%",
                      fontSize: 13.5,
                      padding: "11px 12px",
                      borderRadius: 10,
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="REEL">▶ Reel</option>
                    <option value="POST">🖼 Post</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Instagram URL</label>
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
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Thumbnail / Cover Image Input & Upload */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    Cover Image <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>(Upload or URL)</span>
                  </label>
                  {editThumbnail && (
                    <button
                      type="button"
                      onClick={() => setEditThumbnail("")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger, #ef4444)",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      Clear Cover
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleCoverFileChange(e, true)}
                  />

                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingEditCover}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      background: "var(--chip, #f1f5f9)",
                      backgroundColor: "var(--chip, #f1f5f9)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      cursor: uploadingEditCover ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="Upload cover image file from device"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {uploadingEditCover ? "Uploading..." : "Upload File"}
                  </button>

                  <input
                    type="url"
                    placeholder="Or paste image URL (https://...)"
                    value={editThumbnail}
                    onChange={(e) => setEditThumbnail(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {editThumbnail ? (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: "var(--surface-muted, rgba(0,0,0,0.03))", border: "1px solid var(--border)" }}>
                    <img
                      src={editThumbnail}
                      alt="Cover preview"
                      style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
                      {editThumbnail}
                    </div>
                  </div>
                ) : (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Upload an image or paste a direct image URL.
                  </p>
                )}
              </div>

              {/* Caption */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
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
                    background: "var(--input-bg, #ffffff)",
                    backgroundColor: "var(--input-bg, #ffffff)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
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
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Like Count</label>
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
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>View Count</label>
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
                      background: "var(--input-bg, #ffffff)",
                      backgroundColor: "var(--input-bg, #ffffff)",
                      border: "1.5px solid var(--border)",
                      color: "var(--text)",
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
                    background: "var(--chip, #f1f5f9)",
                    backgroundColor: "var(--chip, #f1f5f9)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
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
        </div>,
        document.body
      )}
    </div>
  );
}
