/**
 * KLORIX (window.HMM) — Shared Utilities, Reactions, Smart Link & Safe Embed Engine,
 * @Mentions & #Hashtags, Two-Way User Blocks, Admin Announcements, Feed Promos,
 * Dynamic Site Config, Admin Badge Helpers, Validation, Sanitization, Icons, Theme, Routing & Modals.
 * Classic script (works directly via file://, Vercel static deploy, and cPanel).
 */
(function (HMM) {
  "use strict";

  var BOOTSTRAPPED_ADMIN_EMAIL = "tahasinahammed58@gmail.com";
  var CANONICAL_HOST = "klorixcommunity.vercel.app";

  var LIMITS = {
    NAME_MIN: 1,
    NAME_MAX: 80,
    USERNAME_MIN: 3,
    USERNAME_MAX: 20,
    BIO_MAX: 280,
    AVATAR_URL_MAX: 150000,
    LOCATION_MAX: 80,
    JOB_TITLE_MAX: 80,
    WORKPLACE_MAX: 100,
    POST_TEXT_MAX: 2000,
    COMMENT_TEXT_MAX: 1000,
    MESSAGE_TEXT_MAX: 2000,
    REPORT_DETAILS_MAX: 500,
    GROUP_NAME_MAX: 60,
    ANNOUNCEMENT_TITLE_MAX: 140,
    ANNOUNCEMENT_MESSAGE_MAX: 2000,
  };

  // ============================================================================
  // SOCIAL MEDIA PLATFORMS REGISTRY (Profile Links)
  // ============================================================================
  var SOCIAL_PLATFORMS = [
    {
      id: "facebook",
      label: "Facebook",
      color: "#1877F2",
      placeholder: "https://facebook.com/yourprofile",
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>',
    },
    {
      id: "instagram",
      label: "Instagram",
      color: "#E4405F",
      placeholder: "https://instagram.com/yourhandle",
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    },
    {
      id: "tiktok",
      label: "TikTok",
      color: "#FE2C55",
      placeholder: "https://tiktok.com/@yourhandle",
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>',
    },
    {
      id: "youtube",
      label: "YouTube",
      color: "#FF0000",
      placeholder: "https://youtube.com/@yourchannel",
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    },
    {
      id: "blogger",
      label: "Blogger",
      color: "#F57D00",
      placeholder: "https://yourblog.blogspot.com",
      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 13.5c0 .83-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5v-9C8 6.67 8.67 6 9.5 6h3.5c1.38 0 2.5 1.12 2.5 2.5 0 .61-.22 1.17-.59 1.6.64.44 1.09 1.17 1.09 2.02V16.5zm-5.5-7h2.25c.41 0 .75-.34.75-.75S13.16 8 12.75 8H10.5v1.5zm3 4.5h-3v1.5h3c.41 0 .75-.34.75-.75s-.34-.75-.75-.75z"/></svg>',
    },
    {
      id: "twitter",
      label: "Twitter (X)",
      color: "#0F1419",
      placeholder: "https://x.com/yourhandle",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    },
  ];

  var SOCIAL_PLATFORM_MAP = {};
  SOCIAL_PLATFORMS.forEach(function (sp) {
    SOCIAL_PLATFORM_MAP[sp.id] = sp;
  });

  function normalizeSocialUrl(rawUrl) {
    var s = String(rawUrl || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
      var parsed = new URL(s);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.href.slice(0, 300);
    } catch (e) {
      return "";
    }
  }

  function sanitizeSocialLinks(links) {
    if (!Array.isArray(links)) return [];
    var out = [];
    var seen = new Set();
    for (var i = 0; i < links.length && out.length < 10; i++) {
      var item = links[i];
      if (!item || typeof item !== "object") continue;
      var pid = String(item.platform || "").toLowerCase().trim();
      if (!SOCIAL_PLATFORM_MAP[pid]) continue;
      var cleanUrl = normalizeSocialUrl(item.url);
      if (!cleanUrl) continue;
      var key = pid + "|" + cleanUrl.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ platform: pid, url: cleanUrl });
    }
    return out;
  }

  function getGoogleAccountPhotoUrl(firebaseUser) {
    if (!firebaseUser) return "";
    if (firebaseUser.photoURL && /^https?:\/\//i.test(firebaseUser.photoURL)) {
      return String(firebaseUser.photoURL).trim();
    }
    if (Array.isArray(firebaseUser.providerData)) {
      for (var i = 0; i < firebaseUser.providerData.length; i++) {
        var p = firebaseUser.providerData[i];
        if (p && p.photoURL && /^https?:\/\//i.test(p.photoURL)) {
          return String(p.photoURL).trim();
        }
      }
    }
    return "";
  }

  function getProfileShareUrl(username) {
    var clean = normalizeUsername(username || "");
    if (!clean) return "https://" + CANONICAL_HOST + "/";
    if (typeof window !== "undefined" && window.location && (window.location.protocol === "https:" || window.location.protocol === "http:")) {
      var host = window.location.hostname || "";
      if (host === CANONICAL_HOST) {
        return "https://" + CANONICAL_HOST + "/" + encodeURIComponent(clean);
      }
      return window.location.origin + "/" + encodeURIComponent(clean);
    }
    return "https://" + CANONICAL_HOST + "/" + encodeURIComponent(clean);
  }

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

  // ============================================================================
  // FACEBOOK-STYLE 7 REACTIONS CONFIGURATION
  // ============================================================================
  var REACTIONS = [
    { type: "like", emoji: "👍", label: "Like", color: "#1877F2" },
    { type: "love", emoji: "❤️", label: "Love", color: "#F33E58" },
    { type: "care", emoji: "🥰", label: "Care", color: "#F7B125" },
    { type: "haha", emoji: "😂", label: "Haha", color: "#F7B125" },
    { type: "wow", emoji: "😮", label: "Wow", color: "#F7B125" },
    { type: "sad", emoji: "😢", label: "Sad", color: "#F7B125" },
    { type: "angry", emoji: "😡", label: "Angry", color: "#E9710F" },
  ];

  var REACTION_MAP = {};
  REACTIONS.forEach(function (r) {
    REACTION_MAP[r.type] = r;
  });

  function getReactionMeta(type) {
    return REACTION_MAP[type] || REACTION_MAP.like;
  }

  // ============================================================================
  // SANITIZATION & VALIDATION
  // ============================================================================
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
    if (trimmed.indexOf("data:image/") === 0 && trimmed.length <= 350000) return null;
    if (/^assets\/[a-zA-Z0-9_./-]+$/.test(trimmed)) return null;
    if (trimmed.length > LIMITS.AVATAR_URL_MAX) return "URL is too long.";
    try {
      var parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "URL must start with http:// or https://";
      }
      return null;
    } catch (e) {
      return "Please enter a valid URL.";
    }
  }

  function safeAvatarUrl(url) {
    var trimmed = String(url == null ? "" : url).trim();
    if (!trimmed) return "";
    if (trimmed.indexOf("data:image/") === 0 && trimmed.length <= 350000) return trimmed;
    if (/^assets\/[a-zA-Z0-9_./-]+$/.test(trimmed)) return trimmed;
    return validateOptionalUrl(trimmed) === null ? trimmed : "";
  }

  function pickAvatarColor(seed) {
    var s = String(seed || "klorix");
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  function getInitials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "KX";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderAvatarHtml(opts) {
    var name = opts.name;
    var avatarUrl = opts.avatarUrl;
    var avatarColor = opts.avatarColor;
    var size = opts.size || "md";
    var online = opts.online;
    var isAdminAvatar = Boolean(opts.isAdmin);
    var safeUrl = safeAvatarUrl(avatarUrl);
    var bg = escapeHtml(avatarColor || pickAvatarColor(name || "klorix"));
    var initials = escapeHtml(getInitials(name || "KLORIX"));
    var inner = safeUrl
      ? '<img src="' +
        escapeHtml(safeUrl) +
        '" alt="' +
        escapeHtml(name || "User") +
        '" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove();" />'
      : initials;
    var presenceHtml =
      online === true
        ? '<span class="presence-dot" title="Online"></span>'
        : online === false
        ? '<span class="presence-dot offline" title="Offline"></span>'
        : "";
    var avatarTickHtml =
      isAdminAvatar && (size === "xl" || size === "lg")
        ? '<span class="avatar-blue-tick" title="Verified Official Administrator" aria-label="Verified Admin">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="11" fill="#1877F2"/>' +
          '<path d="M7.5 12.3l3 3 6-6.5" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg></span>"
        : "";
    return (
      '<span class="avatar-wrap' + (isAdminAvatar ? " avatar-wrap-admin" : "") + '">' +
      '<span class="avatar avatar-' +
      size +
      (isAdminAvatar ? " avatar-admin-ring" : "") +
      '" style="background:' +
      bg +
      '">' +
      inner +
      "</span>" +
      avatarTickHtml +
      presenceHtml +
      "</span>"
    );
  }

  // ============================================================================
  // OFFICIAL ADMIN BLUE VERIFIED TICK BADGE HELPERS
  // ============================================================================
  function isOfficialAdminUser(entity) {
    if (!entity) return false;
    if (entity.role === "admin" || entity.authorRole === "admin" || entity.userRole === "admin") {
      return true;
    }
    var primaryUid = siteConfigState && siteConfigState.primaryAdminUid;
    if (primaryUid && (entity.uid === primaryUid || entity.authorId === primaryUid || entity.userId === primaryUid)) {
      return true;
    }
    return false;
  }

  function renderAdminBadgeHtml(variant) {
    var brandName = (siteConfigState && siteConfigState.siteName) || "KLORIX";
    var blueTickSvg =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 1.75l2.39 1.98 3.07-.37 1.16 2.86 2.86 1.16-.37 3.07L23.09 12l-1.98 2.39.37 3.07-2.86 1.16-1.16 2.86-3.07-.37L12 23.09l-2.39-1.98-3.07.37-1.16-2.86-2.86-1.16.37-3.07L.91 12l1.98-2.39-.37-3.07 2.86-1.16 1.16-2.86 3.07.37L12 1.75z" fill="#1877F2"/>' +
      '<path d="M8.4 12.3l2.45 2.45 5.05-5.35" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";

    if (variant === "full") {
      return (
        '<span class="admin-verified-pill" title="Verified Official ' + escapeHtml(brandName) + ' Administrator">' +
        blueTickSvg +
        "<span>Official Admin</span></span>"
      );
    }
    return (
      '<span class="admin-verified-icon" title="Verified Official ' + escapeHtml(brandName) + ' Administrator" aria-label="Verified Admin">' +
      blueTickSvg +
      "</span>"
    );
  }

  // ============================================================================
  // IMAGE FILE COMPRESSION (Logo, Favicon, Group Avatar, Announcements, Feed Ads)
  // ============================================================================
  function compressImageFileToDataUrl(file, maxDim, quality, maxDataChars) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Please select a valid image file (PNG, JPG, WebP, or SVG)."));
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        reject(new Error("Image file is too large. Please choose an image under 6 MB."));
        return;
      }
      var maxLen = maxDataChars || (maxDim && maxDim >= 600 ? 310000 : 140000);
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("Could not read the selected image file."));
      };
      reader.onload = function (ev) {
        var src = ev.target.result;
        if (file.type === "image/svg+xml" && src.length <= maxLen) {
          resolve(src);
          return;
        }
        var img = new Image();
        img.onerror = function () {
          reject(new Error("Selected file could not be decoded as an image."));
        };
        img.onload = function () {
          var limit = maxDim || 256;
          var w = img.width || limit;
          var h = img.height || limit;
          if (w > limit || h > limit) {
            var scale = Math.min(limit / w, limit / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx2d = canvas.getContext("2d");
          ctx2d.clearRect(0, 0, w, h);
          ctx2d.drawImage(img, 0, 0, w, h);
          var mime = file.type === "image/png" && limit <= 320 ? "image/png" : "image/jpeg";
          var out = canvas.toDataURL(mime, quality || 0.84);
          if (out.length > maxLen) {
            out = canvas.toDataURL("image/jpeg", 0.72);
          }
          if (out.length > maxLen) {
            out = canvas.toDataURL("image/jpeg", 0.58);
          }
          resolve(out);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  // ============================================================================
  // @MENTIONS & #HASHTAGS EXTRACTION + RICH TEXT LINKIFIER
  // ============================================================================
  var URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
  var MENTION_REGEX = /(^|[^a-zA-Z0-9_])@([a-z0-9_]{3,20})\b/g;
  var HASHTAG_REGEX = /(^|[^\w#\u0980-\u09FF])#([a-zA-Z0-9_\u0980-\u09FF]{2,40})/g;

  function extractMentions(rawText) {
    var str = String(rawText || "");
    var found = [];
    var seen = new Set();
    // Strip URLs first so @ in URLs aren't treated as mentions
    var cleaned = str.replace(URL_REGEX, " ");
    MENTION_REGEX.lastIndex = 0;
    var m;
    while ((m = MENTION_REGEX.exec(cleaned)) !== null) {
      var uname = m[2].toLowerCase();
      if (!seen.has(uname) && found.length < 15) {
        seen.add(uname);
        found.push(uname);
      }
    }
    return found;
  }

  function extractHashtags(rawText) {
    var str = String(rawText || "");
    var found = [];
    var seen = new Set();
    var cleaned = str.replace(URL_REGEX, " ");
    HASHTAG_REGEX.lastIndex = 0;
    var m;
    while ((m = HASHTAG_REGEX.exec(cleaned)) !== null) {
      var tag = m[2].toLowerCase();
      if (!seen.has(tag) && found.length < 15) {
        seen.add(tag);
        found.push(tag);
      }
    }
    return found;
  }

  function formatNonUrlChunk(chunk) {
    if (!chunk) return "";
    // Tokenize mentions and hashtags in a single pass on plain text
    var tokenRegex = /(^|[^a-zA-Z0-9_])@([a-z0-9_]{3,20})\b|(^|[^\w#\u0980-\u09FF])#([a-zA-Z0-9_\u0980-\u09FF]{2,40})/g;
    var out = "";
    var last = 0;
    var m;
    while ((m = tokenRegex.exec(chunk)) !== null) {
      out += escapeHtml(chunk.slice(last, m.index));
      if (m[2]) {
        // @mention
        var preM = m[1] || "";
        var uname = m[2].toLowerCase();
        out +=
          escapeHtml(preM) +
          '<a href="#profile?u=' +
          encodeURIComponent(uname) +
          '" class="mention-link" data-mention="' +
          escapeHtml(uname) +
          '">@' +
          escapeHtml(uname) +
          "</a>";
      } else if (m[4]) {
        // #hashtag
        var preH = m[3] || "";
        var rawTag = m[4];
        out +=
          escapeHtml(preH) +
          '<a href="#explore?q=' +
          encodeURIComponent("#" + rawTag.toLowerCase()) +
          '" class="hashtag-link" data-hashtag="' +
          escapeHtml(rawTag.toLowerCase()) +
          '">#' +
          escapeHtml(rawTag) +
          "</a>";
      }
      last = m.index + m[0].length;
    }
    out += escapeHtml(chunk.slice(last));
    return out;
  }

  // ============================================================================
  // SAFE EMBED PARSER & NATIVE PLAYER (YouTube, Facebook, Vimeo — Strict Whitelist)
  // ============================================================================
  function extractIframeSrc(rawInput) {
    var str = String(rawInput || "").trim();
    if (!str) return { src: "", width: 0, height: 0 };
    if (str.indexOf("<") !== -1 && /<iframe\b/i.test(str)) {
      var srcMatch = str.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      var rawSrc = srcMatch ? (srcMatch[1] || srcMatch[2] || srcMatch[3] || "") : "";
      rawSrc = rawSrc.replace(/&amp;/g, "&").trim();
      // Strip src attribute before matching outer iframe width/height attributes
      var withoutSrc = str.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "");
      var wMatch = withoutSrc.match(/\bwidth\s*=\s*(?:"(\d{2,4})[^"]*"|'(\d{2,4})[^']*'|(\d{2,4}))/i);
      var hMatch = withoutSrc.match(/\bheight\s*=\s*(?:"(\d{2,4})[^"]*"|'(\d{2,4})[^']*'|(\d{2,4}))/i);
      var wVal = wMatch ? parseInt(wMatch[1] || wMatch[2] || wMatch[3] || "0", 10) : 0;
      var hVal = hMatch ? parseInt(hMatch[1] || hMatch[2] || hMatch[3] || "0", 10) : 0;
      return {
        src: rawSrc,
        width: wVal,
        height: hVal,
      };
    }
    return { src: str, width: 0, height: 0 };
  }

  function extractYouTubeId(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") {
        var id1 = u.pathname.split("/").filter(Boolean)[0];
        return id1 && /^[a-zA-Z0-9_-]{6,15}$/.test(id1) ? id1 : null;
      }
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        if (u.pathname === "/watch") {
          var v = u.searchParams.get("v");
          return v && /^[a-zA-Z0-9_-]{6,15}$/.test(v) ? v : null;
        }
        var segs = u.pathname.split("/").filter(Boolean);
        if ((segs[0] === "shorts" || segs[0] === "embed" || segs[0] === "live") && segs[1]) {
          return /^[a-zA-Z0-9_-]{6,15}$/.test(segs[1]) ? segs[1] : null;
        }
      }
    } catch (e) {}
    return null;
  }

  function extractVimeoId(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "vimeo.com") {
        var seg = u.pathname.split("/").filter(Boolean)[0];
        if (seg && /^\d{5,12}$/.test(seg)) return seg;
      }
      if (host === "player.vimeo.com") {
        var segs = u.pathname.split("/").filter(Boolean);
        if (segs[0] === "video" && segs[1] && /^\d{5,12}$/.test(segs[1])) return segs[1];
      }
    } catch (e) {}
    return null;
  }

  function parseSafeEmbedInput(rawInput) {
    var extracted = extractIframeSrc(rawInput);
    var urlStr = extracted.src;
    if (!urlStr) return null;

    var parsed;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    var host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    // 1. YouTube (watch, shorts, live, youtu.be, embed iframe)
    var ytId = extractYouTubeId(urlStr);
    if (ytId) {
      var isShort =
        parsed.pathname.indexOf("/shorts/") !== -1 ||
        (extracted.height > 0 && extracted.width > 0 && extracted.height > extracted.width * 1.15);
      return {
        provider: "youtube",
        embedUrl: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(ytId),
        aspect: isShort ? "9:16" : "16:9",
        videoId: ytId,
        label: isShort ? "YouTube Short" : "YouTube Video",
      };
    }

    // 2. Facebook (official plugins/video.php, plugins/post.php, OR direct Facebook video/reel/post URL)
    if (
      host === "facebook.com" ||
      host === "m.facebook.com" ||
      host === "web.facebook.com" ||
      host === "fb.watch"
    ) {
      if (parsed.pathname.indexOf("/plugins/video.php") === 0) {
        var hrefParam = parsed.searchParams.get("href");
        if (!hrefParam) return null;
        var showVidText = parsed.searchParams.get("show_text") === "true";
        var paramW = parseInt(parsed.searchParams.get("width") || "0", 10) || 0;
        var paramH = parseInt(parsed.searchParams.get("height") || "0", 10) || 0;
        var vidW = extracted.width || paramW || 0;
        var vidH = extracted.height || paramH || 0;
        if (showVidText && vidH >= 320) {
          var clampedVidW = Math.max(350, Math.min(560, vidW || 500));
          var clampedVidH = Math.max(320, Math.min(1400, vidH));
          return {
            provider: "facebook",
            kind: "post",
            embedUrl:
              "https://www.facebook.com/plugins/video.php?href=" +
              encodeURIComponent(hrefParam) +
              "&show_text=true&width=" +
              clampedVidW +
              "&height=" +
              clampedVidH,
            sourceUrl: hrefParam,
            width: clampedVidW,
            height: clampedVidH,
            aspect: "4:3",
            label: "Facebook Video Post",
          };
        }

        // Respect explicit iframe/URL width & height FIRST (Facebook uses /reel/ URLs for horizontal videos too!)
        var hasExplicitDims = vidW > 0 && vidH > 0;
        var fbAspect = "16:9";
        var fbLabel = "Facebook Video";
        var outW = 0;
        var outH = 0;

        if (hasExplicitDims) {
          outW = Math.max(220, Math.min(800, vidW));
          outH = Math.max(160, Math.min(1000, vidH));
          var dimRatio = outW / outH;
          if (dimRatio < 0.85) {
            fbAspect = "9:16";
            fbLabel = "Facebook Reel";
          } else if (dimRatio <= 1.15) {
            fbAspect = "1:1";
            fbLabel = "Facebook Video";
          } else if (dimRatio < 1.5) {
            fbAspect = "4:3";
            fbLabel = "Facebook Video";
          } else {
            fbAspect = "16:9";
            fbLabel = "Facebook Video";
          }
        } else {
          var isReelFallback = hrefParam.indexOf("/reel") !== -1;
          fbAspect = isReelFallback ? "9:16" : "16:9";
          fbLabel = isReelFallback ? "Facebook Reel" : "Facebook Video";
        }

        var cleanFbUrl =
          "https://www.facebook.com/plugins/video.php?href=" +
          encodeURIComponent(hrefParam) +
          "&show_text=false&width=" +
          (outW || 560) +
          (outH ? "&height=" + outH : "");

        return {
          provider: "facebook",
          kind: "video",
          embedUrl: cleanFbUrl,
          sourceUrl: hrefParam,
          width: outW,
          height: outH,
          aspect: fbAspect,
          label: fbLabel,
        };
      }
      if (parsed.pathname.indexOf("/plugins/post.php") === 0) {
        var postHref = parsed.searchParams.get("href");
        if (!postHref) return null;
        var rawPostW = parseInt(extracted.width || parsed.searchParams.get("width") || 0, 10) || 500;
        var rawPostH = parseInt(extracted.height || parsed.searchParams.get("height") || 0, 10) || 680;
        var postW = Math.max(350, Math.min(500, rawPostW));
        var postH = Math.max(320, Math.min(1400, rawPostH));
        var showPostText = parsed.searchParams.get("show_text") === "false" ? "false" : "true";
        return {
          provider: "facebook",
          kind: "post",
          embedUrl:
            "https://www.facebook.com/plugins/post.php?href=" +
            encodeURIComponent(postHref) +
            "&show_text=" +
            showPostText +
            "&width=" +
            postW +
            "&height=" +
            postH,
          sourceUrl: postHref,
          width: postW,
          height: postH,
          aspect: "4:3",
          label: "Facebook Post",
        };
      }
      // Direct Facebook video / reel / watch link
      var lowerPath = parsed.pathname.toLowerCase();
      var isFbVideo =
        host === "fb.watch" ||
        lowerPath.indexOf("/videos/") !== -1 ||
        lowerPath.indexOf("/reel/") !== -1 ||
        lowerPath.indexOf("/watch") === 0 ||
        lowerPath.indexOf("/share/v/") !== -1 ||
        lowerPath.indexOf("/share/r/") !== -1;
      if (isFbVideo) {
        var isReel = lowerPath.indexOf("/reel/") !== -1 || lowerPath.indexOf("/share/r/") !== -1;
        return {
          provider: "facebook",
          kind: "video",
          embedUrl:
            "https://www.facebook.com/plugins/video.php?href=" +
            encodeURIComponent(urlStr) +
            "&show_text=false&width=560",
          sourceUrl: urlStr,
          aspect: isReel ? "9:16" : "16:9",
          label: isReel ? "Facebook Reel" : "Facebook Video",
        };
      }
      // Direct Facebook normal post / photo / permalink / share post link
      var isFbPost =
        lowerPath.indexOf("/posts/") !== -1 ||
        lowerPath.indexOf("/photos/") !== -1 ||
        lowerPath.indexOf("/photo") === 0 ||
        lowerPath.indexOf("/permalink.php") === 0 ||
        lowerPath.indexOf("/story.php") === 0 ||
        lowerPath.indexOf("/share/p/") !== -1;
      if (isFbPost) {
        return {
          provider: "facebook",
          kind: "post",
          embedUrl:
            "https://www.facebook.com/plugins/post.php?href=" +
            encodeURIComponent(urlStr) +
            "&show_text=true&width=500&height=680",
          sourceUrl: urlStr,
          width: 500,
          height: 680,
          aspect: "4:3",
          label: "Facebook Post",
        };
      }
    }

    // 3. Vimeo
    var vimeoId = extractVimeoId(urlStr);
    if (vimeoId) {
      return {
        provider: "vimeo",
        kind: "video",
        embedUrl: "https://player.vimeo.com/video/" + encodeURIComponent(vimeoId),
        aspect: "16:9",
        videoId: vimeoId,
        label: "Vimeo Video",
      };
    }

    return null;
  }

  function fitFacebookPostEmbeds(rootEl) {
    var scope = rootEl || document;
    var viewports = scope.querySelectorAll(".fb-post-embed-viewport[data-fb-w][data-fb-h]");
    viewports.forEach(function (vp) {
      var fbW = parseInt(vp.getAttribute("data-fb-w"), 10) || 500;
      var fbH = parseInt(vp.getAttribute("data-fb-h"), 10) || 680;
      var iframe = vp.querySelector("iframe");
      if (!iframe) return;
      var availW = vp.clientWidth;
      if (!availW) return;
      if (availW < fbW) {
        var scale = availW / fbW;
        iframe.style.width = fbW + "px";
        iframe.style.height = fbH + "px";
        iframe.style.transform = "scale(" + scale.toFixed(4) + ")";
        iframe.style.transformOrigin = "top left";
        vp.style.height = Math.ceil(fbH * scale) + "px";
      } else {
        iframe.style.width = fbW + "px";
        iframe.style.height = fbH + "px";
        iframe.style.transform = "none";
        iframe.style.transformOrigin = "top left";
        vp.style.height = fbH + "px";
      }
    });
  }

  var fbResizeTimer = null;
  if (typeof window !== "undefined") {
    window.addEventListener("resize", function () {
      clearTimeout(fbResizeTimer);
      fbResizeTimer = setTimeout(function () {
        fitFacebookPostEmbeds(document);
      }, 120);
    });
  }

  function renderEmbedPlayerHtml(embedObj) {
    if (!embedObj || !embedObj.embedUrl) return "";
    // Re-validate stored embedUrl strictly before rendering
    var safe = parseSafeEmbedInput(embedObj.embedUrl);
    if (!safe) return "";

    if (safe.kind === "post") {
      var fbW = safe.width || 500;
      var fbH = safe.height || 680;
      var safeSourceLink =
        safe.sourceUrl && validateOptionalUrl(safe.sourceUrl) === null ? safe.sourceUrl : "";

      return (
        '<div class="native-embed-card native-embed-fb-post">' +
        '<div class="fb-post-embed-stage">' +
        '<div class="fb-post-embed-viewport" data-fb-w="' +
        fbW +
        '" data-fb-h="' +
        fbH +
        '" style="max-width:' +
        fbW +
        "px;height:" +
        fbH +
        'px;">' +
        '<iframe src="' +
        escapeHtml(safe.embedUrl) +
        '" title="' +
        escapeHtml(safe.label || "Facebook Post") +
        '" width="' +
        fbW +
        '" height="' +
        fbH +
        '" frameborder="0" scrolling="auto" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
        "</div></div>" +
        '<div class="native-embed-bar">' +
        '<span class="native-embed-provider">' +
        ICONS.globe +
        "<span>" +
        escapeHtml(safe.label || "Facebook Post") +
        "</span></span>" +
        (safeSourceLink
          ? '<a href="' +
            escapeHtml(safeSourceLink) +
            '" target="_blank" rel="noopener noreferrer" class="native-embed-ext-link">Open on Facebook &rarr;</a>'
          : "") +
        "</div></div>"
      );
    }

    var aspect = embedObj.aspect || safe.aspect || "16:9";
    var hasExactDims =
      safe.width > 0 &&
      safe.height > 0 &&
      (!embedObj.aspect || embedObj.aspect === safe.aspect);

    var isVertical = aspect === "9:16";
    var isSquare = aspect === "1:1";
    var ratioClass =
      aspect === "9:16"
        ? "ratio-9-16"
        : aspect === "1:1"
        ? "ratio-1-1"
        : aspect === "4:3"
        ? "ratio-4-3"
        : "ratio-16-9";
    var exactRatioStyle = hasExactDims
      ? ' style="aspect-ratio:' + safe.width + " / " + safe.height + ';"'
      : "";

    var providerLabel =
      safe.provider === "youtube"
        ? "YouTube"
        : safe.provider === "facebook"
        ? "Facebook"
        : "Vimeo";

    var displayLabel = safe.label || providerLabel + " Video";
    if (safe.provider === "facebook" && !isVertical) {
      displayLabel = "Facebook Video";
    } else if (safe.provider === "facebook" && isVertical) {
      displayLabel = "Facebook Reel";
    }

    var safeVidSource =
      safe.sourceUrl && validateOptionalUrl(safe.sourceUrl) === null ? safe.sourceUrl : "";

    return (
      '<div class="native-embed-card ' +
      (isVertical ? "native-embed-vertical" : isSquare ? "native-embed-square" : "") +
      '">' +
      '<div class="native-embed-frame-wrap ' +
      ratioClass +
      '"' +
      exactRatioStyle +
      ">" +
      '<iframe src="' +
      escapeHtml(safe.embedUrl) +
      '" title="' +
      escapeHtml(displayLabel) +
      '" frameborder="0" scrolling="no" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
      "</div>" +
      '<div class="native-embed-bar">' +
      '<span class="native-embed-provider">' +
      ICONS.video +
      "<span>" +
      escapeHtml(displayLabel) +
      "</span></span>" +
      (safeVidSource
        ? '<a href="' +
          escapeHtml(safeVidSource) +
          '" target="_blank" rel="noopener noreferrer" class="native-embed-ext-link">Open original &rarr;</a>'
        : "") +
      "</div></div>"
    );
  }

  // ============================================================================
  // SMART LINK & MEDIA PREVIEW ENGINE
  // ============================================================================
  var ogMemoryCache = new Map();
  var OG_CACHE_PREFIX = "hmm_og_v2_";

  function cleanMatchedUrl(raw) {
    return String(raw || "").replace(/[.,!?;:)\]]+$/, "");
  }

  function extractUrls(text) {
    var matches = String(text || "").match(URL_REGEX);
    if (!matches) return [];
    var seen = new Set();
    var result = [];
    for (var i = 0; i < matches.length; i++) {
      var u = cleanMatchedUrl(matches[i]);
      try {
        var parsed = new URL(u);
        if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !seen.has(u)) {
          seen.add(u);
          result.push(u);
        }
      } catch (e) {}
    }
    return result;
  }

  function linkifyText(rawText) {
    var str = String(rawText || "");
    var out = "";
    var lastIdx = 0;
    URL_REGEX.lastIndex = 0;
    var m;
    while ((m = URL_REGEX.exec(str)) !== null) {
      var full = m[0];
      var clean = cleanMatchedUrl(full);
      var trail = full.slice(clean.length);
      out += formatNonUrlChunk(str.slice(lastIdx, m.index));
      var valid = false;
      try {
        var p = new URL(clean);
        valid = p.protocol === "http:" || p.protocol === "https:";
      } catch (e) {}
      if (valid) {
        out +=
          '<a href="' +
          escapeHtml(clean) +
          '" target="_blank" rel="noopener noreferrer" class="post-inline-link">' +
          escapeHtml(clean) +
          "</a>" +
          escapeHtml(trail);
      } else {
        out += formatNonUrlChunk(full);
      }
      lastIdx = m.index + full.length;
    }
    out += formatNonUrlChunk(str.slice(lastIdx));
    return out;
  }

  function isOwnBrandUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === CANONICAL_HOST) return true;
      if (
        window.location &&
        (window.location.protocol === "https:" || window.location.protocol === "http:") &&
        window.location.hostname
      ) {
        var cur = window.location.hostname.replace(/^www\./, "").toLowerCase();
        if (cur && cur !== "localhost" && cur !== "127.0.0.1" && host === cur) return true;
      }
    } catch (e) {}
    return false;
  }

  function classifyUrl(url) {
    try {
      var u = new URL(url);
      var pathname = u.pathname.toLowerCase();
      var ytId = extractYouTubeId(url);
      if (ytId) return { kind: "youtube", url: url, videoId: ytId, host: "youtube.com" };
      var vimeoId = extractVimeoId(url);
      if (vimeoId) return { kind: "vimeo", url: url, videoId: vimeoId, host: "vimeo.com" };
      if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(pathname)) {
        return { kind: "image", url: url, host: u.hostname.replace(/^www\./, "") };
      }
      if (/\.(mp4|webm|ogg|mov)$/i.test(pathname)) {
        return { kind: "video", url: url, host: u.hostname.replace(/^www\./, "") };
      }
      return { kind: "web", url: url, host: u.hostname.replace(/^www\./, ""), path: u.pathname };
    } catch (e) {
      return null;
    }
  }

  function getCachedOg(url) {
    if (ogMemoryCache.has(url)) return ogMemoryCache.get(url);
    try {
      var raw = sessionStorage.getItem(OG_CACHE_PREFIX + url);
      if (raw) {
        var parsed = JSON.parse(raw);
        ogMemoryCache.set(url, parsed);
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setCachedOg(url, data) {
    ogMemoryCache.set(url, data);
    try {
      sessionStorage.setItem(OG_CACHE_PREFIX + url, JSON.stringify(data));
    } catch (e) {}
  }

  function buildFallbackTitle(url) {
    try {
      var u = new URL(url);
      var segs = u.pathname.split("/").filter(Boolean);
      if (segs.length === 0) return u.hostname.replace(/^www\./, "");
      var last = decodeURIComponent(segs[segs.length - 1]).replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "");
      return last.length > 3 ? last.charAt(0).toUpperCase() + last.slice(1) : u.hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  }

  function renderSmartPreviewHtml(text) {
    var urls = extractUrls(text);
    if (urls.length === 0) return "";
    var primary = classifyUrl(urls[0]);
    if (!primary) return "";

    if (primary.kind === "image") {
      return (
        '<div class="link-preview-card link-preview-media">' +
        '<button type="button" class="media-lightbox-trigger" data-lightbox-img="' + escapeHtml(primary.url) + '" aria-label="View full image">' +
        '<img src="' + escapeHtml(primary.url) + '" alt="Shared image from ' + escapeHtml(primary.host) + '" referrerpolicy="no-referrer" loading="lazy" ' +
        'onerror="this.closest(\'.link-preview-card\').classList.add(\'media-broken\');this.remove();" />' +
        "</button>" +
        '<a href="' + escapeHtml(primary.url) + '" target="_blank" rel="noopener noreferrer" class="link-preview-caption">' +
        ICONS.image + "<span>" + escapeHtml(primary.host) + "</span></a></div>"
      );
    }

    if (primary.kind === "video") {
      return (
        '<div class="link-preview-card link-preview-media">' +
        '<video class="post-video-player" controls playsinline preload="metadata" src="' + escapeHtml(primary.url) + '"></video>' +
        '<a href="' + escapeHtml(primary.url) + '" target="_blank" rel="noopener noreferrer" class="link-preview-caption">' +
        ICONS.play + "<span>Video · " + escapeHtml(primary.host) + "</span></a></div>"
      );
    }

    if (primary.kind === "youtube") {
      var thumb = "https://i.ytimg.com/vi/" + encodeURIComponent(primary.videoId) + "/hqdefault.jpg";
      return (
        '<div class="link-preview-card link-preview-video" data-yt-card="' + escapeHtml(primary.videoId) + '">' +
        '<div class="yt-thumb-wrap" data-yt-play="' + escapeHtml(primary.videoId) + '">' +
        '<img src="' + thumb + '" alt="YouTube video preview" referrerpolicy="no-referrer" loading="lazy" />' +
        '<button type="button" class="yt-play-overlay" aria-label="Play YouTube video">' + ICONS.play + "</button>" +
        "</div>" +
        '<a href="' + escapeHtml(primary.url) + '" target="_blank" rel="noopener noreferrer" class="link-preview-caption">' +
        '<span>YouTube Video</span><span class="text-muted">· Watch on YouTube ↗</span></a></div>'
      );
    }

    if (primary.kind === "vimeo") {
      return (
        '<div class="link-preview-card link-preview-video">' +
        '<div class="video-embed-ratio"><iframe src="https://player.vimeo.com/video/' + encodeURIComponent(primary.videoId) +
        '" title="Vimeo video" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>' +
        '<a href="' + escapeHtml(primary.url) + '" target="_blank" rel="noopener noreferrer" class="link-preview-caption">' +
        '<span>Vimeo Video</span><span class="text-muted">· Open ↗</span></a></div>'
      );
    }

    // Internal KLORIX links ALWAYS render live KLORIX branding (never stale Microlink cache!)
    if (isOwnBrandUrl(primary.url)) {
      var cfg = getSiteConfig();
      var brandTitle = cfg.siteName + (cfg.tagline ? " — " + cfg.tagline : "");
      var brandDesc = cfg.metaDescription || DEFAULT_SITE_CONFIG.metaDescription;
      var brandLogo = cfg.logoUrl || "assets/icons/logo.svg";
      return (
        '<a href="' + escapeHtml(primary.url) + '" class="link-preview-card link-preview-web" data-og-hydrated="1">' +
        '<div class="link-preview-og-img"><img src="assets/images/og-banner.png" alt="' + escapeHtml(brandTitle) + '" loading="lazy" onerror="this.src=\'assets/images/og-banner.svg\';" /></div>' +
        '<div class="link-preview-body">' +
        '<div class="link-preview-host">' +
        '<img src="' + escapeHtml(brandLogo) + '" alt="" class="link-preview-fav" onerror="this.style.display=\'none\'" />' +
        "<span>" + escapeHtml(primary.host.toUpperCase()) + "</span></div>" +
        '<div class="link-preview-title">' + escapeHtml(brandTitle) + "</div>" +
        '<div class="link-preview-desc">' + escapeHtml(brandDesc) + "</div>" +
        "</div></a>"
      );
    }

    // Standard Web URL — render instant card & hydrate OpenGraph metadata asynchronously
    var cached = getCachedOg(primary.url);
    var title = (cached && cached.title) || buildFallbackTitle(primary.url);
    var desc = (cached && cached.description) || primary.url;
    var imgUrl = cached && cached.image ? safeAvatarUrl(cached.image) : "";
    var favicon =
      (cached && cached.logo && safeAvatarUrl(cached.logo)) ||
      "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(primary.host) + "&sz=64";

    return (
      '<a href="' + escapeHtml(primary.url) + '" target="_blank" rel="noopener noreferrer" class="link-preview-card link-preview-web" data-og-url="' +
      escapeHtml(primary.url) + '" data-og-hydrated="' + (cached ? "1" : "0") + '">' +
      (imgUrl
        ? '<div class="link-preview-og-img"><img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(title) +
          '" referrerpolicy="no-referrer" loading="lazy" onerror="this.parentElement.remove();" /></div>'
        : "") +
      '<div class="link-preview-body">' +
      '<div class="link-preview-host">' +
      '<img src="' + escapeHtml(favicon) + '" alt="" class="link-preview-fav" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'" />' +
      "<span>" + escapeHtml((cached && cached.publisher) || primary.host) + "</span></div>" +
      '<div class="link-preview-title">' + escapeHtml(title) + "</div>" +
      '<div class="link-preview-desc">' + escapeHtml(desc) + "</div>" +
      "</div></a>"
    );
  }

  function hydrateLinkPreviews(rootEl) {
    if (!rootEl) return;
    fitFacebookPostEmbeds(rootEl);
    var cards = rootEl.querySelectorAll('.link-preview-web[data-og-hydrated="0"]');
    cards.forEach(function (card) {
      var url = card.getAttribute("data-og-url");
      if (!url || isOwnBrandUrl(url)) return;
      card.setAttribute("data-og-hydrated", "pending");

      var cached = getCachedOg(url);
      if (cached) {
        applyOgToCard(card, cached, url);
        return;
      }

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timeoutId = setTimeout(function () {
        if (controller) controller.abort();
      }, 4500);

      fetch("https://api.microlink.io/?url=" + encodeURIComponent(url), {
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error("OG fetch status " + res.status);
          return res.json();
        })
        .then(function (json) {
          if (json && json.status === "success" && json.data) {
            var d = json.data;
            var meta = {
              title: sanitizeText(d.title || "", 140),
              description: sanitizeText(d.description || "", 220),
              image: d.image && d.image.url ? d.image.url : "",
              logo: d.logo && d.logo.url ? d.logo.url : "",
              publisher: sanitizeText(d.publisher || "", 60),
            };
            setCachedOg(url, meta);
            applyOgToCard(card, meta, url);
          } else {
            card.setAttribute("data-og-hydrated", "1");
          }
        })
        .catch(function () {
          clearTimeout(timeoutId);
          card.setAttribute("data-og-hydrated", "1");
        });
    });
  }

  function applyOgToCard(card, meta) {
    if (!card || !document.body.contains(card)) return;
    card.setAttribute("data-og-hydrated", "1");
    var titleEl = card.querySelector(".link-preview-title");
    var descEl = card.querySelector(".link-preview-desc");
    var hostSpan = card.querySelector(".link-preview-host span");
    if (titleEl && meta.title) titleEl.textContent = meta.title;
    if (descEl && meta.description) descEl.textContent = meta.description;
    if (hostSpan && meta.publisher) hostSpan.textContent = meta.publisher;

    var imgUrl = safeAvatarUrl(meta.image);
    if (imgUrl && !card.querySelector(".link-preview-og-img")) {
      var imgWrap = document.createElement("div");
      imgWrap.className = "link-preview-og-img";
      var img = document.createElement("img");
      img.src = imgUrl;
      img.alt = meta.title || "Link preview";
      img.referrerPolicy = "no-referrer";
      img.loading = "lazy";
      img.onerror = function () {
        imgWrap.remove();
      };
      imgWrap.appendChild(img);
      card.insertBefore(imgWrap, card.firstChild);
    }
  }

  function openImageLightbox(imgUrl) {
    var safe = safeAvatarUrl(imgUrl);
    if (!safe) return;
    var isData = safe.indexOf("data:image/") === 0;
    openModal(
      "Image Preview",
      '<div class="lightbox-wrap"><img src="' + escapeHtml(safe) + '" alt="Full preview" referrerpolicy="no-referrer" />' +
        (!isData
          ? '<div style="display:flex;justify-content:flex-end;margin-top:12px;">' +
            '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Open original ↗</a></div>'
          : "") +
        "</div>"
    );
  }

  // ============================================================================
  // LIVE @MENTION AUTOCOMPLETE DROPDOWN (Works in Post Composer & Comments)
  // ============================================================================
  var mentionUsersCache = [];
  var mentionCacheAt = 0;

  async function getMentionCandidates() {
    var now = Date.now();
    if (mentionUsersCache.length > 0 && now - mentionCacheAt < 45000) {
      return mentionUsersCache;
    }
    try {
      var snap = await HMM.db.collection("users").limit(80).get();
      mentionUsersCache = snap.docs
        .map(function (d) { return d.data(); })
        .filter(function (u) { return u && u.uid && u.username && !u.isSuspended; });
      mentionCacheAt = now;
    } catch (e) {}
    return mentionUsersCache;
  }

  function attachMentionAutocomplete(inputEl, currentUid) {
    if (!inputEl || inputEl.dataset.mentionBound === "1") return function () {};
    inputEl.dataset.mentionBound = "1";

    var menu = document.createElement("div");
    menu.className = "mention-autocomplete hidden";
    document.body.appendChild(menu);

    var activeItems = [];
    var selectedIdx = 0;
    var activeTokenRange = null;

    function hideMenu() {
      menu.classList.add("hidden");
      activeItems = [];
      activeTokenRange = null;
    }

    function positionMenu() {
      var rect = inputEl.getBoundingClientRect();
      var spaceBelow = window.innerHeight - rect.bottom;
      menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + "px";
      menu.style.width = Math.min(Math.max(rect.width, 230), 320) + "px";
      if (spaceBelow < 220 && rect.top > 200) {
        menu.style.top = "auto";
        menu.style.bottom = window.innerHeight - rect.top + 6 + "px";
      } else {
        menu.style.bottom = "auto";
        menu.style.top = rect.bottom + 6 + "px";
      }
    }

    function insertMention(user) {
      if (!activeTokenRange || !user) return;
      var val = inputEl.value;
      var before = val.slice(0, activeTokenRange.start);
      var after = val.slice(activeTokenRange.end);
      var inserted = "@" + user.username + " ";
      inputEl.value = before + inserted + after;
      var caret = before.length + inserted.length;
      inputEl.focus();
      try {
        inputEl.setSelectionRange(caret, caret);
      } catch (e) {}
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      hideMenu();
    }

    function renderMenu() {
      if (activeItems.length === 0) {
        hideMenu();
        return;
      }
      positionMenu();
      menu.innerHTML = activeItems
        .map(function (u, idx) {
          var isAdm = isOfficialAdminUser(u);
          return (
            '<button type="button" class="mention-option ' + (idx === selectedIdx ? "active" : "") + '" data-midx="' + idx + '">' +
            renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "xs", isAdmin: isAdm }) +
            '<span class="mention-option-meta"><span class="mention-option-name">' + escapeHtml(u.name) +
            (isAdm ? " " + renderAdminBadgeHtml("compact") : "") + "</span>" +
            '<span class="mention-option-handle">@' + escapeHtml(u.username) + "</span></span></button>"
          );
        })
        .join("");
      menu.classList.remove("hidden");
    }

    async function checkTrigger() {
      var pos = inputEl.selectionStart != null ? inputEl.selectionStart : inputEl.value.length;
      var beforeCaret = inputEl.value.slice(0, pos);
      var m = beforeCaret.match(/(^|[\s(\[])@([a-zA-Z0-9_]{0,20})$/);
      if (!m) {
        hideMenu();
        return;
      }
      var query = m[2].toLowerCase();
      activeTokenRange = {
        start: pos - m[2].length - 1,
        end: pos,
      };
      var users = await getMentionCandidates();
      var blockedSvc = HMM.blocks;
      activeItems = users
        .filter(function (u) {
          if (currentUid && u.uid === currentUid) return false;
          if (blockedSvc && blockedSvc.isEitherBlocked(u.uid)) return false;
          if (!query) return true;
          return (
            u.username.indexOf(query) !== -1 ||
            (u.nameLower || String(u.name || "").toLowerCase()).indexOf(query) !== -1
          );
        })
        .slice(0, 6);
      selectedIdx = 0;
      renderMenu();
    }

    function onInput() {
      checkTrigger();
    }

    function onKeyDown(e) {
      if (menu.classList.contains("hidden") || activeItems.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % activeItems.length;
        renderMenu();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + activeItems.length) % activeItems.length;
        renderMenu();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        insertMention(activeItems[selectedIdx]);
      } else if (e.key === "Escape") {
        hideMenu();
      }
    }

    function onMenuMouseDown(e) {
      e.preventDefault();
      var btn = e.target.closest("[data-midx]");
      if (!btn) return;
      var idx = parseInt(btn.dataset.midx, 10);
      if (activeItems[idx]) insertMention(activeItems[idx]);
    }

    function onDocClick(e) {
      if (e.target !== inputEl && !menu.contains(e.target)) {
        hideMenu();
      }
    }

    inputEl.addEventListener("input", onInput);
    inputEl.addEventListener("keydown", onKeyDown);
    inputEl.addEventListener("blur", function () {
      setTimeout(hideMenu, 160);
    });
    menu.addEventListener("mousedown", onMenuMouseDown);
    document.addEventListener("click", onDocClick);

    return function cleanup() {
      inputEl.removeEventListener("input", onInput);
      inputEl.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocClick);
      menu.remove();
      delete inputEl.dataset.mentionBound;
    };
  }

  // ============================================================================
  // TWO-WAY USER BLOCK SERVICE (Firestore blocks/{blocker}_{blocked} + RTDB)
  // ============================================================================
  var blockState = {
    uid: "",
    blockedByMe: new Map(), // targetUid -> blockDoc
    blockedMe: new Set(),   // blockerUid
    unsubOut: null,
    unsubIn: null,
    listeners: new Set(),
  };

  function emitBlockChange() {
    blockState.listeners.forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }

  function cleanupBlocks() {
    if (blockState.unsubOut) { blockState.unsubOut(); blockState.unsubOut = null; }
    if (blockState.unsubIn) { blockState.unsubIn(); blockState.unsubIn = null; }
    blockState.uid = "";
    blockState.blockedByMe = new Map();
    blockState.blockedMe = new Set();
    emitBlockChange();
  }

  function initBlocks(uid) {
    if (!uid || !HMM.db) return;
    if (blockState.uid === uid && blockState.unsubOut) return;
    cleanupBlocks();
    blockState.uid = uid;

    blockState.unsubOut = HMM.db
      .collection("blocks")
      .where("blockerId", "==", uid)
      .onSnapshot(
        function (snap) {
          var next = new Map();
          snap.docs.forEach(function (d) {
            var data = d.data();
            if (data && data.blockedId) next.set(data.blockedId, data);
          });
          blockState.blockedByMe = next;
          emitBlockChange();
        },
        function (err) {
          console.warn("Outbound blocks listener warning:", err);
        }
      );

    blockState.unsubIn = HMM.db
      .collection("blocks")
      .where("blockedId", "==", uid)
      .onSnapshot(
        function (snap) {
          var next = new Set();
          snap.docs.forEach(function (d) {
            var data = d.data();
            if (data && data.blockerId) next.add(data.blockerId);
          });
          blockState.blockedMe = next;
          emitBlockChange();
        },
        function (err) {
          console.warn("Inbound blocks listener warning:", err);
        }
      );
  }

  function isBlockedByMe(targetUid) {
    return Boolean(targetUid && blockState.blockedByMe.has(targetUid));
  }

  function hasBlockedMe(targetUid) {
    return Boolean(targetUid && blockState.blockedMe.has(targetUid));
  }

  function isEitherBlocked(targetUid) {
    return Boolean(targetUid && (blockState.blockedByMe.has(targetUid) || blockState.blockedMe.has(targetUid)));
  }

  function getBlockedList() {
    return Array.from(blockState.blockedByMe.values()).sort(function (a, b) {
      return timestampToMs(b.createdAt) - timestampToMs(a.createdAt);
    });
  }

  function subscribeBlocks(fn) {
    if (typeof fn !== "function") return function () {};
    blockState.listeners.add(fn);
    return function () {
      blockState.listeners.delete(fn);
    };
  }

  async function blockUser(currentProfile, targetUser) {
    if (!currentProfile || !targetUser || currentProfile.uid === targetUser.uid) {
      throw new Error("Invalid user to block.");
    }
    var myUid = currentProfile.uid;
    var targetUid = targetUser.uid;
    var blockId = myUid + "_" + targetUid;

    await HMM.db.collection("blocks").doc(blockId).set({
      blockId: blockId,
      blockerId: myUid,
      blockedId: targetUid,
      blockedName: sanitizeText(targetUser.name || "Member", 80),
      blockedUsername: normalizeUsername(targetUser.username || "") || "member",
      blockedAvatarUrl: safeAvatarUrl(targetUser.avatarUrl || ""),
      blockedAvatarColor: targetUser.avatarColor || "#006A4E",
      createdAt: HMM.serverTimestamp(),
    });

    // Sync to RTDB so RTDB security rules also enforce message blocking
    if (HMM.rtdb) {
      HMM.rtdb.ref("blocks/" + myUid + "/" + targetUid).set(true).catch(function () {});
    }

    // Best-effort cleanup of existing friendship, pending requests, and follows in both directions
    var pairId = getPairId(myUid, targetUid);
    var cleanupTasks = [
      HMM.db.collection("friendships").doc(pairId).delete().catch(function () {}),
      HMM.db.collection("friendRequests").doc(getFriendRequestId(myUid, targetUid)).delete().catch(function () {}),
      HMM.db.collection("friendRequests").doc(getFriendRequestId(targetUid, myUid)).delete().catch(function () {}),
      HMM.db.collection("follows").doc(getFollowId(myUid, targetUid)).delete().catch(function () {}),
      HMM.db.collection("follows").doc(getFollowId(targetUid, myUid)).delete().catch(function () {}),
    ];
    await Promise.all(cleanupTasks);
  }

  async function unblockUser(myUid, targetUid) {
    if (!myUid || !targetUid) return;
    var blockId = myUid + "_" + targetUid;
    await HMM.db.collection("blocks").doc(blockId).delete();
    if (HMM.rtdb) {
      HMM.rtdb.ref("blocks/" + myUid + "/" + targetUid).remove().catch(function () {});
    }
  }

  // ============================================================================
  // OFFICIAL ADMIN ANNOUNCEMENTS SERVICE (announcements/{announcementId})
  // ============================================================================
  function subscribeActiveAnnouncements(onData) {
    if (!HMM.db) return function () {};
    return HMM.db
      .collection("announcements")
      .where("isActive", "==", true)
      .limit(10)
      .onSnapshot(
        function (snap) {
          var list = snap.docs
            .map(function (d) { return d.data(); })
            .sort(function (a, b) { return timestampToMs(b.createdAt) - timestampToMs(a.createdAt); });
          onData(list);
        },
        function (err) {
          console.warn("Announcements listener warning:", err);
          onData([]);
        }
      );
  }

  async function getAllAnnouncements() {
    var snap = await HMM.db.collection("announcements").limit(50).get();
    return snap.docs
      .map(function (d) { return d.data(); })
      .sort(function (a, b) { return timestampToMs(b.createdAt) - timestampToMs(a.createdAt); });
  }

  async function createAnnouncement(author, payload) {
    var title = sanitizeText(payload.title, LIMITS.ANNOUNCEMENT_TITLE_MAX);
    var message = sanitizeText(payload.message, LIMITS.ANNOUNCEMENT_MESSAGE_MAX);
    var imageUrl = safeAvatarUrl(payload.imageUrl || "");
    if (!title) throw new Error("Announcement title is required.");
    if (!message) throw new Error("Announcement message is required.");
    var id = generateId("ann");
    await HMM.db.collection("announcements").doc(id).set({
      announcementId: id,
      title: title,
      message: message,
      imageUrl: imageUrl,
      authorId: author.uid,
      authorName: sanitizeText(author.name, 80),
      authorUsername: author.username,
      authorAvatarUrl: safeAvatarUrl(author.avatarUrl || ""),
      authorAvatarColor: author.avatarColor || "#006A4E",
      isActive: payload.isActive !== false,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });
    return id;
  }

  async function updateAnnouncement(id, payload) {
    var updates = { updatedAt: HMM.serverTimestamp() };
    if (payload.title !== undefined) {
      var t = sanitizeText(payload.title, LIMITS.ANNOUNCEMENT_TITLE_MAX);
      if (!t) throw new Error("Title cannot be empty.");
      updates.title = t;
    }
    if (payload.message !== undefined) {
      var m = sanitizeText(payload.message, LIMITS.ANNOUNCEMENT_MESSAGE_MAX);
      if (!m) throw new Error("Message cannot be empty.");
      updates.message = m;
    }
    if (payload.imageUrl !== undefined) {
      updates.imageUrl = safeAvatarUrl(payload.imageUrl || "");
    }
    if (payload.isActive !== undefined) {
      updates.isActive = Boolean(payload.isActive);
    }
    await HMM.db.collection("announcements").doc(id).update(updates);
  }

  async function removeAnnouncement(id) {
    await HMM.db.collection("announcements").doc(id).delete();
  }

  function openAnnouncementModal(author, existing, onSaved) {
    var isEdit = Boolean(existing && existing.announcementId);
    var currentImg = existing ? existing.imageUrl || "" : "";

    openModal(
      isEdit ? "Edit Official Announcement" : "Post Official Announcement",
      '<p class="text-muted" style="font-size:13px;margin-bottom:14px;">Announcements appear pinned at the top of everyone\'s Home Feed with the Official Admin badge.</p>' +
        '<form id="announcement-modal-form">' +
        '<div class="form-group"><label class="form-label" for="ann-title">Title</label>' +
        '<input id="ann-title" class="form-input" type="text" maxlength="140" placeholder="e.g., Welcome to KLORIX Community!" value="' +
        escapeHtml(existing ? existing.title : "") + '" required /></div>' +
        '<div class="form-group"><label class="form-label" for="ann-message">Announcement Message</label>' +
        '<textarea id="ann-message" class="form-textarea" maxlength="2000" rows="4" placeholder="Write your official community announcement... (supports links, @mentions, #hashtags)" required>' +
        escapeHtml(existing ? existing.message : "") + "</textarea></div>" +
        '<div class="form-group"><label class="form-label">Optional Banner Image</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">' +
        '<label class="btn btn-secondary btn-sm" style="cursor:pointer;">Upload Image<input type="file" id="ann-img-file" accept="image/*" style="display:none;" /></label>' +
        '<button type="button" id="ann-img-clear" class="btn btn-ghost btn-sm ' + (currentImg ? "" : "hidden") + '">Remove Image</button>' +
        "</div>" +
        '<input id="ann-img-url" class="form-input" type="text" placeholder="Or paste an image URL (https://...)" value="' +
        escapeHtml(currentImg.indexOf("data:") === 0 ? "" : currentImg) + '" />' +
        '<div id="ann-img-preview" style="margin-top:10px;' + (currentImg ? "" : "display:none;") + '">' +
        (currentImg ? '<img src="' + escapeHtml(currentImg) + '" alt="Announcement preview" style="max-height:180px;width:100%;object-fit:cover;border-radius:10px;border:1px solid var(--border);" />' : "") +
        "</div></div>" +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">' +
        '<button type="button" class="btn btn-secondary" id="ann-cancel-btn">Cancel</button>' +
        '<button type="submit" class="btn btn-primary" id="ann-submit-btn">' + ICONS.megaphone + " " + (isEdit ? "Save Changes" : "Publish to Feed") + "</button>" +
        "</div></form>",
      function (body, close) {
        var fileInput = body.querySelector("#ann-img-file");
        var urlInput = body.querySelector("#ann-img-url");
        var clearBtn = body.querySelector("#ann-img-clear");
        var previewBox = body.querySelector("#ann-img-preview");
        var imgValue = currentImg;

        function refreshPreview() {
          if (imgValue) {
            previewBox.style.display = "block";
            previewBox.innerHTML =
              '<img src="' + escapeHtml(imgValue) + '" alt="Preview" style="max-height:180px;width:100%;object-fit:cover;border-radius:10px;border:1px solid var(--border);" />';
            clearBtn.classList.remove("hidden");
          } else {
            previewBox.style.display = "none";
            previewBox.innerHTML = "";
            clearBtn.classList.add("hidden");
          }
        }

        fileInput.addEventListener("change", async function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          try {
            imgValue = await compressImageFileToDataUrl(f, 960, 0.82, 310000);
            urlInput.value = "";
            refreshPreview();
            showToast("Image attached and optimized.", "success");
          } catch (err) {
            showToast(err.message || "Could not process image.", "error");
          }
        });

        urlInput.addEventListener("input", function () {
          var v = urlInput.value.trim();
          if (validateOptionalUrl(v) === null) {
            imgValue = v;
            refreshPreview();
          }
        });

        clearBtn.addEventListener("click", function () {
          imgValue = "";
          urlInput.value = "";
          fileInput.value = "";
          refreshPreview();
        });

        body.querySelector("#ann-cancel-btn").addEventListener("click", close);

        body.querySelector("#announcement-modal-form").addEventListener("submit", async function (e) {
          e.preventDefault();
          var btn = body.querySelector("#ann-submit-btn");
          var titleVal = body.querySelector("#ann-title").value;
          var msgVal = body.querySelector("#ann-message").value;
          if (!imgValue && urlInput.value.trim()) {
            var urlErr = validateOptionalUrl(urlInput.value.trim());
            if (urlErr) {
              showToast(urlErr, "error");
              return;
            }
            imgValue = urlInput.value.trim();
          }
          btn.disabled = true;
          try {
            if (isEdit) {
              await updateAnnouncement(existing.announcementId, {
                title: titleVal,
                message: msgVal,
                imageUrl: imgValue,
              });
              showToast("Announcement updated!", "success");
            } else {
              await createAnnouncement(author, {
                title: titleVal,
                message: msgVal,
                imageUrl: imgValue,
              });
              showToast("Official announcement published to everyone's Home Feed!", "success");
            }
            close();
            if (typeof onSaved === "function") onSaved();
          } catch (err) {
            showToast(getFriendlyErrorMessage(err), "error");
            btn.disabled = false;
          }
        });
      }
    );
  }

  // ============================================================================
  // ADMIN ANONYMOUS IN-FEED PROMOS / VIDEOS & ADS SERVICE (feedPromos/{promoId})
  // ============================================================================
  function subscribeActivePromos(onData) {
    if (!HMM.db) return function () {};
    return HMM.db
      .collection("feedPromos")
      .where("isActive", "==", true)
      .limit(20)
      .onSnapshot(
        function (snap) {
          var list = snap.docs
            .map(function (d) { return d.data(); })
            .sort(function (a, b) { return timestampToMs(b.createdAt) - timestampToMs(a.createdAt); });
          onData(list);
        },
        function (err) {
          console.warn("Feed promos listener warning:", err);
          onData([]);
        }
      );
  }

  async function getAllPromos() {
    var snap = await HMM.db.collection("feedPromos").limit(50).get();
    return snap.docs
      .map(function (d) { return d.data(); })
      .sort(function (a, b) { return timestampToMs(b.createdAt) - timestampToMs(a.createdAt); });
  }

  async function createPromo(payload) {
    var promoType = payload.promoType === "image_ad" ? "image_ad" : "embed";
    var interval = Math.max(1, Math.min(50, parseInt(payload.intervalPosts, 10) || 4));
    var id = generateId("promo");

    var doc = {
      promoId: id,
      promoType: promoType,
      label: sanitizeText(payload.label || "Featured", 40),
      title: sanitizeText(payload.title || "", 140),
      caption: sanitizeText(payload.caption || "", 600),
      embedProvider: "",
      embedUrl: "",
      embedAspect: "16:9",
      imageUrl: "",
      ctaUrl: "",
      ctaText: sanitizeText(payload.ctaText || "", 40),
      intervalPosts: interval,
      isActive: payload.isActive !== false,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    };

    if (promoType === "embed") {
      var parsed = parseSafeEmbedInput(payload.embedRaw || payload.embedUrl);
      if (!parsed) {
        throw new Error("Please paste a valid YouTube, Facebook, or Vimeo embed code or video URL.");
      }
      doc.embedProvider = parsed.provider;
      doc.embedUrl = parsed.embedUrl;
      doc.embedAspect = parsed.aspect;
    } else {
      var img = safeAvatarUrl(payload.imageUrl || "");
      if (!img) throw new Error("Please upload an image or provide a valid image URL for the ad.");
      doc.imageUrl = img;
    }

    if (payload.ctaUrl && payload.ctaUrl.trim()) {
      var ctaErr = validateOptionalUrl(payload.ctaUrl.trim());
      if (ctaErr) throw new Error("CTA Link: " + ctaErr);
      doc.ctaUrl = payload.ctaUrl.trim();
    }

    await HMM.db.collection("feedPromos").doc(id).set(doc);
    return id;
  }

  async function updatePromo(promoId, updates) {
    var next = Object.assign({}, updates, { updatedAt: HMM.serverTimestamp() });
    await HMM.db.collection("feedPromos").doc(promoId).update(next);
  }

  async function removePromo(promoId) {
    await HMM.db.collection("feedPromos").doc(promoId).delete();
  }

  // ============================================================================
  // DYNAMIC SITE BRANDING & SEO CONFIG MANAGER (siteConfig/general)
  // ============================================================================
  var SITE_CONFIG_CACHE_KEY = "hmm_site_config_cache";
  var DEFAULT_SITE_CONFIG = {
    siteName: "KLORIX",
    tagline: "Connect. Share. Belong.",
    logoUrl: "assets/icons/logo.svg",
    faviconUrl: "assets/icons/favicon.svg",
    metaDescription:
      "KLORIX (KLORIX Community) — Connect. Share. Belong. A modern social network for real-time conversations, community posts, embedded videos, and meaningful connections.",
    metaKeywords:
      "KLORIX, KLORIX Community, social network, community, real-time chat, group chat, video sharing, social media",
    primaryAdminUid: "",
  };

  var siteConfigState = Object.assign({}, DEFAULT_SITE_CONFIG);
  var siteConfigListeners = [];
  var siteConfigUnsub = null;

  function loadCachedSiteConfig() {
    try {
      var raw = localStorage.getItem(SITE_CONFIG_CACHE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Migrate old cached HMM HMM defaults automatically to KLORIX
        if (parsed && parsed.siteName === "HMM HMM") {
          parsed.siteName = DEFAULT_SITE_CONFIG.siteName;
          parsed.metaDescription = DEFAULT_SITE_CONFIG.metaDescription;
          parsed.metaKeywords = DEFAULT_SITE_CONFIG.metaKeywords;
        }
        siteConfigState = Object.assign({}, DEFAULT_SITE_CONFIG, parsed);
      }
    } catch (e) {}
  }

  function saveCachedSiteConfig(cfg) {
    try {
      localStorage.setItem(SITE_CONFIG_CACHE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function applySiteConfigToDom(cfg) {
    var c = cfg || siteConfigState;
    var siteName = c.siteName || DEFAULT_SITE_CONFIG.siteName;
    var tagline = c.tagline != null ? c.tagline : DEFAULT_SITE_CONFIG.tagline;
    var logoUrl = c.logoUrl || DEFAULT_SITE_CONFIG.logoUrl;
    var faviconUrl = c.faviconUrl || DEFAULT_SITE_CONFIG.faviconUrl;
    var desc = c.metaDescription || DEFAULT_SITE_CONFIG.metaDescription;
    var keywords = c.metaKeywords || DEFAULT_SITE_CONFIG.metaKeywords;

    document.title = siteName + (tagline ? " — " + tagline : "");

    var fav = document.getElementById("dynamic-favicon") || document.querySelector('link[rel="icon"]');
    if (!fav) {
      fav = document.createElement("link");
      fav.rel = "icon";
      fav.id = "dynamic-favicon";
      document.head.appendChild(fav);
    }
    fav.href = faviconUrl;
    if (faviconUrl.indexOf(".svg") === -1 && faviconUrl.indexOf("image/svg") === -1) {
      fav.removeAttribute("type");
    } else {
      fav.type = "image/svg+xml";
    }

    function setMeta(selector, attrName, attrVal, content) {
      var el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }
    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('meta[name="keywords"]', "name", "keywords", keywords);
    setMeta('meta[property="og:site_name"]', "property", "og:site_name", siteName);
    setMeta('meta[property="og:title"]', "property", "og:title", siteName + (tagline ? " — " + tagline : ""));
    setMeta('meta[property="og:description"]', "property", "og:description", desc);

    document.querySelectorAll("[data-site-logo]").forEach(function (img) {
      img.src = logoUrl;
      img.alt = siteName;
    });
    document.querySelectorAll("[data-site-name]").forEach(function (el) {
      el.textContent = siteName;
    });
    document.querySelectorAll("[data-site-tagline]").forEach(function (el) {
      el.textContent = tagline;
    });
  }

  function initSiteConfig() {
    loadCachedSiteConfig();
    applySiteConfigToDom(siteConfigState);

    if (!HMM.db || siteConfigUnsub) return;
    try {
      siteConfigUnsub = HMM.db
        .collection("siteConfig")
        .doc("general")
        .onSnapshot(
          function (snap) {
            if (snap.exists && snap.data()) {
              siteConfigState = Object.assign({}, DEFAULT_SITE_CONFIG, snap.data());
              saveCachedSiteConfig(siteConfigState);
              applySiteConfigToDom(siteConfigState);
              siteConfigListeners.forEach(function (fn) {
                try { fn(siteConfigState); } catch (e) {}
              });
            }
          },
          function () {}
        );
    } catch (e) {}
  }

  function getSiteConfig() {
    return Object.assign({}, DEFAULT_SITE_CONFIG, siteConfigState);
  }

  function onSiteConfigChange(fn) {
    if (typeof fn === "function") siteConfigListeners.push(fn);
  }

  // ============================================================================
  // DETERMINISTIC IDS & TIMESTAMPS
  // ============================================================================
  function getPairId(uid1, uid2) {
    return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
  }

  function getSortedPair(uid1, uid2) {
    return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
  }

  function getLikeId(postId, userId) {
    return postId + "_" + userId;
  }

  function getCommentReactionId(commentId, userId) {
    return commentId + "_" + userId;
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

  function formatBirthDate(dateStr) {
    var raw = String(dateStr || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
    var parts = raw.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
        return "Google Sign-In popup requires HTTPS/HTTP (Vercel, cPanel, or Live Server). On local file://, please use Email & Password.";
      case "auth/unauthorized-domain":
        return "This domain is not yet authorized in Firebase Console (Authentication -> Settings -> Authorized domains).";
      case "auth/operation-not-allowed":
        return "This sign-in method is not enabled in Firebase Console (Authentication -> Sign-in method).";
      case "auth/requires-recent-login":
        return "For your security, please sign out and sign back in before completing this action.";
      case "permission-denied":
        return "Permission denied by security rules. Make sure your email is verified and updated rules are published.";
      case "unavailable":
        return "Unable to reach Firebase. Please try again shortly.";
      default:
        break;
    }

    if (raw.indexOf("permission-denied") !== -1 || raw.indexOf("Missing or insufficient permissions") !== -1) {
      return "Action blocked by Firebase security rules. Verify your email and ensure updated rules are published.";
    }
    if (raw.indexOf("PERMISSION_DENIED") !== -1) {
      return "Realtime Database permission denied. Ensure updated firebase/database.rules.json is published.";
    }
    if (raw.indexOf("the client is offline") !== -1) {
      return "You appear to be offline. Check your connection.";
    }
    if (raw && raw.length < 220 && raw.indexOf("FirebaseError") === -1) {
      return raw;
    }
    return fb;
  }

  async function createNotificationRecord(params) {
    if (!params.recipientId || !params.sender || params.recipientId === params.sender.uid) return;
    if (isEitherBlocked(params.recipientId)) return;
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

  // Hash & Clean Username Path Router Helpers
  var RESERVED_ROUTES = {
    feed: true, explore: true, friends: true, messages: true, notifications: true,
    profile: true, settings: true, admin: true, inspect: true, login: true,
    register: true, forgot: true, index: true,
  };

  function parseRoute() {
    var rawHash = (window.location.hash || "").replace(/^#\/?/, "");
    var parts = rawHash.split("?");
    var route = (parts[0] || "").trim().toLowerCase();
    var params = new URLSearchParams(parts[1] || window.location.search || "");

    // Support #@username or #username shortcut
    if (route && route.charAt(0) === "@") {
      var hUser = normalizeUsername(route.slice(1));
      if (hUser && !validateUsername(hUser)) {
        params.set("u", hUser);
        return { route: "profile", params: params };
      }
    }

    // Support direct clean URL path: https://klorixcommunity.vercel.app/<username> or /@<username>
    if (!route && typeof window !== "undefined" && window.location && window.location.pathname) {
      var seg = window.location.pathname.replace(/^\/+|\/+$/g, "");
      if (seg && seg.indexOf("/") === -1 && seg.indexOf(".") === -1) {
        var cleanSeg = normalizeUsername(seg.replace(/^@/, ""));
        if (cleanSeg && !RESERVED_ROUTES[cleanSeg] && !validateUsername(cleanSeg)) {
          params.set("u", cleanSeg);
          return { route: "profile", params: params };
        }
      }
    }

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
    usersPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
    message: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    heart: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    thumbUp: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    comment: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    share: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    flag: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    restore: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    send: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    mapPin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    image: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    cpu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
    ban: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    megaphone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    video: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    tag: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    hash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    sparkles: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    code: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    briefcase: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    cake: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>',
    camera: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    upload: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    link: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    mail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/><path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/><path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>',
  };

  HMM.siteConfig = {
    DEFAULT: DEFAULT_SITE_CONFIG,
    init: initSiteConfig,
    get: getSiteConfig,
    applyToDom: applySiteConfigToDom,
    onChange: onSiteConfigChange,
    saveCache: saveCachedSiteConfig,
  };

  HMM.blocks = {
    init: initBlocks,
    cleanup: cleanupBlocks,
    isBlockedByMe: isBlockedByMe,
    hasBlockedMe: hasBlockedMe,
    isEitherBlocked: isEitherBlocked,
    getBlockedList: getBlockedList,
    blockUser: blockUser,
    unblockUser: unblockUser,
    subscribe: subscribeBlocks,
  };

  HMM.announcements = {
    subscribeActive: subscribeActiveAnnouncements,
    getAll: getAllAnnouncements,
    create: createAnnouncement,
    update: updateAnnouncement,
    remove: removeAnnouncement,
    openCreateEditModal: openAnnouncementModal,
  };

  HMM.promos = {
    subscribeActive: subscribeActivePromos,
    getAll: getAllPromos,
    create: createPromo,
    update: updatePromo,
    remove: removePromo,
  };

  HMM.utils = {
    BOOTSTRAPPED_ADMIN_EMAIL: BOOTSTRAPPED_ADMIN_EMAIL,
    CANONICAL_HOST: CANONICAL_HOST,
    LIMITS: LIMITS,
    SOCIAL_PLATFORMS: SOCIAL_PLATFORMS,
    SOCIAL_PLATFORM_MAP: SOCIAL_PLATFORM_MAP,
    normalizeSocialUrl: normalizeSocialUrl,
    sanitizeSocialLinks: sanitizeSocialLinks,
    getGoogleAccountPhotoUrl: getGoogleAccountPhotoUrl,
    getProfileShareUrl: getProfileShareUrl,
    USERNAME_REGEX: USERNAME_REGEX,
    REPORT_REASONS: REPORT_REASONS,
    AVATAR_COLORS: AVATAR_COLORS,
    REACTIONS: REACTIONS,
    REACTION_MAP: REACTION_MAP,
    getReactionMeta: getReactionMeta,
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
    isOfficialAdminUser: isOfficialAdminUser,
    renderAdminBadgeHtml: renderAdminBadgeHtml,
    compressImageFileToDataUrl: compressImageFileToDataUrl,
    extractUrls: extractUrls,
    extractMentions: extractMentions,
    extractHashtags: extractHashtags,
    linkifyText: linkifyText,
    formatRichText: linkifyText,
    parseSafeEmbedInput: parseSafeEmbedInput,
    renderEmbedPlayerHtml: renderEmbedPlayerHtml,
    fitFacebookPostEmbeds: fitFacebookPostEmbeds,
    isOwnBrandUrl: isOwnBrandUrl,
    classifyUrl: classifyUrl,
    renderSmartPreviewHtml: renderSmartPreviewHtml,
    hydrateLinkPreviews: hydrateLinkPreviews,
    openImageLightbox: openImageLightbox,
    attachMentionAutocomplete: attachMentionAutocomplete,
    getMentionCandidates: getMentionCandidates,
    getPairId: getPairId,
    getSortedPair: getSortedPair,
    getLikeId: getLikeId,
    getCommentReactionId: getCommentReactionId,
    getFollowId: getFollowId,
    getFriendRequestId: getFriendRequestId,
    getReportId: getReportId,
    generateId: generateId,
    timestampToMs: timestampToMs,
    formatRelativeTime: formatRelativeTime,
    formatJoinDate: formatJoinDate,
    formatBirthDate: formatBirthDate,
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
