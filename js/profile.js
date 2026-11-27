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
    var postsLoaded = false;
    var adminAnnouncements = [];

    ctx.mainEl.innerHTML =
      '<section class="card profile-card" id="profile-header-card"></section>' +
      '<div id="profile-admin-announcements-slot"></div>' +
      '<div id="profile-posts-section">' +
      '<div class="page-header">' +
      '<h2 style="font-size:18px;font-weight:800;">Posts</h2>' +
      (isOwnProfile ? '<a href="#feed" class="btn btn-primary btn-sm">' + U.ICONS.plus + " Create Post</a>" : "") +
      "</div>" +
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
      if (!postsLoaded) {
        return;
      }
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

    function openShareProfileModal() {
      var shareUrl = U.getProfileShareUrl(targetProfile.username);
      U.openModal(
        "Share Profile",
        '<p class="text-muted" style="font-size:13.5px;margin-bottom:12px;">Share <strong>' +
          U.escapeHtml(targetProfile.name) +
          "</strong>'s unique KLORIX profile link:</p>" +
          '<div class="share-profile-box">' +
          '<input id="share-profile-url-input" class="form-input" type="text" readonly value="' +
          U.escapeHtml(shareUrl) +
          '" />' +
          '<button type="button" id="btn-copy-profile-url" class="btn btn-primary btn-sm">' +
          U.ICONS.copy +
          " Copy</button></div>" +
          (typeof navigator !== "undefined" && navigator.share
            ? '<div style="margin-top:12px;"><button type="button" id="btn-native-share-profile" class="btn btn-secondary btn-block">' +
              U.ICONS.share +
              " Share via device apps</button></div>"
            : ""),
        function (body, close) {
          var inputEl = body.querySelector("#share-profile-url-input");
          var copyBtn = body.querySelector("#btn-copy-profile-url");
          if (inputEl) {
            inputEl.addEventListener("focus", function () {
              inputEl.select();
            });
          }
          if (copyBtn) {
            copyBtn.addEventListener("click", async function () {
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(shareUrl);
                } else if (inputEl) {
                  inputEl.select();
                  document.execCommand("copy");
                }
                U.showToast("Profile link copied!", "success");
                close();
              } catch (err) {
                if (inputEl) {
                  inputEl.select();
                  document.execCommand("copy");
                }
                U.showToast("Profile link copied!", "success");
                close();
              }
            });
          }
          var nativeBtn = body.querySelector("#btn-native-share-profile");
          if (nativeBtn) {
            nativeBtn.addEventListener("click", async function () {
              try {
                await navigator.share({
                  title: targetProfile.name + " (@" + targetProfile.username + ") on KLORIX",
                  text: "Check out " + targetProfile.name + " on KLORIX:",
                  url: shareUrl,
                });
                close();
              } catch (e) {}
            });
          }
        }
      );
    }

    function openEditProfileModal() {
      var googlePhotoUrl = U.getGoogleAccountPhotoUrl(ctx.user);
      var draftAvatarUrl = targetProfile.avatarUrl || googlePhotoUrl || "";
      var draftCoverUrl = targetProfile.coverPhotoUrl || "";
      var draftSocialLinks = U.sanitizeSocialLinks(targetProfile.socialLinks || []).slice();

      var platformOptionsHtml = U.SOCIAL_PLATFORMS.map(function (sp) {
        return '<option value="' + U.escapeHtml(sp.id) + '">' + U.escapeHtml(sp.label) + "</option>";
      }).join("");

      var coverSectionHtml = ctx.isAdmin
        ? '<div class="ep-section">' +
          '<div class="ep-section-title">' + U.ICONS.camera + " Official Admin Cover Photo</div>" +
          '<div class="ep-cover-preview" id="ep-cover-preview" ' +
          (U.safeAvatarUrl(draftCoverUrl) ? 'style="background-image:url(\'' + U.escapeHtml(U.safeAvatarUrl(draftCoverUrl)) + '\')"' : "") +
          ">" +
          (U.safeAvatarUrl(draftCoverUrl) ? "" : "<span>Default Admin Banner</span>") +
          "</div>" +
          '<div class="ep-photo-actions">' +
          '<label class="btn btn-secondary btn-sm" for="ep-cover-file">' + U.ICONS.upload + " Upload Cover Photo</label>" +
          '<input id="ep-cover-file" type="file" accept="image/*" class="hidden" />' +
          '<button type="button" id="ep-cover-remove" class="btn btn-ghost btn-sm' + (draftCoverUrl ? "" : " hidden") + '">Remove Cover</button>' +
          "</div>" +
          '<span class="form-hint">Recommended wide banner (automatically compressed for fast loading).</span></div>'
        : "";

      U.openModal(
        "Edit profile",
        '<form id="edit-profile-form" class="auth-form ep-form">' +
          '<div class="ep-section">' +
          '<div class="ep-section-title">' + U.ICONS.camera + " Profile Picture</div>" +
          '<div class="ep-avatar-editor">' +
          '<div id="ep-avatar-preview">' +
          U.renderAvatarHtml({
            name: targetProfile.name,
            avatarUrl: draftAvatarUrl,
            avatarColor: targetProfile.avatarColor,
            size: "lg",
            isAdmin: ctx.isAdmin,
          }) +
          "</div>" +
          '<div class="ep-photo-controls">' +
          '<div class="ep-photo-actions">' +
          '<label class="btn btn-primary btn-sm" for="ep-avatar-file">' + U.ICONS.upload + " Upload Photo</label>" +
          '<input id="ep-avatar-file" type="file" accept="image/*" class="hidden" />' +
          (googlePhotoUrl
            ? '<button type="button" id="ep-use-gmail-photo" class="btn btn-secondary btn-sm">' + U.ICONS.google + " Use Gmail Photo</button>"
            : "") +
          "</div>" +
          '<span class="form-hint" id="ep-avatar-status">' +
          (draftAvatarUrl && draftAvatarUrl === googlePhotoUrl
            ? "Using your Gmail profile picture automatically."
            : draftAvatarUrl
            ? "Custom profile picture ready (auto-compressed)."
            : "Upload a photo from your device.") +
          "</span></div></div></div>" +
          coverSectionHtml +
          '<div class="form-group"><label class="form-label" for="ep-name">Full name</label>' +
          '<input id="ep-name" class="form-input" type="text" required maxlength="' + U.LIMITS.NAME_MAX + '" value="' + U.escapeHtml(targetProfile.name) + '" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-username">Username (@) — Your profile link</label>' +
          '<input id="ep-username" class="form-input" type="text" required maxlength="' + U.LIMITS.USERNAME_MAX + '" value="' + U.escapeHtml(targetProfile.username) + '" />' +
          '<span class="form-hint" id="ep-link-preview">Profile link: <strong>' + U.escapeHtml(U.getProfileShareUrl(targetProfile.username)) + "</strong></span></div>" +
          '<div class="form-group"><label class="form-label" for="ep-bio">Bio</label>' +
          '<textarea id="ep-bio" class="form-textarea" maxlength="' + U.LIMITS.BIO_MAX + '" placeholder="Tell people about yourself...">' + U.escapeHtml(targetProfile.bio || "") + "</textarea></div>" +
          '<div class="ep-section">' +
          '<div class="ep-section-title">' + U.ICONS.briefcase + " Work, Position &amp; Personal Info</div>" +
          '<div class="ep-two-col">' +
          '<div class="form-group"><label class="form-label" for="ep-job-title">Position / Job / Role</label>' +
          '<input id="ep-job-title" class="form-input" type="text" maxlength="' + U.LIMITS.JOB_TITLE_MAX + '" value="' + U.escapeHtml(targetProfile.jobTitle || "") + '" placeholder="e.g. Founder, Web Developer, Student" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-workplace">Workplace / Organization</label>' +
          '<input id="ep-workplace" class="form-input" type="text" maxlength="' + U.LIMITS.WORKPLACE_MAX + '" value="' + U.escapeHtml(targetProfile.workplace || "") + '" placeholder="e.g. KLORIX Tech, Dhaka University" /></div>' +
          "</div>" +
          '<div class="ep-two-col">' +
          '<div class="form-group"><label class="form-label" for="ep-birthdate">Date of Birth</label>' +
          '<input id="ep-birthdate" class="form-input" type="date" value="' + U.escapeHtml(targetProfile.birthDate || "") + '" /></div>' +
          '<div class="form-group"><label class="form-label" for="ep-location">Location</label>' +
          '<input id="ep-location" class="form-input" type="text" maxlength="' + U.LIMITS.LOCATION_MAX + '" value="' + U.escapeHtml(targetProfile.location || "") + '" placeholder="Dhaka, Bangladesh" /></div>' +
          "</div></div>" +
          '<div class="ep-section">' +
          '<div class="ep-section-title">' + U.ICONS.link + " Social Media Links</div>" +
          '<p class="form-hint" style="margin-bottom:8px;">Select a platform and paste your profile URL to display it on your KLORIX profile.</p>' +
          '<div class="ep-social-adder">' +
          '<select id="ep-social-platform" class="form-select">' + platformOptionsHtml + "</select>" +
          '<input id="ep-social-url" class="form-input" type="url" placeholder="https://facebook.com/yourprofile" />' +
          '<button type="button" id="ep-social-add" class="btn btn-secondary btn-sm">' + U.ICONS.plus + " Add</button>" +
          "</div>" +
          '<div id="ep-social-list" class="ep-social-list"></div></div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="ep-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn-primary" id="ep-save">Save changes</button></div></form>',
        function (body, close) {
          body.querySelector("#ep-cancel").addEventListener("click", close);

          var uInput = body.querySelector("#ep-username");
          var linkPreviewEl = body.querySelector("#ep-link-preview");
          uInput.addEventListener("input", function () {
            uInput.value = U.normalizeUsername(uInput.value);
            if (linkPreviewEl) {
              linkPreviewEl.innerHTML =
                "Profile link: <strong>" + U.escapeHtml(U.getProfileShareUrl(uInput.value || targetProfile.username)) + "</strong>";
            }
          });

          function refreshAvatarPreview(statusMsg) {
            var previewBox = body.querySelector("#ep-avatar-preview");
            if (previewBox) {
              previewBox.innerHTML = U.renderAvatarHtml({
                name: body.querySelector("#ep-name").value || targetProfile.name,
                avatarUrl: draftAvatarUrl,
                avatarColor: targetProfile.avatarColor,
                size: "lg",
                isAdmin: ctx.isAdmin,
              });
            }
            var st = body.querySelector("#ep-avatar-status");
            if (st && statusMsg) st.textContent = statusMsg;
          }

          var avatarFileEl = body.querySelector("#ep-avatar-file");
          if (avatarFileEl) {
            avatarFileEl.addEventListener("change", async function () {
              var file = avatarFileEl.files && avatarFileEl.files[0];
              if (!file) return;
              try {
                refreshAvatarPreview("Compressing image...");
                draftAvatarUrl = await U.compressImageFileToDataUrl(file, 240, 0.78, 95000);
                refreshAvatarPreview("Low-resolution profile photo uploaded. Click Save changes to apply.");
              } catch (err) {
                U.showToast(err.message || "Could not process image.", "error");
                refreshAvatarPreview("Could not process image. Try another photo.");
              }
              avatarFileEl.value = "";
            });
          }

          var gmailBtn = body.querySelector("#ep-use-gmail-photo");
          if (gmailBtn && googlePhotoUrl) {
            gmailBtn.addEventListener("click", function () {
              draftAvatarUrl = googlePhotoUrl;
              refreshAvatarPreview("Restored your Gmail profile picture! Click Save changes to apply.");
            });
          }

          var coverFileEl = body.querySelector("#ep-cover-file");
          var coverPreviewEl = body.querySelector("#ep-cover-preview");
          var coverRemoveBtn = body.querySelector("#ep-cover-remove");
          if (coverFileEl && coverPreviewEl) {
            coverFileEl.addEventListener("change", async function () {
              var file = coverFileEl.files && coverFileEl.files[0];
              if (!file) return;
              try {
                draftCoverUrl = await U.compressImageFileToDataUrl(file, 1200, 0.8, 300000);
                coverPreviewEl.style.backgroundImage = "url('" + draftCoverUrl + "')";
                coverPreviewEl.innerHTML = "";
                if (coverRemoveBtn) coverRemoveBtn.classList.remove("hidden");
                U.showToast("Cover photo ready! Click Save changes.", "success");
              } catch (err) {
                U.showToast(err.message || "Could not process cover photo.", "error");
              }
              coverFileEl.value = "";
            });
          }
          if (coverRemoveBtn && coverPreviewEl) {
            coverRemoveBtn.addEventListener("click", function () {
              draftCoverUrl = "";
              coverPreviewEl.style.backgroundImage = "";
              coverPreviewEl.innerHTML = "<span>Default Admin Banner</span>";
              coverRemoveBtn.classList.add("hidden");
            });
          }

          // Social Media Links Editor
          var socialSelect = body.querySelector("#ep-social-platform");
          var socialUrlInput = body.querySelector("#ep-social-url");
          var socialAddBtn = body.querySelector("#ep-social-add");
          var socialListEl = body.querySelector("#ep-social-list");

          socialSelect.addEventListener("change", function () {
            var meta = U.SOCIAL_PLATFORM_MAP[socialSelect.value];
            if (meta && socialUrlInput) socialUrlInput.placeholder = meta.placeholder;
          });

          function renderDraftSocialList() {
            if (!socialListEl) return;
            if (draftSocialLinks.length === 0) {
              socialListEl.innerHTML = '<p class="text-muted" style="font-size:12.5px;">No social media links added yet.</p>';
              return;
            }
            socialListEl.innerHTML = draftSocialLinks
              .map(function (item, idx) {
                var meta = U.SOCIAL_PLATFORM_MAP[item.platform] || { label: item.platform, color: "#006A4E", icon: U.ICONS.link };
                return (
                  '<div class="ep-social-item">' +
                  '<span class="ep-social-badge" style="color:' + meta.color + '">' + meta.icon + " <strong>" + U.escapeHtml(meta.label) + "</strong></span>" +
                  '<span class="ep-social-url-text">' + U.escapeHtml(item.url) + "</span>" +
                  '<button type="button" class="icon-btn ep-social-del" data-sidx="' + idx + '" aria-label="Remove link">' + U.ICONS.close + "</button>" +
                  "</div>"
                );
              })
              .join("");
          }

          socialAddBtn.addEventListener("click", function () {
            var plat = socialSelect.value;
            var cleanUrl = U.normalizeSocialUrl(socialUrlInput.value);
            if (!cleanUrl) {
              U.showToast("Please enter a valid social media URL.", "error");
              return;
            }
            if (draftSocialLinks.length >= 10) {
              U.showToast("You can add up to 10 social links.", "error");
              return;
            }
            var existingIdx = draftSocialLinks.findIndex(function (s) { return s.platform === plat; });
            if (existingIdx !== -1) {
              draftSocialLinks[existingIdx] = { platform: plat, url: cleanUrl };
            } else {
              draftSocialLinks.push({ platform: plat, url: cleanUrl });
            }
            socialUrlInput.value = "";
            renderDraftSocialList();
          });

          socialListEl.addEventListener("click", function (ev) {
            var del = ev.target.closest("[data-sidx]");
            if (!del) return;
            var idx = Number(del.dataset.sidx);
            if (!isNaN(idx)) {
              draftSocialLinks.splice(idx, 1);
              renderDraftSocialList();
            }
          });

          renderDraftSocialList();

          body.querySelector("#edit-profile-form").addEventListener("submit", async function (e) {
            e.preventDefault();
            var saveBtn = body.querySelector("#ep-save");
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
            try {
              // Auto-capture any typed-but-not-yet-clicked social link
              if (socialUrlInput && socialUrlInput.value.trim()) {
                var pendingUrl = U.normalizeSocialUrl(socialUrlInput.value);
                if (pendingUrl && draftSocialLinks.length < 10) {
                  var pPlat = socialSelect.value;
                  var exIdx = draftSocialLinks.findIndex(function (s) { return s.platform === pPlat; });
                  if (exIdx !== -1) draftSocialLinks[exIdx] = { platform: pPlat, url: pendingUrl };
                  else draftSocialLinks.push({ platform: pPlat, url: pendingUrl });
                }
              }

              var updateArgs = {
                currentProfile: targetProfile,
                name: body.querySelector("#ep-name").value,
                username: body.querySelector("#ep-username").value,
                bio: body.querySelector("#ep-bio").value,
                location: body.querySelector("#ep-location").value,
                jobTitle: body.querySelector("#ep-job-title").value,
                workplace: body.querySelector("#ep-workplace").value,
                birthDate: body.querySelector("#ep-birthdate").value,
                socialLinks: draftSocialLinks,
                avatarUrl: draftAvatarUrl || googlePhotoUrl || "",
                avatarColor: targetProfile.avatarColor,
                visibility: targetProfile.visibility,
                friendRequestPref: targetProfile.friendRequestPref,
              };
              if (ctx.isAdmin) {
                updateArgs.coverPhotoUrl = draftCoverUrl;
              }
              var updated = await HMM.authService.updateUserProfile(updateArgs);
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

      var shareBtnHtml =
        '<button type="button" class="btn btn-secondary btn-sm" id="btn-share-profile" title="Share profile link">' +
        U.ICONS.share +
        " Share</button>";

      var actionsHtml = "";
      if (isOwnProfile) {
        actionsHtml =
          '<button type="button" class="btn btn-primary btn-sm" id="btn-edit-profile">' + U.ICONS.edit + " Edit profile</button>" +
          shareBtnHtml +
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
          shareBtnHtml +
          '<button type="button" class="btn btn-danger-soft btn-sm" data-paction="block" title="Block user">' + U.ICONS.ban + " Block</button>" +
          (!isProfileAdmin
            ? '<button type="button" class="icon-btn" data-paction="report" title="Report user" aria-label="Report user">' + U.ICONS.flag + "</button>"
            : "");
      }

      var adminExecutiveStrip = isProfileAdmin
        ? '<div class="admin-profile-banner">' +
          '<div class="admin-profile-banner-icon">' + U.renderAdminBadgeHtml("compact") + "</div>" +
          '<div class="admin-profile-banner-text">' +
          "<strong>Official " + U.escapeHtml(HMM.siteConfig.get().siteName) + " Administrator</strong>" +
          "<span>Verified platform leadership · Community safety &amp; governance</span>" +
          "</div></div>"
        : "";

      var safeCover = U.safeAvatarUrl(targetProfile.coverPhotoUrl || "");
      var coverControlsHtml =
        isOwnProfile && ctx.isAdmin
          ? '<div class="profile-cover-controls">' +
            '<label class="profile-cover-btn" for="quick-cover-upload">' + U.ICONS.camera + " " + (safeCover ? "Change Cover" : "Add Cover Photo") + "</label>" +
            '<input id="quick-cover-upload" type="file" accept="image/*" class="hidden" />' +
            (safeCover ? '<button type="button" class="profile-cover-btn profile-cover-btn-del" id="quick-cover-remove" title="Remove cover photo">' + U.ICONS.trash + "</button>" : "") +
            "</div>"
          : "";

      // Work / Position display
      var workLabel = "";
      if (targetProfile.jobTitle && targetProfile.workplace) {
        workLabel = "<strong>" + U.escapeHtml(targetProfile.jobTitle) + "</strong> at <strong>" + U.escapeHtml(targetProfile.workplace) + "</strong>";
      } else if (targetProfile.jobTitle) {
        workLabel = "<strong>" + U.escapeHtml(targetProfile.jobTitle) + "</strong>";
      } else if (targetProfile.workplace) {
        workLabel = "Works at <strong>" + U.escapeHtml(targetProfile.workplace) + "</strong>";
      }

      var formattedDob = U.formatBirthDate(targetProfile.birthDate);
      var socialLinks = U.sanitizeSocialLinks(targetProfile.socialLinks || []);
      var socialLinksHtml =
        socialLinks.length > 0
          ? '<div class="profile-social-row">' +
            socialLinks
              .map(function (item) {
                var meta = U.SOCIAL_PLATFORM_MAP[item.platform];
                if (!meta) return "";
                return (
                  '<a href="' + U.escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" class="profile-social-chip" style="--social-color:' + meta.color + '" title="' + U.escapeHtml(meta.label) + '">' +
                  '<span class="profile-social-icon">' + meta.icon + "</span>" +
                  "<span>" + U.escapeHtml(meta.label) + "</span></a>"
                );
              })
              .join("") +
            "</div>"
          : "";

      var displayAvatarUrl =
        targetProfile.avatarUrl || (isOwnProfile ? U.getGoogleAccountPhotoUrl(ctx.user) : "");

      card.innerHTML =
        '<div class="profile-cover ' + (isProfileAdmin ? "profile-cover-admin" : "") + (safeCover ? " has-cover-photo" : "") + '">' +
        (safeCover
          ? '<img src="' + U.escapeHtml(safeCover) + '" alt="Cover photo" class="profile-cover-img" id="profile-cover-img" />'
          : "") +
        (isProfileAdmin ? '<div class="profile-cover-emblem">' + U.renderAdminBadgeHtml("compact") + " Official Admin</div>" : "") +
        coverControlsHtml +
        '</div><div class="profile-body">' +
        '<div class="profile-top-row"><div class="profile-avatar-ring ' + (isProfileAdmin ? "profile-avatar-ring-admin" : "") + '">' +
        U.renderAvatarHtml({
          name: targetProfile.name,
          avatarUrl: displayAvatarUrl,
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
        (workLabel ? '<span class="profile-meta-item profile-meta-work">' + U.ICONS.briefcase + " <span>" + workLabel + "</span></span>" : "") +
        (formattedDob ? '<span class="profile-meta-item">' + U.ICONS.cake + " Born " + U.escapeHtml(formattedDob) + "</span>" : "") +
        (targetProfile.location ? '<span class="profile-meta-item">' + U.ICONS.mapPin + " " + U.escapeHtml(targetProfile.location) + "</span>" : "") +
        '<span class="profile-meta-item">' + U.ICONS.calendar + " Joined " + U.escapeHtml(U.formatJoinDate(targetProfile.createdAt)) + "</span></div>" +
        socialLinksHtml +
        '<div class="profile-stats">' +
        '<div class="profile-stat"><strong>' + (targetProfile.postsCount || 0) + "</strong><span>Posts</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.friendsCount || 0) + "</strong><span>Friends</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.followersCount || 0) + "</strong><span>Followers</span></div>" +
        '<div class="profile-stat"><strong>' + (targetProfile.followingCount || 0) + "</strong><span>Following</span></div>" +
        "</div></div>";

      var editBtn = document.getElementById("btn-edit-profile");
      if (editBtn) editBtn.addEventListener("click", openEditProfileModal);

      var shareBtn = document.getElementById("btn-share-profile");
      if (shareBtn) shareBtn.addEventListener("click", openShareProfileModal);

      var coverImgEl = document.getElementById("profile-cover-img");
      if (coverImgEl && safeCover) {
        coverImgEl.addEventListener("click", function () {
          U.openImageLightbox(safeCover);
        });
      }

      var quickCoverInput = document.getElementById("quick-cover-upload");
      if (quickCoverInput && isOwnProfile && ctx.isAdmin) {
        quickCoverInput.addEventListener("change", async function () {
          var file = quickCoverInput.files && quickCoverInput.files[0];
          if (!file) return;
          try {
            U.showToast("Uploading cover photo...");
            var dataUrl = await U.compressImageFileToDataUrl(file, 1200, 0.8, 300000);
            var updated = await HMM.authService.updateAdminCoverPhoto(ctx.user.uid, dataUrl);
            if (updated) targetProfile = updated;
            await ctx.refreshProfile();
            renderHeader();
            U.showToast("Cover photo updated!", "success");
          } catch (err) {
            U.showToast(U.getFriendlyErrorMessage(err), "error");
          }
          quickCoverInput.value = "";
        });
      }

      var quickCoverRemove = document.getElementById("quick-cover-remove");
      if (quickCoverRemove && isOwnProfile && ctx.isAdmin) {
        quickCoverRemove.addEventListener("click", async function () {
          quickCoverRemove.disabled = true;
          try {
            var updated = await HMM.authService.updateAdminCoverPhoto(ctx.user.uid, "");
            if (updated) targetProfile = updated;
            await ctx.refreshProfile();
            renderHeader();
            U.showToast("Cover photo removed.");
          } catch (err) {
            U.showToast(U.getFriendlyErrorMessage(err), "error");
            quickCoverRemove.disabled = false;
          }
        });
      }

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
    try {
      userPosts = await HMM.feed.getUserPosts(targetProfile.uid);
    } catch (postErr) {
      console.error("Failed to load profile posts:", postErr);
      userPosts = [];
    } finally {
      postsLoaded = true;
      renderProfilePosts();
    }
  }

  HMM.profile = { mountView: mountProfileView };
})(window.HMM = window.HMM || {});
