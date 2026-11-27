/**
 * HMM HMM — Posts, 7 Facebook-Style Reactions (Posts & Comments), Sharing,
 * Smart Link/Media Previews & Home Feed View
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function createPost(author, rawText) {
    var text = U.sanitizeText(rawText, U.LIMITS.POST_TEXT_MAX);
    if (!text) throw new Error("Post text cannot be empty.");

    var postId = U.generateId("post");
    var postDoc = {
      postId: postId,
      authorId: author.uid,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatarUrl: author.avatarUrl || "",
      authorAvatarColor: author.avatarColor || "#006A4E",
      authorRole: U.isOfficialAdminUser(author) ? "admin" : "member",
      text: text,
      visibility: "public",
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    };

    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("posts").doc(postId), postDoc);
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

  // Subscribe to ALL post reactions (public non-PII) so hover/click shows who reacted with what
  function subscribeToAllPostReactions(onData) {
    return HMM.db
      .collection("likes")
      .limit(600)
      .onSnapshot(
        function (snap) {
          var byPost = new Map();
          snap.docs.forEach(function (d) {
            var r = d.data();
            if (!r || !r.postId || !r.userId) return;
            var normalized = {
              likeId: r.likeId || d.id,
              postId: r.postId,
              userId: r.userId,
              reactionType: U.REACTION_MAP[r.reactionType] ? r.reactionType : "like",
              userName: r.userName || "HMM Member",
              userUsername: r.userUsername || "",
              userAvatarUrl: r.userAvatarUrl || "",
              userAvatarColor: r.userAvatarColor || "#006A4E",
              userRole: r.userRole || "member",
              createdAt: r.createdAt,
            };
            if (!byPost.has(r.postId)) byPost.set(r.postId, []);
            byPost.get(r.postId).push(normalized);
          });
          onData(byPost);
        },
        function (err) {
          console.warn("Post reactions listener warning:", err);
        }
      );
  }

  // Keep backward-compatible export name
  function subscribeToUserLikes(uid, onData) {
    return subscribeToAllPostReactions(function (byPost) {
      onData(byPost);
    });
  }

  async function setPostReaction(post, currentUser, currentReactionType, nextReactionType) {
    var likeId = U.getLikeId(post.postId, currentUser.uid);
    var likeRef = HMM.db.collection("likes").doc(likeId);
    var postRef = HMM.db.collection("posts").doc(post.postId);

    // Toggle off if clicking the same reaction
    if (currentReactionType && (!nextReactionType || currentReactionType === nextReactionType)) {
      var delBatch = HMM.db.batch();
      delBatch.delete(likeRef);
      delBatch.update(postRef, { likesCount: HMM.increment(-1) });
      await delBatch.commit();
      return null;
    }

    var type = U.REACTION_MAP[nextReactionType] ? nextReactionType : "like";
    var role = U.isOfficialAdminUser(currentUser) ? "admin" : "member";

    if (currentReactionType) {
      // Switching reaction type without changing likesCount
      await likeRef.update({
        reactionType: type,
        userName: currentUser.name,
        userUsername: currentUser.username,
        userAvatarUrl: currentUser.avatarUrl || "",
        userAvatarColor: currentUser.avatarColor || "#006A4E",
        userRole: role,
        updatedAt: HMM.serverTimestamp(),
      });
      return type;
    }

    // Creating new reaction
    var addBatch = HMM.db.batch();
    addBatch.set(likeRef, {
      likeId: likeId,
      postId: post.postId,
      userId: currentUser.uid,
      reactionType: type,
      userName: currentUser.name,
      userUsername: currentUser.username,
      userAvatarUrl: currentUser.avatarUrl || "",
      userAvatarColor: currentUser.avatarColor || "#006A4E",
      userRole: role,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });
    addBatch.update(postRef, { likesCount: HMM.increment(1) });
    await addBatch.commit();

    if (post.authorId !== currentUser.uid) {
      var meta = U.getReactionMeta(type);
      await U.createNotificationRecord({
        recipientId: post.authorId,
        sender: currentUser,
        type: "like",
        referenceId: post.postId,
        message: currentUser.name + " reacted " + meta.emoji + " (" + meta.label + ") to your post.",
      });
    }
    return type;
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

  function subscribeToCommentReactionsForPost(postId, onData) {
    return HMM.db
      .collection("commentReactions")
      .where("postId", "==", postId)
      .limit(300)
      .onSnapshot(
        function (snap) {
          var byComment = new Map();
          snap.docs.forEach(function (d) {
            var r = d.data();
            if (!r || !r.commentId || !r.userId) return;
            var normalized = {
              reactionId: r.reactionId || d.id,
              commentId: r.commentId,
              postId: r.postId,
              userId: r.userId,
              reactionType: U.REACTION_MAP[r.reactionType] ? r.reactionType : "like",
              userName: r.userName || "HMM Member",
              userUsername: r.userUsername || "",
              userAvatarUrl: r.userAvatarUrl || "",
              userAvatarColor: r.userAvatarColor || "#006A4E",
              userRole: r.userRole || "member",
              createdAt: r.createdAt,
            };
            if (!byComment.has(r.commentId)) byComment.set(r.commentId, []);
            byComment.get(r.commentId).push(normalized);
          });
          onData(byComment);
        },
        function () {}
      );
  }

  async function setCommentReaction(comment, currentUser, currentType, nextType) {
    var reactionId = U.getCommentReactionId(comment.commentId, currentUser.uid);
    var ref = HMM.db.collection("commentReactions").doc(reactionId);

    if (currentType && (!nextType || currentType === nextType)) {
      await ref.delete();
      return null;
    }

    var type = U.REACTION_MAP[nextType] ? nextType : "like";
    var role = U.isOfficialAdminUser(currentUser) ? "admin" : "member";

    if (currentType) {
      await ref.update({
        reactionType: type,
        userName: currentUser.name,
        userUsername: currentUser.username,
        userAvatarUrl: currentUser.avatarUrl || "",
        userAvatarColor: currentUser.avatarColor || "#006A4E",
        userRole: role,
        updatedAt: HMM.serverTimestamp(),
      });
      return type;
    }

    await ref.set({
      reactionId: reactionId,
      commentId: comment.commentId,
      postId: comment.postId,
      userId: currentUser.uid,
      reactionType: type,
      userName: currentUser.name,
      userUsername: currentUser.username,
      userAvatarUrl: currentUser.avatarUrl || "",
      userAvatarColor: currentUser.avatarColor || "#006A4E",
      userRole: role,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });
    return type;
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
      authorRole: U.isOfficialAdminUser(author) ? "admin" : "member",
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
  // REACTION UI HELPERS (Dock, Summary Bar & Who Reacted Modal)
  // ============================================================================
  function summarizeReactions(list) {
    var counts = {};
    (list || []).forEach(function (r) {
      var t = U.REACTION_MAP[r.reactionType] ? r.reactionType : "like";
      counts[t] = (counts[t] || 0) + 1;
    });
    var topTypes = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 3);
    return { total: (list || []).length, counts: counts, topTypes: topTypes };
  }

  function renderReactionDockHtml(attrName, targetId, compact) {
    return (
      '<div class="reaction-dock ' + (compact ? "reaction-dock-sm" : "") + '" role="toolbar" aria-label="Choose a reaction">' +
      U.REACTIONS.map(function (r) {
        return (
          '<button type="button" class="reaction-dock-item" ' +
          attrName + '="' + U.escapeHtml(targetId) + '" data-reaction-type="' + r.type + '" title="' + r.label + '" aria-label="' + r.label + '">' +
          '<span class="reaction-emoji">' + r.emoji + "</span>" +
          '<span class="reaction-tooltip">' + r.label + "</span></button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function buildReactorTooltip(list) {
    if (!list || list.length === 0) return "";
    var preview = list.slice(0, 6).map(function (r) {
      return U.getReactionMeta(r.reactionType).emoji + " " + r.userName;
    });
    if (list.length > 6) preview.push("+" + (list.length - 6) + " more");
    return preview.join("\n");
  }

  function openReactorsModal(title, reactionsList) {
    var list = reactionsList || [];
    var summary = summarizeReactions(list);
    var activeFilter = "all";

    var tabsHtml =
      '<button type="button" class="tab-btn active" data-rfilter="all">All <span class="tab-count">' + list.length + "</span></button>" +
      U.REACTIONS.filter(function (r) { return summary.counts[r.type] > 0; })
        .map(function (r) {
          return (
            '<button type="button" class="tab-btn" data-rfilter="' + r.type + '">' +
            r.emoji + ' <span class="tab-count">' + summary.counts[r.type] + "</span></button>"
          );
        })
        .join("");

    U.openModal(
      title || "Reactions",
      '<div class="tabs" id="reactors-modal-tabs" style="margin-bottom:12px;">' + tabsHtml + "</div>" +
        '<div id="reactors-modal-list" style="max-height:360px;overflow-y:auto;"></div>',
      function (body, close) {
        var listEl = body.querySelector("#reactors-modal-list");
        function renderList() {
          var filtered = activeFilter === "all"
            ? list
            : list.filter(function (r) { return r.reactionType === activeFilter; });
          if (filtered.length === 0) {
            listEl.innerHTML = '<p class="text-muted" style="font-size:13.5px;padding:16px 0;text-align:center;">No reactions yet.</p>';
            return;
          }
          listEl.innerHTML = filtered
            .map(function (r) {
              var meta = U.getReactionMeta(r.reactionType);
              var isAdm = U.isOfficialAdminUser(r);
              return (
                '<div class="user-row"><a href="#profile?uid=' + encodeURIComponent(r.userId) + '" class="user-row-left" data-close-modal="1">' +
                U.renderAvatarHtml({ name: r.userName, avatarUrl: r.userAvatarUrl, avatarColor: r.userAvatarColor, size: "sm", isAdmin: isAdm }) +
                '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(r.userName) +
                (isAdm ? " " + U.renderAdminBadgeHtml("compact") : "") + "</span>" +
                (r.userUsername ? '<span class="user-row-handle">@' + U.escapeHtml(r.userUsername) + "</span>" : "") +
                "</div></a>" +
                '<span class="reactor-emoji-badge" title="' + meta.label + '">' + meta.emoji + " <span>" + meta.label + "</span></span></div>"
              );
            })
            .join("");
          listEl.querySelectorAll("[data-close-modal]").forEach(function (a) {
            a.addEventListener("click", close);
          });
        }

        body.querySelector("#reactors-modal-tabs").addEventListener("click", function (e) {
          var btn = e.target.closest("[data-rfilter]");
          if (!btn) return;
          activeFilter = btn.dataset.rfilter;
          body.querySelectorAll("#reactors-modal-tabs .tab-btn").forEach(function (b) {
            b.classList.toggle("active", b === btn);
          });
          renderList();
        });
        renderList();
      }
    );
  }

  function openSharePostModal(post, onQuotePost) {
    var shareUrl = window.location.href.split("#")[0] + "#feed?post=" + encodeURIComponent(post.postId);
    var previewText = String(post.text || "").slice(0, 140) + (String(post.text || "").length > 140 ? "…" : "");

    U.openModal(
      "Share Post",
      '<div class="share-preview-box">' +
        '<div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">' + U.escapeHtml(post.authorName) +
        ' <span class="text-muted" style="font-weight:500;">@' + U.escapeHtml(post.authorUsername) + "</span></div>" +
        '<div class="text-muted" style="font-size:13px;">' + U.escapeHtml(previewText) + "</div></div>" +
        '<div class="form-group" style="margin-top:14px;"><label class="form-label" for="share-url-input">Direct Post Link</label>' +
        '<div style="display:flex;gap:8px;">' +
        '<input id="share-url-input" class="form-input" type="text" readonly value="' + U.escapeHtml(shareUrl) + '" />' +
        '<button type="button" id="btn-copy-post-link" class="btn btn-primary">' + U.ICONS.copy + " Copy</button></div></div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">' +
        (typeof navigator.share === "function"
          ? '<button type="button" id="btn-native-share" class="btn btn-secondary" style="flex:1;">' + U.ICONS.share + " Share via Device</button>"
          : "") +
        (typeof onQuotePost === "function"
          ? '<button type="button" id="btn-quote-share" class="btn btn-outline" style="flex:1;">Quote to Feed</button>'
          : "") +
        "</div>",
      function (body, close) {
        var copyBtn = body.querySelector("#btn-copy-post-link");
        copyBtn.addEventListener("click", async function () {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(shareUrl);
            } else {
              var inp = body.querySelector("#share-url-input");
              inp.select();
              document.execCommand("copy");
            }
            await incrementShareCount(post.postId).catch(function () {});
            U.showToast("Post link copied to clipboard!", "success");
            close();
          } catch (err) {
            U.showToast("Could not copy link automatically.", "error");
          }
        });

        var nativeBtn = body.querySelector("#btn-native-share");
        if (nativeBtn) {
          nativeBtn.addEventListener("click", async function () {
            try {
              await navigator.share({
                title: post.authorName + " on " + HMM.siteConfig.get().siteName,
                text: previewText,
                url: shareUrl,
              });
              await incrementShareCount(post.postId).catch(function () {});
              close();
            } catch (e) {}
          });
        }

        var quoteBtn = body.querySelector("#btn-quote-share");
        if (quoteBtn && typeof onQuotePost === "function") {
          quoteBtn.addEventListener("click", async function () {
            await incrementShareCount(post.postId).catch(function () {});
            close();
            onQuotePost('Sharing @' + post.authorUsername + '\'s post:\n"' + previewText + '"\n' + shareUrl);
          });
        }
      }
    );
  }

  // ============================================================================
  // REUSABLE INTERACTIVE POST LIST MANAGER
  // ============================================================================
  function createPostListManager(opts) {
    var container = opts.container;
    var ctx = opts.ctx;
    var onPostMutated = opts.onPostMutated;
    var onQuotePost = opts.onQuotePost;
    var highlightPostId = opts.highlightPostId || "";
    var postsMap = new Map();
    var reactionsByPost = new Map();
    var commentsByPost = new Map();
    var commentReactionsByPost = new Map();
    var commentUnsubs = new Map();
    var commentReactUnsubs = new Map();
    var openComments = new Set();

    function getMyPostReaction(postId) {
      var list = reactionsByPost.get(postId) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].userId === ctx.user.uid) return list[i].reactionType;
      }
      return null;
    }

    function getCommentReactions(postId, commentId) {
      var map = commentReactionsByPost.get(postId);
      return (map && map.get(commentId)) || [];
    }

    function getMyCommentReaction(postId, commentId) {
      var list = getCommentReactions(postId, commentId);
      for (var i = 0; i < list.length; i++) {
        if (list[i].userId === ctx.user.uid) return list[i].reactionType;
      }
      return null;
    }

    function renderCommentsList(postId) {
      var listEl = container.querySelector('[data-comments-list="' + CSS.escape(postId) + '"]');
      if (!listEl) return;
      var comments = commentsByPost.get(postId) || [];
      if (comments.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:13px;padding:4px 0;">No comments yet. Start the conversation!</p>';
        return;
      }
      listEl.innerHTML = comments
        .map(function (c) {
          var canDelete = c.authorId === ctx.user.uid || ctx.isAdmin;
          var isAdm = U.isOfficialAdminUser(c);
          var cReacts = getCommentReactions(postId, c.commentId);
          var myCReact = getMyCommentReaction(postId, c.commentId);
          var myMeta = myCReact ? U.getReactionMeta(myCReact) : null;
          var summary = summarizeReactions(cReacts);

          return (
            '<div class="comment-item">' +
            '<a href="#profile?uid=' + encodeURIComponent(c.authorId) + '">' +
            U.renderAvatarHtml({ name: c.authorName, avatarUrl: c.authorAvatarUrl, avatarColor: c.authorAvatarColor, size: "xs", isAdmin: isAdm }) +
            "</a>" +
            '<div class="comment-bubble-wrap">' +
            '<div class="comment-bubble">' +
            '<div class="comment-bubble-top">' +
            '<a href="#profile?uid=' + encodeURIComponent(c.authorId) + '" class="comment-author">' + U.escapeHtml(c.authorName) +
            (isAdm ? " " + U.renderAdminBadgeHtml("compact") : "") + "</a>" +
            '<span class="comment-time">' + U.escapeHtml(U.formatRelativeTime(c.createdAt)) + "</span>" +
            "</div>" +
            '<div class="comment-text">' + U.linkifyText(c.text) + "</div>" +
            "</div>" +
            '<div class="comment-actions">' +
            '<div class="reaction-picker-wrap reaction-picker-inline">' +
            '<button type="button" class="comment-react-btn ' + (myCReact ? "reacted" : "") + '" ' +
            (myMeta ? 'style="color:' + myMeta.color + ';" ' : "") +
            'data-comment-quick-react="' + U.escapeHtml(c.commentId) + '" data-post-id="' + U.escapeHtml(postId) + '">' +
            (myMeta ? myMeta.emoji + " " + myMeta.label : "Like") + "</button>" +
            renderReactionDockHtml("data-comment-react", c.commentId + "|" + postId, true) +
            "</div>" +
            (summary.total > 0
              ? '<button type="button" class="comment-react-summary" data-view-comment-reactors="' + U.escapeHtml(c.commentId) +
                '" data-post-id="' + U.escapeHtml(postId) + '" title="' + U.escapeHtml(buildReactorTooltip(cReacts)) + '">' +
                summary.topTypes.map(function (t) { return U.getReactionMeta(t).emoji; }).join("") +
                ' <span class="tabular-nums">' + summary.total + "</span></button>"
              : "") +
            (canDelete ? '<button type="button" data-del-comment="' + U.escapeHtml(c.commentId) + '" data-post-id="' + U.escapeHtml(postId) + '">Delete</button>' : "") +
            (c.authorId !== ctx.user.uid ? '<button type="button" data-report-comment="' + U.escapeHtml(c.commentId) + '">Report</button>' : "") +
            "</div></div></div>"
          );
        })
        .join("");
    }

    function openCommentsForPost(postId) {
      if (!commentUnsubs.has(postId)) {
        commentUnsubs.set(
          postId,
          subscribeToPostComments(postId, function (comments) {
            commentsByPost.set(postId, comments);
            renderCommentsList(postId);
          })
        );
      }
      if (!commentReactUnsubs.has(postId)) {
        commentReactUnsubs.set(
          postId,
          subscribeToCommentReactionsForPost(postId, function (byComment) {
            commentReactionsByPost.set(postId, byComment);
            renderCommentsList(postId);
          })
        );
      }
    }

    function render(posts, emptyTitle, emptySubtitle) {
      postsMap = new Map(posts.map(function (p) { return [p.postId, p]; }));
      if (posts.length === 0) {
        container.innerHTML =
          '<div class="card empty-state"><div class="empty-state-icon">' +
          U.ICONS.comment +
          "</div><h3>" + U.escapeHtml(emptyTitle || "No posts yet") + "</h3><p>" +
          U.escapeHtml(emptySubtitle || "Share your first update with the community.") +
          "</p></div>";
        return;
      }

      container.innerHTML = posts
        .map(function (post) {
          var isOwn = post.authorId === ctx.user.uid;
          var canDelete = isOwn || ctx.isAdmin;
          var isAuthorAdmin = U.isOfficialAdminUser(post);
          var postReacts = reactionsByPost.get(post.postId) || [];
          var summary = summarizeReactions(postReacts);
          var totalReacts = Math.max(summary.total, post.likesCount || 0);
          var myReaction = getMyPostReaction(post.postId);
          var myMeta = myReaction ? U.getReactionMeta(myReaction) : null;
          var wasEdited = U.timestampToMs(post.updatedAt) - U.timestampToMs(post.createdAt) > 2000;
          var commentsVisible = openComments.has(post.postId);
          var smartPreview = U.renderSmartPreviewHtml(post.text);
          var isHighlighted = highlightPostId && highlightPostId === post.postId;

          var reactionSummaryRow =
            totalReacts > 0 || (post.commentsCount || 0) > 0 || (post.sharesCount || 0) > 0
              ? '<div class="post-stats-bar">' +
                (totalReacts > 0
                  ? '<button type="button" class="reaction-summary-btn" data-view-post-reactors="' + U.escapeHtml(post.postId) +
                    '" title="' + U.escapeHtml(buildReactorTooltip(postReacts)) + '">' +
                    '<span class="reaction-emoji-stack">' +
                    (summary.topTypes.length > 0
                      ? summary.topTypes.map(function (t) { return "<span>" + U.getReactionMeta(t).emoji + "</span>"; }).join("")
                      : "<span>👍</span>") +
                    '</span><span class="tabular-nums">' + totalReacts + "</span></button>"
                  : "<span></span>") +
                '<div class="post-stats-right text-muted tabular-nums">' +
                ((post.commentsCount || 0) > 0
                  ? '<button type="button" class="post-stat-link" data-toggle-comments="' + U.escapeHtml(post.postId) + '">' +
                    post.commentsCount + (post.commentsCount === 1 ? " comment" : " comments") + "</button>"
                  : "") +
                ((post.sharesCount || 0) > 0
                  ? "<span>" + post.sharesCount + (post.sharesCount === 1 ? " share" : " shares") + "</span>"
                  : "") +
                "</div></div>"
              : "";

          return (
            '<article class="card post-card ' + (isHighlighted ? "post-card-highlight" : "") + '" data-post-card="' + U.escapeHtml(post.postId) + '">' +
            '<div class="post-header"><div class="post-author">' +
            '<a href="#profile?uid=' + encodeURIComponent(post.authorId) + '">' +
            U.renderAvatarHtml({ name: post.authorName, avatarUrl: post.authorAvatarUrl, avatarColor: post.authorAvatarColor, size: "md", isAdmin: isAuthorAdmin }) +
            "</a>" +
            '<div class="post-author-meta">' +
            '<a href="#profile?uid=' + encodeURIComponent(post.authorId) + '" class="post-author-name">' +
            U.escapeHtml(post.authorName) + (isAuthorAdmin ? U.renderAdminBadgeHtml("compact") : "") + "</a>" +
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
            '<div class="post-body" data-post-body="' + U.escapeHtml(post.postId) + '">' + U.linkifyText(post.text) + "</div>" +
            smartPreview +
            '<div class="post-edit-box hidden" data-edit-box="' + U.escapeHtml(post.postId) + '">' +
            '<textarea class="form-textarea" maxlength="' + U.LIMITS.POST_TEXT_MAX + '" data-edit-textarea="' + U.escapeHtml(post.postId) + '">' + U.escapeHtml(post.text) + "</textarea>" +
            '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-cancel-edit="' + U.escapeHtml(post.postId) + '">Cancel</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-save-edit="' + U.escapeHtml(post.postId) + '">Save</button>' +
            "</div></div>" +
            reactionSummaryRow +
            '<div class="post-actions">' +
            '<div class="reaction-picker-wrap">' +
            '<button type="button" class="post-action-btn ' + (myReaction ? "reacted" : "") + '" ' +
            (myMeta ? 'style="color:' + myMeta.color + ';" ' : "") +
            'data-quick-react="' + U.escapeHtml(post.postId) + '">' +
            (myMeta ? '<span class="react-btn-emoji">' + myMeta.emoji + "</span><span>" + myMeta.label + "</span>" : U.ICONS.thumbUp + "<span>Like</span>") +
            "</button>" +
            renderReactionDockHtml("data-post-react", post.postId, false) +
            "</div>" +
            '<button type="button" class="post-action-btn" data-toggle-comments="' + U.escapeHtml(post.postId) + '">' +
            U.ICONS.comment + "<span>Comment</span></button>" +
            '<button type="button" class="post-action-btn" data-share-post="' + U.escapeHtml(post.postId) + '">' +
            U.ICONS.share + "<span>Share</span></button>" +
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

      U.hydrateLinkPreviews(container);

      openComments.forEach(function (postId) {
        if (postsMap.has(postId)) {
          openCommentsForPost(postId);
          renderCommentsList(postId);
        }
      });

      if (highlightPostId) {
        var targetCard = container.querySelector('[data-post-card="' + CSS.escape(highlightPostId) + '"]');
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
          highlightPostId = "";
        }
      }
    }

    function onDocClick(e) {
      if (!e.target.closest(".post-menu-wrap")) {
        container.querySelectorAll(".post-dropdown").forEach(function (d) { d.classList.add("hidden"); });
      }
      if (!e.target.closest(".reaction-picker-wrap")) {
        container.querySelectorAll(".reaction-picker-wrap.open").forEach(function (w) { w.classList.remove("open"); });
      }
    }
    document.addEventListener("click", onDocClick);

    // Long-press support on touch devices to open reaction dock cleanly
    var touchTimer = null;
    container.addEventListener("touchstart", function (e) {
      var trigger = e.target.closest("[data-quick-react], [data-comment-quick-react]");
      if (!trigger) return;
      var wrap = trigger.closest(".reaction-picker-wrap");
      if (!wrap) return;
      touchTimer = setTimeout(function () {
        container.querySelectorAll(".reaction-picker-wrap.open").forEach(function (w) { w.classList.remove("open"); });
        wrap.classList.add("open");
      }, 320);
    }, { passive: true });
    container.addEventListener("touchend", function () { clearTimeout(touchTimer); }, { passive: true });
    container.addEventListener("touchmove", function () { clearTimeout(touchTimer); }, { passive: true });

    container.addEventListener("click", async function (e) {
      // YouTube click-to-play embed
      var ytWrap = e.target.closest("[data-yt-play]");
      if (ytWrap) {
        var vid = ytWrap.dataset.ytPlay;
        ytWrap.outerHTML =
          '<div class="video-embed-ratio"><iframe src="https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(vid) +
          '?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
        return;
      }

      // Image lightbox preview
      var lightboxBtn = e.target.closest("[data-lightbox-img]");
      if (lightboxBtn) {
        U.openImageLightbox(lightboxBtn.dataset.lightboxImg);
        return;
      }

      var toggleMenuBtn = e.target.closest("[data-toggle-menu]");
      if (toggleMenuBtn) {
        var pid = toggleMenuBtn.dataset.toggleMenu;
        container.querySelectorAll(".post-dropdown").forEach(function (d) {
          if (d.dataset.postMenu === pid) d.classList.toggle("hidden");
          else d.classList.add("hidden");
        });
        return;
      }

      // Pick specific reaction from post dock
      var postReactBtn = e.target.closest("[data-post-react]");
      if (postReactBtn) {
        var rPid = postReactBtn.dataset.postReact;
        var rType = postReactBtn.dataset.reactionType;
        var postObj = postsMap.get(rPid);
        var wrapEl = postReactBtn.closest(".reaction-picker-wrap");
        if (wrapEl) wrapEl.classList.remove("open");
        if (!postObj) return;
        try {
          await setPostReaction(postObj, ctx.profile, getMyPostReaction(rPid), rType);
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
        return;
      }

      // Quick Like / Toggle off button
      var quickReactBtn = e.target.closest("[data-quick-react]");
      if (quickReactBtn) {
        var qPid = quickReactBtn.dataset.quickReact;
        var qPost = postsMap.get(qPid);
        if (!qPost) return;
        var existingType = getMyPostReaction(qPid);
        quickReactBtn.disabled = true;
        try {
          await setPostReaction(qPost, ctx.profile, existingType, existingType ? null : "like");
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          quickReactBtn.disabled = false;
        }
        return;
      }

      // View who reacted to a post
      var viewPostReactsBtn = e.target.closest("[data-view-post-reactors]");
      if (viewPostReactsBtn) {
        var vPid = viewPostReactsBtn.dataset.viewPostReactors;
        openReactorsModal("Post Reactions", reactionsByPost.get(vPid) || []);
        return;
      }

      // Pick specific reaction for a comment
      var cmtReactBtn = e.target.closest("[data-comment-react]");
      if (cmtReactBtn) {
        var parts = String(cmtReactBtn.dataset.commentReact || "").split("|");
        var cid = parts[0];
        var cPostId = parts[1];
        var cType = cmtReactBtn.dataset.reactionType;
        var cWrap = cmtReactBtn.closest(".reaction-picker-wrap");
        if (cWrap) cWrap.classList.remove("open");
        var cmts = commentsByPost.get(cPostId) || [];
        var targetCmt = cmts.find(function (x) { return x.commentId === cid; });
        if (!targetCmt) return;
        try {
          await setCommentReaction(targetCmt, ctx.profile, getMyCommentReaction(cPostId, cid), cType);
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
        return;
      }

      // Quick Like / Toggle on a comment
      var cmtQuickBtn = e.target.closest("[data-comment-quick-react]");
      if (cmtQuickBtn) {
        var qCid = cmtQuickBtn.dataset.commentQuickReact;
        var qCPid = cmtQuickBtn.dataset.postId;
        var qCmts = commentsByPost.get(qCPid) || [];
        var qTarget = qCmts.find(function (x) { return x.commentId === qCid; });
        if (!qTarget) return;
        var curC = getMyCommentReaction(qCPid, qCid);
        try {
          await setCommentReaction(qTarget, ctx.profile, curC, curC ? null : "like");
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
        return;
      }

      // View who reacted to a comment
      var viewCmtReactsBtn = e.target.closest("[data-view-comment-reactors]");
      if (viewCmtReactsBtn) {
        var vcCid = viewCmtReactsBtn.dataset.viewCommentReactors;
        var vcPid = viewCmtReactsBtn.dataset.postId;
        openReactorsModal("Comment Reactions", getCommentReactions(vcPid, vcCid));
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
          var u1 = commentUnsubs.get(cpid);
          if (u1) { u1(); commentUnsubs.delete(cpid); }
          var u2 = commentReactUnsubs.get(cpid);
          if (u2) { u2(); commentReactUnsubs.delete(cpid); }
        } else {
          openComments.add(cpid);
          box.classList.remove("hidden");
          openCommentsForPost(cpid);
        }
        return;
      }

      var shareBtn = e.target.closest("[data-share-post]");
      if (shareBtn) {
        var sp = postsMap.get(shareBtn.dataset.sharePost);
        if (!sp) return;
        openSharePostModal(sp, onQuotePost);
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
      setReactionsMap: function (nextMap) { reactionsByPost = nextMap || new Map(); },
      setLikedSet: function (nextMap) { reactionsByPost = nextMap instanceof Map ? nextMap : new Map(); },
      render: render,
      cleanup: function () {
        document.removeEventListener("click", onDocClick);
        commentUnsubs.forEach(function (u) { if (u) u(); });
        commentUnsubs.clear();
        commentReactUnsubs.forEach(function (u) { if (u) u(); });
        commentReactUnsubs.clear();
      },
    };
  }

  // ============================================================================
  // HOME FEED VIEW CONTROLLER
  // ============================================================================
  function mountFeedView(ctx, params) {
    var feedFilter = "all";
    var pageLimit = 30;
    var allPosts = [];
    var socialState = { friendUids: new Set(), followingUids: new Set() };
    var unsubFeed = null;
    var highlightPostId = params ? params.get("post") || "" : "";

    ctx.mainEl.innerHTML =
      '<section class="card composer-card">' +
      '<div class="composer-top">' +
      U.renderAvatarHtml({ name: ctx.profile.name, avatarUrl: ctx.profile.avatarUrl, avatarColor: ctx.profile.avatarColor, size: "md", isAdmin: ctx.isAdmin }) +
      '<textarea id="post-composer-input" class="composer-textarea" maxlength="' + U.LIMITS.POST_TEXT_MAX +
      '" placeholder="What\'s on your mind, ' + U.escapeHtml(ctx.profile.name.split(" ")[0]) + '? Paste any image, YouTube, video, or website link for a smart preview..."></textarea>' +
      "</div>" +
      '<div id="composer-live-preview"></div>' +
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

    var inputEl = document.getElementById("post-composer-input");
    var counterEl = document.getElementById("composer-counter");
    var submitBtn = document.getElementById("post-submit-btn");
    var livePreviewEl = document.getElementById("composer-live-preview");
    var postsContainer = document.getElementById("feed-posts-container");

    var postManager = createPostListManager({
      container: postsContainer,
      ctx: ctx,
      highlightPostId: highlightPostId,
      onQuotePost: function (quoteText) {
        inputEl.value = quoteText;
        inputEl.dispatchEvent(new Event("input"));
        inputEl.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });

    var lastPreviewUrl = "";
    var previewTimer = null;

    function updateComposerPreview() {
      var urls = U.extractUrls(inputEl.value);
      var firstUrl = urls[0] || "";
      if (firstUrl === lastPreviewUrl) return;
      lastPreviewUrl = firstUrl;
      if (!firstUrl) {
        livePreviewEl.innerHTML = "";
        return;
      }
      livePreviewEl.innerHTML = U.renderSmartPreviewHtml(firstUrl);
      U.hydrateLinkPreviews(livePreviewEl);
    }

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
          : "Be the first to share something on " + HMM.siteConfig.get().siteName + "!"
      );

      var loadMoreWrap = document.getElementById("feed-load-more-wrap");
      if (loadMoreWrap) {
        loadMoreWrap.classList.toggle("hidden", allPosts.length < pageLimit || pageLimit >= 100);
      }
    }

    inputEl.addEventListener("input", function () {
      var len = inputEl.value.length;
      counterEl.textContent = len + " / " + U.LIMITS.POST_TEXT_MAX;
      counterEl.classList.toggle("near-limit", len > U.LIMITS.POST_TEXT_MAX - 120);
      submitBtn.disabled = inputEl.value.trim().length === 0;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updateComposerPreview, 350);
    });

    submitBtn.addEventListener("click", async function () {
      if (!inputEl.value.trim()) return;
      submitBtn.disabled = true;
      try {
        await createPost(ctx.profile, inputEl.value);
        inputEl.value = "";
        lastPreviewUrl = "";
        livePreviewEl.innerHTML = "";
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

    var unsubReacts = subscribeToAllPostReactions(function (byPost) {
      postManager.setReactionsMap(byPost);
      renderFiltered();
    });

    var unsubSocial = HMM.friends.subscribeToSocialState(ctx.user.uid, function (next) {
      socialState = next;
      if (feedFilter === "network") renderFiltered();
    });

    attachFeedSubscription();

    ctx.onCleanup(function () {
      clearTimeout(previewTimer);
      if (unsubFeed) unsubFeed();
      if (unsubReacts) unsubReacts();
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
    subscribeToAllPostReactions: subscribeToAllPostReactions,
    subscribeToUserLikes: subscribeToUserLikes,
    setPostReaction: setPostReaction,
    createPostListManager: createPostListManager,
    mountView: mountFeedView,
  };
})(window.HMM = window.HMM || {});
