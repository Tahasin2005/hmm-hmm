/**
 * HMM HMM — Admin & Moderation Console (#admin)
 * Features:
 * 1. AI Bulk Moderation (Google AI Studio API Key, On/Off Toggle, Batch Scan Posts & Comments -> Trash)
 * 2. Admin Trash Bin (View Trashed Items, Restore to Feed/Comments, Permanently Delete)
 * 3. Dynamic Site Branding & SEO Settings (Upload/URL Logo, Favicon, Site Name, Meta Description & Keywords)
 * 4. Reports, Users (Suspend/Unsuspend), and Posts Moderation
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

    // Safely decrement counters if possible (ignore if parent already deleted)
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
      "You are an automated content moderation classifier for HMM HMM, a Bangladeshi community social network (content may be in English, Bengali, or Banglish). " +
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
  // ADMIN CONSOLE VIEW CONTROLLER
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
    };

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Admin &amp; Moderation Console</h1>' +
      '<p class="page-subtitle">AI bulk moderation, recycle bin, dynamic site branding, SEO, and community governance.</p></div>' +
      '<button type="button" id="admin-refresh-btn" class="btn btn-secondary btn-sm">Refresh data</button></div>' +
      '<div class="kpi-grid" id="admin-kpi-grid"></div>' +
      '<div class="card admin-console-card"><div class="tabs" id="admin-tabs">' +
      '<button type="button" class="tab-btn active" data-tab="ai">' + U.ICONS.cpu + " AI Moderation</button>" +
      '<button type="button" class="tab-btn" data-tab="trash">' + U.ICONS.trash + ' Trash <span class="tab-count" id="adm-cnt-trash">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="branding">' + U.ICONS.globe + " Branding &amp; SEO</button>" +
      '<button type="button" class="tab-btn" data-tab="reports">Reports <span class="tab-count" id="adm-cnt-reports">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="users">Users <span class="tab-count" id="adm-cnt-users">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="posts">Posts <span class="tab-count" id="adm-cnt-posts">0</span></button>' +
      '</div><div id="admin-panel" class="admin-panel-body"><p class="text-muted">Loading admin console...</p></div></div>';

    function renderKpis() {
      var openReports = data.reports.filter(function (r) { return r.status === "open"; }).length;
      document.getElementById("adm-cnt-trash").textContent = String(data.trash.length);
      document.getElementById("adm-cnt-reports").textContent = String(data.reports.length);
      document.getElementById("adm-cnt-users").textContent = String(data.users.length);
      document.getElementById("adm-cnt-posts").textContent = String(data.posts.length);

      document.getElementById("admin-kpi-grid").innerHTML =
        '<div class="kpi-card"><div class="kpi-label">AI Moderation</div><div class="kpi-value" style="font-size:20px;color:' +
        (data.aiConfig.enabled ? "var(--accent)" : "var(--text-muted)") + ';">' +
        (data.aiConfig.enabled ? "Active" : "Paused") + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Trash Items</div><div class="kpi-value" style="color:var(--crimson);">' + data.trash.length + "</div></div>" +
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

      // Wire events for AI tab
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
          // Fetch fresh posts & comments
          var fresh = await Promise.all([
            HMM.db.collection("posts").limit(120).get(),
            HMM.db.collection("comments").limit(150).get(),
          ]);
          var postsList = fresh[0].docs.map(function (d) { return d.data(); });
          var commentsList = fresh[1].docs.map(function (d) { return d.data(); });

          var queue = [];
          postsList.forEach(function (p) {
            queue.push({ id: "post:" + p.postId, type: "post", author: p.authorName, text: p.text, raw: p });
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
        '<p class="text-muted" style="font-size:13px;margin:4px 0 14px;">Dynamically updates &lt;title&gt;, meta description, keywords, and OpenGraph social share tags.</p>' +
        '<div class="form-group"><label class="form-label" for="sc-meta-desc">SEO Meta Description</label>' +
        '<textarea id="sc-meta-desc" class="form-textarea" maxlength="320">' + U.escapeHtml(cfg.metaDescription) + "</textarea>" +
        '<span class="form-hint">Recommended: 120–160 characters for search engines.</span></div>' +
        '<div class="form-group" style="margin-top:12px;"><label class="form-label" for="sc-meta-keys">SEO Meta Keywords (comma-separated)</label>' +
        '<textarea id="sc-meta-keys" class="form-textarea" style="min-height:76px;" maxlength="320">' + U.escapeHtml(cfg.metaKeywords) + "</textarea></div>" +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">' +
        '<button type="submit" id="sc-save-btn" class="btn btn-primary">Save &amp; Apply Globally</button>' +
        '<button type="button" id="sc-reset-btn" class="btn btn-secondary">Reset Defaults</button>' +
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
          U.showToast("Site branding reset to defaults.", "success");
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
            siteName: U.sanitizeText(document.getElementById("sc-name").value, 80) || "HMM HMM",
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

      if (activeTab === "ai") {
        renderAiTab(panel);
        return;
      }
      if (activeTab === "trash") {
        renderTrashTab(panel);
        return;
      }
      if (activeTab === "branding") {
        renderBrandingTab(panel);
        return;
      }

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
          "<th>Member</th><th>Location</th><th>Stats</th><th>Status</th><th>Action</th></tr></thead><tbody>" +
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
                '<td data-label="Action">' +
                (isSelf
                  ? '<span class="text-muted" style="font-size:12px;">You (Admin)</span>'
                  : '<button type="button" class="btn ' + (u.isSuspended ? "btn-primary" : "btn-danger-soft") + ' btn-sm" data-toggle-suspend="' + U.escapeHtml(u.uid) + '" data-suspended="' + (u.isSuspended ? "1" : "0") + '">' + (u.isSuspended ? "Unsuspend" : "Suspend") + "</button>") +
                "</td></tr>"
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
              var txt = String(p.text || "");
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
        var postObj = data.posts.find(function (p) { return p.postId === tpid; });
        if (!postObj) return;
        trashPostBtn.disabled = true;
        try {
          await moveItemToTrash("post", postObj, "Moved to Trash by Administrator", "Manual Moderation", "admin", ctx.user.uid);
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
          U.showToast("Post permanently deleted.", "success");
          await loadAll();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          delPostBtn.disabled = false;
        }
      }
    });

    await loadAll();
  }

  HMM.admin = { mountView: mountAdminView };
})(window.HMM = window.HMM || {});
