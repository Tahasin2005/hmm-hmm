/**
 * KLORIX (window.HMM) — User Profile View Controller (#profile?uid= or #profile?u=)
 * Includes:
 * - Official Administrator Profile badge & direct "Post Official Announcement" composer/manager
 * - Two-Way User Block / Unblock controls + isolation state screens
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function mountProfileView(ctx, params) {
    var uidParam = params.get("uid");
    var usernameParam = params.get("u");

    ctx.mainEl.innerHTML =
      '<div class="card empty-state"><div class="spinner"></div><p>Loading profile...</p></div>';

    var targetProfile = null;
    if (uidParam && uidParam !== ctx.user.uid) {
      targetProfile = await HMM.authService.getUserProfile(uidParam);
    } else if (usernameParam) {
      targetProfile = await HMM.authService.getUserByUsername(usernameParam);
    } else {
      targetProfile = ctx.profile;
    }

    if (!targetProfile) {
      ctx.mainEl.innerHTML =
        '<div class="card empty-state"><div class="empty-state-icon">' +
        U.ICONS.user +
        '</div><h3>Profile not found</h3><p>This profile may be private or no longer exists.</p>' +
        '<a href="#feed" class="btn btn-primary btn-sm">Back to Feed</a></div>';
      return;
    }

    var isOwnProfile = targetProfile.uid === ctx.user.uid;
    var socialState = {
      friendUids: new Set(),
      followingUids: new Set(),
      incomingBySender: new Map(),
      outgoingByReceiver: new Map(),
    };
    var presence = { online: false, lastSeen: 0 };
    var userPosts = [];
    var adminAnnouncements = [];

    ctx.mainEl.innerHTML =
      '<section class="card profile-card" id="profile-header-card"></section>' +
      '<div id="profile-admin-announcements-slot"></div>' +
      '<div id="profile-posts-section">' +
      '<div class="page-header"><h2 style="font-size:18px;font-weight:800;">Posts</h2></div>' +
      '<div id="profile-posts-container" style="display:flex;flex-direction:column;gap:14px;">' +
      '<div class="card empty-state"><div class="spinner"></div><p>Loading posts...</p></div></div></div>';

    var postsSection = document.getElementById("profile-posts-section");
    var postsContainer = document.getElementById("profile-posts-container");
    var adminAnnSlot = document.getElementById("profile-admin-announcements-slot");

    var postManager = HMM.feed.createPostListManager({
      container: postsContainer,
      ctx: ctx,
      onPostMutated: async function () {
        userPosts = await HMM.feed.getUserPosts(targetProfile.uid);
        renderProfilePosts();
      },
    });

    function renderProfilePosts() {
      if (!isOwnProfile && HMM.blocks && HMM.blocks.isEitherBlocked(targetProfile.uid)) {
        postsSection.classList.add("hidden");
        return;
      }
      postsSection.classList.remove("hidden");
      postManager.render(
        userPosts,
        "No posts yet",
        isOwnProfile ? "Share your first post from the Home Feed." : "This user hasn't shared any posts yet."
      );
    }

    async function loadAdminAnnouncements() {
      if (!isOwnProfile || !ctx.isAdmin) return;
      try {
        adminAnnouncements = await HMM.announcements.getAll();
        renderAdminAnnouncementsBox();
      } catch (e) {}
    }

    function renderAdminAnnouncementsBox() {
      if (!adminAnnSlot || !isOwnProfile || !ctx.isAdmin) return;
      adminAnnSlot.innerHTML =
        '<section class="card profile-ann-manager">' +
        '<div class="profile-ann-head"><div>' +
        '<h3 style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;">' +
        U.ICONS.megaphone + " Official Home Feed Announcements</h3>" +
        '<p class="text-muted" style="font-size:13px;margin-top:2px;">Pinned announcements posted here appear at the top of everyone\'s Home Feed.</p>' +
        "</div>" +
        '<button type="button" id="btn-profile-new-ann" class="btn btn-primary btn-sm">' + U.ICONS.megaphone + " Post Announcement</button>" +
        "</div>" +
        (adminAnnouncements.length === 0
          ? '<p class="text-muted" style="font-size:13.5px;margin-top:12px;">No announcements published yet. Click <strong>Post Announcement</strong> to broadcast an official notice (with optional image) to all members.</p>'
          : '<div class="profile-ann-list">' +
            adminAnnouncements
              .map(function (a) {
                var safeImg = U.safeAvatarUrl(a.imageUrl || "");
                return (
                  '<div class="profile-ann-item">' +
                  (safeImg ? '<img src="' + U.escapeHtml(safeImg) + '" alt="" class="profile-ann-thumb" />' : "") +
                  '<div class="profile-ann-info">' +
                  '<div class="profile-ann-title-row"><strong>' + U.escapeHtml(a.title) + "</strong>" +
                  '<span class="status-tag ' + (a.isActive ? "status-resolved" : "status-dismissed") + '">' + (a.isActive ? "Pinned Live" : "Hidden") + "</span></div>" +
                  '<p class="text-muted" style="font-size:13px;margin-top:3px;">' + U.escapeHtml(String(a.message || "").slice(0, 140)) + (String(a.message || "").length > 140 ? "…" : "") + "</p>" +
                  "</div>" +
                  '<div class="profile-ann-actions">' +
                  '<button type="button" class="btn btn-secondary btn-sm" data-pann-toggle="' + U.escapeHtml(a.announcementId) + '" data-active="' + (a.isActive ? "1" : "0") + '">' + (a.isActive ? "Hide" : "Show") + "</button>" +
                  '<button type="button" class="btn btn-secondary btn-sm" data-pann-edit="' + U.escapeHtml(a.announcementId) + '">' + U.ICONS.edit + "</button>" +
                  '<button type="button" class="btn btn-danger-soft btn-sm" data-pann-del="' + U.escapeHtml(a.announcementId) + '">' + U.ICONS.trash + "</button>" +
                  "</div></div>"
                );
              })
              .join("") +
            "</div>") +
        "</section>";

      var newBtn = document.getElementById("btn-profile-new-ann");
      if (newBtn) {
        newBtn.addEventListener("click", function () {
          HMM.announcements.openCreateEditModal(ctx.profile, null, loadAdminAnnouncements);
        });
      }
    }

    adminAnnSlot.addEventListener("click", async function (e) {
      var toggleBtn = e.target.closest("[data-pann-toggle]");
      if (toggleBtn) {
        toggleBtn.disabled = true;
        try {
          var nextActive = toggleBtn.dataset.active !== "1";
          await HMM.announcements.update(toggleBtn.dataset.pannToggle, { isActive: nextActive });
          U.showToast(nextActive ? "Announcement is now live on Home Feed." : "Announcement hidden from Home Feed.", "success");
          await loadAdminAnnouncements();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          toggleBtn.disabled = false;
        }
        return;
      }

      var editBtn = e.target.closest("[data-pann-edit]");
      if (editBtn) {
        var found = adminAnnouncements.find(function (a) { return a.announcementId === editBtn.dataset.pannEdit; });
        if (found) HMM.announcements.openCreateEditModal(ctx.profile, found, loadAdminAnnouncements);
        return;
      }

      var delBtn = e.target.closest("[data-pann-del]");
      if (delBtn) {
        delBtn.disabled = true;
        try {
          await HMM.announcements.remove(delBtn.dataset.pannDel);
          U.showToast("Announcement deleted.", "success");
          await loadAdminAnnouncements();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          delBtn.disabled = false;
        }
      }
    });

    function openEditProfileModal() {
      var selectedColor = targetProfile.avatarColor || U.AVATAR_COLORS[0];
      var swatchesHtml = U.AVATAR_COLORS.map(function (c) {
        return (
          '<button type="button" class="color-swatch ' +
          (c === selectedColor ? "active" : "") +
          '" data-color="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>'
        );
      }).join("");

      U.openModal(
        "Edit profile",
        '<form id="edit-profile-form" class="auth-form">' +
          '<div class="form-group"><label class="form-label" for="ep-name">Full name</label>' +
          '<input id="ep-name" class="form-input" type="text" required maxlength="' + U.LIMITS.NAME_MAX + '" value="' + U.escapeHtml(targetProfile.name) + '" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-username">Username (@)</label>' +
          '<input id="ep-username" class="form-input" type="text" required maxlength="' + U.LIMITS.USERNAME_MAX + '" value="' + U.escapeHtml(targetProfile.username) + '" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-bio">Bio</label>' +
          '<textarea id="ep-bio" class="form-textarea" maxlength="' + U.LIMITS.BIO_MAX + '">' + U.escapeHtml(targetProfile.bio || "") + "</textarea></div>" +
          '<div class="form-group"><label class="form-label" for="ep-location">Location</label>' +
          '<input id="ep-location" class="form-input" type="text" maxlength="' + U.LIMITS.LOCATION_MAX + '" value="' + U.escapeHtml(targetProfile.location || "") + '" placeholder="Dhaka, Bangladesh" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-avatar">Profile picture URL (optional)</label>' +
          '<input id="ep-avatar" class="form-input" type="url" maxlength="' + U.LIMITS.AVATAR_URL_MAX + '" value="' + U.escapeHtml(targetProfile.avatarUrl || "") + '" placeholder="https://example.com/photo.jpg" />' +
          '<span class="form-hint">Paste a direct HTTPS image link, or leave blank to use your initials avatar.</span></div>' +
          '<div class="form-group"><label class="form-label">Avatar accent color</label><div class="color-swatches" id="ep-swatches">' + swatchesHtml + "</div></div>" +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="ep-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn-primary" id="ep-save">Save changes</button></div></form>',
        function (body, close) {
          body.querySelector("#ep-cancel").addEventListener("click", close);
          var uInput = body.querySelector("#ep-username");
          uInput.addEventListener("input", function () {
            uInput.value = U.normalizeUsername(uInput.value);
          });
          body.querySelector("#ep-swatches").addEventListener("click", function (e) {
            var btn = e.target.closest(".color-swatch");
            if (!btn) return;
            selectedColor = btn.dataset.color;
            body.querySelectorAll(".color-swatch").forEach(function (s) {
              s.classList.toggle("active", s === btn);
            });
          });
          body.querySelector("#edit-profile-form").addEventListener("submit", async function (e) {
            e.preventDefault();
            var saveBtn = body.querySelector("#ep-save");
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
            try {
              var updated = await HMM.authService.updateUserProfile({
                currentProfile: targetProfile,
                name: body.querySelector("#ep-name").value,
                username: body.querySelector("#ep-username").value,
                bio: body.querySelector("#ep-bio").value,
                location: body.querySelector("#ep-location").value,
                avatarUrl: body.querySelector("#ep-avatar").value,
                avatarColor: selectedColor,
                visibility: targetProfile.visibility,
                friendRequestPref: targetProfile.friendRequestPref,
              });
              targetProfile = updated;
              await ctx.refreshProfile();
              renderHeader();
              U.showToast("Profile updated!", "success");
              close();
            } catch (err) {
              U.showToast(U.getFriendlyErrorMessage(err), "error");
              saveBtn.disabled = false;
              saveBtn.textContent = "Save changes";
            }
          });
        }
      );
    }

    function renderHeader() {
      var card = document.getElementById("profile-header-card");
      if (!card) return;

      var iBlocked = !isOwnProfile && HMM.blocks && HMM.blocks.isBlockedByMe(targetProfile.uid);
      var theyBlocked = !isOwnProfile && HMM.blocks && HMM.blocks.hasBlockedMe(targetProfile.uid);

      if (theyBlocked) {
        card.className = "card profile-card";
        card.innerHTML =
          '<div class="empty-state" style="padding:36px 20px;">' +
          '<div class="empty-state-icon">' + U.ICONS.ban + "</div>" +
          "<h3>This profile is unavailable</h3>" +
          "<p>You don't have access to view this member's profile or posts.</p>" +
          '<a href="#feed" class="btn btn-primary btn-sm">Back to Home Feed</a></div>';
        renderProfilePosts();
        return;
      }

      if (iBlocked) {
        card.className = "card profile-card";
        card.innerHTML =
          '<div class="empty-state" style="padding:36px 20px;">' +
          '<div class="empty-state-icon" style="background:var(--crimson-soft);color:var(--crimson);">' + U.ICONS.ban + "</div>" +
          "<h3>You blocked " + U.escapeHtml(targetProfile.name) + "</h3>" +
          "<p>@" + U.escapeHtml(targetProfile.username) + " cannot message you or see your posts, and their content is hidden from you.</p>" +
          '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-primary btn-sm" data-paction="unblock">Unblock User</button>' +
          '<a href="#feed" class="btn btn-secondary btn-sm">Back to Home Feed</a></div></div>';
        renderProfilePosts();
        return;
      }

      var isProfileAdmin = U.isOfficialAdminUser(targetProfile) || (isOwnProfile && ctx.isAdmin);
      card.classList.toggle("profile-card-admin", isProfileAdmin);

      var actionsHtml = "";
      if (isOwnProfile) {
        actionsHtml =
          '<button type="button" class="btn btn-primary btn-sm" id="btn-edit-profile">' + U.ICONS.edit + " Edit profile</button>" +
          (ctx.isAdmin
            ? '<button type="button" class="btn btn-outline btn-sm" id="btn-header-post-ann">' + U.ICONS.megaphone + " Announce</button>" +
              '<a href="#admin" class="btn btn-secondary btn-sm">' + U.ICONS.shield + " Admin</a>"
            : "") +
          '<a href="#settings" class="btn btn-secondary btn-sm">' + U.ICONS.settings + " Settings</a>";
      } else {
        var isFriend = socialState.friendUids.has(targetProfile.uid);
        var isFollowing = socialState.followingUids.has(targetProfile.uid);
        var incomingReq = socialState.incomingBySender.get(targetProfile.uid);
        var outgoingReq = socialState.outgoingByReceiver.get(targetProfile.uid);

        var friendBtn = "";
        if (isFriend) {
          friendBtn = '<button type="button" class="btn btn-secondary btn-sm" data-paction="unfriend">Friends ✓</button>';
        } else if (incomingReq) {
          friendBtn =
            '<button type="button" class="btn btn-primary btn-sm" data-paction="accept">Accept request</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-paction="reject">Decline</button>';
        } else if (outgoingReq) {
          friendBtn = '<button type="button" class="btn btn-secondary btn-sm" data-paction="cancel">Cancel request</button>';
        } else if (targetProfile.friendRequestPref !== "none") {
          friendBtn = '<button type="button" class="btn btn-primary btn-sm" data-paction="add-friend">Add friend</button>';
        }

        var followBtn = isFollowing
          ? '<button type="button" class="btn btn-secondary btn-sm" data-paction="unfollow">Following</button>'
          : '<button type="button" class="btn btn-outline btn-sm" data-paction="follow">Follow</button>';

        actionsHtml =
          friendBtn +
          followBtn +
          '<a href="#messages?uid=' + encodeURIComponent(targetProfile.uid) + '" class="btn btn-secondary btn-sm">' + U.ICONS.message + " Message</a>" +
          '<button type="button" class="btn btn-danger-soft btn-sm" data-paction="block" title="Block user">' + U.ICONS.ban + " Block</button>" +
          (!isProfileAdmin
            ? '<button type="button" class="icon-btn" data-paction="report" title="Report user" aria-label="Report user">' + U.ICONS.flag + "</button>"
            : "");
      }

      var adminExecutiveStrip = isProfileAdmin
        ? '<div class="admin-profile-banner">' +
          '<div class="admin-profile-banner-icon">' + U.ICONS.shield + "</div>" +
          '<div class="admin-profile-banner-text">' +
          "<strong>Official " + U.escapeHtml(HMM.siteConfig.get().siteName) + " Administrator</strong>" +
          "<span>Verified platform leadership · Community safety &amp; governance</span>" +
          "</div></div>"
        : "";

      card.innerHTML =
        '<div class="profile-cover ' + (isProfileAdmin ? "profile-cover-admin" : "") + '">' +
        (isProfileAdmin ? '<div class="profile-cover-emblem">Official Administrator</div>' : "") +
        '</div><div class="profile-body">' +
        '<div class="profile-top-row"><div class="profile-avatar-ring ' + (isProfileAdmin ? "profile-avatar-ring-admin" : "") + '">' +
        U.renderAvatarHtml({
          name: targetProfile.name,
          avatarUrl: targetProfile.avatarUrl,
          avatarColor: targetProfile.avatarColor,
          size: "xl",
          online: isOwnProfile ? true : presence.online,
          isAdmin: isProfileAdmin,
        }) +
        '</div><div class="profile-actions">' + actionsHtml + "</div></div>" +
        '<div class="profile-identity"><div class="profile-name-row"><h1>' + U.escapeHtml(targetProfile.name) + "</h1>" +
        (isProfileAdmin ? U.renderAdminBadgeHtml("full") : "") + "</div>" +
        '<div class="profile-handle">@' + U.escapeHtml(targetProfile.username) + "</div>" +
        '<div class="profile-presence ' + (isOwnProfile || presence.online ? "online" : "") + '">' +
        '<span class="dot"></span><span>' +
        (isOwnProfile ? "Online" : U.escapeHtml(U.formatPresenceLabel(presence.online, presence.lastSeen))) +
        "</span></div></div>" +
        adminExecutiveStrip +
        (targetProfile.bio ? '<p class="profile-bio">' + U.linkifyText(targetProfile.bio) + "</p>" : "") +
        '<div class="profile-meta-row">' +
        (targetProfile.location ? '<span class="profile-meta-item">' + U.ICONS.mapPin + " " + U.escapeHtml(targetProfile.location) + "</span>" : "") +
        '<span class="profile-meta-item">' + U.ICONS.calendar + " Joined " + U.escapeHtml(U.formatJoinDate(targetProfile.createdAt)) + "</span></div>" +
        '<div class="profile-stats">' +
        '<div class="profile-stat"><strong>' + (targetProfile.postsCount || 0) + "</strong><span>Posts</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.friendsCount || 0) + "</strong><span>Friends</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.followersCount || 0) + "</strong><span>Followers</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.followingCount || 0) + "</strong><span>Following</span></div>" +
        "</div></div>";

      var editBtn = document.getElementById("btn-edit-profile");
      if (editBtn) editBtn.addEventListener("click", openEditProfileModal);

      var headerAnnBtn = document.getElementById("btn-header-post-ann");
      if (headerAnnBtn) {
        headerAnnBtn.addEventListener("click", function () {
          HMM.announcements.openCreateEditModal(ctx.profile, null, loadAdminAnnouncements);
        });
      }

      renderProfilePosts();
    }

    document.getElementById("profile-header-card").addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-paction]");
      if (!btn) return;
      var action = btn.dataset.paction;
      if (action === "report") {
        ctx.openReport({
          targetType: "user",
          targetId: targetProfile.uid,
          label: "@" + targetProfile.username,
        });
        return;
      }
      if (action === "block") {
        U.openModal(
          "Block " + targetProfile.name + "?",
          '<p style="font-size:14px;line-height:1.6;">Blocking <strong>' + U.escapeHtml(targetProfile.name) + "</strong> (@" +
            U.escapeHtml(targetProfile.username) + ") will remove friendships &amp; follows, disable messaging, and hide each other's posts and profiles.</p>" +
            '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">' +
            '<button type="button" id="pblk-cancel" class="btn btn-secondary">Cancel</button>' +
            '<button type="button" id="pblk-confirm" class="btn btn-danger">' + U.ICONS.ban + " Block User</button></div>",
          function (body, close) {
            body.querySelector("#pblk-cancel").addEventListener("click", close);
            body.querySelector("#pblk-confirm").addEventListener("click", async function (ev) {
              ev.currentTarget.disabled = true;
              try {
                await HMM.blocks.blockUser(ctx.profile, targetProfile);
                U.showToast("Blocked " + targetProfile.name + ".", "success");
                close();
              } catch (err) {
                U.showToast(U.getFriendlyErrorMessage(err), "error");
                ev.currentTarget.disabled = false;
              }
            });
          }
        );
        return;
      }

      btn.disabled = true;
      try {
        if (action === "unblock") {
          await HMM.blocks.unblockUser(ctx.user.uid, targetProfile.uid);
          U.showToast("Unblocked " + targetProfile.name + ".", "success");
        } else if (action === "add-friend") {
          await HMM.friends.sendFriendRequest(ctx.profile, targetProfile);
          U.showToast("Friend request sent!", "success");
        } else if (action === "cancel") {
          await HMM.friends.cancelFriendRequest(ctx.user.uid, targetProfile.uid);
          U.showToast("Friend request cancelled.");
        } else if (action === "accept") {
          var req = socialState.incomingBySender.get(targetProfile.uid);
          if (req) await HMM.friends.acceptFriendRequest(req, ctx.profile);
          U.showToast("You are now friends!", "success");
        } else if (action === "reject") {
          await HMM.friends.rejectFriendRequest(targetProfile.uid, ctx.user.uid);
          U.showToast("Friend request declined.");
        } else if (action === "unfriend") {
          await HMM.friends.removeFriend(ctx.user.uid, targetProfile.uid);
          U.showToast("Removed from friends.");
        } else if (action === "follow") {
          await HMM.friends.followUser(ctx.profile, targetProfile.uid);
          U.showToast("Following @" + targetProfile.username, "success");
        } else if (action === "unfollow") {
          await HMM.friends.unfollowUser(ctx.user.uid, targetProfile.uid);
          U.showToast("Unfollowed @" + targetProfile.username);
        }
        var refreshed = await HMM.authService.getUserProfile(targetProfile.uid);
        if (refreshed) targetProfile = refreshed;
        renderHeader();
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    var presenceRef = HMM.rtdb.ref("presence/" + targetProfile.uid);
    var presenceCb = function (snap) {
      var val = snap.val();
      presence = {
        online: Boolean(val && val.online),
        lastSeen: val && typeof val.lastSeen === "number" ? val.lastSeen : 0,
      };
      renderHeader();
    };
    presenceRef.on("value", presenceCb);

    var unsubSocial = HMM.friends.subscribeToSocialState(ctx.user.uid, function (next) {
      socialState = next;
      renderHeader();
    });

    var unsubReacts = HMM.feed.subscribeToAllPostReactions(function (byPost) {
      postManager.setReactionsMap(byPost);
      renderProfilePosts();
    });

    var unsubBlocks = HMM.blocks.subscribe(function () {
      renderHeader();
    });

    ctx.onCleanup(function () {
      presenceRef.off("value", presenceCb);
      if (unsubSocial) unsubSocial();
      if (unsubReacts) unsubReacts();
      if (unsubBlocks) unsubBlocks();
      postManager.cleanup();
    });

    renderHeader();
    loadAdminAnnouncements();
    userPosts = await HMM.feed.getUserPosts(targetProfile.uid);
    renderProfilePosts();
  }

  HMM.profile = { mountView: mountProfileView };
})(window.HMM = window.HMM || {});
