/**
 * HMM HMM — Protected Admin & Moderation Console View Controller (#admin)
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function fetchAdminData() {
    var results = await Promise.all([
      HMM.db.collection("reports").limit(100).get(),
      HMM.db.collection("users").limit(100).get(),
      HMM.db.collection("posts").limit(100).get(),
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
    };
  }

  async function mountAdminView(ctx) {
    if (!ctx.isAdmin) {
      ctx.mainEl.innerHTML =
        '<div class="card empty-state">' +
        '<div class="empty-state-icon" style="background:var(--crimson-soft);color:var(--crimson);">' + U.ICONS.shield + "</div>" +
        "<h3>Admin access required</h3>" +
        "<p>This moderation console is restricted to authorized HMM HMM administrators.</p>" +
        '<a href="#feed" class="btn btn-primary btn-sm">Return to Home Feed</a></div>';
      return;
    }

    var activeTab = "reports";
    var data = { reports: [], users: [], posts: [] };

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Admin &amp; Moderation Console</h1>' +
      '<p class="page-subtitle">Review community reports, moderate posts, and manage account status.</p></div>' +
      '<button type="button" id="admin-refresh-btn" class="btn btn-secondary btn-sm">Refresh data</button></div>' +
      '<div class="kpi-grid" id="admin-kpi-grid"></div>' +
      '<div class="card" style="padding-bottom:0;"><div class="tabs" id="admin-tabs">' +
      '<button type="button" class="tab-btn active" data-tab="reports">Reports <span class="tab-count" id="adm-cnt-reports">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="users">Users <span class="tab-count" id="adm-cnt-users">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="posts">Posts <span class="tab-count" id="adm-cnt-posts">0</span></button>' +
      '</div><div id="admin-panel" style="padding:16px 0;"><p class="text-muted">Loading moderation dashboard...</p></div></div>';

    function render() {
      var openReports = data.reports.filter(function (r) { return r.status === "open"; }).length;
      var suspendedUsers = data.users.filter(function (u) { return u.isSuspended; }).length;

      document.getElementById("adm-cnt-reports").textContent = String(data.reports.length);
      document.getElementById("adm-cnt-users").textContent = String(data.users.length);
      document.getElementById("adm-cnt-posts").textContent = String(data.posts.length);

      document.getElementById("admin-kpi-grid").innerHTML =
        '<div class="kpi-card"><div class="kpi-label">Open Reports</div><div class="kpi-value" style="color:var(--amber);">' + openReports + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Total Users</div><div class="kpi-value">' + data.users.length + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Suspended</div><div class="kpi-value" style="color:var(--crimson);">' + suspendedUsers + "</div></div>" +
        '<div class="kpi-card"><div class="kpi-label">Public Posts</div><div class="kpi-value">' + data.posts.length + "</div></div>";

      var panel = document.getElementById("admin-panel");
      if (activeTab === "reports") {
        if (data.reports.length === 0) {
          panel.innerHTML = '<div class="empty-state"><h3>No reports</h3><p>The community report queue is clear.</p></div>';
          return;
        }
        panel.innerHTML =
          '<div class="data-table-wrap"><table class="data-table"><thead><tr>' +
          "<th>Target</th><th>Reason &amp; Details</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>" +
          data.reports
            .map(function (r) {
              var locked = r.status === "resolved" || r.status === "dismissed";
              return (
                "<tr><td><strong>" + U.escapeHtml(r.targetType.toUpperCase()) + "</strong><br/>" +
                '<span class="font-mono text-muted" style="font-size:12px;">' + U.escapeHtml(r.targetId) + "</span></td>" +
                "<td><strong>" + U.escapeHtml(r.reason) + "</strong>" +
                (r.details ? '<div class="text-muted" style="font-size:12.5px;margin-top:2px;">' + U.escapeHtml(r.details) + "</div>" : "") + "</td>" +
                '<td><span class="status-tag status-' + U.escapeHtml(r.status) + '">' + U.escapeHtml(r.status) + "</span></td>" +
                '<td class="text-muted">' + U.escapeHtml(U.formatRelativeTime(r.createdAt)) + "</td>" +
                '<td><div style="display:flex;gap:6px;flex-wrap:wrap;">' +
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
          '<div class="data-table-wrap"><table class="data-table"><thead><tr>' +
          "<th>Member</th><th>Location</th><th>Stats</th><th>Status</th><th>Action</th></tr></thead><tbody>" +
          data.users
            .map(function (u) {
              var isSelf = u.uid === ctx.user.uid;
              return (
                '<tr><td><a href="#profile?uid=' + encodeURIComponent(u.uid) + '" style="display:flex;align-items:center;gap:10px;">' +
                U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm" }) +
                "<div><strong>" + U.escapeHtml(u.name) + '</strong><div class="text-muted" style="font-size:12px;">@' + U.escapeHtml(u.username) + "</div></div></a></td>" +
                '<td class="text-muted">' + U.escapeHtml(u.location || "—") + "</td>" +
                '<td class="tabular-nums text-muted" style="font-size:12.5px;">' + (u.postsCount || 0) + " posts · " + (u.friendsCount || 0) + " friends</td>" +
                "<td>" + (u.isSuspended ? '<span class="status-tag status-suspended">Suspended</span>' : '<span class="status-tag status-resolved">Active</span>') + "</td>" +
                "<td>" +
                (isSelf
                  ? '<span class="text-muted" style="font-size:12px;">You</span>'
                  : '<button type="button" class="btn ' + (u.isSuspended ? "btn-primary" : "btn-danger-soft") + ' btn-sm" data-toggle-suspend="' + U.escapeHtml(u.uid) + '" data-suspended="' + (u.isSuspended ? "1" : "0") + '">' + (u.isSuspended ? "Unsuspend" : "Suspend") + "</button>") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table></div>";
      } else if (activeTab === "posts") {
        if (data.posts.length === 0) {
          panel.innerHTML = '<div class="empty-state"><h3>No posts</h3><p>No posts found.</p></div>';
          return;
        }
        panel.innerHTML =
          '<div class="data-table-wrap"><table class="data-table"><thead><tr>' +
          "<th>Author</th><th>Content</th><th>Engagement</th><th>Posted</th><th>Action</th></tr></thead><tbody>" +
          data.posts
            .map(function (p) {
              var txt = String(p.text || "");
              return (
                '<tr><td><a href="#profile?uid=' + encodeURIComponent(p.authorId) + '"><strong>' + U.escapeHtml(p.authorName) + '</strong><br/><span class="text-muted" style="font-size:12px;">@' + U.escapeHtml(p.authorUsername) + "</span></a></td>" +
                '<td style="max-width:340px;">' + U.escapeHtml(txt.slice(0, 180)) + (txt.length > 180 ? "…" : "") + "</td>" +
                '<td class="tabular-nums text-muted" style="font-size:12.5px;">' + (p.likesCount || 0) + " likes · " + (p.commentsCount || 0) + " comments</td>" +
                '<td class="text-muted">' + U.escapeHtml(U.formatRelativeTime(p.createdAt)) + "</td>" +
                '<td><button type="button" class="btn btn-danger-soft btn-sm" data-admin-del-post="' + U.escapeHtml(p.postId) + '">Delete</button></td></tr>'
              );
            })
            .join("") +
          "</tbody></table></div>";
      }
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
      activeTab = btn.dataset.tab;
      document.querySelectorAll("#admin-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      render();
    });

    document.getElementById("admin-panel").addEventListener("click", async function (e) {
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

      var delPostBtn = e.target.closest("[data-admin-del-post]");
      if (delPostBtn) {
        delPostBtn.disabled = true;
        try {
          await HMM.db.collection("posts").doc(delPostBtn.dataset.adminDelPost).delete();
          U.showToast("Post removed by moderation.", "success");
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
