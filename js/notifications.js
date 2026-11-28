/**
 * KLORIX (window.HMM) — Facebook-Style Real-Time Notifications View Controller (#notifications)
 * - Opening Notifications immediately clears the global badge count ("seen")
 * - Inside the list, clicked (isRead: true) vs unclicked (isRead: false) items remain visually distinct
 * - Supports reactions, comments, @mentions, post tags, friend requests, follows, messages & VIP verification.
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  function iconForType(type) {
    switch (type) {
      case "like": return U.ICONS.heart;
      case "comment": return U.ICONS.comment;
      case "mention": return U.ICONS.hash;
      case "tag": return U.ICONS.tag;
      case "friend_request":
      case "friend_accepted":
      case "follow": return U.ICONS.users;
      case "message": return U.ICONS.message;
      case "vip_verified": return U.ICONS.sparkles;
      default: return U.ICONS.bell;
    }
  }

  function linkForNotification(item) {
    switch (item.type) {
      case "vip_verified":
        return "#profile";
      case "message":
        if (item.referenceId && String(item.referenceId).indexOf("grp_") === 0) {
          return "#messages?chat=" + encodeURIComponent(item.referenceId);
        }
        return "#messages?uid=" + encodeURIComponent(item.senderId);
      case "friend_request": return "#friends";
      case "friend_accepted":
      case "follow": return "#profile?uid=" + encodeURIComponent(item.senderId);
      case "like":
      case "comment":
      case "mention":
      case "tag":
        return item.referenceId ? "#feed?post=" + encodeURIComponent(item.referenceId) : "#feed";
      default: return "#feed";
    }
  }

  function mountNotificationsView(ctx) {
    var items = [];
    var filter = "all";
    var seenSyncedIds = new Set();

    // Immediately clear global badge count as soon as user opens Notifications
    U.markNotificationsOpened(ctx.user.uid, Date.now());

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Notifications</h1>' +
      '<p class="page-subtitle">Tap any notification to open it. Unclicked items stay highlighted until you tap them.</p></div>' +
      '<button type="button" id="btn-mark-all-read" class="btn btn-secondary btn-sm">Mark all read</button></div>' +
      '<div class="card notif-card-wrap"><div class="tabs" id="notif-tabs">' +
      '<button type="button" class="tab-btn active" data-filter="all">All <span class="tab-count" id="notif-cnt-all">0</span></button>' +
      '<button type="button" class="tab-btn" data-filter="unread">Unclicked <span class="tab-count" id="notif-cnt-unread">0</span></button>' +
      '</div><div id="notif-list" class="notif-list">' +
      '<p class="text-muted" style="padding:12px;">Loading notifications...</p></div></div>';

    var listEl = document.getElementById("notif-list");

    function markUnseenInFirestore(notifItems) {
      var maxMs = Date.now();
      var toMarkSeen = [];
      (notifItems || []).forEach(function (n) {
        var ms = U.timestampToMs(n.createdAt);
        if (ms > maxMs) maxMs = ms;
        if (!n.isSeen && !n.isRead && n.notificationId && !seenSyncedIds.has(n.notificationId)) {
          seenSyncedIds.add(n.notificationId);
          toMarkSeen.push(n.notificationId);
        }
      });

      // Keep local seen timestamp ahead of latest notification so badge stays cleared
      U.markNotificationsOpened(ctx.user.uid, maxMs);

      if (toMarkSeen.length === 0) return;
      try {
        var batch = HMM.db.batch();
        toMarkSeen.slice(0, 450).forEach(function (nid) {
          batch.update(HMM.db.collection("notifications").doc(nid), { isSeen: true });
        });
        batch.commit().catch(function () {
          // Silently ignore if older Firestore rules are still active; localStorage handles badge state
        });
      } catch (e) {}
    }

    function markSingleAsRead(nid) {
      if (!nid) return;
      var target = items.find(function (i) { return i.notificationId === nid; });
      if (target) {
        target.isRead = true;
        target.isSeen = true;
      }
      render();
      // Update Firestore (try isRead + isSeen first, fallback to isRead-only for older rules)
      HMM.db
        .collection("notifications")
        .doc(nid)
        .update({ isRead: true, isSeen: true })
        .catch(function () {
          return HMM.db.collection("notifications").doc(nid).update({ isRead: true }).catch(function () {});
        });
    }

    function render() {
      var nonBlocked = items.filter(function (n) {
        return !(HMM.blocks && HMM.blocks.isEitherBlocked(n.senderId));
      });
      var unreadCount = nonBlocked.filter(function (n) { return !n.isRead; }).length;
      var cntAll = document.getElementById("notif-cnt-all");
      var cntUnread = document.getElementById("notif-cnt-unread");
      if (cntAll) cntAll.textContent = String(nonBlocked.length);
      if (cntUnread) cntUnread.textContent = String(unreadCount);
      var markAllBtn = document.getElementById("btn-mark-all-read");
      if (markAllBtn) markAllBtn.disabled = unreadCount === 0;

      var visible = filter === "unread" ? nonBlocked.filter(function (n) { return !n.isRead; }) : nonBlocked;
      if (visible.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">' + U.ICONS.bell + "</div>" +
          "<h3>" + (filter === "unread" ? "All caught up!" : "No notifications yet") + "</h3>" +
          "<p>" +
          (filter === "unread"
            ? "You have already opened all your notifications."
            : "Activity from your posts, @mentions, friends, and followers will show up here in real time.") +
          "</p></div>";
        return;
      }

      listEl.innerHTML = visible
        .map(function (n) {
          var isClicked = Boolean(n.isRead);
          var href = linkForNotification(n);
          return (
            '<a href="' + href + '" class="notif-item notif-row-link ' + (isClicked ? "clicked" : "unread") + '" data-notif-id="' + U.escapeHtml(n.notificationId) + '">' +
            '<div class="notif-icon ' + (n.type === "vip_verified" ? "notif-icon-vip" : "") + '">' + iconForType(n.type) + "</div>" +
            '<div class="notif-body">' +
            '<div class="notif-text">' + U.escapeHtml(n.message) + "</div>" +
            '<div class="notif-time">@' + U.escapeHtml(n.senderUsername || "klorix") + " · " + U.escapeHtml(U.formatRelativeTime(n.createdAt)) +
            (isClicked ? ' · <span class="notif-state-read">Opened</span>' : "") + "</div>" +
            "</div>" +
            '<div class="notif-status-col">' +
            (!isClicked
              ? '<span class="notif-unread-dot" title="Not opened yet" aria-label="Unclicked notification"></span>'
              : "") +
            "</div></a>"
          );
        })
        .join("");
    }

    document.getElementById("notif-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      filter = btn.dataset.filter;
      document.querySelectorAll("#notif-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      render();
    });

    document.getElementById("btn-mark-all-read").addEventListener("click", async function (e) {
      var unread = items.filter(function (n) { return !n.isRead; });
      if (unread.length === 0) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      try {
        var batch = HMM.db.batch();
        unread.slice(0, 450).forEach(function (n) {
          batch.update(HMM.db.collection("notifications").doc(n.notificationId), { isRead: true });
        });
        await batch.commit();
        unread.forEach(function (n) {
          n.isRead = true;
          n.isSeen = true;
        });
        U.markNotificationsOpened(ctx.user.uid, Date.now());
        render();
        U.showToast("All notifications marked as read.", "success");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    listEl.addEventListener("click", function (e) {
      var row = e.target.closest("[data-notif-id]");
      if (!row) return;
      var nid = row.dataset.notifId;
      var targetItem = items.find(function (i) { return i.notificationId === nid; });
      if (targetItem && !targetItem.isRead) {
        markSingleAsRead(nid);
      }
    });

    var unsub = HMM.db
      .collection("notifications")
      .where("recipientId", "==", ctx.user.uid)
      .limit(60)
      .onSnapshot(
        function (snap) {
          items = snap.docs
            .map(function (d) { return d.data(); })
            .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
          markUnseenInFirestore(items);
          render();
        },
        function (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
      );

    var unsubBlocks = HMM.blocks.subscribe(render);

    ctx.onCleanup(function () {
      if (unsub) unsub();
      if (unsubBlocks) unsubBlocks();
    });
  }

  HMM.notifications = { mountView: mountNotificationsView };
})(window.HMM = window.HMM || {});
