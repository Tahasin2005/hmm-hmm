/**
 * HMM HMM — Shared Utilities, Validation, Sanitization, Icons, Theme, Routing & Toasts
 * Classic ES6 script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var BOOTSTRAPPED_ADMIN_EMAIL = "tahasinahammed58@gmail.com";

  var LIMITS = {
    NAME_MIN: 1,
    NAME_MAX: 80,
    USERNAME_MIN: 3,
    USERNAME_MAX: 20,
    BIO_MAX: 280,
    AVATAR_URL_MAX: 500,
    LOCATION_MAX: 80,
    POST_TEXT_MAX: 2000,
    COMMENT_TEXT_MAX: 1000,
    MESSAGE_TEXT_MAX: 2000,
    REPORT_DETAILS_MAX: 500,
  };

  var USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

  var REPORT_REASONS = [
    "Spam",
    "Harassment",
    "Hate speech",
    "Fake account",
    "Inappropriate content",
    "Other",
  ];

  var AVATAR_COLORS = [
    "#006A4E",
    "#0F766E",
    "#B45309",
    "#BE123C",
    "#1D4ED8",
    "#4D7C0F",
    "#7C2D12",
    "#334155",
  ];

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, maxLength);
  }

  function normalizeUsername(raw) {
    return String(raw == null ? "" : raw)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  function validateUsername(username) {
    var cleaned = String(username == null ? "" : username).trim();
    if (cleaned !== cleaned.toLowerCase()) return "Username must be lowercase.";
    if (cleaned.length < LIMITS.USERNAME_MIN || cleaned.length > LIMITS.USERNAME_MAX) {
      return "Username must be between 3 and 20 characters.";
    }
    if (!USERNAME_REGEX.test(cleaned)) {
      return "Use only lowercase letters, numbers, and underscores.";
    }
    return null;
  }

  function validateOptionalUrl(url) {
    var trimmed = String(url == null ? "" : url).trim();
    if (!trimmed) return null;
    if (trimmed.length > LIMITS.AVATAR_URL_MAX) return "Avatar URL is too long.";
    try {
      var parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "Avatar URL must start with http:// or https://";
      }
      return null;
    } catch (e) {
      return "Please enter a valid image URL.";
    }
  }

  function safeAvatarUrl(url) {
    var trimmed = String(url == null ? "" : url).trim();
    if (!trimmed) return "";
    return validateOptionalUrl(trimmed) === null ? trimmed : "";
  }

  function pickAvatarColor(seed) {
    var s = String(seed || "hmm");
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  function getInitials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "HH";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderAvatarHtml(opts) {
    var name = opts.name;
    var avatarUrl = opts.avatarUrl;
    var avatarColor = opts.avatarColor;
    var size = opts.size || "md";
    var online = opts.online;
    var safeUrl = safeAvatarUrl(avatarUrl);
    var bg = escapeHtml(avatarColor || pickAvatarColor(name || "hmm"));
    var initials = escapeHtml(getInitials(name || "HMM"));
    var inner = safeUrl
      ? '<img src="' +
        escapeHtml(safeUrl) +
        '" alt="' +
        escapeHtml(name || "User") +
        '" loading="lazy" onerror="this.remove();" />'
      : initials;
    var presenceHtml =
      online === true
        ? '<span class="presence-dot" title="Online"></span>'
        : online === false
        ? '<span class="presence-dot offline" title="Offline"></span>'
        : "";
    return (
      '<span class="avatar-wrap">' +
      '<span class="avatar avatar-' +
      size +
      '" style="background:' +
      bg +
      '">' +
      inner +
      "</span>" +
      presenceHtml +
      "</span>"
    );
  }

  function getPairId(uid1, uid2) {
    return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
  }

  function getSortedPair(uid1, uid2) {
    return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
  }

  function getLikeId(postId, userId) {
    return postId + "_" + userId;
  }

  function getFollowId(followerId, followingId) {
    return followerId + "_" + followingId;
  }

  function getFriendRequestId(senderId, receiverId) {
    return senderId + "_" + receiverId;
  }

  function getReportId(reporterId, targetType, targetId) {
    return reporterId + "_" + targetType + "_" + targetId;
  }

  function generateId(prefix) {
    var p = prefix || "id";
    var random =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
        : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    return p + "_" + random;
  }

  function timestampToMs(ts) {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    return 0;
  }

  function formatRelativeTime(ts) {
    var ms = timestampToMs(ts);
    if (!ms) return "Just now";
    var diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (diffSec < 45) return "Just now";
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + "m";
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + "h";
    var diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return diffDay + "d";
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatJoinDate(ts) {
    var ms = timestampToMs(ts);
    if (!ms) return "Recently joined";
    return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function formatMessageTime(ms) {
    if (!ms) return "";
    return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatPresenceLabel(online, lastSeen) {
    if (online) return "Online";
    if (!lastSeen) return "Offline";
    var diffMin = Math.floor((Date.now() - lastSeen) / 60000);
    if (diffMin < 60) return "Last seen recently";
    if (diffMin < 1440) return "Last seen " + Math.floor(diffMin / 60) + "h ago";
    return "Last seen recently";
  }

  function isFileProtocol() {
    return window.location.protocol === "file:";
  }

  function getFriendlyErrorMessage(error, fallback) {
    var fb = fallback || "Something went wrong. Please try again.";
    if (!error) return fb;
    var code = typeof error === "object" && error !== null && error.code ? String(error.code) : "";
    var raw = error instanceof Error ? error.message : String(error);

    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Login failed. Please check your email and password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password is too weak. Use at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":
        return "Unable to connect to Firebase. Check your internet connection.";
      case "auth/popup-closed-by-user":
        return "Sign-in popup was closed before completing.";
      case "auth/operation-not-supported-in-this-environment":
        return "Google Sign-In popup requires HTTPS/HTTP (such as cPanel or Live Server). When opening index.html directly via file://, please use Email & Password sign-in.";
      case "auth/unauthorized-domain":
        return "This domain is not yet authorized in Firebase Console (Authentication -> Settings -> Authorized domains).";
      case "auth/operation-not-allowed":
        return "This sign-in method is not enabled in Firebase Console (Authentication -> Sign-in method).";
      case "auth/requires-recent-login":
        return "For your security, please sign out and sign back in before completing this action.";
      case "permission-denied":
        return "You do not have permission to perform this action.";
      case "unavailable":
        return "Unable to reach Firebase. Please try again shortly.";
      default:
        break;
    }

    if (raw.indexOf("permission-denied") !== -1 || raw.indexOf("Missing or insufficient permissions") !== -1) {
      return "Action blocked by security rules. Make sure your email is verified.";
    }
    if (raw.indexOf("the client is offline") !== -1) {
      return "You appear to be offline. Check your connection.";
    }
    if (raw && raw.length < 180 && raw.indexOf("FirebaseError") === -1) {
      return raw;
    }
    return fb;
  }

  async function createNotificationRecord(params) {
    if (!params.recipientId || !params.sender || params.recipientId === params.sender.uid) return;
    var notificationId = generateId("ntf");
    try {
      await HMM.db.collection("notifications").doc(notificationId).set({
        notificationId: notificationId,
        recipientId: params.recipientId,
        senderId: params.sender.uid,
        senderName: sanitizeText(params.sender.name, 80),
        senderUsername: params.sender.username,
        type: params.type,
        referenceId: String(params.referenceId || "").slice(0, 128),
        message: sanitizeText(params.message, 240),
        isRead: false,
        createdAt: HMM.serverTimestamp(),
      });
    } catch (err) {
      console.warn("Notification create skipped:", err);
    }
  }

  // Theme Manager
  var THEME_KEY = "hmm_theme";

  function getCurrentTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    var mode = theme === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", mode === "dark");
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) {}
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", mode === "dark" ? "#121917" : "#006A4E");
    }
    return mode;
  }

  function toggleTheme() {
    var next = getCurrentTheme() === "dark" ? "light" : "dark";
    return applyTheme(next);
  }

  function initTheme() {
    return applyTheme(getCurrentTheme());
  }

  // Hash Router Helpers (works identically on file:// and https://)
  function parseRoute() {
    var rawHash = (window.location.hash || "").replace(/^#\/?/, "");
    var parts = rawHash.split("?");
    var route = (parts[0] || "").trim().toLowerCase();
    var params = new URLSearchParams(parts[1] || window.location.search || "");
    return { route: route, params: params };
  }

  function navigateTo(route, paramsObj) {
    var hash = "#" + route;
    if (paramsObj) {
      var sp = new URLSearchParams();
      Object.keys(paramsObj).forEach(function (k) {
        if (paramsObj[k] != null && paramsObj[k] !== "") sp.set(k, paramsObj[k]);
      });
      var qs = sp.toString();
      if (qs) hash += "?" + qs;
    }
    if (window.location.hash === hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = hash;
    }
  }

  // Toast
  function showToast(message, type) {
    var container = document.getElementById("hmm-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "hmm-toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    var toast = document.createElement("div");
    toast.className =
      "toast " + (type === "success" ? "toast-success" : type === "error" ? "toast-error" : "");
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.2s ease";
      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 3400);
  }

  // Modal
  function closeModal() {
    var existing = document.getElementById("hmm-modal-backdrop");
    if (existing) existing.remove();
  }

  function openModal(title, bodyHtml, onMount) {
    closeModal();
    var backdrop = document.createElement("div");
    backdrop.id = "hmm-modal-backdrop";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true" aria-label="' +
      escapeHtml(title) +
      '">' +
      '<div class="modal-header">' +
      '<h3 class="modal-title">' +
      escapeHtml(title) +
      "</h3>" +
      '<button type="button" class="icon-btn" id="hmm-modal-close" aria-label="Close modal">' +
      ICONS.close +
      "</button>" +
      "</div>" +
      '<div id="hmm-modal-body">' +
      bodyHtml +
      "</div>" +
      "</div>";
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    var closeBtn = document.getElementById("hmm-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (typeof onMount === "function") {
      onMount(backdrop.querySelector("#hmm-modal-body"), closeModal);
    }
  }

  var ICONS = {
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
    compass: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    message: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    heart: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    heartFilled: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    comment: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    share: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    flag: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    send: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    arrowLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    mapPin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    mail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>',
  };

  HMM.utils = {
    BOOTSTRAPPED_ADMIN_EMAIL: BOOTSTRAPPED_ADMIN_EMAIL,
    LIMITS: LIMITS,
    USERNAME_REGEX: USERNAME_REGEX,
    REPORT_REASONS: REPORT_REASONS,
    AVATAR_COLORS: AVATAR_COLORS,
    ICONS: ICONS,
    escapeHtml: escapeHtml,
    sanitizeText: sanitizeText,
    normalizeUsername: normalizeUsername,
    validateUsername: validateUsername,
    validateOptionalUrl: validateOptionalUrl,
    safeAvatarUrl: safeAvatarUrl,
    pickAvatarColor: pickAvatarColor,
    getInitials: getInitials,
    renderAvatarHtml: renderAvatarHtml,
    getPairId: getPairId,
    getSortedPair: getSortedPair,
    getLikeId: getLikeId,
    getFollowId: getFollowId,
    getFriendRequestId: getFriendRequestId,
    getReportId: getReportId,
    generateId: generateId,
    timestampToMs: timestampToMs,
    formatRelativeTime: formatRelativeTime,
    formatJoinDate: formatJoinDate,
    formatMessageTime: formatMessageTime,
    formatPresenceLabel: formatPresenceLabel,
    isFileProtocol: isFileProtocol,
    getFriendlyErrorMessage: getFriendlyErrorMessage,
    createNotificationRecord: createNotificationRecord,
    getCurrentTheme: getCurrentTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme,
    parseRoute: parseRoute,
    navigateTo: navigateTo,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
  };
})(window.HMM = window.HMM || {});
