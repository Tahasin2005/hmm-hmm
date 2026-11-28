/**
 * KLORIX — Main Application Bootstrap, Hash Router, Shell, Mobile Navigation Drawer,
 * Dynamic Site Config Sync, User Blocks, Presence, Badges & Report Modal
 * Classic script — works automatically on Vercel static deploy, cPanel (HTTPS),
 * AND when double-clicking index.html locally (file://).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;
  var A = HMM.authService;

  var currentSession = null;
  var actingAsProfile = null;
  var activeViewCleanup = [];
  var globalCleanups = [];
  var sessionCleanups = [];
  var IMPERSONATE_STORAGE_KEY = "hmm_admin_acting_uid";

  function runViewCleanup() {
    activeViewCleanup.forEach(function (fn) {
      try { if (typeof fn === "function") fn(); } catch (e) {}
    });
    activeViewCleanup = [];
  }

  function runSessionCleanup() {
    runViewCleanup();
    sessionCleanups.forEach(function (fn) {
      try { if (typeof fn === "function") fn(); } catch (e) {}
    });
    sessionCleanups = [];
  }

  function runGlobalCleanup() {
    runSessionCleanup();
    globalCleanups.forEach(function (fn) {
      try { if (typeof fn === "function") fn(); } catch (e) {}
    });
    globalCleanups = [];
  }

  function getActiveSession() {
    if (!currentSession) return null;
    if (currentSession.isAdmin && actingAsProfile && actingAsProfile.uid !== currentSession.user.uid) {
      var target = actingAsProfile;
      return {
        user: {
          uid: target.uid,
          displayName: target.name,
          photoURL: target.avatarUrl || "",
          email: "",
          providerData: [],
        },
        profile: target,
        isAdmin: false,
        isRealAdmin: true,
        isImpersonating: true,
        realAdminUser: currentSession.user,
        realAdminProfile: currentSession.profile,
      };
    }
    return {
      user: currentSession.user,
      profile: currentSession.profile,
      isAdmin: currentSession.isAdmin,
      isRealAdmin: currentSession.isAdmin,
      isImpersonating: false,
      realAdminUser: currentSession.user,
      realAdminProfile: currentSession.profile,
    };
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
    var latestNotifDocs = [];

    function recomputeNotifBadge() {
      var seenAt = U.getNotificationsSeenAt(uid);
      var parsed = U.parseRoute();
      if (parsed && parsed.route === "notifications") {
        updateBadges(["badge-notifs", "hdr-badge-notifs", "drawer-badge-notifs"], 0);
        return;
      }
      var unseen = latestNotifDocs.filter(function (n) {
        if (!n || n.isRead || n.isSeen) return false;
        if (HMM.blocks && HMM.blocks.isEitherBlocked(n.senderId)) return false;
        var createdMs = U.timestampToMs(n.createdAt);
        // If createdMs is 0 (pending serverTimestamp) or strictly newer than seenAt, treat as unseen
        if (seenAt > 0 && createdMs > 0 && createdMs <= seenAt) return false;
        return true;
      }).length;
      updateBadges(["badge-notifs", "hdr-badge-notifs", "drawer-badge-notifs"], unseen);
    }

    var onNotifsSeenEvent = function (ev) {
      if (!ev || !ev.detail || ev.detail.uid === uid) {
        recomputeNotifBadge();
      }
    };
    window.addEventListener("hmm:notifs-seen", onNotifsSeenEvent);

    var u1 = HMM.db
      .collection("notifications")
      .where("recipientId", "==", uid)
      .limit(60)
      .onSnapshot(
        function (snap) {
          latestNotifDocs = snap.docs.map(function (d) { return d.data(); });
          recomputeNotifBadge();
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
          updateBadges(["badge-friends", "mob-badge-friends", "drawer-badge-friends"], pending);
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
      updateBadges(["badge-messages", "hdr-badge-messages", "mob-badge-messages", "drawer-badge-messages"], total);
    };
    chatRef.on("value", chatCb, function () {});

    return function () {
      window.removeEventListener("hmm:notifs-seen", onNotifsSeenEvent);
      if (u1) u1();
      if (u2) u2();
      chatRef.off("value", chatCb);
    };
  }

  function closeMobileDrawer() {
    var drawer = document.getElementById("mobile-nav-drawer");
    var backdrop = document.getElementById("mobile-drawer-backdrop");
    var toggleBtn = document.getElementById("mobile-drawer-toggle");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-open");
  }

  function openMobileDrawer() {
    var drawer = document.getElementById("mobile-nav-drawer");
    var backdrop = document.getElementById("mobile-drawer-backdrop");
    var toggleBtn = document.getElementById("mobile-drawer-toggle");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-open");
  }

  function openReportModal(opts) {
    var cfg = HMM.siteConfig.get();
    var optionsHtml = U.REPORT_REASONS.map(function (r) {
      return '<option value="' + U.escapeHtml(r) + '">' + U.escapeHtml(r) + "</option>";
    }).join("");

    U.openModal(
      "Report " + opts.targetType,
      '<p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">' +
        "Help keep " + U.escapeHtml(cfg.siteName) + " safe. Tell our moderation team why you are reporting " +
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
            U.showToast("Report submitted to moderation.", "success");
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
    var cfg = HMM.siteConfig.get();
    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div class="gate-icon">' + U.ICONS.mail + "</div>" +
      "<h2>Verify your email</h2>" +
      '<p class="text-muted" style="margin-top:8px;font-size:14px;">' +
      "We sent a verification link to <strong>" + U.escapeHtml(user.email || "") + "</strong>. " +
      "Verify your email address to activate your " + U.escapeHtml(cfg.siteName) + " account.</p>" +
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
    var cfg = HMM.siteConfig.get();
    var pending = A.readPendingSignup();
    var suggestedName = (pending && pending.name) || user.displayName || "KLORIX Member";
    var suggestedUser = (pending && pending.username) || A.generateDefaultUsername(suggestedName, user.uid);
    var suggestedLocation = (pending && pending.location) || "Dhaka, Bangladesh";

    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
      '<img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" data-site-logo style="width:40px;height:40px;border-radius:10px;object-fit:cover;" />' +
      '<div><div class="brand-name" data-site-name>' + U.escapeHtml(cfg.siteName) + '</div>' +
      '<div class="brand-tagline" data-site-tagline>' + U.escapeHtml(cfg.tagline) + "</div></div></div>" +
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
      '<textarea id="ob-bio" class="form-textarea" maxlength="' + U.LIMITS.BIO_MAX + '" placeholder="Say hello to the community..."></textarea></div>' +
      '<button type="submit" id="ob-submit" class="btn btn-primary btn-lg btn-block">Start using ' + U.escapeHtml(cfg.siteName) + "</button>" +
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
        btn.textContent = "Start using " + cfg.siteName;
      }
    });
  }

  function renderSuspendedScreen(root, profile) {
    root.innerHTML =
      '<div class="gate-page"><div class="gate-card">' +
      '<div class="gate-icon" style="background:var(--crimson-soft);color:var(--crimson);">' + U.ICONS.shield + "</div>" +
      "<h2>Account suspended</h2>" +
      '<p class="text-muted" style="margin-top:8px;font-size:14px;">Your account (@' + U.escapeHtml(profile.username) + ") has been temporarily suspended by moderation.</p>" +
      '<div class="gate-actions"><button type="button" class="btn btn-secondary btn-block" id="btn-suspended-logout">Sign out</button></div></div></div>';
    document.getElementById("btn-suspended-logout").addEventListener("click", function () { A.logoutUser(); });
  }

  function renderShell(root, session) {
    var profile = session.profile;
    var isAdmin = session.isAdmin;
    var isOfficialAdmin = isAdmin || U.isOfficialAdminUser(profile);
    var isVerifiedProfile = isOfficialAdmin || U.isVerifiedUser(profile);
    var cfg = HMM.siteConfig.get();

    var navItems = [
      { id: "feed", label: "Home Feed", href: "#feed", icon: U.ICONS.home },
      { id: "explore", label: "Explore", href: "#explore", icon: U.ICONS.compass },
      { id: "friends", label: "Friends", href: "#friends", icon: U.ICONS.users, badgeId: "badge-friends", drawerBadgeId: "drawer-badge-friends" },
      { id: "messages", label: "Messages", href: "#messages", icon: U.ICONS.message, badgeId: "badge-messages", drawerBadgeId: "drawer-badge-messages" },
      { id: "notifications", label: "Notifications", href: "#notifications", icon: U.ICONS.bell, badgeId: "badge-notifs", drawerBadgeId: "drawer-badge-notifs" },
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

    var drawerNavHtml = navItems
      .map(function (item) {
        return (
          '<a href="' + item.href + '" class="nav-link" data-nav="' + item.id + '">' +
          item.icon + "<span>" + item.label + "</span>" +
          (item.drawerBadgeId ? '<span id="' + item.drawerBadgeId + '" class="nav-link-badge hidden">0</span>' : "") +
          "</a>"
        );
      })
      .join("");

    var verifiedBadge = isOfficialAdmin
      ? U.renderAdminBadgeHtml("compact")
      : isVerifiedProfile
      ? U.renderVipBadgeHtml("compact")
      : "";

    var impersonationBarHtml = session.isImpersonating
      ? '<div class="impersonation-bar" id="impersonation-bar">' +
        '<div class="impersonation-bar-inner">' +
        '<div class="impersonation-bar-info">' +
        '<span class="impersonation-dot"></span>' +
        '<span>Logged in as <strong>' + U.escapeHtml(profile.name) + '</strong> (@' + U.escapeHtml(profile.username) + ")</span>" +
        "</div>" +
        '<div class="impersonation-bar-actions">' +
        '<a href="#profile" class="btn btn-secondary btn-sm">Profile</a>' +
        '<a href="#messages" class="btn btn-secondary btn-sm">Messages</a>' +
        '<button type="button" id="btn-exit-impersonation" class="btn btn-danger btn-sm">Exit to Admin</button>' +
        "</div></div></div>"
      : "";

    root.innerHTML =
      impersonationBarHtml +
      '<header class="app-header"><div class="header-inner">' +
      '<div class="header-left-group">' +
      '<button type="button" id="mobile-drawer-toggle" class="icon-btn mobile-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-drawer">' +
      U.ICONS.menu + "</button>" +
      '<a href="#feed" class="brand-link brand-link-desktop" aria-label="' + U.escapeHtml(cfg.siteName) + ' Home">' +
      '<img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" class="brand-logo-full" data-site-logo />' +
      "</a>" +
      "</div>" +
      '<a href="#feed" class="brand-link brand-link-mobile" aria-label="' + U.escapeHtml(cfg.siteName) + ' Home">' +
      '<img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" class="brand-logo-full" data-site-logo />' +
      "</a>" +
      '<form id="global-search-form" class="header-search" role="search">' +
      '<span class="header-search-icon">' + U.ICONS.search + "</span>" +
      '<input id="global-search-input" type="search" placeholder="Search people, @usernames, #hashtags..." aria-label="Search people and hashtags" /></form>' +
      '<div class="header-actions">' +
      '<button type="button" id="hdr-mobile-search-btn" class="icon-btn mobile-search-toggle-btn" title="Search" aria-label="Search" aria-expanded="false">' + U.ICONS.search + "</button>" +
      '<a href="#notifications" class="icon-btn" data-hdr-nav="notifications" title="Notifications" aria-label="Notifications">' + U.ICONS.bell + '<span id="hdr-badge-notifs" class="badge-dot hidden">0</span></a>' +
      '<a href="#profile" class="header-user-btn" title="My profile" id="hdr-user-link">' +
      '<span id="hdr-profile-avatar">' + U.renderAvatarHtml({ name: profile.name, avatarUrl: profile.avatarUrl, avatarColor: profile.avatarColor, size: "xs", isAdmin: isOfficialAdmin, isVerified: isVerifiedProfile }) + "</span>" +
      '<span class="header-user-name" id="hdr-profile-name">' + U.escapeHtml(profile.name) + "</span>" +
      (verifiedBadge ? '<span class="header-user-admin-badge">' + verifiedBadge + "</span>" : "") +
      "</a>" +
      "</div></div></header>" +

      // Expandable Mobile Search Bar (triggered from Top Bar Search icon)
      '<div id="mobile-search-bar" class="mobile-search-bar hidden">' +
      '<form id="mobile-search-form" class="mobile-search-form" role="search">' +
      '<span class="header-search-icon">' + U.ICONS.search + "</span>" +
      '<input id="mobile-search-input" type="search" placeholder="Search people, @usernames, #hashtags..." aria-label="Search" />' +
      '<button type="button" id="mobile-search-close" class="icon-btn" aria-label="Close search">' + U.ICONS.close + "</button>" +
      "</form></div>" +

      // Mobile Navigation Drawer + Backdrop (no search input, no theme toggle)
      '<div id="mobile-drawer-backdrop" class="mobile-drawer-backdrop" aria-hidden="true"></div>' +
      '<aside id="mobile-nav-drawer" class="mobile-nav-drawer" aria-label="Navigation menu">' +
      '<div class="mobile-drawer-head">' +
      '<a href="#feed" class="brand-link" aria-label="' + U.escapeHtml(cfg.siteName) + ' Home">' +
      '<img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" class="brand-logo-full" data-site-logo /></a>' +
      '<button type="button" id="mobile-drawer-close" class="icon-btn" aria-label="Close navigation menu">' + U.ICONS.close + "</button>" +
      "</div>" +
      '<a href="#profile" class="sidebar-profile-mini" id="drawer-profile-card">' +
      '<span id="drawer-profile-avatar">' + U.renderAvatarHtml({ name: profile.name, avatarUrl: profile.avatarUrl, avatarColor: profile.avatarColor, size: "md", online: true, isAdmin: isOfficialAdmin, isVerified: isVerifiedProfile }) + "</span>" +
      '<div class="sidebar-profile-info"><strong class="name-with-badge"><span id="drawer-profile-name">' + U.escapeHtml(profile.name) + "</span>" + verifiedBadge + "</strong>" +
      '<span id="drawer-profile-handle">@' + U.escapeHtml(profile.username) + "</span></div></a>" +
      '<nav class="mobile-drawer-nav"><div class="nav-list">' + drawerNavHtml + "</div></nav>" +
      '<div class="mobile-drawer-footer">' +
      (session.isImpersonating
        ? '<button type="button" id="drawer-exit-impersonation" class="btn btn-danger btn-block">Exit to Admin Account</button>'
        : "") +
      '<button type="button" id="drawer-logout-btn" class="sidebar-logout-btn">' + U.ICONS.logout + "<span>Sign out</span></button>" +
      "</div></aside>" +

      '<div class="app-shell" id="hmm-app-shell">' +
      '<aside class="left-sidebar">' +
      '<a href="#profile" class="sidebar-profile-mini" id="sidebar-profile-card">' +
      '<span id="sidebar-profile-avatar">' + U.renderAvatarHtml({ name: profile.name, avatarUrl: profile.avatarUrl, avatarColor: profile.avatarColor, size: "md", online: true, isAdmin: isOfficialAdmin, isVerified: isVerifiedProfile }) + "</span>" +
      '<div class="sidebar-profile-info"><strong class="name-with-badge"><span id="sidebar-profile-name">' + U.escapeHtml(profile.name) + "</span>" + verifiedBadge + "</strong>" +
      '<span id="sidebar-profile-handle">@' + U.escapeHtml(profile.username) + "</span></div></a>" +
      '<nav class="nav-card" aria-label="Main navigation"><div class="nav-list">' + leftNavHtml + "</div>" +
      '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;" />' +
      (session.isImpersonating
        ? '<button type="button" id="sidebar-exit-impersonation" class="btn btn-danger btn-sm btn-block" style="margin-bottom:8px;">Exit to Admin</button>'
        : "") +
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

    // Mobile Top Bar Search Toggle
    var mobSearchBtn = document.getElementById("hdr-mobile-search-btn");
    var mobSearchBar = document.getElementById("mobile-search-bar");
    var mobSearchInput = document.getElementById("mobile-search-input");
    var mobSearchClose = document.getElementById("mobile-search-close");
    var mobSearchForm = document.getElementById("mobile-search-form");

    function closeMobileSearch() {
      if (mobSearchBar) mobSearchBar.classList.add("hidden");
      if (mobSearchBtn) mobSearchBtn.setAttribute("aria-expanded", "false");
    }

    if (mobSearchBtn && mobSearchBar) {
      mobSearchBtn.addEventListener("click", function () {
        var opening = mobSearchBar.classList.contains("hidden");
        mobSearchBar.classList.toggle("hidden", !opening);
        mobSearchBtn.setAttribute("aria-expanded", opening ? "true" : "false");
        if (opening && mobSearchInput) {
          mobSearchInput.focus();
        }
      });
    }
    if (mobSearchClose) mobSearchClose.addEventListener("click", closeMobileSearch);
    if (mobSearchForm) {
      mobSearchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = (mobSearchInput.value || "").trim();
        closeMobileSearch();
        U.navigateTo("explore", q ? { q: q } : null);
      });
    }

    // Impersonation Exit buttons
    ["btn-exit-impersonation", "drawer-exit-impersonation", "sidebar-exit-impersonation"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", function () {
          closeMobileDrawer();
          exitImpersonation("admin");
        });
      }
    });

    document.getElementById("sidebar-logout-btn").addEventListener("click", function () {
      try { sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY); } catch (e) {}
      actingAsProfile = null;
      A.logoutUser();
    });

    document.getElementById("drawer-logout-btn").addEventListener("click", function () {
      closeMobileDrawer();
      try { sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY); } catch (e) {}
      actingAsProfile = null;
      A.logoutUser();
    });

    // Mobile drawer wiring
    document.getElementById("mobile-drawer-toggle").addEventListener("click", openMobileDrawer);
    document.getElementById("mobile-drawer-close").addEventListener("click", closeMobileDrawer);
    document.getElementById("mobile-drawer-backdrop").addEventListener("click", closeMobileDrawer);
    document.getElementById("mobile-nav-drawer").addEventListener("click", function (e) {
      if (e.target.closest("a[href]")) closeMobileDrawer();
    });

    var escHandler = function (e) {
      if (e.key === "Escape") {
        closeMobileDrawer();
        closeMobileSearch();
      }
    };
    document.addEventListener("keydown", escHandler);
    sessionCleanups.push(function () {
      document.removeEventListener("keydown", escHandler);
      closeMobileDrawer();
    });

    renderRightRailSuggestions(session);
  }

  async function renderRightRailSuggestions(session) {
    var rail = document.getElementById("page-right-rail");
    if (!rail) return;
    var cfg = HMM.siteConfig.get();

    rail.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">People on <span data-site-name>' + U.escapeHtml(cfg.siteName) + "</span></h3>" +
      '<a href="#explore" class="text-accent" style="font-size:13px;font-weight:600;">See all</a></div>' +
      '<div id="rail-suggested-list" class="text-muted" style="font-size:13px;">Loading people...</div></div>' +
      '<div class="card"><h3 class="card-title" style="margin-bottom:6px;" data-site-name>' + U.escapeHtml(cfg.siteName) + "</h3>" +
      '<p class="text-muted" style="font-size:13px;line-height:1.5;"><span data-site-tagline>' + U.escapeHtml(cfg.tagline) + "</span> A modern Bangladeshi social network powered directly by Firebase.</p>" +
      '<div style="display:flex;gap:12px;margin-top:12px;font-size:12.5px;font-weight:600;flex-wrap:wrap;">' +
      '<a href="#settings" class="text-accent">Settings</a><a href="#explore" class="text-accent">Explore</a>' +
      (session.isAdmin ? '<a href="#admin" class="text-accent">Admin Console</a>' : "") +
      "</div></div>";

    try {
      var users = await A.getSuggestedUsers(session.user.uid, 5);
      var listEl = document.getElementById("rail-suggested-list");
      if (!listEl) return;
      if (users.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Invite friends to join the community!</p>';
        return;
      }
      listEl.innerHTML = users
        .map(function (u) {
          var isOffAdmin = U.isOfficialAdminUser(u);
          var isVer = U.isVerifiedUser(u);
          return (
            '<div class="user-row"><a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="user-row-left">' +
            U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm", isAdmin: isOffAdmin, isVerified: isVer }) +
            '<div class="user-row-meta"><span class="user-row-name name-with-badge">' + U.escapeHtml(u.name) +
            (isVer ? U.renderVerifiedBadgeHtml(u, "compact") : "") + "</span>" +
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

  function mountActiveShellAndListeners() {
    var root = document.getElementById("app-root");
    var active = getActiveSession();
    if (!active) return;

    runSessionCleanup();

    if (HMM.blocks && HMM.blocks.init) {
      HMM.blocks.init(active.user.uid);
      sessionCleanups.push(function () {
        HMM.blocks.cleanup();
      });
    }

    renderShell(root, active);

    if (HMM.blocks && HMM.blocks.subscribe) {
      sessionCleanups.push(
        HMM.blocks.subscribe(function () {
          var latest = getActiveSession();
          if (latest) renderRightRailSuggestions(latest);
        })
      );
    }

    sessionCleanups.push(subscribeToGlobalBadges(active.user.uid));
  }

  async function startImpersonation(targetOrUid, targetRoute) {
    if (!currentSession || !currentSession.isAdmin) {
      U.showToast("Only authorized administrators can login as another user.", "error");
      return;
    }
    var targetProfile = typeof targetOrUid === "string"
      ? await A.getUserProfile(targetOrUid)
      : targetOrUid;
    if (!targetProfile || !targetProfile.uid) {
      U.showToast("Target user account not found.", "error");
      return;
    }
    if (targetProfile.uid === currentSession.user.uid) {
      exitImpersonation("profile");
      return;
    }

    actingAsProfile = targetProfile;
    try { sessionStorage.setItem(IMPERSONATE_STORAGE_KEY, targetProfile.uid); } catch (e) {}
    mountActiveShellAndListeners();
    U.showToast("Now logged in as " + targetProfile.name + " (@" + targetProfile.username + ")", "success");

    var nextHash = "#" + (targetRoute || "profile");
    if (window.location.hash === nextHash) {
      renderActiveRoute();
    } else {
      window.location.hash = nextHash;
    }
  }

  function exitImpersonation(targetRoute) {
    actingAsProfile = null;
    try { sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY); } catch (e) {}
    if (!currentSession) return;
    mountActiveShellAndListeners();
    U.showToast("Returned to Admin account.", "success");

    var nextHash = "#" + (targetRoute || "admin");
    if (window.location.hash === nextHash) {
      renderActiveRoute();
    } else {
      window.location.hash = nextHash;
    }
  }

  function renderActiveRoute() {
    closeMobileDrawer();
    var root = document.getElementById("app-root");
    var parsed = U.parseRoute();
    var route = parsed.route;
    var params = parsed.params;

    // Signed-out user -> remember deep-link target (e.g. /username or #profile?u=...) then show Auth
    if (!currentSession) {
      if (route === "profile" && (params.get("u") || params.get("uid"))) {
        try {
          var targetQ = params.get("u") ? ("u=" + encodeURIComponent(params.get("u"))) : ("uid=" + encodeURIComponent(params.get("uid")));
          sessionStorage.setItem("hmm_post_login_hash", "#profile?" + targetQ);
        } catch (e) {}
      }
      if (route === "register") A.renderAuthView(root, "register");
      else if (route === "forgot") A.renderAuthView(root, "forgot");
      else A.renderAuthView(root, "login");
      return;
    }

    var activeSession = getActiveSession();

    // Signed-in user -> route inside App Shell
    if (!route || route === "login" || route === "register" || route === "forgot") {
      route = "feed";
    }

    runViewCleanup();

    var wideRoutes = { messages: true, admin: true, inspect: true };
    var shell = document.getElementById("hmm-app-shell");
    var rail = document.getElementById("page-right-rail");
    if (shell) shell.classList.toggle("wide-layout", Boolean(wideRoutes[route]));
    if (rail) rail.classList.toggle("hidden", Boolean(wideRoutes[route]));

    // Update active nav highlights (desktop sidebar + mobile drawer + header + bottom nav)
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      var isMatch = el.dataset.nav === route || (route === "inspect" && el.dataset.nav === "admin");
      el.classList.toggle("active", isMatch);
    });
    document.querySelectorAll("[data-hdr-nav]").forEach(function (el) {
      el.classList.toggle("active", el.dataset.hdrNav === route);
    });
    document.querySelectorAll("[data-mob-nav]").forEach(function (el) {
      var active = el.dataset.mobNav === route || (el.dataset.mobNav === "profile" && (route === "settings" || route === "admin" || route === "inspect"));
      el.classList.toggle("active", active);
    });

    var ctx = {
      user: activeSession.user,
      profile: activeSession.profile,
      isAdmin: activeSession.isAdmin,
      isRealAdmin: activeSession.isRealAdmin,
      isImpersonating: activeSession.isImpersonating,
      realAdminUser: activeSession.realAdminUser,
      realAdminProfile: activeSession.realAdminProfile,
      startImpersonation: startImpersonation,
      exitImpersonation: exitImpersonation,
      mainEl: document.getElementById("page-main"),
      onCleanup: function (fn) {
        if (typeof fn === "function") activeViewCleanup.push(fn);
      },
      openReport: function (opts) {
        openReportModal(Object.assign({ reporterId: activeSession.user.uid }, opts));
      },
      refreshProfile: async function () {
        var fresh = await A.getUserProfile(activeSession.user.uid);
        if (fresh) {
          if (activeSession.isAdmin && fresh.role !== "admin") fresh.role = "admin";
          if (activeSession.isImpersonating) {
            actingAsProfile = fresh;
          } else {
            currentSession.profile = fresh;
          }
          ctx.profile = fresh;
          var isOffAdm = activeSession.isAdmin || U.isOfficialAdminUser(fresh);
          var isVer = isOffAdm || U.isVerifiedUser(fresh);
          ["sidebar-profile-name", "drawer-profile-name", "hdr-profile-name"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = fresh.name;
          });
          ["sidebar-profile-handle", "drawer-profile-handle"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = "@" + fresh.username;
          });
          var hdrAv = document.getElementById("hdr-profile-avatar");
          if (hdrAv) hdrAv.innerHTML = U.renderAvatarHtml({ name: fresh.name, avatarUrl: fresh.avatarUrl, avatarColor: fresh.avatarColor, size: "xs", isAdmin: isOffAdm, isVerified: isVer });
          var sideAv = document.getElementById("sidebar-profile-avatar");
          if (sideAv) sideAv.innerHTML = U.renderAvatarHtml({ name: fresh.name, avatarUrl: fresh.avatarUrl, avatarColor: fresh.avatarColor, size: "md", online: true, isAdmin: isOffAdm, isVerified: isVer });
          var drwAv = document.getElementById("drawer-profile-avatar");
          if (drwAv) drwAv.innerHTML = U.renderAvatarHtml({ name: fresh.name, avatarUrl: fresh.avatarUrl, avatarColor: fresh.avatarColor, size: "md", online: true, isAdmin: isOffAdm, isVerified: isVer });
        }
        return ctx.profile;
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
      case "inspect":
        if (HMM.admin && HMM.admin.mountInspectUserView) {
          HMM.admin.mountInspectUserView(ctx, params);
        } else {
          HMM.feed.mountView(ctx, params);
        }
        break;
      case "feed":
      default:
        HMM.feed.mountView(ctx, params);
        break;
    }
  }

  async function syncOfficialAdminIdentity(user, profile) {
    // Tag admin user profile with role: "admin" and register primaryAdminUid in siteConfig/general
    // so regular users recognize the official administrator across profiles, posts, comments & search.
    try {
      if (profile.role !== "admin") {
        await HMM.db.collection("users").doc(user.uid).update({
          role: "admin",
          updatedAt: HMM.serverTimestamp(),
        });
        profile.role = "admin";
      }
    } catch (e) {}

    if (user.email === U.BOOTSTRAPPED_ADMIN_EMAIL) {
      try {
        var cfg = HMM.siteConfig.get();
        if (cfg.primaryAdminUid !== user.uid) {
          await HMM.db.collection("siteConfig").doc("general").set(
            {
              siteName: cfg.siteName || "KLORIX",
              tagline: cfg.tagline || "Connect. Share. Belong.",
              logoUrl: cfg.logoUrl || "assets/icons/logo.svg",
              faviconUrl: cfg.faviconUrl || "assets/icons/favicon.svg",
              metaDescription: cfg.metaDescription || HMM.siteConfig.DEFAULT.metaDescription,
              metaKeywords: cfg.metaKeywords || HMM.siteConfig.DEFAULT.metaKeywords,
              primaryAdminUid: user.uid,
              updatedAt: HMM.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (e) {}
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

    // Ensure the Firebase Auth JWT carries email_verified: true for Firestore Rules
    try {
      var tokenResult = await user.getIdTokenResult();
      if (!tokenResult || !tokenResult.claims || tokenResult.claims.email_verified !== true) {
        await user.getIdToken(true);
      }
    } catch (e) {}

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
                name: pending.name || user.displayName || "KLORIX Member",
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

      // Auto-restore Gmail / Google profile picture if avatarUrl is currently blank
      var googlePhoto = U.getGoogleAccountPhotoUrl(user);
      if ((!profile.avatarUrl || !String(profile.avatarUrl).trim()) && googlePhoto) {
        profile.avatarUrl = googlePhoto;
        A.updateUserAvatarUrl(user.uid, googlePhoto).catch(function () {});
      }

      var isAdmin = await A.checkIsAdmin(user);
      if (isAdmin) {
        profile.role = "admin";
        syncOfficialAdminIdentity(user, profile);
      }

      currentSession = { user: user, profile: profile, isAdmin: isAdmin };
      actingAsProfile = null;

      // Restore admin impersonation session across reloads if previously active
      if (isAdmin) {
        try {
          var savedActingUid = sessionStorage.getItem(IMPERSONATE_STORAGE_KEY);
          if (savedActingUid && savedActingUid !== user.uid) {
            var restoredTarget = await A.getUserProfile(savedActingUid);
            if (restoredTarget) {
              actingAsProfile = restoredTarget;
            } else {
              sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY);
            }
          }
        } catch (e) {}
      }

      globalCleanups.push(attachPresence(user.uid));
      U.syncVerifiedUsers().catch(function () {});
      mountActiveShellAndListeners();

      // Resume deep-linked shared profile URL if user just signed in
      try {
        var pendingHash = sessionStorage.getItem("hmm_post_login_hash");
        if (pendingHash) {
          sessionStorage.removeItem("hmm_post_login_hash");
          if (window.location.hash !== pendingHash) {
            window.location.hash = pendingHash;
            return;
          }
        }
      } catch (e) {}

      renderActiveRoute();
    } catch (err) {
      console.error("Bootstrap error:", err);
      var errSiteName = (HMM.siteConfig && HMM.siteConfig.get().siteName) || "KLORIX";
      root.innerHTML =
        '<div class="gate-page"><div class="gate-card"><h2>Unable to load ' + U.escapeHtml(errSiteName) + "</h2>" +
        '<p class="text-muted" style="margin-top:8px;font-size:14px;">' + U.escapeHtml(U.getFriendlyErrorMessage(err)) + "</p>" +
        '<div class="gate-actions">' +
        '<button type="button" class="btn btn-primary btn-block" onclick="window.location.reload()">Retry</button>' +
        '<button type="button" class="btn btn-ghost btn-block" id="err-logout">Sign out</button></div></div></div>';
      document.getElementById("err-logout").addEventListener("click", function () { A.logoutUser(); });
    }
  }

  function startApp() {
    U.initTheme();
    HMM.siteConfig.init();
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
        actingAsProfile = null;
        try { sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY); } catch (e) {}
        renderActiveRoute();
        return;
      }
      handleSignedInUser(user);
    });
  }

  HMM.impersonation = {
    start: startImpersonation,
    stop: exitImpersonation,
    isActive: function () {
      return Boolean(currentSession && currentSession.isAdmin && actingAsProfile);
    },
    getTarget: function () {
      return actingAsProfile;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
  } else {
    startApp();
  }
})(window.HMM = window.HMM || {});
