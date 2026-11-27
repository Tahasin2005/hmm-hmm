/**
 * HMM HMM — Real-Time Notifications View Controller (#notifications)
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  function iconForType(type) {
    switch (type) {
      case "like": return U.ICONS.heart;
      case "comment": return U.ICONS.comment;
      case "friend_request":
      case "friend_accepted":
      case "follow": return U.ICONS.users;
      case "message": return U.ICONS.message;
      default: return U.ICONS.bell;
    }
  }

  function linkForNotification(item) {
    switch (item.type) {
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
        return item.referenceId ? "#feed?post=" + encodeURIComponent(item.referenceId) : "#feed";
      default: return "#feed";
    }
  }

  function mountNotificationsView(ctx) {
    var items = [];
    var filter = "all";

    ctx.mainEl.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Notifications</h1>' +
      '<p class="page-subtitle">Likes, comments, friend requests, follows, and messages.</p></div>' +
      '<button type="button" id="btn-mark-all-read" class="btn btn-secondary btn-sm">Mark all read</button></div>' +
      '<div class="card" style="padding-bottom:0;"><div class="tabs" id="notif-tabs">' +
      '<button type="button" class="tab-btn active" data-filter="all">All <span class="tab-count" id="notif-cnt-all">0</span></button>' +
      '<button type="button" class="tab-btn" data-filter="unread">Unread <span class="tab-count" id="notif-cnt-unread">0</span></button>' +
      '</div><div id="notif-list" style="padding:16px 0;display:flex;flex-direction:column;gap:10px;">' +
      '<p class="text-muted">Loading notifications...</p></div></div>';

    var listEl = document.getElementById("notif-list");

    function render() {
      var unreadCount = items.filter(function (n) { return !n.isRead; }).length;
      document.getElementById("notif-cnt-all").textContent = String(items.length);
      document.getElementById("notif-cnt-unread").textContent = String(unreadCount);
      var markAllBtn = document.getElementById("btn-mark-all-read");
      if (markAllBtn) markAllBtn.disabled = unreadCount === 0;

      var visible = filter === "unread" ? items.filter(function (n) { return !n.isRead; }) : items;
      if (visible.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">' + U.ICONS.bell + "</div>" +
          "<h3>" + (filter === "unread" ? "You're all caught up!" : "No notifications yet") + "</h3>" +
          "<p>Activity from your posts, friends, and followers will show up here in real time.</p></div>";
        return;
      }

      listEl.innerHTML = visible
        .map(function (n) {
          return (
            '<div class="notif-item ' + (n.isRead ? "" : "unread") + '" data-notif-id="' + U.escapeHtml(n.notificationId) + '">' +
            '<div class="notif-icon">' + iconForType(n.type) + "</div>" +
            '<div class="notif-body"><div class="notif-text">' + U.escapeHtml(n.message) + "</div>" +
            '<div class="notif-time">@' + U.escapeHtml(n.senderUsername) + " · " + U.escapeHtml(U.formatRelativeTime(n.createdAt)) + "</div></div>" +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<a href="' + linkForNotification(n) + '" class="btn btn-secondary btn-sm" data-open-notif="' + U.escapeHtml(n.notificationId) + '">Open</a>' +
            (!n.isRead ? '<button type="button" class="btn btn-ghost btn-sm" data-read-notif="' + U.escapeHtml(n.notificationId) + '">Read</button>' : "") +
            "</div></div>"
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
        U.showToast("All notifications marked as read.", "success");
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    listEl.addEventListener("click", async function (e) {
      var readBtn = e.target.closest("[data-read-notif]");
      if (readBtn) {
        var nid = readBtn.dataset.readNotif;
        readBtn.disabled = true;
        try {
          await HMM.db.collection("notifications").doc(nid).update({ isRead: true });
        } catch (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
        return;
      }

      var openLink = e.target.closest("[data-open-notif]");
      if (openLink) {
        var onid = openLink.dataset.openNotif;
        var targetItem = items.find(function (i) { return i.notificationId === onid; });
        if (targetItem && !targetItem.isRead) {
          HMM.db.collection("notifications").doc(onid).update({ isRead: true }).catch(function () {});
        }
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
          render();
        },
        function (err) {
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        }
      );

    ctx.onCleanup(unsub);
  }

  HMM.notifications = { mountView: mountNotificationsView };
})(window.HMM = window.HMM || {});
