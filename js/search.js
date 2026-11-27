/**
 * HMM HMM — Explore People, User Search & Trending Posts View Controller (#explore)
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function mountExploreView(ctx, params) {
    var initialQ = params.get("q") || "";
    var activeTab = "people";
    var currentQuery = initialQ.trim();
    var displayedUsers = [];
    var allPosts = [];
    var socialState = {
      friendUids: new Set(),
      followingUids: new Set(),
      outgoingByReceiver: new Map(),
    };

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Explore HMM HMM</h1>' +
      '<p class="page-subtitle">Discover people across Bangladesh and trending community posts.</p></div></div>' +
      '<div class="card">' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<input id="explore-search-input" class="form-input" type="search" placeholder="Search by name, @username, or city..." value="' + U.escapeHtml(initialQ) + '" />' +
      '<button type="button" id="explore-search-btn" class="btn btn-primary">Search</button></div>' +
      '<div class="tabs" id="explore-tabs">' +
      '<button type="button" class="tab-btn active" data-tab="people">People</button>' +
      '<button type="button" class="tab-btn" data-tab="posts">Posts</button></div></div>' +
      '<div id="explore-people-view" class="people-grid"></div>' +
      '<div id="explore-posts-view" class="hidden" style="display:flex;flex-direction:column;gap:14px;"></div>';

    var globalInput = document.getElementById("global-search-input");
    if (globalInput && initialQ) globalInput.value = initialQ;

    var peopleContainer = document.getElementById("explore-people-view");
    var postsContainer = document.getElementById("explore-posts-view");
    var postManager = HMM.feed.createPostListManager({ container: postsContainer, ctx: ctx });

    function renderPeople() {
      if (displayedUsers.length === 0) {
        peopleContainer.innerHTML =
          '<div class="card empty-state" style="grid-column:1 / -1;"><div class="empty-state-icon">' +
          U.ICONS.search +
          "</div><h3>No people matched</h3><p>Try searching a different name, @username, or city.</p></div>";
        return;
      }

      peopleContainer.innerHTML = displayedUsers
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

          return (
            '<div class="person-card">' +
            '<a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="person-card-top">' +
            U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "md" }) +
            '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u.name) + "</span>" +
            '<span class="user-row-handle">@' + U.escapeHtml(u.username) + (u.location ? " · " + U.escapeHtml(u.location) : "") + "</span></div></a>" +
            '<p class="person-card-bio">' + U.escapeHtml(u.bio || "Member of the HMM HMM community.") + "</p>" +
            '<div class="person-card-actions">' + friendBtn + followBtn + "</div></div>"
          );
        })
        .join("");
    }

    function renderPosts() {
      var term = currentQuery.toLowerCase();
      var filtered = term
        ? allPosts.filter(function (p) {
            return (
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
    var unsubLikes = HMM.feed.subscribeToUserLikes(ctx.user.uid, function (liked) {
      postManager.setLikedSet(liked);
      renderPosts();
    });
    var unsubPosts = HMM.feed.subscribeToFeedPosts(50, function (posts) {
      allPosts = posts;
      renderPosts();
    });

    ctx.onCleanup(function () {
      clearTimeout(debounceTimer);
      if (unsubSocial) unsubSocial();
      if (unsubLikes) unsubLikes();
      if (unsubPosts) unsubPosts();
      postManager.cleanup();
    });

    await runSearch();
  }

  HMM.search = { mountView: mountExploreView };
})(window.HMM = window.HMM || {});
