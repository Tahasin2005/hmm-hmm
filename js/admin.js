/**
 * KLORIX (window.HMM) — Admin & Moderation Console (#admin) + Admin View-As Account Inspector (#inspect)
 * Features:
 * 1. AI Bulk Moderation (Google AI Studio API Key, On/Off Toggle, Batch Scan Posts & Comments -> Trash)
 * 2. Admin Trash Bin (View Trashed Items, Restore to Feed/Comments, Permanently Delete)
 * 3. Feed Ads & Videos Manager (Anonymous YouTube/Facebook embeds or Image Ads interleaved every N posts)
 * 4. Official Home Feed Announcements Manager (Pinned notices with optional images)
 * 5. Dynamic Site Branding & SEO Settings (Upload/URL Logo, Favicon, Site Name, Meta Description & Keywords)
 * 6. Users (View As Account Inspector + Suspend/Unsuspend), Reports & Posts Moderation
 * 100% Mobile, Tablet & Desktop Responsive.
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  var DEFAULT_AI_CONFIG = {
    enabled: false,
    apiKey: "",
    model: "gemini-3.1-flash-lite",
    lastScanSummary: "",
  };

  async function fetchAdminData() {
    var results = await Promise.all([
      HMM.db.collection("reports").limit(100).get().catch(function () { return { docs: [] }; }),
      HMM.db.collection("users").limit(100).get().catch(function () { return { docs: [] }; }),
      HMM.db.collection("posts").limit(120).get().catch(function () { return { docs: [] }; }),
      HMM.db.collection("comments").limit(150).get().catch(function () { return { docs: [] }; }),
      HMM.db.collection("trash").limit(120).get().catch(function () { return { docs: [] }; }),
      HMM.db.collection("adminConfig").doc("aiModeration").get().catch(function () { return { exists: false }; }),
      HMM.db.collection("siteConfig").doc("general").get().catch(function () { return { exists: false }; }),
      HMM.announcements.getAll().catch(function () { return []; }),
      HMM.promos.getAll().catch(function () { return []; }),
    ]);

    return {
      reports: results[0].docs
        .map(function (d) { return d.data(); })
        .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); }),
      users: results[1].docs
        .map(function (d) { return d.data(); })
        .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); }),
      posts: results[2].docs
        .map(function (d) { return d.data(); })
        .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); }),
      comments: results[3].docs
        .map(function (d) { return d.data(); })
        .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); }),
      trash: results[4].docs
        .map(function (d) { return d.data(); })
        .sort(function (a, b) { return U.timestampToMs(b.trashedAt) - U.timestampToMs(a.trashedAt); }),
      aiConfig: results[5].exists
        ? Object.assign({}, DEFAULT_AI_CONFIG, results[5].data())
        : Object.assign({}, DEFAULT_AI_CONFIG),
      siteConfig: results[6].exists
        ? Object.assign({}, HMM.siteConfig.DEFAULT, results[6].data())
        : HMM.siteConfig.get(),
      announcements: results[7] || [],
      promos: results[8] || [],
    };
  }

  // ============================================================================
  // MOVE ITEM TO TRASH / RESTORE / PERMANENT DELETE
  // ============================================================================
  async function moveItemToTrash(itemType, docData, reason, category, flaggedBy, adminUid) {
    var originalId = itemType === "post" ? docData.postId : docData.commentId;
    var originalCollection = itemType === "post" ? "posts" : "comments";
    var trashId = U.generateId("trsh");

    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("trash").doc(trashId), {
      trashId: trashId,
      itemType: itemType,
      originalId: originalId,
      originalCollection: originalCollection,
      data: docData,
      reason: U.sanitizeText(reason || "Flagged by moderation", 500),
      category: U.sanitizeText(category || "Policy Violation", 80),
      flaggedBy: flaggedBy === "ai" ? "ai" : "admin",
      trashedBy: adminUid,
      trashedAt: HMM.serverTimestamp(),
    });
    batch.delete(HMM.db.collection(originalCollection).doc(originalId));
    await batch.commit();

    try {
      if (itemType === "post" && docData.authorId) {
        await HMM.db.collection("users").doc(docData.authorId).update({
          postsCount: HMM.increment(-1),
        });
      } else if (itemType === "comment" && docData.postId) {
        await HMM.db.collection("posts").doc(docData.postId).update({
          commentsCount: HMM.increment(-1),
        });
      }
    } catch (e) {}
    return trashId;
  }

  async function restoreTrashItem(trashDoc) {
    var col = trashDoc.originalCollection === "comments" ? "comments" : "posts";
    var origId = trashDoc.originalId;
    var payload = Object.assign({}, trashDoc.data);
    if (!payload.createdAt) payload.createdAt = HMM.serverTimestamp();
    if (col === "posts" && !payload.updatedAt) payload.updatedAt = HMM.serverTimestamp();

    var batch = HMM.db.batch();
    batch.set(HMM.db.collection(col).doc(origId), payload);
    batch.delete(HMM.db.collection("trash").doc(trashDoc.trashId));
    await batch.commit();

    try {
      if (col === "posts" && payload.authorId) {
        await HMM.db.collection("users").doc(payload.authorId).update({
          postsCount: HMM.increment(1),
        });
      } else if (col === "comments" && payload.postId) {
        await HMM.db.collection("posts").doc(payload.postId).update({
          commentsCount: HMM.increment(1),
        });
      }
    } catch (e) {}
  }

  async function permanentlyDeleteTrashItem(trashId) {
    await HMM.db.collection("trash").doc(trashId).delete();
  }

  // ============================================================================
  // GOOGLE AI STUDIO GEMINI BATCH MODERATION CALL
  // ============================================================================
  async function moderateBatchWithGemini(apiKey, model, batchItems) {
    var cleanModel = String(model || "gemini-3.1-flash-lite").trim();
    var endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(cleanModel) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey.trim());

    var promptPayload = batchItems.map(function (item) {
      return {
        id: item.id,
        type: item.type,
        author: item.author,
        text: String(item.text || "").slice(0, 800),
      };
    });

    var systemPrompt =
      "You are an automated content moderation classifier for KLORIX Community, a social network (content may be in English, Bengali, or Banglish). " +
      "Inspect each post/comment in the JSON array and flag ONLY genuinely toxic, abusive, hate speech, harassment, violent threats, scams, or spam content. " +
      "Do NOT flag normal friendly conversation, jokes, or benign opinions. " +
      'Return ONLY a valid JSON array where each element has: {"id": string, "flagged": boolean, "category": string, "reason": string}. ' +
      'For clean items set flagged: false, category: "clean", reason: "".';

    var body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Moderate the following items and return the JSON array:\n" +
                JSON.stringify(promptPayload),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var apiMsg = (json && json.error && json.error.message) || ("HTTP " + res.status);
      if (res.status === 400 || res.status === 403) {
        throw new Error("Invalid or unauthorized Google AI Studio API Key: " + apiMsg);
      }
      if (res.status === 404) {
        throw new Error('Model "' + cleanModel + '" not found on your API key. Try selecting another model or entering a custom model ID.');
      }
      if (res.status === 429) {
        throw new Error("API rate limit exceeded (429). Wait a moment and retry.");
      }
      throw new Error("Gemini API error: " + apiMsg);
    }

    var rawText =
      json &&
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text;

    if (!rawText) {
      throw new Error("Gemini API returned an empty response.");
    }

    var cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    var parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Unexpected moderation format returned by Gemini API.");
    }
    return parsed;
  }

  // ============================================================================
  // ADMIN CONSOLE VIEW CONTROLLER (#admin)
  // ============================================================================
  async function mountAdminView(ctx) {
    if (!ctx.isAdmin) {
      ctx.mainEl.innerHTML =
        '<div class="card empty-state">' +
        '<div class="empty-state-icon" style="background:var(--crimson-soft);color:var(--crimson);">' + U.ICONS.shield + "</div>" +
        "<h3>Admin access required</h3>" +
        "<p>This moderation console is restricted to authorized administrators.</p>" +
        '<a href="#feed" class="btn btn-primary btn-sm">Return to Home Feed</a></div>';
      return;
    }

    var activeTab = "ai";
    var isScanning = false;
    var scanLog = [];
    var data = {
      reports: [],
      users: [],
      posts: [],
      comments: [],
      trash: [],
      aiConfig: Object.assign({}, DEFAULT_AI_CONFIG),
      siteConfig: HMM.siteConfig.get(),
      announcements: [],
      promos: [],
    };

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Admin &amp; Moderation Console</h1>' +
      '<p class="page-subtitle">AI bulk moderation, anonymous feed promos/videos, announcements, branding, and account inspector.</p></div>' +
      '<button type="button" id="admin-refresh-btn" class="btn btn-secondary btn-sm">Refresh data</button></div>' +
      '<div class="kpi-grid" id="admin-kpi-grid"></div>' +
      '<div class="card admin-console-card"><div class="tabs" id="admin-tabs">' +
      '<button type="button" class="tab-btn active" data-tab="ai">' + U.ICONS.cpu + " AI Moderation</button>" +
      '<button type="button" class="tab-btn" data-tab="promos">' + U.ICONS.video + ' Feed Ads &amp; Videos <span class="tab-count" id="adm-cnt-promos">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="announcements">' + U.ICONS.megaphone + ' Announcements <span class="tab-count" id="adm-cnt-ann">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="users">' + U.ICONS.users + ' Users <span class="tab-count" id="adm-cnt-users">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="trash">' + U.ICONS.trash + ' Trash <span class="tab-count" id="adm-cnt-trash">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="branding">' + U.ICONS.globe + " Branding &amp; SEO</button>" +
      '<button type="button" class="tab-btn" data-tab="reports">Reports <span class="tab-count" id="adm-cnt-reports">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="posts">Posts <span class="tab-count" id="adm-cnt-posts">0</span></button>' +
      '</div><div id="admin-panel" class="admin-panel-body"><p class="text-muted">Loading admin console...</p></div></div>';

    function renderKpis() {
      var openReports = data.reports.filter(function (r) { return r.status === "open"; }).length;
      document.getElementById("adm-cnt-promos").textContent = String(data.promos.length);
      document.getElementById("adm-cnt-ann").textContent = String(data.announcements.length);
      document.getElementById("adm-cnt-trash").textContent = String(data.trash.length);
      document.getElementById("adm-cnt-reports").textContent = String(data.reports.length);
      document.getElementById("adm-cnt-users").textContent = String(data.users.length);
      document.getElementById("adm-cnt-posts").textContent = String(data.posts.length);

      document.getElementById("admin-kpi-grid").innerHTML =
        '<div class="kpi-card"><div class="kpi-label">AI Moderation</div><div class="kpi-value" style="font-size:20px;color:' +
        (data.aiConfig.enabled ? "var(--accent)" : "var(--text-muted)") + ';">' +
        (data.aiConfig.enabled ? "Active" : "Paused") + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Active Feed Slots</div><div class="kpi-value" style="color:var(--accent);">' +
        data.promos.filter(function (p) { return p.isActive; }).length + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Open Reports</div><div class="kpi-value" style="color:var(--amber);">' + openReports + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Posts &amp; Users</div><div class="kpi-value">' + data.posts.length + " / " + data.users.length + "</div></div>";
    }

    function renderAiTab(panel) {
      var cfg = data.aiConfig;
      var presetModels = ["gemini-3.1-flash-lite", "gemini-4-hydrogen", "gemini-2.5-flash"];
      var isCustomModel = cfg.model && presetModels.indexOf(cfg.model) === -1;

      panel.innerHTML =
        '<div class="admin-grid-2">' +
        '<div class="admin-section-box">' +
        '<div class="admin-section-head"><div><h3>Google AI Studio Connection</h3>' +
        '<p class="text-muted" style="font-size:13px;">Stored privately in Firestore (admin-only rules). Toggle off anytime to pause AI API calls.</p></div>' +
        '<label class="toggle-switch" title="Toggle AI API Connection">' +
        '<input type="checkbox" id="ai-enabled-toggle" ' + (cfg.enabled ? "checked" : "") + ' />' +
        '<span class="toggle-slider"></span></label></div>' +
        '<form id="ai-config-form" class="auth-form" style="margin-top:14px;">' +
        '<div class="form-group"><label class="form-label" for="ai-api-key">Google AI Studio API Key</label>' +
        '<div style="display:flex;gap:8px;">' +
        '<input id="ai-api-key" class="form-input font-mono" type="password" autocomplete="off" placeholder="AIza..." value="' + U.escapeHtml(cfg.apiKey || "") + '" />' +
        '<button type="button" id="ai-toggle-key-vis" class="btn btn-secondary btn-sm" style="height:42px;">Show</button></div>' +
        '<span class="form-hint">Create a free API key at aistudio.google.com/apikey. Only admins can access this setting.</span></div>' +
        '<div class="form-group"><label class="form-label" for="ai-model-select">Gemini Model (Free-Tier Fast Models)</label>' +
        '<select id="ai-model-select" class="form-select">' +
        '<option value="gemini-3.1-flash-lite" ' + (cfg.model === "gemini-3.1-flash-lite" ? "selected" : "") + ">gemini-3.1-flash-lite (Recommended — Fast Free Tier)</option>" +
        '<option value="gemini-4-hydrogen" ' + (cfg.model === "gemini-4-hydrogen" ? "selected" : "") + ">gemini-4-hydrogen (Gemini 4 Flash)</option>" +
        '<option value="gemini-2.5-flash" ' + (cfg.model === "gemini-2.5-flash" ? "selected" : "") + ">gemini-2.5-flash (Public AI Studio Free Tier)</option>" +
        '<option value="custom" ' + (isCustomModel ? "selected" : "") + ">Custom Model ID...</option>" +
        "</select></div>" +
        '<div class="form-group ' + (isCustomModel ? "" : "hidden") + '" id="ai-custom-model-wrap">' +
        '<label class="form-label" for="ai-custom-model">Custom Model ID</label>' +
        '<input id="ai-custom-model" class="form-input font-mono" type="text" value="' + U.escapeHtml(isCustomModel ? cfg.model : "") + '" placeholder="e.g., gemini-2.5-flash-lite" /></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="submit" id="ai-save-btn" class="btn btn-primary">Save AI Settings</button>' +
        "</div></form></div>" +

        '<div class="admin-section-box">' +
        "<h3>Bulk Content Scanner</h3>" +
        '<p class="text-muted" style="font-size:13px;margin-top:4px;">Scans all existing posts (' + data.posts.length + ") and comments (" + data.comments.length +
        ") in batches of 10. Detected toxic, abusive, or spam items are automatically moved to the <strong>Trash</strong> collection for review.</p>" +
        '<div class="ai-scan-status-box" id="ai-scan-status">' +
        (cfg.lastScanSummary
          ? '<div style="font-size:13px;"><strong>Last Scan:</strong> ' + U.escapeHtml(cfg.lastScanSummary) + "</div>"
          : '<div class="text-muted" style="font-size:13px;">No bulk scan run yet.</div>') +
        "</div>" +
        '<div class="ai-progress-wrap hidden" id="ai-progress-wrap">' +
        '<div class="ai-progress-bar"><div class="ai-progress-fill" id="ai-progress-fill" style="width:0%"></div></div>' +
        '<div class="text-muted" id="ai-progress-label" style="font-size:12.5px;margin-top:6px;">Preparing scan...</div></div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" id="btn-ai-scan-all" class="btn btn-primary" ' +
        (!cfg.enabled || !cfg.apiKey || isScanning ? "disabled" : "") + ">" +
        U.ICONS.cpu + " <span>" + (isScanning ? "Scanning..." : "Scan All Posts with AI") + "</span></button>" +
        '<button type="button" id="btn-open-trash-shortcut" class="btn btn-secondary">' + U.ICONS.trash + " Open Trash (" + data.trash.length + ")</button>" +
        "</div>" +
        (!cfg.enabled
          ? '<div class="alert alert-warning" style="margin-top:12px;">AI API connection is currently toggled OFF. Turn on the switch and save your API key to run bulk scans.</div>'
          : !cfg.apiKey
          ? '<div class="alert alert-info" style="margin-top:12px;">Enter and save your Google AI Studio API Key to enable bulk scanning.</div>'
          : "") +
        (scanLog.length > 0
          ? '<div class="ai-scan-log">' +
            scanLog.map(function (line) { return "<div>" + U.escapeHtml(line) + "</div>"; }).join("") +
            "</div>"
          : "") +
        "</div></div>";

      var keyInput = document.getElementById("ai-api-key");
      document.getElementById("ai-toggle-key-vis").addEventListener("click", function (e) {
        var isPwd = keyInput.type === "password";
        keyInput.type = isPwd ? "text" : "password";
        e.currentTarget.textContent = isPwd ? "Hide" : "Show";
      });

      var modelSelect = document.getElementById("ai-model-select");
      var customWrap = document.getElementById("ai-custom-model-wrap");
      modelSelect.addEventListener("change", function () {
        customWrap.classList.toggle("hidden", modelSelect.value !== "custom");
      });

      document.getElementById("ai-enabled-toggle").addEventListener("change", async function (e) {
        var nextEnabled = e.target.checked;
        try {
          await HMM.db.collection("adminConfig").doc("aiModeration").set(
            {
              enabled: nextEnabled,
              apiKey: data.aiConfig.apiKey || "",
              model: data.aiConfig.model || "gemini-3.1-flash-lite",
              updatedAt: HMM.serverTimestamp(),
            },
            { merge: true }
          );
          data.aiConfig.enabled = nextEnabled;
          U.showToast(nextEnabled ? "AI Moderation API enabled." : "AI Moderation API paused.", "success");
          render();
        } catch (err) {
          e.target.checked = !nextEnabled;
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
      });

      document.getElementById("ai-config-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var btn = document.getElementById("ai-save-btn");
        var chosenModel =
          modelSelect.value === "custom"
            ? (document.getElementById("ai-custom-model").value || "").trim() || "gemini-3.1-flash-lite"
            : modelSelect.value;
        var apiKeyVal = (keyInput.value || "").trim();
        var enabledVal = document.getElementById("ai-enabled-toggle").checked;

        btn.disabled = true;
        btn.textContent = "Saving...";
        try {
          await HMM.db.collection("adminConfig").doc("aiModeration").set(
            {
              enabled: enabledVal,
              apiKey: apiKeyVal,
              model: chosenModel,
              updatedAt: HMM.serverTimestamp(),
            },
            { merge: true }
          );
          data.aiConfig.enabled = enabledVal;
          data.aiConfig.apiKey = apiKeyVal;
          data.aiConfig.model = chosenModel;
          U.showToast("AI moderation settings saved securely.", "success");
          render();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          btn.disabled = false;
          btn.textContent = "Save AI Settings";
        }
      });

      document.getElementById("btn-open-trash-shortcut").addEventListener("click", function () {
        switchTab("trash");
      });

      document.getElementById("btn-ai-scan-all").addEventListener("click", async function () {
        if (isScanning) return;
        if (!data.aiConfig.enabled) {
          U.showToast("AI Moderation API is turned OFF.", "error");
          return;
        }
        if (!data.aiConfig.apiKey) {
          U.showToast("Please save a Google AI Studio API Key first.", "error");
          return;
        }

        isScanning = true;
        scanLog = [];
        var scanBtn = document.getElementById("btn-ai-scan-all");
        var progWrap = document.getElementById("ai-progress-wrap");
        var progFill = document.getElementById("ai-progress-fill");
        var progLabel = document.getElementById("ai-progress-label");
        scanBtn.disabled = true;
        progWrap.classList.remove("hidden");

        try {
          var fresh = await Promise.all([
            HMM.db.collection("posts").limit(120).get(),
            HMM.db.collection("comments").limit(150).get(),
          ]);
          var postsList = fresh[0].docs.map(function (d) { return d.data(); });
          var commentsList = fresh[1].docs.map(function (d) { return d.data(); });

          var queue = [];
          postsList.forEach(function (p) {
            if (p.text) queue.push({ id: "post:" + p.postId, type: "post", author: p.authorName, text: p.text, raw: p });
          });
          commentsList.forEach(function (c) {
            queue.push({ id: "comment:" + c.commentId, type: "comment", author: c.authorName, text: c.text, raw: c });
          });

          if (queue.length === 0) {
            U.showToast("No posts or comments to scan.", "success");
            isScanning = false;
            render();
            return;
          }

          var BATCH_SIZE = 10;
          var totalBatches = Math.ceil(queue.length / BATCH_SIZE);
          var flaggedCount = 0;

          for (var i = 0; i < totalBatches; i++) {
            var slice = queue.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            var pct = Math.round(((i + 0.3) / totalBatches) * 100);
            if (progFill) progFill.style.width = pct + "%";
            if (progLabel) {
              progLabel.textContent = "Scanning batch " + (i + 1) + " of " + totalBatches + " (" + slice.length + " items)...";
            }

            var verdicts = await moderateBatchWithGemini(data.aiConfig.apiKey, data.aiConfig.model, slice);
            var verdictById = new Map();
            verdicts.forEach(function (v) {
              if (v && v.id) verdictById.set(String(v.id), v);
            });

            for (var j = 0; j < slice.length; j++) {
              var item = slice[j];
              var verdict = verdictById.get(item.id);
              if (verdict && verdict.flagged === true) {
                await moveItemToTrash(
                  item.type,
                  item.raw,
                  verdict.reason || "Flagged as toxic, abusive, or spam by AI.",
                  verdict.category || "AI Flagged",
                  "ai",
                  ctx.user.uid
                );
                flaggedCount++;
                scanLog.push("[MOVED TO TRASH] " + item.type.toUpperCase() + " by " + item.author + " — " + (verdict.category || "Flagged") + ": " + (verdict.reason || ""));
              }
            }

            if (progFill) progFill.style.width = Math.round(((i + 1) / totalBatches) * 100) + "%";
          }

          var summaryMsg =
            "Scanned " + queue.length + " items (" + postsList.length + " posts, " + commentsList.length + " comments) · " +
            flaggedCount + " moved to Trash · " + new Date().toLocaleTimeString();

          await HMM.db.collection("adminConfig").doc("aiModeration").set(
            { lastScanSummary: summaryMsg, updatedAt: HMM.serverTimestamp() },
            { merge: true }
          );

          U.showToast(
            flaggedCount > 0
              ? "AI Scan complete: " + flaggedCount + " flagged item(s) moved to Trash."
              : "AI Scan complete: All " + queue.length + " items look clean!",
            "success"
          );
          isScanning = false;
          await loadAll();
        } catch (err) {
          isScanning = false;
          U.showToast(err.message || "AI scan failed.", "error");
          if (progLabel) progLabel.textContent = "Error: " + (err.message || "Scan failed");
          if (scanBtn) scanBtn.disabled = false;
        }
      });
    }

    // ============================================================================
    // ANONYMOUS IN-FEED PROMOS / VIDEOS & ADS TAB
    // ============================================================================
    function renderPromosTab(panel) {
      var uploadedPromoImg = "";

      panel.innerHTML =
        '<div class="admin-grid-2">' +
        '<div class="admin-section-box">' +
        "<h3>Add Anonymous In-Feed Video or Ad</h3>" +
        '<p class="text-muted" style="font-size:13px;margin:4px 0 14px;">Automatically injected between community posts on the Home Feed with <strong>no author name or profile avatar</strong>.</p>' +
        '<form id="promo-create-form" class="auth-form">' +
        '<div class="form-group"><label class="form-label" for="pr-type">Slot Type</label>' +
        '<select id="pr-type" class="form-select">' +
        '<option value="embed">Embedded Video (YouTube / Facebook / Vimeo)</option>' +
        '<option value="image_ad">Image Banner Ad</option></select></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<div class="form-group"><label class="form-label" for="pr-label">Top Badge Label</label>' +
        '<input id="pr-label" class="form-input" type="text" maxlength="40" value="Featured" placeholder="Featured / Sponsored" /></div>' +
        '<div class="form-group"><label class="form-label" for="pr-interval">Show Every N Posts</label>' +
        '<input id="pr-interval" class="form-input" type="number" min="1" max="50" value="4" required /></div></div>' +
        '<div class="form-group"><label class="form-label" for="pr-title">Headline (optional)</label>' +
        '<input id="pr-title" class="form-input" type="text" maxlength="140" placeholder="e.g., Trending Highlight" /></div>' +
        '<div class="form-group"><label class="form-label" for="pr-caption">Caption (optional)</label>' +
        '<textarea id="pr-caption" class="form-textarea" rows="2" maxlength="600" placeholder="Short description or message..."></textarea></div>' +
        '<div class="form-group" id="pr-embed-group"><label class="form-label" for="pr-embed-raw">YouTube or Facebook Embed Code / Video URL</label>' +
        '<textarea id="pr-embed-raw" class="form-textarea font-mono" rows="2" placeholder=\'<iframe src="https://www.youtube.com/embed/..."></iframe> or video link\'></textarea>' +
        '<div id="pr-embed-preview" style="margin-top:8px;"></div></div>' +
        '<div class="form-group hidden" id="pr-image-group"><label class="form-label">Ad Banner Image (Upload or URL)</label>' +
        '<input id="pr-image-url" class="form-input" type="text" placeholder="https://example.com/banner.jpg" style="margin-bottom:6px;" />' +
        '<input id="pr-image-file" type="file" accept="image/*" style="font-size:12.5px;" />' +
        '<div id="pr-image-preview" style="margin-top:8px;"></div></div>' +
        '<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:10px;">' +
        '<div class="form-group"><label class="form-label" for="pr-cta-url">CTA Link URL (optional)</label>' +
        '<input id="pr-cta-url" class="form-input" type="url" placeholder="https://..." /></div>' +
        '<div class="form-group"><label class="form-label" for="pr-cta-text">Button Label</label>' +
        '<input id="pr-cta-text" class="form-input" type="text" maxlength="40" placeholder="Learn more" /></div></div>' +
        '<button type="submit" id="pr-submit-btn" class="btn btn-primary" style="margin-top:6px;">' + U.ICONS.sparkles + " Publish to Home Feed</button>" +
        "</form></div>" +

        '<div class="admin-section-box">' +
        "<h3>Active &amp; Saved Feed Slots (" + data.promos.length + ")</h3>" +
        '<p class="text-muted" style="font-size:13px;margin:4px 0 12px;">Active slots rotate automatically between posts on every user\'s Home Feed.</p>' +
        (data.promos.length === 0
          ? '<div class="empty-state" style="padding:28px 12px;"><p>No in-feed videos or ads added yet.</p></div>'
          : '<div class="promo-admin-list">' +
            data.promos
              .map(function (pr) {
                return (
                  '<div class="promo-admin-item">' +
                  '<div class="promo-admin-head">' +
                  '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                  '<span class="status-tag ' + (pr.isActive ? "status-resolved" : "status-dismissed") + '">' + (pr.isActive ? "Active" : "Paused") + "</span>" +
                  '<span class="status-tag status-open">' + U.escapeHtml(pr.label || "Featured") + "</span>" +
                  '<span class="text-muted" style="font-size:12px;">Every ' + (pr.intervalPosts || 4) + " posts · " +
                  (pr.promoType === "embed" ? U.escapeHtml(pr.embedProvider || "video") : "image ad") + "</span></div>" +
                  '<div style="display:flex;gap:6px;">' +
                  '<button type="button" class="btn btn-secondary btn-sm" data-promo-toggle="' + U.escapeHtml(pr.promoId) + '" data-active="' + (pr.isActive ? "1" : "0") + '">' + (pr.isActive ? "Pause" : "Activate") + "</button>" +
                  '<button type="button" class="btn btn-danger-soft btn-sm" data-promo-del="' + U.escapeHtml(pr.promoId) + '">' + U.ICONS.trash + "</button>" +
                  "</div></div>" +
                  (pr.title ? '<div style="font-weight:700;font-size:14px;margin-top:6px;">' + U.escapeHtml(pr.title) + "</div>" : "") +
                  (pr.caption ? '<div class="text-muted" style="font-size:13px;margin-top:2px;">' + U.escapeHtml(pr.caption.slice(0, 140)) + "</div>" : "") +
                  (pr.promoType === "image_ad" && pr.imageUrl
                    ? '<img src="' + U.escapeHtml(pr.imageUrl) + '" alt="" style="max-height:110px;border-radius:8px;margin-top:8px;object-fit:cover;" />'
                    : pr.embedUrl
                    ? '<div class="font-mono text-muted" style="font-size:11.5px;margin-top:6px;word-break:break-all;">' + U.escapeHtml(pr.embedUrl) + "</div>"
                    : "") +
                  "</div>"
                );
              })
              .join("") +
            "</div>") +
        "</div></div>";

      var typeSel = document.getElementById("pr-type");
      var embedGrp = document.getElementById("pr-embed-group");
      var imgGrp = document.getElementById("pr-image-group");
      var embedRaw = document.getElementById("pr-embed-raw");
      var embedPrev = document.getElementById("pr-embed-preview");
      var imgUrl = document.getElementById("pr-image-url");
      var imgFile = document.getElementById("pr-image-file");
      var imgPrev = document.getElementById("pr-image-preview");

      typeSel.addEventListener("change", function () {
        var isImg = typeSel.value === "image_ad";
        embedGrp.classList.toggle("hidden", isImg);
        imgGrp.classList.toggle("hidden", !isImg);
      });

      embedRaw.addEventListener("input", function () {
        var parsed = U.parseSafeEmbedInput(embedRaw.value);
        embedPrev.innerHTML = parsed
          ? U.renderEmbedPlayerHtml(parsed)
          : embedRaw.value.trim()
          ? '<p class="text-danger" style="font-size:12.5px;">Unrecognized embed URL/iframe.</p>'
          : "";
      });

      imgFile.addEventListener("change", async function () {
        var f = imgFile.files && imgFile.files[0];
        if (!f) return;
        try {
          uploadedPromoImg = await U.compressImageFileToDataUrl(f, 960, 0.82, 310000);
          imgUrl.value = "";
          imgPrev.innerHTML = '<img src="' + U.escapeHtml(uploadedPromoImg) + '" alt="Preview" style="max-height:150px;border-radius:10px;border:1px solid var(--border);" />';
          U.showToast("Ad image ready!", "success");
        } catch (err) {
          U.showToast(err.message, "error");
        }
      });

      imgUrl.addEventListener("input", function () {
        uploadedPromoImg = "";
        var v = imgUrl.value.trim();
        imgPrev.innerHTML =
          v && U.validateOptionalUrl(v) === null
            ? '<img src="' + U.escapeHtml(v) + '" alt="Preview" style="max-height:150px;border-radius:10px;border:1px solid var(--border);" />'
            : "";
      });

      document.getElementById("promo-create-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var btn = document.getElementById("pr-submit-btn");
        btn.disabled = true;
        try {
          await HMM.promos.create({
            promoType: typeSel.value,
            label: document.getElementById("pr-label").value,
            intervalPosts: document.getElementById("pr-interval").value,
            title: document.getElementById("pr-title").value,
            caption: document.getElementById("pr-caption").value,
            embedRaw: embedRaw.value,
            imageUrl: uploadedPromoImg || imgUrl.value.trim(),
            ctaUrl: document.getElementById("pr-cta-url").value,
            ctaText: document.getElementById("pr-cta-text").value,
            isActive: true,
          });
          U.showToast("In-feed promo published!", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          btn.disabled = false;
        }
      });
    }

    // ============================================================================
    // ANNOUNCEMENTS TAB
    // ============================================================================
    function renderAnnouncementsTab(panel) {
      panel.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<div><h3 style="font-size:16px;font-weight:800;">Official Home Feed Announcements</h3>' +
        '<p class="text-muted" style="font-size:13px;">Synced with your Official Admin Profile. Pinned announcements appear at the top of everyone\'s Home Feed.</p></div>' +
        '<button type="button" id="btn-adm-new-ann" class="btn btn-primary btn-sm">' + U.ICONS.megaphone + " New Announcement</button></div>" +
        (data.announcements.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">' + U.ICONS.megaphone + "</div><h3>No announcements yet</h3><p>Publish an official announcement with optional banner image.</p></div>"
          : '<div class="trash-list">' +
            data.announcements
              .map(function (a) {
                var safeImg = U.safeAvatarUrl(a.imageUrl || "");
                return (
                  '<div class="trash-item-card">' +
                  '<div class="trash-item-top">' +
                  '<div class="trash-item-meta">' +
                  '<span class="status-tag ' + (a.isActive ? "status-resolved" : "status-dismissed") + '">' + (a.isActive ? "Pinned Live" : "Hidden") + "</span>" +
                  '<span class="text-muted" style="font-size:12.5px;">' + U.escapeHtml(U.formatRelativeTime(a.createdAt)) + "</span></div>" +
                  '<div class="trash-item-actions">' +
                  '<button type="button" class="btn btn-secondary btn-sm" data-adm-ann-toggle="' + U.escapeHtml(a.announcementId) + '" data-active="' + (a.isActive ? "1" : "0") + '">' + (a.isActive ? "Hide" : "Show Live") + "</button>" +
                  '<button type="button" class="btn btn-secondary btn-sm" data-adm-ann-edit="' + U.escapeHtml(a.announcementId) + '">' + U.ICONS.edit + " Edit</button>" +
                  '<button type="button" class="btn btn-danger-soft btn-sm" data-adm-ann-del="' + U.escapeHtml(a.announcementId) + '">' + U.ICONS.trash + " Delete</button>" +
                  "</div></div>" +
                  '<div style="font-weight:800;font-size:15px;margin-top:6px;">' + U.escapeHtml(a.title) + "</div>" +
                  '<div class="trash-item-content" style="margin-top:4px;">' + U.escapeHtml(a.message) + "</div>" +
                  (safeImg ? '<img src="' + U.escapeHtml(safeImg) + '" alt="" style="max-height:160px;border-radius:10px;margin-top:8px;object-fit:cover;" />' : "") +
                  "</div>"
                );
              })
              .join("") +
            "</div>");

      document.getElementById("btn-adm-new-ann").addEventListener("click", function () {
        HMM.announcements.openCreateEditModal(ctx.profile, null, loadAll);
      });
    }

    function renderTrashTab(panel) {
      if (data.trash.length === 0) {
        panel.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">' + U.ICONS.trash + "</div>" +
          "<h3>Trash is empty</h3><p>Posts and comments flagged by AI moderation or trashed by admins will appear here for review, restoration, or permanent deletion.</p></div>";
        return;
      }

      panel.innerHTML =
        '<div class="trash-list">' +
        data.trash
          .map(function (t) {
            var orig = t.data || {};
            var text = String(orig.text || "");
            return (
              '<div class="trash-item-card">' +
              '<div class="trash-item-top">' +
              '<div class="trash-item-meta">' +
              '<span class="status-tag ' + (t.flaggedBy === "ai" ? "status-open" : "status-suspended") + '">' +
              (t.flaggedBy === "ai" ? "AI Flagged" : "Admin Trashed") + " · " + U.escapeHtml(t.itemType) + "</span>" +
              '<span class="text-muted" style="font-size:12.5px;">' + U.escapeHtml(t.category || "Moderation") + " · " + U.escapeHtml(U.formatRelativeTime(t.trashedAt)) + "</span>" +
              "</div>" +
              '<div class="trash-item-actions">' +
              '<button type="button" class="btn btn-primary btn-sm" data-restore-trash="' + U.escapeHtml(t.trashId) + '">' + U.ICONS.restore + " Restore</button>" +
              '<button type="button" class="btn btn-danger-soft btn-sm" data-perm-delete-trash="' + U.escapeHtml(t.trashId) + '">' + U.ICONS.trash + " Delete Forever</button>" +
              "</div></div>" +
              '<div class="trash-item-author"><strong>' + U.escapeHtml(orig.authorName || "Unknown") + "</strong> " +
              '<span class="text-muted">@' + U.escapeHtml(orig.authorUsername || "user") + "</span></div>" +
              '<div class="trash-item-content">' + U.escapeHtml(text) + "</div>" +
              (t.reason ? '<div class="trash-item-reason"><strong>Reason:</strong> ' + U.escapeHtml(t.reason) + "</div>" : "") +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }

    function renderBrandingTab(panel) {
      var cfg = data.siteConfig;
      var uploadedLogo = "";
      var uploadedFavicon = "";

      panel.innerHTML =
        '<form id="site-branding-form" class="auth-form">' +
        '<div class="admin-grid-2">' +
        '<div class="admin-section-box">' +
        "<h3>Website Identity &amp; Logos</h3>" +
        '<p class="text-muted" style="font-size:13px;margin:4px 0 14px;">Changes apply dynamically across all user and admin screens immediately.</p>' +
        '<div class="form-group"><label class="form-label" for="sc-name">Website Name</label>' +
        '<input id="sc-name" class="form-input" type="text" required maxlength="80" value="' + U.escapeHtml(cfg.siteName) + '" /></div>' +
        '<div class="form-group" style="margin-top:12px;"><label class="form-label" for="sc-tagline">Tagline</label>' +
        '<input id="sc-tagline" class="form-input" type="text" maxlength="140" value="' + U.escapeHtml(cfg.tagline) + '" /></div>' +
        '<div class="form-group" style="margin-top:12px;"><label class="form-label" for="sc-logo-url">Website Logo (Upload or Image URL)</label>' +
        '<div class="branding-upload-row">' +
        '<img id="sc-logo-preview" src="' + U.escapeHtml(cfg.logoUrl) + '" alt="Logo preview" class="branding-preview-img" />' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
        '<input id="sc-logo-url" class="form-input" type="text" value="' + U.escapeHtml(cfg.logoUrl) + '" placeholder="https://... or upload below" />' +
        '<input id="sc-logo-file" type="file" accept="image/*" style="font-size:12.5px;" /></div></div></div>' +
        '<div class="form-group" style="margin-top:12px;"><label class="form-label" for="sc-fav-url">Browser Favicon (Upload or Image URL)</label>' +
        '<div class="branding-upload-row">' +
        '<img id="sc-fav-preview" src="' + U.escapeHtml(cfg.faviconUrl) + '" alt="Favicon preview" class="branding-preview-img branding-preview-fav" />' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
        '<input id="sc-fav-url" class="form-input" type="text" value="' + U.escapeHtml(cfg.faviconUrl) + '" placeholder="https://... or upload below" />' +
        '<input id="sc-fav-file" type="file" accept="image/*" style="font-size:12.5px;" /></div></div></div>' +
        "</div>" +

        '<div class="admin-section-box">' +
        "<h3>SEO Meta Tags</h3>" +
        '<p class="text-muted" style="font-size:13px;margin:4px 0 14px;">Dynamically updates &lt;title&gt;, meta description, keywords, and OpenGraph tags.</p>' +
        '<div class="form-group"><label class="form-label" for="sc-meta-desc">SEO Meta Description</label>' +
        '<textarea id="sc-meta-desc" class="form-textarea" maxlength="320">' + U.escapeHtml(cfg.metaDescription) + "</textarea>" +
        '<span class="form-hint">Recommended: 120–160 characters for search engines.</span></div>' +
        '<div class="form-group" style="margin-top:12px;"><label class="form-label" for="sc-meta-keys">SEO Meta Keywords (comma-separated)</label>' +
        '<textarea id="sc-meta-keys" class="form-textarea" style="min-height:76px;" maxlength="320">' + U.escapeHtml(cfg.metaKeywords) + "</textarea></div>" +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">' +
        '<button type="submit" id="sc-save-btn" class="btn btn-primary">Save &amp; Apply Globally</button>' +
        '<button type="button" id="sc-reset-btn" class="btn btn-secondary">Reset KLORIX Defaults</button>' +
        "</div></div></div></form>";

      var logoUrlInp = document.getElementById("sc-logo-url");
      var logoPreview = document.getElementById("sc-logo-preview");
      var favUrlInp = document.getElementById("sc-fav-url");
      var favPreview = document.getElementById("sc-fav-preview");

      logoUrlInp.addEventListener("input", function () {
        uploadedLogo = "";
        logoPreview.src = logoUrlInp.value.trim() || HMM.siteConfig.DEFAULT.logoUrl;
      });
      favUrlInp.addEventListener("input", function () {
        uploadedFavicon = "";
        favPreview.src = favUrlInp.value.trim() || HMM.siteConfig.DEFAULT.faviconUrl;
      });

      document.getElementById("sc-logo-file").addEventListener("change", async function (e) {
        if (!e.target.files || !e.target.files[0]) return;
        try {
          uploadedLogo = await U.compressImageFileToDataUrl(e.target.files[0], 256, 0.88);
          logoUrlInp.value = uploadedLogo;
          logoPreview.src = uploadedLogo;
          U.showToast("Logo ready! Click Save & Apply Globally.", "success");
        } catch (err) {
          U.showToast(err.message, "error");
        }
      });

      document.getElementById("sc-fav-file").addEventListener("change", async function (e) {
        if (!e.target.files || !e.target.files[0]) return;
        try {
          uploadedFavicon = await U.compressImageFileToDataUrl(e.target.files[0], 64, 0.9);
          favUrlInp.value = uploadedFavicon;
          favPreview.src = uploadedFavicon;
          U.showToast("Favicon ready! Click Save & Apply Globally.", "success");
        } catch (err) {
          U.showToast(err.message, "error");
        }
      });

      document.getElementById("sc-reset-btn").addEventListener("click", async function () {
        try {
          var resetPayload = Object.assign({}, HMM.siteConfig.DEFAULT, {
            primaryAdminUid: data.siteConfig.primaryAdminUid || ctx.user.uid,
            updatedAt: HMM.serverTimestamp(),
          });
          await HMM.db.collection("siteConfig").doc("general").set(resetPayload, { merge: true });
          HMM.siteConfig.applyToDom(HMM.siteConfig.DEFAULT);
          HMM.siteConfig.saveCache(HMM.siteConfig.DEFAULT);
          U.showToast("Site branding reset to KLORIX defaults.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
      });

      document.getElementById("site-branding-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var btn = document.getElementById("sc-save-btn");
        btn.disabled = true;
        btn.textContent = "Applying...";
        try {
          var nextCfg = {
            siteName: U.sanitizeText(document.getElementById("sc-name").value, 80) || "KLORIX",
            tagline: U.sanitizeText(document.getElementById("sc-tagline").value, 140),
            logoUrl: (uploadedLogo || logoUrlInp.value.trim()) || HMM.siteConfig.DEFAULT.logoUrl,
            faviconUrl: (uploadedFavicon || favUrlInp.value.trim()) || HMM.siteConfig.DEFAULT.faviconUrl,
            metaDescription: U.sanitizeText(document.getElementById("sc-meta-desc").value, 320),
            metaKeywords: U.sanitizeText(document.getElementById("sc-meta-keys").value, 320),
            primaryAdminUid: data.siteConfig.primaryAdminUid || ctx.user.uid,
            updatedAt: HMM.serverTimestamp(),
          };
          await HMM.db.collection("siteConfig").doc("general").set(nextCfg, { merge: true });
          HMM.siteConfig.applyToDom(nextCfg);
          HMM.siteConfig.saveCache(nextCfg);
          data.siteConfig = Object.assign({}, data.siteConfig, nextCfg);
          U.showToast("Logo, favicon & SEO meta tags applied across all pages!", "success");
          btn.disabled = false;
          btn.textContent = "Save & Apply Globally";
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          btn.disabled = false;
          btn.textContent = "Save & Apply Globally";
        }
      });
    }

    function render() {
      renderKpis();
      var panel = document.getElementById("admin-panel");
      if (!panel) return;

      if (activeTab === "ai") { renderAiTab(panel); return; }
      if (activeTab === "promos") { renderPromosTab(panel); return; }
      if (activeTab === "announcements") { renderAnnouncementsTab(panel); return; }
      if (activeTab === "trash") { renderTrashTab(panel); return; }
      if (activeTab === "branding") { renderBrandingTab(panel); return; }

      if (activeTab === "reports") {
        if (data.reports.length === 0) {
          panel.innerHTML = '<div class="empty-state"><h3>No reports</h3><p>The community report queue is clear.</p></div>';
          return;
        }
        panel.innerHTML =
          '<div class="data-table-wrap"><table class="data-table responsive-table"><thead><tr>' +
          "<th>Target</th><th>Reason &amp; Details</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>" +
          data.reports
            .map(function (r) {
              var locked = r.status === "resolved" || r.status === "dismissed";
              return (
                '<tr><td data-label="Target"><strong>' + U.escapeHtml(r.targetType.toUpperCase()) + "</strong><br/>" +
                '<span class="font-mono text-muted" style="font-size:12px;word-break:break-all;">' + U.escapeHtml(r.targetId) + "</span></td>" +
                '<td data-label="Reason"><strong>' + U.escapeHtml(r.reason) + "</strong>" +
                (r.details ? '<div class="text-muted" style="font-size:12.5px;margin-top:2px;">' + U.escapeHtml(r.details) + "</div>" : "") + "</td>" +
                '<td data-label="Status"><span class="status-tag status-' + U.escapeHtml(r.status) + '">' + U.escapeHtml(r.status) + "</span></td>" +
                '<td data-label="Submitted" class="text-muted">' + U.escapeHtml(U.formatRelativeTime(r.createdAt)) + "</td>" +
                '<td data-label="Actions"><div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                (!locked
                  ? '<button type="button" class="btn btn-primary btn-sm" data-report-status="resolved" data-id="' + U.escapeHtml(r.reportId) + '">Resolve</button>' +
                    '<button type="button" class="btn btn-secondary btn-sm" data-report-status="dismissed" data-id="' + U.escapeHtml(r.reportId) + '">Dismiss</button>'
                  : '<span class="text-muted" style="font-size:12px;">Closed</span>') +
                "</div></td></tr>"
              );
            })
            .join("") +
          "</tbody></table></div>";
      } else if (activeTab === "users") {
        panel.innerHTML =
          '<div class="data-table-wrap"><table class="data-table responsive-table"><thead><tr>' +
          "<th>Member</th><th>Location</th><th>Stats</th><th>Status</th><th>Actions</th></tr></thead><tbody>" +
          data.users
            .map(function (u) {
              var isSelf = u.uid === ctx.user.uid;
              var isAdm = U.isOfficialAdminUser(u);
              return (
                '<tr><td data-label="Member"><a href="#profile?uid=' + encodeURIComponent(u.uid) + '" style="display:flex;align-items:center;gap:10px;">' +
                U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm", isAdmin: isAdm }) +
                "<div><strong>" + U.escapeHtml(u.name) + (isAdm ? " " + U.renderAdminBadgeHtml("compact") : "") +
                '</strong><div class="text-muted" style="font-size:12px;">@' + U.escapeHtml(u.username) + "</div></div></a></td>" +
                '<td data-label="Location" class="text-muted">' + U.escapeHtml(u.location || "—") + "</td>" +
                '<td data-label="Stats" class="tabular-nums text-muted" style="font-size:12.5px;">' + (u.postsCount || 0) + " posts · " + (u.friendsCount || 0) + " friends</td>" +
                '<td data-label="Status">' + (u.isSuspended ? '<span class="status-tag status-suspended">Suspended</span>' : '<span class="status-tag status-resolved">Active</span>') + "</td>" +
                '<td data-label="Actions"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
                '<a href="#inspect?uid=' + encodeURIComponent(u.uid) + '" class="btn btn-outline btn-sm" title="Inspect account read-only">' + U.ICONS.eye + " View As</a>" +
                (isSelf
                  ? '<span class="text-muted" style="font-size:12px;">You</span>'
                  : '<button type="button" class="btn ' + (u.isSuspended ? "btn-primary" : "btn-danger-soft") + ' btn-sm" data-toggle-suspend="' + U.escapeHtml(u.uid) + '" data-suspended="' + (u.isSuspended ? "1" : "0") + '">' + (u.isSuspended ? "Unsuspend" : "Suspend") + "</button>") +
                "</div></td></tr>"
              );
            })
            .join("") +
          "</tbody></table></div>";
      } else if (activeTab === "posts") {
        if (data.posts.length === 0) {
          panel.innerHTML = '<div class="empty-state"><h3>No posts</h3><p>No public posts found.</p></div>';
          return;
        }
        panel.innerHTML =
          '<div class="data-table-wrap"><table class="data-table responsive-table"><thead><tr>' +
          "<th>Author</th><th>Content</th><th>Engagement</th><th>Posted</th><th>Actions</th></tr></thead><tbody>" +
          data.posts
            .map(function (p) {
              var txt = String(p.text || (p.postType === "embed" ? "[Embedded " + (p.embedProvider || "video") + "]" : ""));
              return (
                '<tr><td data-label="Author"><a href="#profile?uid=' + encodeURIComponent(p.authorId) + '"><strong>' + U.escapeHtml(p.authorName) + '</strong><br/><span class="text-muted" style="font-size:12px;">@' + U.escapeHtml(p.authorUsername) + "</span></a></td>" +
                '<td data-label="Content" style="max-width:340px;word-break:break-word;">' + U.escapeHtml(txt.slice(0, 180)) + (txt.length > 180 ? "…" : "") + "</td>" +
                '<td data-label="Engagement" class="tabular-nums text-muted" style="font-size:12.5px;">' + (p.likesCount || 0) + " reactions · " + (p.commentsCount || 0) + " comments</td>" +
                '<td data-label="Posted" class="text-muted">' + U.escapeHtml(U.formatRelativeTime(p.createdAt)) + "</td>" +
                '<td data-label="Actions"><div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                '<button type="button" class="btn btn-secondary btn-sm" data-admin-trash-post="' + U.escapeHtml(p.postId) + '">Move to Trash</button>' +
                '<button type="button" class="btn btn-danger-soft btn-sm" data-admin-del-post="' + U.escapeHtml(p.postId) + '">Delete</button>' +
                "</div></td></tr>"
              );
            })
            .join("") +
          "</tbody></table></div>";
      }
    }

    function switchTab(tabName) {
      activeTab = tabName;
      document.querySelectorAll("#admin-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.tab === tabName);
      });
      render();
    }

    async function loadAll() {
      try {
        data = await fetchAdminData();
        render();
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
      }
    }

    document.getElementById("admin-refresh-btn").addEventListener("click", loadAll);

    document.getElementById("admin-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });

    document.getElementById("admin-panel").addEventListener("click", async function (e) {
      var promoToggle = e.target.closest("[data-promo-toggle]");
      if (promoToggle) {
        promoToggle.disabled = true;
        try {
          var nextOn = promoToggle.dataset.active !== "1";
          await HMM.promos.update(promoToggle.dataset.promoToggle, { isActive: nextOn });
          U.showToast(nextOn ? "Feed slot activated." : "Feed slot paused.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          promoToggle.disabled = false;
        }
        return;
      }

      var promoDel = e.target.closest("[data-promo-del]");
      if (promoDel) {
        promoDel.disabled = true;
        try {
          await HMM.promos.remove(promoDel.dataset.promoDel);
          U.showToast("Feed slot deleted.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          promoDel.disabled = false;
        }
        return;
      }

      var annToggle = e.target.closest("[data-adm-ann-toggle]");
      if (annToggle) {
        annToggle.disabled = true;
        try {
          var nextA = annToggle.dataset.active !== "1";
          await HMM.announcements.update(annToggle.dataset.admAnnToggle, { isActive: nextA });
          U.showToast(nextA ? "Announcement pinned live." : "Announcement hidden.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          annToggle.disabled = false;
        }
        return;
      }

      var annEdit = e.target.closest("[data-adm-ann-edit]");
      if (annEdit) {
        var foundAnn = data.announcements.find(function (a) { return a.announcementId === annEdit.dataset.admAnnEdit; });
        if (foundAnn) HMM.announcements.openCreateEditModal(ctx.profile, foundAnn, loadAll);
        return;
      }

      var annDel = e.target.closest("[data-adm-ann-del]");
      if (annDel) {
        annDel.disabled = true;
        try {
          await HMM.announcements.remove(annDel.dataset.admAnnDel);
          U.showToast("Announcement deleted.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          annDel.disabled = false;
        }
        return;
      }

      var restoreBtn = e.target.closest("[data-restore-trash]");
      if (restoreBtn) {
        var tid = restoreBtn.dataset.restoreTrash;
        var item = data.trash.find(function (t) { return t.trashId === tid; });
        if (!item) return;
        restoreBtn.disabled = true;
        try {
          await restoreTrashItem(item);
          U.showToast("Item restored to " + item.originalCollection + ".", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          restoreBtn.disabled = false;
        }
        return;
      }

      var permDelBtn = e.target.closest("[data-perm-delete-trash]");
      if (permDelBtn) {
        var pid = permDelBtn.dataset.permDeleteTrash;
        permDelBtn.disabled = true;
        try {
          await permanentlyDeleteTrashItem(pid);
          U.showToast("Item permanently deleted from Trash.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          permDelBtn.disabled = false;
        }
        return;
      }

      var repBtn = e.target.closest("[data-report-status]");
      if (repBtn) {
        repBtn.disabled = true;
        try {
          await HMM.db.collection("reports").doc(repBtn.dataset.id).update({
            status: repBtn.dataset.reportStatus,
            updatedAt: HMM.serverTimestamp(),
          });
          U.showToast("Report marked " + repBtn.dataset.reportStatus + ".", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          repBtn.disabled = false;
        }
        return;
      }

      var suspBtn = e.target.closest("[data-toggle-suspend]");
      if (suspBtn) {
        var uid = suspBtn.dataset.toggleSuspend;
        var nextSuspended = suspBtn.dataset.suspended !== "1";
        suspBtn.disabled = true;
        try {
          await HMM.db.collection("users").doc(uid).update({
            isSuspended: nextSuspended,
            updatedAt: HMM.serverTimestamp(),
          });
          U.showToast(nextSuspended ? "User suspended." : "User unsuspended.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          suspBtn.disabled = false;
        }
        return;
      }

      var trashPostBtn = e.target.closest("[data-admin-trash-post]");
      if (trashPostBtn) {
        var tpid = trashPostBtn.dataset.adminTrashPost;
        var pDoc = data.posts.find(function (p) { return p.postId === tpid; });
        if (!pDoc) return;
        trashPostBtn.disabled = true;
        try {
          await moveItemToTrash("post", pDoc, "Moved to Trash by Administrator", "Manual Moderation", "admin", ctx.user.uid);
          U.showToast("Post moved to Trash.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          trashPostBtn.disabled = false;
        }
        return;
      }

      var delPostBtn = e.target.closest("[data-admin-del-post]");
      if (delPostBtn) {
        delPostBtn.disabled = true;
        try {
          await HMM.db.collection("posts").doc(delPostBtn.dataset.adminDelPost).delete();
          U.showToast("Post permanently removed.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          delPostBtn.disabled = false;
        }
      }
    });

    await loadAll();
  }

  // ============================================================================
  // ADMIN "VIEW AS USER" READ-ONLY ACCOUNT INSPECTOR (#inspect?uid=<uid>)
  // ============================================================================
  async function mountInspectUserView(ctx, params) {
    if (!ctx.isAdmin) {
      ctx.mainEl.innerHTML =
        '<div class="card empty-state"><h3>Admin access required</h3>' +
        '<p>Account Inspector is restricted to authorized administrators.</p>' +
        '<a href="#feed" class="btn btn-primary btn-sm">Back to Feed</a></div>';
      return;
    }

    var targetUid = params ? params.get("uid") : "";
    if (!targetUid) {
      U.navigateTo("admin");
      return;
    }

    ctx.mainEl.innerHTML =
      '<div class="card empty-state"><div class="spinner"></div><p>Loading Account Inspector...</p></div>';

    var targetProfile = await HMM.authService.getUserProfile(targetUid);
    if (!targetProfile) {
      ctx.mainEl.innerHTML =
        '<div class="card empty-state"><h3>User not found</h3>' +
        '<p>This account may have been deleted.</p>' +
        '<a href="#admin" class="btn btn-primary btn-sm">Back to Admin Console</a></div>';
      return;
    }

    var activeTab = "overview";
    var inspected = {
      privateAccount: null,
      allPosts: [],
      userPosts: [],
      friendships: [],
      incomingReqs: [],
      outgoingReqs: [],
      following: [],
      followers: [],
      notifications: [],
      blocksOut: [],
      blocksIn: [],
      chats: [],
      selectedChatMessages: [],
      selectedChatTitle: "",
      usersByUid: new Map(),
    };

    try {
      var res = await Promise.all([
        HMM.db.collection("users").doc(targetUid).collection("private").doc("account").get().catch(function () { return { exists: false }; }),
        HMM.db.collection("posts").where("visibility", "==", "public").limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("posts").where("authorId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("friendships").where("participants", "array-contains", targetUid).limit(100).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("friendRequests").where("receiverId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("friendRequests").where("senderId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("follows").where("followerId", "==", targetUid).limit(100).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("follows").where("followingId", "==", targetUid).limit(100).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("notifications").where("recipientId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("blocks").where("blockerId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.db.collection("blocks").where("blockedId", "==", targetUid).limit(50).get().catch(function () { return { docs: [] }; }),
        HMM.rtdb.ref("userChats/" + targetUid).once("value").catch(function () { return { val: function () { return null; } }; }),
      ]);

      inspected.privateAccount = res[0].exists ? res[0].data() : null;
      inspected.allPosts = res[1].docs.map(function (d) { return d.data(); }).sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
      inspected.userPosts = res[2].docs.map(function (d) { return d.data(); }).sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
      inspected.friendships = res[3].docs.map(function (d) { return d.data(); });
      inspected.incomingReqs = res[4].docs.map(function (d) { return d.data(); }).filter(function (r) { return r.status === "pending"; });
      inspected.outgoingReqs = res[5].docs.map(function (d) { return d.data(); }).filter(function (r) { return r.status === "pending"; });
      inspected.following = res[6].docs.map(function (d) { return d.data(); });
      inspected.followers = res[7].docs.map(function (d) { return d.data(); });
      inspected.notifications = res[8].docs.map(function (d) { return d.data(); }).sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
      inspected.blocksOut = res[9].docs.map(function (d) { return d.data(); });
      inspected.blocksIn = res[10].docs.map(function (d) { return d.data(); });
      var chatVal = res[11] && typeof res[11].val === "function" ? res[11].val() : null;
      inspected.chats = chatVal
        ? Object.values(chatVal).sort(function (a, b) { return (b.lastMessageTime || 0) - (a.lastMessageTime || 0); })
        : [];

      // Preload related user profiles for network/blocks display
      var relatedUids = [];
      inspected.friendships.forEach(function (f) { relatedUids.push(f.user1Id === targetUid ? f.user2Id : f.user1Id); });
      inspected.incomingReqs.forEach(function (r) { relatedUids.push(r.senderId); });
      inspected.outgoingReqs.forEach(function (r) { relatedUids.push(r.receiverId); });
      inspected.blocksIn.forEach(function (b) { relatedUids.push(b.blockerId); });
      var loadedUsers = await HMM.authService.getUsersByIds(relatedUids);
      loadedUsers.forEach(function (u) { inspected.usersByUid.set(u.uid, u); });
    } catch (err) {
      U.showToast(U.getFriendlyErrorMessage(err), "error");
    }

    var blockedSet = new Set();
    inspected.blocksOut.forEach(function (b) { blockedSet.add(b.blockedId); });
    inspected.blocksIn.forEach(function (b) { blockedSet.add(b.blockerId); });

    ctx.mainEl.innerHTML =
      '<div class="view-as-banner">' +
      '<div class="view-as-banner-left">' +
      '<span class="view-as-pill">' + U.ICONS.eye + " Admin Read-Only Preview</span>" +
      '<span>Viewing KLORIX as <strong>' + U.escapeHtml(targetProfile.name) + '</strong> (@' + U.escapeHtml(targetProfile.username) + ")</span>" +
      "</div>" +
      '<a href="#admin" class="btn btn-secondary btn-sm">Exit View-As</a>' +
      "</div>" +
      '<div class="card admin-console-card">' +
      '<div class="tabs" id="inspect-tabs">' +
      '<button type="button" class="tab-btn active" data-itab="overview">Account Overview</button>' +
      '<button type="button" class="tab-btn" data-itab="feed">Home Feed View</button>' +
      '<button type="button" class="tab-btn" data-itab="posts">Posts <span class="tab-count">' + inspected.userPosts.length + "</span></button>" +
      '<button type="button" class="tab-btn" data-itab="network">Friends &amp; Network <span class="tab-count">' + inspected.friendships.length + "</span></button>" +
      '<button type="button" class="tab-btn" data-itab="notifs">Notifications <span class="tab-count">' + inspected.notifications.length + "</span></button>" +
      '<button type="button" class="tab-btn" data-itab="blocks">Blocked Users <span class="tab-count">' + inspected.blocksOut.length + "</span></button>" +
      '<button type="button" class="tab-btn" data-itab="chats">Chats <span class="tab-count">' + inspected.chats.length + "</span></button>" +
      '</div><div id="inspect-panel" class="admin-panel-body"></div></div>';

    var activePostManager = null;

    function renderInspectTab() {
      if (activePostManager) {
        activePostManager.cleanup();
        activePostManager = null;
      }
      var panel = document.getElementById("inspect-panel");
      if (!panel) return;

      if (activeTab === "overview") {
        var email = (inspected.privateAccount && inspected.privateAccount.email) || "Not recorded";
        panel.innerHTML =
          '<div class="admin-grid-2">' +
          '<div class="admin-section-box">' +
          '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
          U.renderAvatarHtml({ name: targetProfile.name, avatarUrl: targetProfile.avatarUrl, avatarColor: targetProfile.avatarColor, size: "lg", isAdmin: U.isOfficialAdminUser(targetProfile) }) +
          '<div><h3 style="font-size:18px;font-weight:800;">' + U.escapeHtml(targetProfile.name) + "</h3>" +
          '<div class="text-muted">@' + U.escapeHtml(targetProfile.username) + "</div>" +
          '<div style="margin-top:6px;">' + (targetProfile.isSuspended ? '<span class="status-tag status-suspended">Suspended</span>' : '<span class="status-tag status-resolved">Active</span>') + "</div></div></div>" +
          '<div class="inspect-kv-list">' +
          '<div><span>Private Email</span><strong class="font-mono" style="font-size:12.5px;">' + U.escapeHtml(email) + "</strong></div>" +
          '<div><span>UID</span><strong class="font-mono" style="font-size:12px;">' + U.escapeHtml(targetProfile.uid) + "</strong></div>" +
          '<div><span>Location</span><strong>' + U.escapeHtml(targetProfile.location || "—") + "</strong></div>" +
          '<div><span>Visibility</span><strong>' + U.escapeHtml(targetProfile.visibility || "public") + "</strong></div>" +
          '<div><span>Friend Requests</span><strong>' + U.escapeHtml(targetProfile.friendRequestPref || "everyone") + "</strong></div>" +
          '<div><span>Joined</span><strong>' + U.escapeHtml(U.formatJoinDate(targetProfile.createdAt)) + "</strong></div>" +
          "</div></div>" +
          '<div class="admin-section-box">' +
          "<h3>Profile Stats &amp; Bio</h3>" +
          '<div class="kpi-grid" style="margin:12px 0;">' +
          '<div class="kpi-card"><div class="kpi-label">Posts</div><div class="kpi-value">' + (targetProfile.postsCount || 0) + "</div></div>" +
          '<div class="kpi-card"><div class="kpi-label">Friends</div><div class="kpi-value">' + (targetProfile.friendsCount || 0) + "</div></div>" +
          '<div class="kpi-card"><div class="kpi-label">Followers</div><div class="kpi-value">' + (targetProfile.followersCount || 0) + "</div></div>" +
          '<div class="kpi-card"><div class="kpi-label">Following</div><div class="kpi-value">' + (targetProfile.followingCount || 0) + "</div></div>" +
          "</div>" +
          '<p class="text-muted" style="font-size:13.5px;line-height:1.6;">' + U.escapeHtml(targetProfile.bio || "No bio set.") + "</p>" +
          '<div style="margin-top:14px;"><a href="#profile?uid=' + encodeURIComponent(targetUid) + '" class="btn btn-secondary btn-sm">Open Public Profile</a></div>' +
          "</div></div>";
        return;
      }

      if (activeTab === "feed" || activeTab === "posts") {
        panel.innerHTML =
          '<p class="text-muted" style="font-size:13px;margin-bottom:12px;">' +
          (activeTab === "feed"
            ? "Showing the public Home Feed as seen by @" + U.escapeHtml(targetProfile.username) + " (filtered by their blocked accounts)."
            : "All posts authored by @" + U.escapeHtml(targetProfile.username) + ".") +
          '</p><div id="inspect-posts-box" style="display:flex;flex-direction:column;gap:14px;"></div>';

        var list =
          activeTab === "feed"
            ? inspected.allPosts.filter(function (p) { return !blockedSet.has(p.authorId); })
            : inspected.userPosts;

        activePostManager = HMM.feed.createPostListManager({
          container: document.getElementById("inspect-posts-box"),
          ctx: ctx,
          readOnly: true,
          skipBlockFilter: true,
        });
        activePostManager.render(list, "No posts visible", "No posts in this view.");
        return;
      }

      if (activeTab === "network") {
        var friendRows = inspected.friendships.map(function (f) {
          var fid = f.user1Id === targetUid ? f.user2Id : f.user1Id;
          var u = inspected.usersByUid.get(fid);
          return '<div class="user-row"><div class="user-row-left">' +
            U.renderAvatarHtml({ name: u ? u.name : fid, avatarUrl: u ? u.avatarUrl : "", avatarColor: u ? u.avatarColor : "#006A4E", size: "sm" }) +
            '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u ? u.name : fid) + '</span>' +
            '<span class="user-row-handle">@' + U.escapeHtml(u ? u.username : "member") + "</span></div></div>" +
            '<a href="#inspect?uid=' + encodeURIComponent(fid) + '" class="btn btn-outline btn-sm">' + U.ICONS.eye + " Inspect</a></div>";
        });
        panel.innerHTML =
          '<div class="admin-grid-2">' +
          '<div class="admin-section-box"><h3>Friends (' + inspected.friendships.length + ")</h3>" +
          (friendRows.length ? friendRows.join("") : '<p class="text-muted" style="font-size:13px;margin-top:8px;">No friends yet.</p>') +
          "</div>" +
          '<div class="admin-section-box"><h3>Network Summary</h3>' +
          '<div class="inspect-kv-list" style="margin-top:10px;">' +
          "<div><span>Incoming Pending Requests</span><strong>" + inspected.incomingReqs.length + "</strong></div>" +
          "<div><span>Outgoing Pending Requests</span><strong>" + inspected.outgoingReqs.length + "</strong></div>" +
          "<div><span>Following</span><strong>" + inspected.following.length + "</strong></div>" +
          "<div><span>Followers</span><strong>" + inspected.followers.length + "</strong></div>" +
          "</div></div></div>";
        return;
      }

      if (activeTab === "notifs") {
        if (inspected.notifications.length === 0) {
          panel.innerHTML = '<div class="empty-state"><h3>No notifications</h3><p>This user has no notifications.</p></div>';
          return;
        }
        panel.innerHTML =
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
          inspected.notifications
            .map(function (n) {
              return (
                '<div class="notif-item ' + (n.isRead ? "" : "unread") + '">' +
                '<div class="notif-body"><div class="notif-text">' + U.escapeHtml(n.message) + "</div>" +
                '<div class="notif-time">@' + U.escapeHtml(n.senderUsername || "user") + " · " + U.escapeHtml(n.type) + " · " + U.escapeHtml(U.formatRelativeTime(n.createdAt)) + "</div></div></div>"
              );
            })
            .join("") +
          "</div>";
        return;
      }

      if (activeTab === "blocks") {
        panel.innerHTML =
          '<div class="admin-grid-2">' +
          '<div class="admin-section-box"><h3>Users Blocked by @' + U.escapeHtml(targetProfile.username) + " (" + inspected.blocksOut.length + ")</h3>" +
          (inspected.blocksOut.length === 0
            ? '<p class="text-muted" style="font-size:13px;margin-top:8px;">Has not blocked anyone.</p>'
            : inspected.blocksOut.map(function (b) {
                return '<div class="user-row"><div class="user-row-left">' +
                  U.renderAvatarHtml({ name: b.blockedName, avatarUrl: b.blockedAvatarUrl, avatarColor: b.blockedAvatarColor, size: "sm" }) +
                  '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(b.blockedName) + '</span>' +
                  '<span class="user-row-handle">@' + U.escapeHtml(b.blockedUsername) + "</span></div></div></div>";
              }).join("")) +
          "</div>" +
          '<div class="admin-section-box"><h3>Users Who Blocked @' + U.escapeHtml(targetProfile.username) + " (" + inspected.blocksIn.length + ")</h3>" +
          (inspected.blocksIn.length === 0
            ? '<p class="text-muted" style="font-size:13px;margin-top:8px;">No one has blocked this user.</p>'
            : inspected.blocksIn.map(function (b) {
                var u = inspected.usersByUid.get(b.blockerId);
                return '<div class="user-row"><div class="user-row-left">' +
                  U.renderAvatarHtml({ name: u ? u.name : b.blockerId, avatarUrl: u ? u.avatarUrl : "", avatarColor: u ? u.avatarColor : "#006A4E", size: "sm" }) +
                  '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u ? u.name : b.blockerId) + '</span>' +
                  '<span class="user-row-handle">@' + U.escapeHtml(u ? u.username : "member") + "</span></div></div></div>";
              }).join("")) +
          "</div></div>";
        return;
      }

      if (activeTab === "chats") {
        panel.innerHTML =
          '<div class="admin-grid-2">' +
          '<div class="admin-section-box"><h3>Conversations (' + inspected.chats.length + ")</h3>" +
          (inspected.chats.length === 0
            ? '<p class="text-muted" style="font-size:13px;margin-top:8px;">No chat threads found.</p>'
            : inspected.chats.map(function (c) {
                return (
                  '<div class="user-row" style="cursor:pointer;" data-inspect-chat="' + U.escapeHtml(c.chatId) + '" data-chat-title="' + U.escapeHtml(c.name || c.otherName || "Chat") + '">' +
                  '<div class="user-row-left">' +
                  U.renderAvatarHtml({ name: c.name || c.otherName || "Chat", avatarUrl: c.avatarUrl || c.otherAvatarUrl, avatarColor: c.avatarColor || c.otherAvatarColor, size: "sm" }) +
                  '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(c.name || c.otherName || "Chat") +
                  (c.type === "group" ? ' <span class="chat-group-tag">Group</span>' : "") + "</span>" +
                  '<span class="user-row-handle">' + U.escapeHtml(String(c.lastMessage || "").slice(0, 60)) + "</span></div></div>" +
                  '<button type="button" class="btn btn-secondary btn-sm">Read</button></div>'
                );
              }).join("")) +
          "</div>" +
          '<div class="admin-section-box" id="inspect-chat-messages-box">' +
          "<h3>" + U.escapeHtml(inspected.selectedChatTitle || "Message Thread Preview") + "</h3>" +
          (inspected.selectedChatMessages.length === 0
            ? '<p class="text-muted" style="font-size:13px;margin-top:8px;">Click any conversation on the left to inspect its recent messages (read-only).</p>'
            : '<div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-top:10px;">' +
              inspected.selectedChatMessages.map(function (m) {
                var isTarget = m.senderId === targetUid;
                return (
                  '<div class="msg-row ' + (isTarget ? "mine" : "theirs") + '">' +
                  '<div class="msg-sender-name" style="font-size:11.5px;">' + U.escapeHtml(m.senderName || m.senderId) + "</div>" +
                  '<div class="msg-bubble">' + U.escapeHtml(m.text || "") + "</div>" +
                  '<div class="msg-meta"><span>' + U.escapeHtml(U.formatMessageTime(m.createdAt)) + "</span></div></div>"
                );
              }).join("") +
              "</div>") +
          "</div></div>";
      }
    }

    document.getElementById("inspect-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      activeTab = btn.dataset.itab;
      document.querySelectorAll("#inspect-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderInspectTab();
    });

    document.getElementById("inspect-panel").addEventListener("click", async function (e) {
      var chatRow = e.target.closest("[data-inspect-chat]");
      if (!chatRow) return;
      var chatId = chatRow.dataset.inspectChat;
      inspected.selectedChatTitle = chatRow.dataset.chatTitle || "Chat Thread";
      try {
        var snap = await HMM.rtdb.ref("messages/" + chatId).limitToLast(50).once("value");
        var val = snap.val();
        inspected.selectedChatMessages = val
          ? Object.values(val).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); })
          : [];
        renderInspectTab();
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err, "Unable to read messages. Ensure updated RTDB rules are published."), "error");
      }
    });

    ctx.onCleanup(function () {
      if (activePostManager) activePostManager.cleanup();
    });

    renderInspectTab();
  }

  HMM.admin = {
    mountView: mountAdminView,
    mountInspectUserView: mountInspectUserView,
  };
})(window.HMM = window.HMM || {});
