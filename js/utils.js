/**
 * HMM HMM — Shared Utilities, Reactions, Smart Link Previews, Dynamic Site Config,
 * Admin Badge Helpers, Validation, Sanitization, Icons, Theme, Routing & Modals
 * Classic script (works directly via file://, Vercel static deploy, and cPanel).
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
    GROUP_NAME_MAX: 60,
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
    if (trimmed.indexOf("data:image/") === 0 && trimmed.length <= 250000) return null;
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
    if (trimmed.indexOf("data:image/") === 0 && trimmed.length <= 250000) return trimmed;
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
    var isAdminAvatar = Boolean(opts.isAdmin);
    var safeUrl = safeAvatarUrl(avatarUrl);
    var bg = escapeHtml(avatarColor || pickAvatarColor(name || "hmm"));
    var initials = escapeHtml(getInitials(name || "HMM"));
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
      presenceHtml +
      "</span>"
    );
  }

  // ============================================================================
  // OFFICIAL ADMIN PROFILE BADGE HELPERS
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
    var shieldSvg =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>' +
      "</svg>";

    if (variant === "full") {
      return (
        '<span class="admin-verified-pill" title="Verified Official HMM HMM Administrator">' +
        shieldSvg +
        "<span>Official Admin</span></span>"
      );
    }
    return (
      '<span class="admin-verified-icon" title="Official HMM HMM Administrator" aria-label="Official Admin">' +
      shieldSvg +
      "</span>"
    );
  }

  // ============================================================================
  // IMAGE FILE COMPRESSION (For Logo, Favicon, Group Avatar — Zero Storage Needed)
  // ============================================================================
  function compressImageFileToDataUrl(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Please select a valid image file (PNG, JPG, WebP, or SVG)."));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error("Image file is too large. Please choose an image under 5 MB."));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("Could not read the selected image file."));
      };
      reader.onload = function (ev) {
        var src = ev.target.result;
        // Preserve compact SVGs directly
        if (file.type === "image/svg+xml" && src.length <= 120000) {
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
          var mime = file.type === "image/png" ? "image/png" : "image/jpeg";
          var out = canvas.toDataURL(mime, quality || 0.85);
          if (out.length > 140000) {
            out = canvas.toDataURL("image/jpeg", 0.72);
          }
          resolve(out);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  // ============================================================================
  // SMART LINK & MEDIA PREVIEW ENGINE
  // ============================================================================
  var URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
  var ogMemoryCache = new Map();
  var OG_CACHE_PREFIX = "hmm_og_";

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
      out += escapeHtml(str.slice(lastIdx, m.index));
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
        out += escapeHtml(full);
      }
      lastIdx = m.index + full.length;
    }
    out += escapeHtml(str.slice(lastIdx));
    return out;
  }

  function extractYouTubeId(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") {
        var id1 = u.pathname.split("/").filter(Boolean)[0];
        return id1 && /^[a-zA-Z0-9_-]{6,15}$/.test(id1) ? id1 : null;
      }
      if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
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
    } catch (e) {}
    return null;
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
    var cards = rootEl.querySelectorAll('.link-preview-web[data-og-hydrated="0"]');
    cards.forEach(function (card) {
      var url = card.getAttribute("data-og-url");
      if (!url) return;
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

  function applyOgToCard(card, meta, url) {
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
    openModal(
      "Image Preview",
      '<div class="lightbox-wrap"><img src="' + escapeHtml(safe) + '" alt="Full preview" referrerpolicy="no-referrer" />' +
        '<div style="display:flex;justify-content:flex-end;margin-top:12px;">' +
        '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Open original ↗</a></div></div>'
    );
  }

  // ============================================================================
  // DYNAMIC SITE BRANDING & SEO CONFIG MANAGER (siteConfig/general)
  // ============================================================================
  var SITE_CONFIG_CACHE_KEY = "hmm_site_config_cache";
  var DEFAULT_SITE_CONFIG = {
    siteName: "HMM HMM",
    tagline: "Connect. Share. Belong.",
    logoUrl: "assets/icons/logo.svg",
    faviconUrl: "assets/icons/favicon.svg",
    metaDescription:
      "HMM HMM — Connect. Share. Belong. A modern Bangladeshi social network built for real-time conversations, community posts, and meaningful connections.",
    metaKeywords:
      "HMM HMM, Bangladesh social network, community, real-time chat, group chat, social media",
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
          function () {
            // Silently keep default/cached config if rules haven't deployed siteConfig yet
          }
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

  // Hash Router Helpers
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
    usersPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
    message: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
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
    arrowLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    mapPin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    mail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    image: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    cpu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
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

  HMM.utils = {
    BOOTSTRAPPED_ADMIN_EMAIL: BOOTSTRAPPED_ADMIN_EMAIL,
    LIMITS: LIMITS,
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
    linkifyText: linkifyText,
    classifyUrl: classifyUrl,
    renderSmartPreviewHtml: renderSmartPreviewHtml,
    hydrateLinkPreviews: hydrateLinkPreviews,
    openImageLightbox: openImageLightbox,
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
