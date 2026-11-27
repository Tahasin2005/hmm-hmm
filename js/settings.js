/**
 * KLORIX (window.HMM) — Account, Privacy, Blocked Users, Dark Mode & Security Settings (#settings)
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  function mountSettingsView(ctx) {
    var cfg = HMM.siteConfig.get();
    var selectedColor = ctx.profile.avatarColor || U.AVATAR_COLORS[0];
    var usesPassword = ctx.user.providerData.some(function (p) { return p.providerId === "password"; });
    var currentTheme = U.getCurrentTheme();

    var swatchesHtml = U.AVATAR_COLORS.map(function (c) {
      return (
        '<button type="button" class="color-swatch ' + (c === selectedColor ? "active" : "") +
        '" data-color="' + c + '" style="background:' + c + '" aria-label="Accent ' + c + '"></button>'
      );
    }).join("");

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Settings</h1>' +
      '<p class="page-subtitle">Manage your ' + U.escapeHtml(cfg.siteName) + ' profile, privacy, blocked users, appearance, and account security.</p></div></div>' +
      '<div class="settings-stack">' +
      '<section class="card"><h2 class="card-title" style="margin-bottom:14px;">Profile &amp; Privacy</h2>' +
      '<form id="settings-profile-form" class="auth-form">' +
      '<div class="form-group"><label class="form-label" for="set-name">Full name</label>' +
      '<input id="set-name" class="form-input" type="text" required maxlength="' + U.LIMITS.NAME_MAX + '" value="' + U.escapeHtml(ctx.profile.name) + '" /></div>' +
      '<div class="form-group"><label class="form-label" for="set-username">Username (@)</label>' +
      '<input id="set-username" class="form-input" type="text" required maxlength="' + U.LIMITS.USERNAME_MAX + '" value="' + U.escapeHtml(ctx.profile.username) + '" />' +
      '<span class="form-hint">Unique handle (3–20 lowercase letters, numbers, underscores).</span></div>' +
      '<div class="form-group"><label class="form-label" for="set-bio">Bio</label>' +
      '<textarea id="set-bio" class="form-textarea" maxlength="' + U.LIMITS.BIO_MAX + '">' + U.escapeHtml(ctx.profile.bio || "") + "</textarea></div>" +
      '<div class="form-group"><label class="form-label" for="set-location">Location</label>' +
      '<input id="set-location" class="form-input" type="text" maxlength="' + U.LIMITS.LOCATION_MAX + '" value="' + U.escapeHtml(ctx.profile.location || "") + '" placeholder="Dhaka, Bangladesh" /></div>' +
      '<div class="form-group"><label class="form-label" for="set-avatar">Profile picture URL (optional)</label>' +
      '<input id="set-avatar" class="form-input" type="url" maxlength="' + U.LIMITS.AVATAR_URL_MAX + '" value="' + U.escapeHtml(ctx.profile.avatarUrl || "") + '" placeholder="https://example.com/avatar.jpg" /></div>' +
      '<div class="form-group"><label class="form-label">Avatar color</label><div class="color-swatches" id="set-swatches">' + swatchesHtml + "</div></div>" +
      '<div class="form-group"><label class="form-label" for="set-visibility">Profile visibility</label>' +
      '<select id="set-visibility" class="form-select">' +
      '<option value="public" ' + (ctx.profile.visibility === "public" ? "selected" : "") + ">Public — Anyone on " + U.escapeHtml(cfg.siteName) + " can find and view your profile</option>" +
      '<option value="friends" ' + (ctx.profile.visibility === "friends" ? "selected" : "") + ">Friends only — Hidden from public search</option></select></div>" +
      '<div class="form-group"><label class="form-label" for="set-fr-pref">Who can send you friend requests</label>' +
      '<select id="set-fr-pref" class="form-select">' +
      '<option value="everyone" ' + (ctx.profile.friendRequestPref === "everyone" ? "selected" : "") + ">Everyone</option>" +
      '<option value="none" ' + (ctx.profile.friendRequestPref === "none" ? "selected" : "") + ">Nobody</option></select></div>" +
      '<div><button type="submit" id="set-profile-save" class="btn btn-primary">Save profile settings</button></div>' +
      "</form></section>" +

      '<section class="card"><h2 class="card-title" style="margin-bottom:6px;display:flex;align-items:center;gap:8px;">' + U.ICONS.ban + " Blocked Users</h2>" +
      '<p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">Blocked users cannot message you, send friend requests, or see your posts and profile.</p>' +
      '<div id="settings-blocked-list"></div></section>' +

      '<section class="card"><h2 class="card-title" style="margin-bottom:6px;">Appearance</h2>' +
      '<p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">Switch between Light and Dark mode at any time.</p>' +
      '<div class="theme-options" id="theme-options">' +
      '<button type="button" class="theme-option-btn ' + (currentTheme === "light" ? "active" : "") + '" data-theme="light">' + U.ICONS.sun + "<span>Light Mode</span></button>" +
      '<button type="button" class="theme-option-btn ' + (currentTheme === "dark" ? "active" : "") + '" data-theme="dark">' + U.ICONS.moon + "<span>Dark Mode</span></button>" +
      "</div></section>" +
      (usesPassword
        ? '<section class="card"><h2 class="card-title" style="margin-bottom:14px;">Change Password</h2>' +
          '<form id="settings-password-form" class="auth-form">' +
          '<div class="form-group"><label class="form-label" for="pwd-current">Current password</label>' +
          '<input id="pwd-current" class="form-input" type="password" required autocomplete="current-password" /></div>' +
          '<div class="form-group"><label class="form-label" for="pwd-new">New password</label>' +
          '<input id="pwd-new" class="form-input" type="password" required minlength="6" autocomplete="new-password" /></div>' +
          '<div><button type="submit" id="pwd-submit" class="btn btn-secondary">Update password</button></div></form></section>'
        : '<section class="card"><h2 class="card-title" style="margin-bottom:6px;">Sign-in Method</h2>' +
          '<p class="text-muted" style="font-size:13.5px;">You sign in with Google (' + U.escapeHtml(ctx.user.email || "") + ").</p></section>") +
      '<section class="card" style="border-color:rgba(217, 56, 58, 0.35);">' +
      '<h2 class="card-title text-danger" style="margin-bottom:6px;">Account Actions</h2>' +
      '<p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">Sign out on this device, or permanently delete your ' + U.escapeHtml(cfg.siteName) + " profile and login.</p>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
      '<button type="button" id="set-logout-btn" class="btn btn-secondary">' + U.ICONS.logout + " Sign out</button></div>" +
      '<form id="delete-account-form" class="auth-form" style="padding-top:14px;border-top:1px solid var(--border);">' +
      (usesPassword
        ? '<div class="form-group"><label class="form-label" for="del-password">Enter current password to delete account</label>' +
          '<input id="del-password" class="form-input" type="password" required autocomplete="current-password" /></div>'
        : "") +
      '<div><button type="submit" id="del-account-btn" class="btn btn-danger-soft">' + U.ICONS.trash + " Permanently delete account</button></div>" +
      "</form></section></div>";

    var blockedListEl = document.getElementById("settings-blocked-list");

    function renderBlockedUsers() {
      if (!blockedListEl) return;
      var list = HMM.blocks ? HMM.blocks.getBlockedList() : [];
      if (list.length === 0) {
        blockedListEl.innerHTML = '<p class="text-muted" style="font-size:13.5px;">You have not blocked any users.</p>';
        return;
      }
      blockedListEl.innerHTML = list
        .map(function (b) {
          return (
            '<div class="user-row">' +
            '<div class="user-row-left">' +
            U.renderAvatarHtml({ name: b.blockedName, avatarUrl: b.blockedAvatarUrl, avatarColor: b.blockedAvatarColor, size: "sm" }) +
            '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(b.blockedName) + "</span>" +
            '<span class="user-row-handle">@' + U.escapeHtml(b.blockedUsername) + "</span></div></div>" +
            '<button type="button" class="btn btn-secondary btn-sm" data-unblock-uid="' + U.escapeHtml(b.blockedId) + '">Unblock</button></div>'
          );
        })
        .join("");
    }

    blockedListEl.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-unblock-uid]");
      if (!btn) return;
      btn.disabled = true;
      try {
        await HMM.blocks.unblockUser(ctx.user.uid, btn.dataset.unblockUid);
        U.showToast("User unblocked.", "success");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    renderBlockedUsers();
    var unsubBlocks = HMM.blocks.subscribe(renderBlockedUsers);
    ctx.onCleanup(unsubBlocks);

    var uInput = document.getElementById("set-username");
    uInput.addEventListener("input", function () {
      uInput.value = U.normalizeUsername(uInput.value);
    });

    document.getElementById("set-swatches").addEventListener("click", function (e) {
      var btn = e.target.closest(".color-swatch");
      if (!btn) return;
      selectedColor = btn.dataset.color;
      document.querySelectorAll("#set-swatches .color-swatch").forEach(function (s) {
        s.classList.toggle("active", s === btn);
      });
    });

    document.getElementById("settings-profile-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("set-profile-save");
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        await HMM.authService.updateUserProfile({
          currentProfile: ctx.profile,
          name: document.getElementById("set-name").value,
          username: document.getElementById("set-username").value,
          bio: document.getElementById("set-bio").value,
          location: document.getElementById("set-location").value,
          avatarUrl: document.getElementById("set-avatar").value,
          avatarColor: selectedColor,
          visibility: document.getElementById("set-visibility").value,
          friendRequestPref: document.getElementById("set-fr-pref").value,
        });
        await ctx.refreshProfile();
        U.showToast("Settings saved!", "success");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Save profile settings";
      }
    });

    document.getElementById("theme-options").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-theme]");
      if (!btn) return;
      var mode = U.applyTheme(btn.dataset.theme);
      document.querySelectorAll("#theme-options [data-theme]").forEach(function (b) {
        b.classList.toggle("active", b.dataset.theme === mode);
      });
      var hdrBtn = document.getElementById("theme-toggle-btn");
      if (hdrBtn) hdrBtn.innerHTML = mode === "dark" ? U.ICONS.sun : U.ICONS.moon;
      U.showToast((mode === "dark" ? "Dark" : "Light") + " mode enabled.");
    });

    var pwdForm = document.getElementById("settings-password-form");
    if (pwdForm) {
      pwdForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var btn = document.getElementById("pwd-submit");
        btn.disabled = true;
        btn.textContent = "Updating...";
        try {
          await HMM.authService.changeUserPassword(
            document.getElementById("pwd-current").value,
            document.getElementById("pwd-new").value
          );
          pwdForm.reset();
          U.showToast("Password updated successfully!", "success");
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Update password";
        }
      });
    }

    document.getElementById("set-logout-btn").addEventListener("click", function () {
      HMM.authService.logoutUser();
    });

    document.getElementById("delete-account-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("del-account-btn");
      btn.disabled = true;
      btn.textContent = "Deleting account...";
      try {
        var pwdEl = document.getElementById("del-password");
        await HMM.authService.deleteUserAccount({
          profile: ctx.profile,
          currentPassword: pwdEl ? pwdEl.value : "",
        });
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
        btn.innerHTML = U.ICONS.trash + " Permanently delete account";
      }
    });
  }

  HMM.settings = { mountView: mountSettingsView };
})(window.HMM = window.HMM || {});
