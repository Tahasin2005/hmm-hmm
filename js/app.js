/**
 * HMM HMM — Main Application Bootstrap, Hash Router, Shell, Presence, Badges & Report Modal
 * Classic script — works automatically when double-clicking index.html locally (file://)
 * AND when hosted on cPanel (HTTPS) or preview server.
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;
  var A = HMM.authService;

  var currentSession = null;
  var activeViewCleanup = [];
  var globalCleanups = [];

  function runViewCleanup() {
    activeViewCleanup.forEach(function (fn) {
      try { if (typeof fn === "function") fn(); } catch (e) {}
    });
    activeViewCleanup = [];
  }

  function runGlobalCleanup() {
    runViewCleanup();
    globalCleanups.forEach(function (fn) {
      try { if (typeof fn === "function") fn(); } catch (e) {}
    });
    globalCleanups = [];
  }

  function attachPresence(uid) {
    var connectedRef = HMM.rtdb.ref(".info/connected");
    var userPresenceRef = HMM.rtdb.ref("presence/" + uid);
    var cb = function (snap) {
      if (snap.val() !== true) return;
      userPresenceRef
        .onDisconnect()
        .set({ online: false, lastSeen: HMM.rtdbServerTimestamp() })
        .then(function () {
          userPresenceRef.set({ online: true, lastSeen: HMM.rtdbServerTimestamp() }).catch(function () {});
        })
        .catch(function () {});
    };
    connectedRef.on("value", cb);
    return function () {
      connectedRef.off("value", cb);
    };
  }

  function updateBadges(ids, count) {
    var display = count > 99 ? "99+" : String(count);
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (count > 0) {
        el.textContent = display;
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
  }

  function subscribeToGlobalBadges(uid) {
    var u1 = HMM.db
      .collection("notifications")
      .where("recipientId", "==", uid)
      .limit(60)
      .onSnapshot(
        function (snap) {
          var unread = snap.docs.filter(function (d) { return !d.data().isRead; }).length;
          updateBadges(["badge-notifs", "hdr-badge-notifs"], unread);
        },
        function () {}
      );

    var u2 = HMM.db
      .collection("friendRequests")
      .where("receiverId", "==", uid)
      .limit(60)
      .onSnapshot(
        function (snap) {
          var pending = snap.docs.filter(function (d) { return d.data().status === "pending"; }).length;
          updateBadges(["badge-friends", "mob-badge-friends"], pending);
        },
        function () {}
      );

    var chatRef = HMM.rtdb.ref("userChats/" + uid);
    var chatCb = function (snap) {
      var val = snap.val();
      var total = 0;
      if (val && typeof val === "object") {
        Object.values(val).forEach(function (item) {
          if (item && typeof item.unreadCount === "number") total += item.unreadCount;
        });
      }
      updateBadges(["badge-messages", "hdr-badge-messages", "mob-badge-messages"], total);
    };
    chatRef.on("value", chatCb);

    return function () {
      if (u1) u1();
      if (u2) u2();
      chatRef.off("value", chatCb);
    };
  }

  function openReportModal(opts) {
    var optionsHtml = U.REPORT_REASONS.map(function (r) {
      return '<option value="' + U.escapeHtml(r) + '">' + U.escapeHtml(r) + "</option>";
    }).join("");

    U.openModal(
      "Report " + opts.targetType,
      '<p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">' +
        "Help keep HMM HMM safe. Tell our moderation team why you are reporting " +
        U.escapeHtml(opts.label || "this item") + ".</p>" +
        '<form id="report-modal-form" class="auth-form">' +
        '<div class="form-group"><label class="form-label" for="report-reason">Reason</label>' +
        '<select id="report-reason" class="form-select" required>' + optionsHtml + "</select></div>" +
        '<div class="form-group"><label class="form-label" for="report-details">Additional details (optional)</label>' +
        '<textarea id="report-details" class="form-textarea" maxlength="' + U.LIMITS.REPORT_DETAILS_MAX + '" placeholder="Provide helpful context..."></textarea></div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="report-cancel">Cancel</button>' +
        '<button type="submit" class="btn btn-danger" id="report-submit">Submit report</button></div></form>',
      function (body, close) {
        body.querySelector("#report-cancel").addEventListener("click", close);
        body.querySelector("#report-modal-form").addEventListener("submit", async function (e) {
          e.preventDefault();
          var submitBtn = body.querySelector("#report-submit");
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
          var reason = body.querySelector("#report-reason").value;
          var details = U.sanitizeText(body.querySelector("#report-details").value, U.LIMITS.REPORT_DETAILS_MAX);
          var reportId = U.getReportId(opts.reporterId, opts.targetType, opts.targetId);
          var reportRef = HMM.db.collection("reports").doc(reportId);

          try {
            var existing = await reportRef.get();
            if (existing.exists) {
              U.showToast("You have already reported this item.", "error");
              close();
              return;
            }
            await reportRef.set({
              reportId: reportId,
              reporterId: opts.reporterId,
              targetType: opts.targetType,
              targetId: opts.targetId,
              reason: reason,
              details: details,
              status: "open",
              createdAt: HMM.serverTimestamp(),
              updatedAt: HMM.serverTimestamp(),
            });
            U.showToast("Report submitted to HMM HMM moderation.", "success");
            close();
          } catch (err) {
            U.showToast(U.getFriendlyErrorMessage(err), "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit report";
          }
        });
      }
    );
  }

  function renderVerificationGate(root, user) {
    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div class="gate-icon">' + U.ICONS.mail + "</div>" +
      "<h2>Verify your email</h2>" +
      '<p class="text-muted" style="margin-top:8px;font-size:14px;">' +
      "We sent a verification link to <strong>" + U.escapeHtml(user.email || "") + "</strong>. " +
      "Verify your email address to activate your HMM HMM account.</p>" +
      '<div id="gate-alert" class="alert alert-info hidden" style="margin-top:14px;"></div>' +
      '<div class="gate-actions">' +
      '<button type="button" class="btn btn-primary btn-lg btn-block" id="btn-check-verified">I\'ve verified my email — Continue</button>' +
      '<button type="button" class="btn btn-secondary btn-block" id="btn-resend-verify">Resend verification email</button>' +
      '<button type="button" class="btn btn-ghost btn-block" id="btn-gate-logout">Sign out</button>' +
      "</div></div></div>";

    var alertBox = document.getElementById("gate-alert");
    document.getElementById("btn-check-verified").addEventListener("click", async function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Checking...";
      try {
        await user.reload();
        await user.getIdToken(true);
        if (HMM.auth.currentUser && HMM.auth.currentUser.emailVerified) {
          handleSignedInUser(HMM.auth.currentUser);
        } else {
          alertBox.textContent = "Your email is not verified yet. Please click the link in your inbox (check spam too).";
          alertBox.className = "alert alert-warning";
          alertBox.classList.remove("hidden");
          btn.disabled = false;
          btn.textContent = "I've verified my email — Continue";
        }
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
        btn.textContent = "I've verified my email — Continue";
      }
    });

    document.getElementById("btn-resend-verify").addEventListener("click", async function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      try {
        await A.resendVerificationEmail();
        alertBox.textContent = "Verification email sent again! Check your inbox.";
        alertBox.className = "alert alert-info";
        alertBox.classList.remove("hidden");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("btn-gate-logout").addEventListener("click", function () { A.logoutUser(); });
  }

  function renderOnboardingGate(root, user) {
    var pending = A.readPendingSignup();
    var suggestedName = (pending && pending.name) || user.displayName || "HMM Member";
    var suggestedUser = (pending && pending.username) || A.generateDefaultUsername(suggestedName, user.uid);
    var suggestedLocation = (pending && pending.location) || "Dhaka, Bangladesh";

    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
      '<img src="assets/icons/logo.svg" alt="HMM HMM" style="width:40px;height:40px;border-radius:10px;" />' +
      '<div><div class="brand-name">HMM HMM</div><div class="brand-tagline">Connect. Share. Belong.</div></div></div>' +
      "<h2>Complete your profile</h2>" +
      '<p class="text-muted" style="margin-top:6px;margin-bottom:18px;font-size:14px;">Choose your unique @username so friends can find and connect with you.</p>' +
      '<div id="onboard-error" class="alert alert-danger hidden" style="margin-bottom:14px;"></div>' +
      '<form id="onboard-form" class="auth-form">' +
      '<div class="form-group"><label class="form-label" for="ob-name">Full name</label>' +
      '<input id="ob-name" class="form-input" type="text" required maxlength="' + U.LIMITS.NAME_MAX + '" value="' + U.escapeHtml(suggestedName) + '" /></div>' +
      '<div class="form-group"><label class="form-label" for="ob-username">Username</label>' +
      '<input id="ob-username" class="form-input" type="text" required maxlength="' + U.LIMITS.USERNAME_MAX + '" value="' + U.escapeHtml(suggestedUser) + '" />' +
      '<span id="ob-username-status" class="username-status text-muted">3–20 lowercase letters, numbers, underscores.</span></div>' +
      '<div class="form-group"><label class="form-label" for="ob-location">City / Location</label>' +
      '<input id="ob-location" class="form-input" type="text" maxlength="' + U.LIMITS.LOCATION_MAX + '" value="' + U.escapeHtml(suggestedLocation) + '" placeholder="Dhaka, Bangladesh" /></div>' +
      '<div class="form-group"><label class="form-label" for="ob-bio">Short bio (optional)</label>' +
      '<textarea id="ob-bio" class="form-textarea" maxlength="' + U.LIMITS.BIO_MAX + '" placeholder="Say hello to the HMM HMM community..."></textarea></div>' +
      '<button type="submit" id="ob-submit" class="btn btn-primary btn-lg btn-block">Start using HMM HMM</button>' +
      '<button type="button" id="ob-logout" class="btn btn-ghost btn-block">Sign out</button></form></div></div>';

    var uInput = document.getElementById("ob-username");
    var statusEl = document.getElementById("ob-username-status");
    var errEl = document.getElementById("onboard-error");
    var timer = null;

    uInput.addEventListener("input", function () {
      var norm = U.normalizeUsername(uInput.value);
      if (uInput.value !== norm) uInput.value = norm;
      clearTimeout(timer);
      var err = U.validateUsername(norm);
      if (err) {
        statusEl.textContent = err;
        statusEl.className = "username-status err";
        return;
      }
      statusEl.textContent = "Checking availability...";
      statusEl.className = "username-status text-muted";
      timer = setTimeout(async function () {
        try {
          var ok = await A.isUsernameAvailable(norm);
          statusEl.textContent = ok ? "@" + norm + " is available" : "@" + norm + " is already taken";
          statusEl.className = ok ? "username-status ok" : "username-status err";
        } catch (e) {
          statusEl.textContent = "";
        }
      }, 320);
    });

    document.getElementById("ob-logout").addEventListener("click", function () { A.logoutUser(); });

    document.getElementById("onboard-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      errEl.classList.add("hidden");
      var btn = document.getElementById("ob-submit");
      btn.disabled = true;
      btn.textContent = "Creating profile...";
      try {
        await A.createUserProfile({
          firebaseUser: user,
          name: document.getElementById("ob-name").value,
          username: document.getElementById("ob-username").value,
          location: document.getElementById("ob-location").value,
          bio: document.getElementById("ob-bio").value,
        });
        A.clearPendingSignup();
        handleSignedInUser(user);
      } catch (err) {
        errEl.textContent = U.getFriendlyErrorMessage(err);
        errEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "Start using HMM HMM";
      }
    });
  }

  function renderSuspendedScreen(root, profile) {
    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div class="gate-icon" style="background:var(--crimson-soft);color:var(--crimson);">' + U.ICONS.shield + "</div>" +
      "<h2>Account suspended</h2>" +
      '<p class="text-muted" style="margin-top:8px;font-size:14px;">Your account (@' + U.escapeHtml(profile.username) + ") has been temporarily suspended by HMM HMM moderation.</p>" +
      '<div class="gate-actions"><button type="button" class="btn btn-secondary btn-block" id="btn-suspended-logout">Sign out</button></div></div></div>';
    document.getElementById("btn-suspended-logout").addEventListener("click", function () { A.logoutUser(); });
  }

  function renderShell(root, session) {
    var profile = session.profile;
    var isAdmin = session.isAdmin;
    var isDark = U.getCurrentTheme() === "dark";

    var navItems = [
      { id: "feed", label: "Home Feed", href: "#feed", icon: U.ICONS.home },
      { id: "explore", label: "Explore", href: "#explore", icon: U.ICONS.compass },
      { id: "friends", label: "Friends", href: "#friends", icon: U.ICONS.users, badgeId: "badge-friends" },
      { id: "messages", label: "Messages", href: "#messages", icon: U.ICONS.message, badgeId: "badge-messages" },
      { id: "notifications", label: "Notifications", href: "#notifications", icon: U.ICONS.bell, badgeId: "badge-notifs" },
      { id: "profile", label: "My Profile", href: "#profile", icon: U.ICONS.user },
      { id: "settings", label: "Settings", href: "#settings", icon: U.ICONS.settings },
    ];
    if (isAdmin) {
      navItems.push({ id: "admin", label: "Admin Console", href: "#admin", icon: U.ICONS.shield });
    }

    var leftNavHtml = navItems
      .map(function (item) {
        return (
          '<a href="' + item.href + '" class="nav-link" data-nav="' + item.id + '">' +
          item.icon + "<span>" + item.label + "</span>" +
          (item.badgeId ? '<span id="' + item.badgeId + '" class="nav-link-badge hidden">0</span>' : "") +
          "</a>"
        );
      })
      .join("");

    root.innerHTML =
      '<header class="app-header"><div class="header-inner">' +
      '<a href="#feed" class="brand-link"><img src="assets/icons/logo.svg" alt="HMM HMM" class="brand-mark" />' +
      '<span class="brand-text"><span class="brand-name">HMM HMM</span><span class="brand-tagline">Connect. Share. Belong.</span></span></a>' +
      '<form id="global-search-form" class="header-search" role="search">' +
      '<span class="header-search-icon">' + U.ICONS.search + "</span>" +
      '<input id="global-search-input" type="search" placeholder="Search people, @usernames..." aria-label="Search HMM HMM" /></form>' +
      '<div class="header-actions">' +
      '<button type="button" id="theme-toggle-btn" class="icon-btn" title="Toggle dark mode" aria-label="Toggle dark mode">' + (isDark ? U.ICONS.sun : U.ICONS.moon) + "</button>" +
      '<a href="#messages" class="icon-btn" data-hdr-nav="messages" title="Messages" aria-label="Messages">' + U.ICONS.message + '<span id="hdr-badge-messages" class="badge-dot hidden">0</span></a>' +
      '<a href="#notifications" class="icon-btn" data-hdr-nav="notifications" title="Notifications" aria-label="Notifications">' + U.ICONS.bell + '<span id="hdr-badge-notifs" class="badge-dot hidden">0</span></a>' +
      '<a href="#profile" class="header-user-btn" title="My profile" id="hdr-user-link">' +
      U.renderAvatarHtml({ name: profile.name, avatarUrl: profile.avatarUrl, avatarColor: profile.avatarColor, size: "xs" }) +
      '<span class="header-user-name" id="hdr-profile-name">' + U.escapeHtml(profile.name) + "</span></a>" +
      "</div></div></header>" +
      '<div class="app-shell" id="hmm-app-shell">' +
      '<aside class="left-sidebar">' +
      '<a href="#profile" class="sidebar-profile-mini" id="sidebar-profile-card">' +
      U.renderAvatarHtml({ name: profile.name, avatarUrl: profile.avatarUrl, avatarColor: profile.avatarColor, size: "md", online: true }) +
      '<div class="sidebar-profile-info"><strong id="sidebar-profile-name">' + U.escapeHtml(profile.name) + "</strong>" +
      '<span id="sidebar-profile-handle">@' + U.escapeHtml(profile.username) + "</span></div></a>" +
      '<nav class="nav-card" aria-label="Main navigation"><div class="nav-list">' + leftNavHtml + "</div>" +
      '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;" />' +
      '<button type="button" id="sidebar-logout-btn" class="sidebar-logout-btn">' + U.ICONS.logout + "<span>Sign out</span></button>" +
      "</nav></aside>" +
      '<main class="main-column" id="page-main"></main>' +
      '<aside class="right-rail" id="page-right-rail"></aside>' +
      "</div>" +
      '<nav class="mobile-bottom-nav" aria-label="Mobile navigation">' +
      '<a href="#feed" class="mobile-nav-item" data-mob-nav="feed">' + U.ICONS.home + "<span>Feed</span></a>" +
      '<a href="#explore" class="mobile-nav-item" data-mob-nav="explore">' + U.ICONS.compass + "<span>Explore</span></a>" +
      '<a href="#friends" class="mobile-nav-item" data-mob-nav="friends">' + U.ICONS.users + '<span>Friends</span><span id="mob-badge-friends" class="badge-dot hidden">0</span></a>' +
      '<a href="#messages" class="mobile-nav-item" data-mob-nav="messages">' + U.ICONS.message + '<span>Chat</span><span id="mob-badge-messages" class="badge-dot hidden">0</span></a>' +
      '<a href="#profile" class="mobile-nav-item" data-mob-nav="profile">' + U.ICONS.user + "<span>Profile</span></a>" +
      "</nav>";

    document.getElementById("global-search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (document.getElementById("global-search-input").value || "").trim();
      U.navigateTo("explore", q ? { q: q } : null);
    });

    document.getElementById("theme-toggle-btn").addEventListener("click", function (e) {
      var next = U.toggleTheme();
      e.currentTarget.innerHTML = next === "dark" ? U.ICONS.sun : U.ICONS.moon;
    });

    document.getElementById("sidebar-logout-btn").addEventListener("click", function () {
      A.logoutUser();
    });

    renderRightRailSuggestions(session);
  }

  async function renderRightRailSuggestions(session) {
    var rail = document.getElementById("page-right-rail");
    if (!rail) return;

    rail.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">People on HMM HMM</h3>' +
      '<a href="#explore" class="text-accent" style="font-size:13px;font-weight:600;">See all</a></div>' +
      '<div id="rail-suggested-list" class="text-muted" style="font-size:13px;">Loading people...</div></div>' +
      '<div class="card"><h3 class="card-title" style="margin-bottom:6px;">HMM HMM</h3>' +
      '<p class="text-muted" style="font-size:13px;line-height:1.5;">Connect. Share. Belong. A modern Bangladeshi social network powered directly by Firebase.</p>' +
      '<div style="display:flex;gap:12px;margin-top:12px;font-size:12.5px;font-weight:600;">' +
      '<a href="#settings" class="text-accent">Settings</a><a href="#explore" class="text-accent">Explore</a>' +
      (session.isAdmin ? '<a href="#admin" class="text-accent">Moderation</a>' : "") +
      "</div></div>";

    try {
      var users = await A.getSuggestedUsers(session.user.uid, 5);
      var listEl = document.getElementById("rail-suggested-list");
      if (!listEl) return;
      if (users.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Invite friends to join HMM HMM!</p>';
        return;
      }
      listEl.innerHTML = users
        .map(function (u) {
          return (
            '<div class="user-row"><a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="user-row-left">' +
            U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm" }) +
            '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u.name) + "</span>" +
            '<span class="user-row-handle">@' + U.escapeHtml(u.username) + "</span></div></a>" +
            '<a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="btn btn-secondary btn-sm">View</a></div>'
          );
        })
        .join("");
    } catch (e) {
      var fallbackEl = document.getElementById("rail-suggested-list");
      if (fallbackEl) fallbackEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Explore people in the directory.</p>';
    }
  }

  function renderActiveRoute() {
    var root = document.getElementById("app-root");
    var parsed = U.parseRoute();
    var route = parsed.route;
    var params = parsed.params;

    // Signed-out user -> show Login / Register / Forgot inside index.html
    if (!currentSession) {
      if (route === "register") A.renderAuthView(root, "register");
      else if (route === "forgot") A.renderAuthView(root, "forgot");
      else A.renderAuthView(root, "login");
      return;
    }

    // Signed-in user -> route inside App Shell
    if (!route || route === "login" || route === "register" || route === "forgot") {
      route = "feed";
    }

    runViewCleanup();

    var wideRoutes = { messages: true, admin: true };
    var shell = document.getElementById("hmm-app-shell");
    var rail = document.getElementById("page-right-rail");
    if (shell) shell.classList.toggle("wide-layout", Boolean(wideRoutes[route]));
    if (rail) rail.classList.toggle("hidden", Boolean(wideRoutes[route]));

    // Update active nav highlights
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      el.classList.toggle("active", el.dataset.nav === route);
    });
    document.querySelectorAll("[data-hdr-nav]").forEach(function (el) {
      el.classList.toggle("active", el.dataset.hdrNav === route);
    });
    document.querySelectorAll("[data-mob-nav]").forEach(function (el) {
      var active = el.dataset.mobNav === route || (el.dataset.mobNav === "profile" && route === "settings");
      el.classList.toggle("active", active);
    });

    var ctx = {
      user: currentSession.user,
      profile: currentSession.profile,
      isAdmin: currentSession.isAdmin,
      mainEl: document.getElementById("page-main"),
      onCleanup: function (fn) {
        if (typeof fn === "function") activeViewCleanup.push(fn);
      },
      openReport: function (opts) {
        openReportModal(Object.assign({ reporterId: currentSession.user.uid }, opts));
      },
      refreshProfile: async function () {
        var fresh = await A.getUserProfile(currentSession.user.uid);
        if (fresh) {
          currentSession.profile = fresh;
          ctx.profile = fresh;
          var sn = document.getElementById("sidebar-profile-name");
          var sh = document.getElementById("sidebar-profile-handle");
          var hn = document.getElementById("hdr-profile-name");
          if (sn) sn.textContent = fresh.name;
          if (sh) sh.textContent = "@" + fresh.username;
          if (hn) hn.textContent = fresh.name;
        }
        return currentSession.profile;
      },
    };

    window.scrollTo({ top: 0, behavior: "instant" });

    switch (route) {
      case "explore":
        HMM.search.mountView(ctx, params);
        break;
      case "friends":
        HMM.friends.mountView(ctx);
        break;
      case "messages":
        HMM.chat.mountView(ctx, params);
        break;
      case "notifications":
        HMM.notifications.mountView(ctx);
        break;
      case "profile":
        HMM.profile.mountView(ctx, params);
        break;
      case "settings":
        HMM.settings.mountView(ctx);
        break;
      case "admin":
        HMM.admin.mountView(ctx);
        break;
      case "feed":
      default:
        HMM.feed.mountView(ctx);
        break;
    }
  }

  async function handleSignedInUser(user) {
    var root = document.getElementById("app-root");
    runGlobalCleanup();
    currentSession = null;

    if (!user.emailVerified) {
      renderVerificationGate(root, user);
      return;
    }

    try {
      var profile = await A.getUserProfile(user.uid);
      if (!profile) {
        var pending = A.readPendingSignup();
        if (pending && pending.username) {
          try {
            var avail = await A.isUsernameAvailable(pending.username);
            if (avail) {
              profile = await A.createUserProfile({
                firebaseUser: user,
                name: pending.name || user.displayName || "HMM Member",
                username: pending.username,
                location: pending.location || "Dhaka, Bangladesh",
              });
              A.clearPendingSignup();
            }
          } catch (e) {}
        }
      }

      if (!profile) {
        renderOnboardingGate(root, user);
        return;
      }

      if (profile.isSuspended) {
        renderSuspendedScreen(root, profile);
        return;
      }

      var isAdmin = await A.checkIsAdmin(user);
      currentSession = { user: user, profile: profile, isAdmin: isAdmin };

      renderShell(root, currentSession);
      globalCleanups.push(attachPresence(user.uid));
      globalCleanups.push(subscribeToGlobalBadges(user.uid));

      renderActiveRoute();
    } catch (err) {
      console.error("Bootstrap error:", err);
      root.innerHTML =
        '<div class="gate-page"><div class="gate-card"><h2>Unable to load HMM HMM</h2>' +
        '<p class="text-muted" style="margin-top:8px;font-size:14px;">' + U.escapeHtml(U.getFriendlyErrorMessage(err)) + "</p>" +
        '<div class="gate-actions">' +
        '<button type="button" class="btn btn-primary btn-block" onclick="window.location.reload()">Retry</button>' +
        '<button type="button" class="btn btn-ghost btn-block" id="err-logout">Sign out</button></div></div></div>';
      document.getElementById("err-logout").addEventListener("click", function () { A.logoutUser(); });
    }
  }

  function startApp() {
    U.initTheme();
    var root = document.getElementById("app-root");

    if (HMM.firebaseLoadError || !HMM.auth) {
      root.innerHTML =
        '<div class="gate-page"><div class="gate-card"><h2>Internet connection required</h2>' +
        '<p class="text-muted" style="margin-top:8px;font-size:14px;">' +
        U.escapeHtml(HMM.firebaseLoadError || "Could not initialize Firebase Web SDK.") +
        "</p>" +
        '<div class="gate-actions"><button type="button" class="btn btn-primary btn-block" onclick="window.location.reload()">Try again</button></div></div></div>';
      return;
    }

    window.addEventListener("hashchange", function () {
      renderActiveRoute();
    });

    HMM.auth.onAuthStateChanged(function (user) {
      if (!user) {
        runGlobalCleanup();
        currentSession = null;
        renderActiveRoute();
        return;
      }
      handleSignedInUser(user);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
  } else {
    startApp();
  }
})(window.HMM = window.HMM || {});
