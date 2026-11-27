/**
 * HMM HMM — Posts, Likes, Comments Services & Home Feed View
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function createPost(author, rawText) {
    var text = U.sanitizeText(rawText, U.LIMITS.POST_TEXT_MAX);
    if (!text) throw new Error("Post text cannot be empty.");

    var postId = U.generateId("post");
    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("posts").doc(postId), {
      postId: postId,
      authorId: author.uid,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatarUrl: author.avatarUrl || "",
      authorAvatarColor: author.avatarColor || "#006A4E",
      text: text,
      visibility: "public",
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });
    batch.update(HMM.db.collection("users").doc(author.uid), {
      postsCount: HMM.increment(1),
    });
    await batch.commit();
    return postId;
  }

  async function updatePostText(postId, rawText) {
    var text = U.sanitizeText(rawText, U.LIMITS.POST_TEXT_MAX);
    if (!text) throw new Error("Post text cannot be empty.");
    await HMM.db.collection("posts").doc(postId).update({
      text: text,
      updatedAt: HMM.serverTimestamp(),
    });
  }

  async function deletePost(post, isOwnPost) {
    var batch = HMM.db.batch();
    batch.delete(HMM.db.collection("posts").doc(post.postId));
    if (isOwnPost) {
      batch.update(HMM.db.collection("users").doc(post.authorId), {
        postsCount: HMM.increment(-1),
      });
    }
    await batch.commit();
  }

  function subscribeToFeedPosts(pageLimit, onData, onError) {
    return HMM.db
      .collection("posts")
      .where("visibility", "==", "public")
      .limit(Math.min(pageLimit, 100))
      .onSnapshot(
        function (snap) {
          var posts = snap.docs
            .map(function (d) { return d.data(); })
            .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
          onData(posts);
        },
        function (err) {
          console.error("Feed posts listener error:", err);
          if (onError) onError(err);
        }
      );
  }

  async function getUserPosts(uid) {
    var snap = await HMM.db
      .collection("posts")
      .where("authorId", "==", uid)
      .limit(50)
      .get();
    return snap.docs
      .map(function (d) { return d.data(); })
      .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
  }

  function subscribeToUserLikes(uid, onData) {
    return HMM.db
      .collection("likes")
      .where("userId", "==", uid)
      .limit(300)
      .onSnapshot(
        function (snap) {
          var set = new Set();
          snap.docs.forEach(function (d) {
            var data = d.data();
            if (data && data.postId) set.add(data.postId);
          });
          onData(set);
        },
        function () {}
      );
  }

  async function togglePostLike(post, currentUser, currentlyLiked) {
    var likeId = U.getLikeId(post.postId, currentUser.uid);
    var likeRef = HMM.db.collection("likes").doc(likeId);
    var postRef = HMM.db.collection("posts").doc(post.postId);
    var batch = HMM.db.batch();

    if (currentlyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, { likesCount: HMM.increment(-1) });
    } else {
      batch.set(likeRef, {
        likeId: likeId,
        postId: post.postId,
        userId: currentUser.uid,
        createdAt: HMM.serverTimestamp(),
      });
      batch.update(postRef, { likesCount: HMM.increment(1) });
    }
    await batch.commit();

    if (!currentlyLiked && post.authorId !== currentUser.uid) {
      await U.createNotificationRecord({
        recipientId: post.authorId,
        sender: currentUser,
        type: "like",
        referenceId: post.postId,
        message: currentUser.name + " liked your post.",
      });
    }
  }

  function subscribeToPostComments(postId, onData) {
    return HMM.db
      .collection("comments")
      .where("postId", "==", postId)
      .where("visibility", "==", "public")
      .limit(100)
      .onSnapshot(
        function (snap) {
          var list = snap.docs
            .map(function (d) { return d.data(); })
            .sort(function (a, b) { return U.timestampToMs(a.createdAt) - U.timestampToMs(b.createdAt); });
          onData(list);
        },
        function () {}
      );
  }

  async function addComment(post, author, rawText) {
    var text = U.sanitizeText(rawText, U.LIMITS.COMMENT_TEXT_MAX);
    if (!text) throw new Error("Comment cannot be empty.");

    var commentId = U.generateId("cmt");
    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("comments").doc(commentId), {
      commentId: commentId,
      postId: post.postId,
      authorId: author.uid,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatarUrl: author.avatarUrl || "",
      authorAvatarColor: author.avatarColor || "#006A4E",
      text: text,
      visibility: "public",
      createdAt: HMM.serverTimestamp(),
    });
    batch.update(HMM.db.collection("posts").doc(post.postId), {
      commentsCount: HMM.increment(1),
    });
    await batch.commit();

    if (post.authorId !== author.uid) {
      await U.createNotificationRecord({
        recipientId: post.authorId,
        sender: author,
        type: "comment",
        referenceId: post.postId,
        message: author.name + " commented on your post.",
      });
    }
    return commentId;
  }

  async function deleteComment(postId, commentId) {
    var batch = HMM.db.batch();
    batch.delete(HMM.db.collection("comments").doc(commentId));
    batch.update(HMM.db.collection("posts").doc(postId), {
      commentsCount: HMM.increment(-1),
    });
    await batch.commit();
  }

  async function incrementShareCount(postId) {
    await HMM.db.collection("posts").doc(postId).update({
      sharesCount: HMM.increment(1),
    });
  }

  // ============================================================================
  // REUSABLE INTERACTIVE POST LIST MANAGER
  // ============================================================================
  function createPostListManager(opts) {
    var container = opts.container;
    var ctx = opts.ctx;
    var onPostMutated = opts.onPostMutated;
    var postsMap = new Map();
    var likedSet = new Set();
    var commentUnsubs = new Map();
    var openComments = new Set();

    function renderCommentsList(postId, comments) {
      var listEl = container.querySelector('[data-comments-list="' + CSS.escape(postId) + '"]');
      if (!listEl) return;
      if (comments.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:13px;padding:4px 0;">No comments yet. Start the conversation!</p>';
        return;
      }
      listEl.innerHTML = comments
        .map(function (c) {
          var canDelete = c.authorId === ctx.user.uid || ctx.isAdmin;
          return (
            '<div class="comment-item">' +
            '<a href="#profile?uid=' + encodeURIComponent(c.authorId) + '">' +
            U.renderAvatarHtml({ name: c.authorName, avatarUrl: c.authorAvatarUrl, avatarColor: c.authorAvatarColor, size: "xs" }) +
            "</a>" +
            '<div class="comment-bubble">' +
            '<div class="comment-bubble-top">' +
            '<a href="#profile?uid=' + encodeURIComponent(c.authorId) + '" class="comment-author">' + U.escapeHtml(c.authorName) + "</a>" +
            '<span class="comment-time">' + U.escapeHtml(U.formatRelativeTime(c.createdAt)) + "</span>" +
            "</div>" +
            '<div class="comment-text">' + U.escapeHtml(c.text) + "</div>" +
            '<div class="comment-actions">' +
            (canDelete ? '<button type="button" data-del-comment="' + U.escapeHtml(c.commentId) + '" data-post-id="' + U.escapeHtml(postId) + '">Delete</button>' : "") +
            (c.authorId !== ctx.user.uid ? '<button type="button" data-report-comment="' + U.escapeHtml(c.commentId) + '">Report</button>' : "") +
            "</div></div></div>"
          );
        })
        .join("");
    }

    function render(posts, emptyTitle, emptySubtitle) {
      postsMap = new Map(posts.map(function (p) { return [p.postId, p]; }));
      if (posts.length === 0) {
        container.innerHTML =
          '<div class="card empty-state"><div class="empty-state-icon">' +
          U.ICONS.comment +
          "</div><h3>" + U.escapeHtml(emptyTitle || "No posts yet") + "</h3><p>" +
          U.escapeHtml(emptySubtitle || "Share your first update with the HMM HMM community.") +
          "</p></div>";
        return;
      }

      container.innerHTML = posts
        .map(function (post) {
          var isOwn = post.authorId === ctx.user.uid;
          var canDelete = isOwn || ctx.isAdmin;
          var isLiked = likedSet.has(post.postId);
          var wasEdited = U.timestampToMs(post.updatedAt) - U.timestampToMs(post.createdAt) > 2000;
          var commentsVisible = openComments.has(post.postId);

          return (
            '<article class="card post-card" data-post-card="' + U.escapeHtml(post.postId) + '">' +
            '<div class="post-header"><div class="post-author">' +
            '<a href="#profile?uid=' + encodeURIComponent(post.authorId) + '">' +
            U.renderAvatarHtml({ name: post.authorName, avatarUrl: post.authorAvatarUrl, avatarColor: post.authorAvatarColor, size: "md" }) +
            "</a>" +
            '<div class="post-author-meta">' +
            '<a href="#profile?uid=' + encodeURIComponent(post.authorId) + '" class="post-author-name">' + U.escapeHtml(post.authorName) + "</a>" +
            '<div class="post-meta-sub"><span>@' + U.escapeHtml(post.authorUsername) + "</span><span>·</span><span>" +
            U.escapeHtml(U.formatRelativeTime(post.createdAt)) + "</span>" + (wasEdited ? "<span>· Edited</span>" : "") + "</div>" +
            "</div></div>" +
            '<div class="post-menu-wrap">' +
            '<button type="button" class="icon-btn" data-toggle-menu="' + U.escapeHtml(post.postId) + '" aria-label="Post options">' + U.ICONS.more + "</button>" +
            '<div class="post-dropdown hidden" data-post-menu="' + U.escapeHtml(post.postId) + '">' +
            (isOwn ? '<button type="button" data-edit-post="' + U.escapeHtml(post.postId) + '">' + U.ICONS.edit + " Edit post</button>" : "") +
            (canDelete ? '<button type="button" class="danger" data-delete-post="' + U.escapeHtml(post.postId) + '">' + U.ICONS.trash + " Delete post</button>" : "") +
            (!isOwn ? '<button type="button" class="danger" data-report-post="' + U.escapeHtml(post.postId) + '">' + U.ICONS.flag + " Report post</button>" : "") +
            "</div></div></div>" +
            '<div class="post-body" data-post-body="' + U.escapeHtml(post.postId) + '">' + U.escapeHtml(post.text) + "</div>" +
            '<div class="post-edit-box hidden" data-edit-box="' + U.escapeHtml(post.postId) + '">' +
            '<textarea class="form-textarea" maxlength="' + U.LIMITS.POST_TEXT_MAX + '" data-edit-textarea="' + U.escapeHtml(post.postId) + '">' + U.escapeHtml(post.text) + "</textarea>" +
            '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-cancel-edit="' + U.escapeHtml(post.postId) + '">Cancel</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-save-edit="' + U.escapeHtml(post.postId) + '">Save</button>' +
            "</div></div>" +
            '<div class="post-actions">' +
            '<button type="button" class="post-action-btn ' + (isLiked ? "liked" : "") + '" data-like-post="' + U.escapeHtml(post.postId) + '">' +
            (isLiked ? U.ICONS.heartFilled : U.ICONS.heart) + '<span class="tabular-nums">' + (post.likesCount || 0) + "</span></button>" +
            '<button type="button" class="post-action-btn" data-toggle-comments="' + U.escapeHtml(post.postId) + '">' +
            U.ICONS.comment + '<span class="tabular-nums">' + (post.commentsCount || 0) + "</span></button>" +
            '<button type="button" class="post-action-btn" data-share-post="' + U.escapeHtml(post.postId) + '">' +
            U.ICONS.share + '<span class="tabular-nums">' + (post.sharesCount || 0) + "</span></button>" +
            "</div>" +
            '<div class="comments-section ' + (commentsVisible ? "" : "hidden") + '" data-comments-box="' + U.escapeHtml(post.postId) + '">' +
            '<form class="comment-form" data-comment-form="' + U.escapeHtml(post.postId) + '">' +
            '<input type="text" maxlength="' + U.LIMITS.COMMENT_TEXT_MAX + '" placeholder="Write a comment..." required />' +
            '<button type="submit" class="btn btn-primary btn-sm">Reply</button></form>' +
            '<div class="comment-list" data-comments-list="' + U.escapeHtml(post.postId) + '"><p class="text-muted" style="font-size:13px;">Loading comments...</p></div>' +
            "</div></article>"
          );
        })
        .join("");

      openComments.forEach(function (postId) {
        if (!commentUnsubs.has(postId) && postsMap.has(postId)) {
          commentUnsubs.set(
            postId,
            subscribeToPostComments(postId, function (comments) {
              renderCommentsList(postId, comments);
            })
          );
        }
      });
    }

    function onDocClick(e) {
      if (!e.target.closest(".post-menu-wrap")) {
        container.querySelectorAll(".post-dropdown").forEach(function (d) { d.classList.add("hidden"); });
      }
    }
    document.addEventListener("click", onDocClick);

    container.addEventListener("click", async function (e) {
      var toggleMenuBtn = e.target.closest("[data-toggle-menu]");
      if (toggleMenuBtn) {
        var pid = toggleMenuBtn.dataset.toggleMenu;
        container.querySelectorAll(".post-dropdown").forEach(function (d) {
          if (d.dataset.postMenu === pid) d.classList.toggle("hidden");
          else d.classList.add("hidden");
        });
        return;
      }

      var likeBtn = e.target.closest("[data-like-post]");
      if (likeBtn) {
        var post = postsMap.get(likeBtn.dataset.likePost);
        if (!post) return;
        likeBtn.disabled = true;
        try {
          await togglePostLike(post, ctx.profile, likedSet.has(post.postId));
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          likeBtn.disabled = false;
        }
        return;
      }

      var commentsBtn = e.target.closest("[data-toggle-comments]");
      if (commentsBtn) {
        var cpid = commentsBtn.dataset.toggleComments;
        var box = container.querySelector('[data-comments-box="' + CSS.escape(cpid) + '"]');
        if (!box) return;
        if (openComments.has(cpid)) {
          openComments.delete(cpid);
          box.classList.add("hidden");
          var u = commentUnsubs.get(cpid);
          if (u) { u(); commentUnsubs.delete(cpid); }
        } else {
          openComments.add(cpid);
          box.classList.remove("hidden");
          commentUnsubs.set(
            cpid,
            subscribeToPostComments(cpid, function (comments) {
              renderCommentsList(cpid, comments);
            })
          );
        }
        return;
      }

      var shareBtn = e.target.closest("[data-share-post]");
      if (shareBtn) {
        var sp = postsMap.get(shareBtn.dataset.sharePost);
        if (!sp) return;
        try {
          var shareUrl = window.location.href.split("#")[0] + "#profile?uid=" + encodeURIComponent(sp.authorId);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl).catch(function () {});
          }
          await incrementShareCount(sp.postId);
          U.showToast("Post link copied & shared!", "success");
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
        return;
      }

      var editBtn = e.target.closest("[data-edit-post]");
      if (editBtn) {
        var epid = editBtn.dataset.editPost;
        var m = container.querySelector('[data-post-menu="' + CSS.escape(epid) + '"]');
        var b = container.querySelector('[data-post-body="' + CSS.escape(epid) + '"]');
        var eb = container.querySelector('[data-edit-box="' + CSS.escape(epid) + '"]');
        if (m) m.classList.add("hidden");
        if (b) b.classList.add("hidden");
        if (eb) eb.classList.remove("hidden");
        return;
      }

      var cancelEditBtn = e.target.closest("[data-cancel-edit]");
      if (cancelEditBtn) {
        var cepid = cancelEditBtn.dataset.cancelEdit;
        var cb = container.querySelector('[data-post-body="' + CSS.escape(cepid) + '"]');
        var ceb = container.querySelector('[data-edit-box="' + CSS.escape(cepid) + '"]');
        if (cb) cb.classList.remove("hidden");
        if (ceb) ceb.classList.add("hidden");
        return;
      }

      var saveEditBtn = e.target.closest("[data-save-edit]");
      if (saveEditBtn) {
        var sepid = saveEditBtn.dataset.saveEdit;
        var textarea = container.querySelector('[data-edit-textarea="' + CSS.escape(sepid) + '"]');
        if (!textarea) return;
        saveEditBtn.disabled = true;
        try {
          await updatePostText(sepid, textarea.value);
          U.showToast("Post updated.", "success");
          var sb = container.querySelector('[data-post-body="' + CSS.escape(sepid) + '"]');
          var seb = container.querySelector('[data-edit-box="' + CSS.escape(sepid) + '"]');
          if (sb) sb.classList.remove("hidden");
          if (seb) seb.classList.add("hidden");
          if (onPostMutated) onPostMutated();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          saveEditBtn.disabled = false;
        }
        return;
      }

      var delBtn = e.target.closest("[data-delete-post]");
      if (delBtn) {
        var dp = postsMap.get(delBtn.dataset.deletePost);
        if (!dp) return;
        delBtn.disabled = true;
        try {
          await deletePost(dp, dp.authorId === ctx.user.uid);
          U.showToast("Post deleted.", "success");
          if (onPostMutated) onPostMutated();
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          delBtn.disabled = false;
        }
        return;
      }

      var reportBtn = e.target.closest("[data-report-post]");
      if (reportBtn) {
        var rp = postsMap.get(reportBtn.dataset.reportPost);
        if (!rp) return;
        var rm = container.querySelector('[data-post-menu="' + CSS.escape(rp.postId) + '"]');
        if (rm) rm.classList.add("hidden");
        ctx.openReport({
          targetType: "post",
          targetId: rp.postId,
          label: "post by @" + rp.authorUsername,
        });
        return;
      }

      var delCmtBtn = e.target.closest("[data-del-comment]");
      if (delCmtBtn) {
        delCmtBtn.disabled = true;
        try {
          await deleteComment(delCmtBtn.dataset.postId, delCmtBtn.dataset.delComment);
          U.showToast("Comment removed.");
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
          delCmtBtn.disabled = false;
        }
        return;
      }

      var reportCmtBtn = e.target.closest("[data-report-comment]");
      if (reportCmtBtn) {
        ctx.openReport({
          targetType: "comment",
          targetId: reportCmtBtn.dataset.reportComment,
          label: "this comment",
        });
      }
    });

    container.addEventListener("submit", async function (e) {
      var form = e.target.closest("[data-comment-form]");
      if (!form) return;
      e.preventDefault();
      var pid = form.dataset.commentForm;
      var post = postsMap.get(pid);
      var input = form.querySelector("input");
      var submitBtn = form.querySelector('button[type="submit"]');
      if (!post || !input || !input.value.trim()) return;
      submitBtn.disabled = true;
      try {
        await addComment(post, ctx.profile, input.value);
        input.value = "";
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
      } finally {
        submitBtn.disabled = false;
      }
    });

    return {
      setLikedSet: function (nextSet) { likedSet = nextSet; },
      render: render,
      cleanup: function () {
        document.removeEventListener("click", onDocClick);
        commentUnsubs.forEach(function (u) { if (u) u(); });
        commentUnsubs.clear();
      },
    };
  }

  // ============================================================================
  // HOME FEED VIEW CONTROLLER
  // ============================================================================
  function mountFeedView(ctx) {
    var feedFilter = "all";
    var pageLimit = 30;
    var allPosts = [];
    var socialState = { friendUids: new Set(), followingUids: new Set() };
    var unsubFeed = null;

    ctx.mainEl.innerHTML =
      '<section class="card composer-card">' +
      '<div class="composer-top">' +
      U.renderAvatarHtml({ name: ctx.profile.name, avatarUrl: ctx.profile.avatarUrl, avatarColor: ctx.profile.avatarColor, size: "md" }) +
      '<textarea id="post-composer-input" class="composer-textarea" maxlength="' + U.LIMITS.POST_TEXT_MAX +
      '" placeholder="What\'s on your mind, ' + U.escapeHtml(ctx.profile.name.split(" ")[0]) + '?"></textarea>' +
      "</div>" +
      '<div class="composer-footer">' +
      '<span id="composer-counter" class="char-counter">0 / ' + U.LIMITS.POST_TEXT_MAX + "</span>" +
      '<button type="button" id="post-submit-btn" class="btn btn-primary" disabled>' + U.ICONS.send + "<span>Post</span></button>" +
      "</div></section>" +
      '<div class="feed-toolbar"><h2 style="font-size:18px;font-weight:800;">Community Feed</h2>' +
      '<div class="feed-filter-pills" id="feed-filter-group">' +
      '<button type="button" class="filter-btn active" data-filter="all">Everyone</button>' +
      '<button type="button" class="filter-btn" data-filter="network">Friends &amp; Following</button>' +
      "</div></div>" +
      '<div id="feed-posts-container" style="display:flex;flex-direction:column;gap:14px;">' +
      '<div class="card empty-state"><div class="spinner"></div><p>Loading posts...</p></div></div>' +
      '<div id="feed-load-more-wrap" class="hidden" style="text-align:center;">' +
      '<button type="button" id="feed-load-more-btn" class="btn btn-secondary">Load more posts</button></div>';

    var postsContainer = document.getElementById("feed-posts-container");
    var postManager = createPostListManager({ container: postsContainer, ctx: ctx });

    function renderFiltered() {
      var list =
        feedFilter === "network"
          ? allPosts.filter(function (p) {
              return (
                p.authorId === ctx.user.uid ||
                socialState.friendUids.has(p.authorId) ||
                socialState.followingUids.has(p.authorId)
              );
            })
          : allPosts;

      postManager.render(
        list,
        feedFilter === "network" ? "Your network feed is quiet" : "No posts yet",
        feedFilter === "network"
          ? "Add friends or follow people on Explore to see their posts here."
          : "Be the first to share something on HMM HMM!"
      );

      var loadMoreWrap = document.getElementById("feed-load-more-wrap");
      if (loadMoreWrap) {
        loadMoreWrap.classList.toggle("hidden", allPosts.length < pageLimit || pageLimit >= 100);
      }
    }

    var inputEl = document.getElementById("post-composer-input");
    var counterEl = document.getElementById("composer-counter");
    var submitBtn = document.getElementById("post-submit-btn");

    inputEl.addEventListener("input", function () {
      var len = inputEl.value.length;
      counterEl.textContent = len + " / " + U.LIMITS.POST_TEXT_MAX;
      counterEl.classList.toggle("near-limit", len > U.LIMITS.POST_TEXT_MAX - 120);
      submitBtn.disabled = inputEl.value.trim().length === 0;
    });

    submitBtn.addEventListener("click", async function () {
      if (!inputEl.value.trim()) return;
      submitBtn.disabled = true;
      try {
        await createPost(ctx.profile, inputEl.value);
        inputEl.value = "";
        counterEl.textContent = "0 / " + U.LIMITS.POST_TEXT_MAX;
        U.showToast("Post published!", "success");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        submitBtn.disabled = false;
      }
    });

    document.getElementById("feed-filter-group").addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      feedFilter = btn.dataset.filter;
      document.querySelectorAll("#feed-filter-group .filter-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderFiltered();
    });

    function attachFeedSubscription() {
      if (unsubFeed) unsubFeed();
      unsubFeed = subscribeToFeedPosts(
        pageLimit,
        function (posts) { allPosts = posts; renderFiltered(); },
        function (err) { U.showToast(U.getFriendlyErrorMessage(err), "error"); }
      );
    }

    document.getElementById("feed-load-more-btn").addEventListener("click", function () {
      pageLimit = Math.min(pageLimit + 30, 100);
      attachFeedSubscription();
    });

    var unsubLikes = subscribeToUserLikes(ctx.user.uid, function (liked) {
      postManager.setLikedSet(liked);
      renderFiltered();
    });

    var unsubSocial = HMM.friends.subscribeToSocialState(ctx.user.uid, function (next) {
      socialState = next;
      if (feedFilter === "network") renderFiltered();
    });

    attachFeedSubscription();

    ctx.onCleanup(function () {
      if (unsubFeed) unsubFeed();
      if (unsubLikes) unsubLikes();
      if (unsubSocial) unsubSocial();
      postManager.cleanup();
    });
  }

  HMM.feed = {
    createPost: createPost,
    updatePostText: updatePostText,
    deletePost: deletePost,
    subscribeToFeedPosts: subscribeToFeedPosts,
    getUserPosts: getUserPosts,
    subscribeToUserLikes: subscribeToUserLikes,
    togglePostLike: togglePostLike,
    createPostListManager: createPostListManager,
    mountView: mountFeedView,
  };
})(window.HMM = window.HMM || {});
