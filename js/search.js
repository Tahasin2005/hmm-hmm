/**
 * KLORIX (window.HMM) — Explore People, #Hashtags, User Search & Trending Posts (#explore)
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function mountExploreView(ctx, params) {
    var cfg = HMM.siteConfig.get();
    var initialQ = params.get("q") || "";
    var startsWithHash = initialQ.trim().indexOf("#") === 0;
    var activeTab = startsWithHash ? "posts" : "people";
    var currentQuery = initialQ.trim();
    var displayedUsers = [];
    var allPosts = [];
    var socialState = {
      friendUids: new Set(),
      followingUids: new Set(),
      outgoingByReceiver: new Map(),
    };

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Explore ' + U.escapeHtml(cfg.siteName) + "</h1>" +
      '<p class="page-subtitle">Discover people, #hashtags, embedded videos, and trending community posts.</p></div></div>' +
      '<div class="card">' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<input id="explore-search-input" class="form-input" type="search" placeholder="Search by name, @username, #hashtag, or city..." value="' + U.escapeHtml(initialQ) + '" />' +
      '<button type="button" id="explore-search-btn" class="btn btn-primary">Search</button></div>' +
      '<div class="tabs" id="explore-tabs">' +
      '<button type="button" class="tab-btn ' + (activeTab === "people" ? "active" : "") + '" data-tab="people">People</button>' +
      '<button type="button" class="tab-btn ' + (activeTab === "posts" ? "active" : "") + '" data-tab="posts">Posts &amp; #Hashtags</button></div></div>' +
      '<div id="explore-people-view" class="people-grid ' + (activeTab === "people" ? "" : "hidden") + '"></div>' +
      '<div id="explore-posts-view" class="' + (activeTab === "posts" ? "" : "hidden") + '" style="display:flex;flex-direction:column;gap:14px;"></div>';

    var globalInput = document.getElementById("global-search-input");
    if (globalInput && initialQ) globalInput.value = initialQ;

    var peopleContainer = document.getElementById("explore-people-view");
    var postsContainer = document.getElementById("explore-posts-view");
    var postManager = HMM.feed.createPostListManager({ container: postsContainer, ctx: ctx });

    function renderPeople() {
      var visibleUsers = displayedUsers.filter(function (u) {
        return !(HMM.blocks && HMM.blocks.isEitherBlocked(u.uid));
      });
      if (visibleUsers.length === 0) {
        peopleContainer.innerHTML =
          '<div class="card empty-state" style="grid-column:1 / -1;"><div class="empty-state-icon">' +
          U.ICONS.search +
          "</div><h3>No people matched</h3><p>Try searching a different name, @username, or city.</p></div>";
        return;
      }

      peopleContainer.innerHTML = visibleUsers
        .map(function (u) {
          var isFriend = socialState.friendUids.has(u.uid);
          var isFollowing = socialState.followingUids.has(u.uid);
          var isSent = socialState.outgoingByReceiver.has(u.uid);

          var followBtn = isFollowing
            ? '<button type="button" class="btn btn-secondary btn-sm" data-eaction="unfollow" data-uid="' + U.escapeHtml(u.uid) + '">Following</button>'
            : '<button type="button" class="btn btn-outline btn-sm" data-eaction="follow" data-uid="' + U.escapeHtml(u.uid) + '">Follow</button>';

          var friendBtn = "";
          if (isFriend) {
            friendBtn = '<a href="#messages?uid=' + encodeURIComponent(u.uid) + '" class="btn btn-primary btn-sm">Message</a>';
          } else if (isSent) {
            friendBtn = '<button type="button" class="btn btn-secondary btn-sm" data-eaction="cancel" data-uid="' + U.escapeHtml(u.uid) + '">Requested</button>';
          } else if (u.friendRequestPref !== "none") {
            friendBtn = '<button type="button" class="btn btn-primary btn-sm" data-eaction="add-friend" data-uid="' + U.escapeHtml(u.uid) + '">Add Friend</button>';
          }

          var isOffAdmin = U.isOfficialAdminUser(u);
          var isVer = isOffAdmin || U.isVerifiedUser(u);
          return (
            '<div class="person-card">' +
            '<a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="person-card-top">' +
            U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "md", isAdmin: isOffAdmin, isVerified: isVer }) +
            '<div class="user-row-meta"><span class="user-row-name name-with-badge">' + U.escapeHtml(u.name) +
            (isVer ? U.renderVerifiedBadgeHtml(u, "compact") : "") + "</span>" +
            '<span class="user-row-handle">@' + U.escapeHtml(u.username) + (u.location ? " · " + U.escapeHtml(u.location) : "") + "</span></div></a>" +
            '<p class="person-card-bio">' + U.escapeHtml(u.bio || ("Member of the " + cfg.siteName + " community.")) + "</p>" +
            '<div class="person-card-actions">' + friendBtn + followBtn + "</div></div>"
          );
        })
        .join("");
    }

    function renderPosts() {
      var term = currentQuery.toLowerCase();
      var cleanTag = term.replace(/^#/, "");
      var filtered = term
        ? allPosts.filter(function (p) {
            var hasTag =
              Array.isArray(p.hashtags) &&
              p.hashtags.some(function (t) { return String(t).toLowerCase() === cleanTag || String(t).toLowerCase().indexOf(cleanTag) !== -1; });
            return (
              hasTag ||
              String(p.text || "").toLowerCase().indexOf(term) !== -1 ||
              String(p.authorName || "").toLowerCase().indexOf(term) !== -1 ||
              String(p.authorUsername || "").toLowerCase().indexOf(term) !== -1
            );
          })
        : allPosts.slice().sort(function (a, b) { return (b.likesCount || 0) - (a.likesCount || 0); });

      postManager.render(
        filtered,
        "No matching posts",
        term ? 'No posts matched "' + currentQuery + '".' : "No public posts yet."
      );
    }

    async function runSearch() {
      var input = document.getElementById("explore-search-input");
      currentQuery = (input ? input.value : "").trim();
      peopleContainer.innerHTML =
        '<div class="card empty-state" style="grid-column:1 / -1;"><div class="spinner"></div><p>Searching...</p></div>';
      try {
        displayedUsers = currentQuery
          ? await HMM.authService.searchUsers(currentQuery, ctx.user.uid)
          : await HMM.authService.getSuggestedUsers(ctx.user.uid, 20);
        renderPeople();
        renderPosts();
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
      }
    }

    document.getElementById("explore-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      activeTab = btn.dataset.tab;
      document.querySelectorAll("#explore-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      peopleContainer.classList.toggle("hidden", activeTab !== "people");
      postsContainer.classList.toggle("hidden", activeTab !== "posts");
    });

    var searchInput = document.getElementById("explore-search-input");
    var debounceTimer = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 280);
    });
    document.getElementById("explore-search-btn").addEventListener("click", runSearch);

    peopleContainer.addEventListener("click", async function (e) {
      var btn = e.target.closest("button[data-eaction]");
      if (!btn) return;
      var action = btn.dataset.eaction;
      var targetUid = btn.dataset.uid;
      var targetUser = displayedUsers.find(function (u) { return u.uid === targetUid; });
      btn.disabled = true;
      try {
        if (action === "follow") {
          await HMM.friends.followUser(ctx.profile, targetUid);
          U.showToast("Followed!", "success");
        } else if (action === "unfollow") {
          await HMM.friends.unfollowUser(ctx.user.uid, targetUid);
          U.showToast("Unfollowed.");
        } else if (action === "add-friend" && targetUser) {
          await HMM.friends.sendFriendRequest(ctx.profile, targetUser);
          U.showToast("Friend request sent!", "success");
        } else if (action === "cancel") {
          await HMM.friends.cancelFriendRequest(ctx.user.uid, targetUid);
          U.showToast("Friend request cancelled.");
        }
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    var unsubSocial = HMM.friends.subscribeToSocialState(ctx.user.uid, function (next) {
      socialState = next;
      renderPeople();
    });
    var unsubLikes = HMM.feed.subscribeToAllPostReactions(function (rMap) {
      postManager.setReactionsMap(rMap);
      renderPosts();
    });
    var unsubPosts = HMM.feed.subscribeToFeedPosts(50, function (posts) {
      allPosts = posts;
      renderPosts();
    });
    var unsubBlocks = HMM.blocks.subscribe(function () {
      renderPeople();
      renderPosts();
    });

    ctx.onCleanup(function () {
      clearTimeout(debounceTimer);
      if (unsubSocial) unsubSocial();
      if (unsubLikes) unsubLikes();
      if (unsubPosts) unsubPosts();
      if (unsubBlocks) unsubBlocks();
      postManager.cleanup();
    });

    await runSearch();
  }

  HMM.search = { mountView: mountExploreView };
})(window.HMM = window.HMM || {});
