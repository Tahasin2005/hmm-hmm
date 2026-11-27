/**
 * HMM HMM — User Profile View Controller (#profile?uid= or #profile?u=)
 * Includes distinguished Executive Official Administrator Profile badge & styling.
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

    ctx.mainEl.innerHTML =
      '<section class="card profile-card" id="profile-header-card"></section>' +
      '<div class="page-header"><h2 style="font-size:18px;font-weight:800;">Posts</h2></div>' +
      '<div id="profile-posts-container" style="display:flex;flex-direction:column;gap:14px;">' +
      '<div class="card empty-state"><div class="spinner"></div><p>Loading posts...</p></div></div>';

    var postsContainer = document.getElementById("profile-posts-container");
    var postManager = HMM.feed.createPostListManager({
      container: postsContainer,
      ctx: ctx,
      onPostMutated: async function () {
        userPosts = await HMM.feed.getUserPosts(targetProfile.uid);
        postManager.render(
          userPosts,
          "No posts yet",
          isOwnProfile ? "Share your first post from the Home Feed." : "This user hasn't posted yet."
        );
      },
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

      var isProfileAdmin = U.isOfficialAdminUser(targetProfile) || (isOwnProfile && ctx.isAdmin);
      card.classList.toggle("profile-card-admin", isProfileAdmin);

      var actionsHtml = "";
      if (isOwnProfile) {
        actionsHtml =
          '<button type="button" class="btn btn-primary btn-sm" id="btn-edit-profile">' + U.ICONS.edit + " Edit profile</button>" +
          (ctx.isAdmin ? '<a href="#admin" class="btn btn-outline btn-sm">' + U.ICONS.shield + " Admin Console</a>" : "") +
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
        (targetProfile.bio ? '<p class="profile-bio">' + U.escapeHtml(targetProfile.bio) + "</p>" : "") +
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
      btn.disabled = true;
      try {
        if (action === "add-friend") {
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
      postManager.render(
        userPosts,
        "No posts yet",
        isOwnProfile ? "Share your first post from the Home Feed." : "This user hasn't shared any posts yet."
      );
    });

    ctx.onCleanup(function () {
      presenceRef.off("value", presenceCb);
      if (unsubSocial) unsubSocial();
      if (unsubReacts) unsubReacts();
      postManager.cleanup();
    });

    renderHeader();
    userPosts = await HMM.feed.getUserPosts(targetProfile.uid);
    postManager.render(
      userPosts,
      "No posts yet",
      isOwnProfile ? "Share your first post from the Home Feed." : "This user hasn't shared any posts yet."
    );
  }

  HMM.profile = { mountView: mountProfileView };
})(window.HMM = window.HMM || {});
