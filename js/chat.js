/**
 * HMM HMM — Private 1-to-1 Real-Time Chat View Controller (#messages)
 * Powered by Firebase Realtime Database (RTDB) + Live Presence + Read Receipts
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  async function sendPrivateMessage(params) {
    var sender = params.sender;
    var recipient = params.recipient;
    if (sender.uid === recipient.uid) throw new Error("You cannot message yourself.");
    var text = U.sanitizeText(params.rawText, U.LIMITS.MESSAGE_TEXT_MAX);
    if (!text) throw new Error("Message cannot be empty.");

    var chatId = U.getPairId(sender.uid, recipient.uid);
    var now = Date.now();

    var chatUpdate = {
      lastMessage: text,
      lastMessageTime: now,
      lastSenderId: sender.uid,
    };
    chatUpdate["participants/" + sender.uid] = true;
    chatUpdate["participants/" + recipient.uid] = true;
    await HMM.rtdb.ref("chats/" + chatId).update(chatUpdate);

    await HMM.rtdb.ref("messages/" + chatId).push({
      senderId: sender.uid,
      text: text,
      createdAt: now,
      read: false,
    });

    var recipientUnread = 0;
    try {
      var snap = await HMM.rtdb
        .ref("userChats/" + recipient.uid + "/" + chatId + "/unreadCount")
        .once("value");
      var val = snap.val();
      recipientUnread = typeof val === "number" ? val : 0;
    } catch (e) {
      recipientUnread = 0;
    }

    await Promise.all([
      HMM.rtdb.ref("userChats/" + sender.uid + "/" + chatId).set({
        chatId: chatId,
        otherUid: recipient.uid,
        otherName: recipient.name,
        otherUsername: recipient.username,
        otherAvatarUrl: recipient.avatarUrl || "",
        otherAvatarColor: recipient.avatarColor || "#006A4E",
        lastMessage: text,
        lastMessageTime: now,
        lastSenderId: sender.uid,
        unreadCount: 0,
      }),
      HMM.rtdb.ref("userChats/" + recipient.uid + "/" + chatId).set({
        chatId: chatId,
        otherUid: sender.uid,
        otherName: sender.name,
        otherUsername: sender.username,
        otherAvatarUrl: sender.avatarUrl || "",
        otherAvatarColor: sender.avatarColor || "#006A4E",
        lastMessage: text,
        lastMessageTime: now,
        lastSenderId: sender.uid,
        unreadCount: recipientUnread + 1,
      }),
    ]);

    await U.createNotificationRecord({
      recipientId: recipient.uid,
      sender: sender,
      type: "message",
      referenceId: sender.uid,
      message: sender.name + " sent you a message.",
    });
  }

  async function markChatAsRead(chatId, myUid, messages) {
    var updates = {};
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.senderId !== myUid && !m.read) {
        updates["messages/" + chatId + "/" + m.messageId + "/read"] = true;
      }
    }
    try {
      var summarySnap = await HMM.rtdb.ref("userChats/" + myUid + "/" + chatId).once("value");
      if (summarySnap.exists() && summarySnap.val() && summarySnap.val().unreadCount > 0) {
        updates["userChats/" + myUid + "/" + chatId + "/unreadCount"] = 0;
      }
      if (Object.keys(updates).length > 0) {
        await HMM.rtdb.ref().update(updates);
      }
    } catch (err) {
      console.warn("markChatAsRead warning:", err);
    }
  }

  async function mountChatView(ctx, params) {
    var chatList = [];
    var activeRecipient = null;
    var activeChatId = null;
    var activePresence = { online: false, lastSeen: 0 };
    var activeMsgRef = null;
    var activeMsgCb = null;
    var activePresRef = null;
    var activePresCb = null;
    var presenceMap = new Map();
    var presenceListeners = new Map();

    ctx.mainEl.innerHTML =
      '<section class="chat-container" id="chat-shell">' +
      '<aside class="chat-sidebar"><div class="chat-sidebar-header">' +
      '<div class="chat-sidebar-title-row"><h2>Messages</h2>' +
      '<button type="button" id="btn-new-chat" class="btn btn-primary btn-sm">New chat</button></div>' +
      '<input id="chat-filter-input" class="form-input" type="search" placeholder="Filter conversations..." style="height:36px;font-size:13.5px;" />' +
      '</div><div class="chat-thread-list" id="chat-thread-list">' +
      '<div class="empty-state" style="padding:24px 12px;"><div class="spinner"></div></div></div></aside>' +
      '<div class="chat-main" id="chat-main-pane"><div class="chat-empty-pane">' +
      '<div class="empty-state-icon">' + U.ICONS.message + "</div>" +
      '<h3>Your private messages</h3><p>Select a conversation or click "New chat" to message anyone on HMM HMM in real time.</p>' +
      "</div></div></section>";

    var chatShell = document.getElementById("chat-shell");
    var threadListEl = document.getElementById("chat-thread-list");
    var mainPaneEl = document.getElementById("chat-main-pane");
    var filterInput = document.getElementById("chat-filter-input");

    function watchPresenceFor(uid) {
      if (!uid || presenceListeners.has(uid)) return;
      var pRef = HMM.rtdb.ref("presence/" + uid);
      var cb = function (snap) {
        var val = snap.val();
        presenceMap.set(uid, {
          online: Boolean(val && val.online),
          lastSeen: val && typeof val.lastSeen === "number" ? val.lastSeen : 0,
        });
        renderThreadList();
      };
      pRef.on("value", cb);
      presenceListeners.set(uid, { ref: pRef, cb: cb });
    }

    function renderThreadList() {
      var term = (filterInput ? filterInput.value : "").trim().toLowerCase();
      var filtered = term
        ? chatList.filter(function (c) {
            return (
              String(c.otherName || "").toLowerCase().indexOf(term) !== -1 ||
              String(c.otherUsername || "").toLowerCase().indexOf(term) !== -1
            );
          })
        : chatList;

      if (filtered.length === 0) {
        threadListEl.innerHTML =
          '<div class="empty-state" style="padding:28px 12px;"><p style="font-size:13px;">' +
          (term ? "No matching chats." : "No conversations yet. Start a new chat!") +
          "</p></div>";
        return;
      }

      threadListEl.innerHTML = filtered
        .map(function (c) {
          var isActive = c.chatId === activeChatId;
          var p = presenceMap.get(c.otherUid);
          return (
            '<button type="button" class="chat-thread-item ' + (isActive ? "active" : "") + '" data-open-uid="' + U.escapeHtml(c.otherUid) + '">' +
            U.renderAvatarHtml({
              name: c.otherName,
              avatarUrl: c.otherAvatarUrl,
              avatarColor: c.otherAvatarColor,
              size: "md",
              online: p ? p.online : false,
            }) +
            '<div class="chat-thread-meta"><div class="chat-thread-top">' +
            '<span class="chat-thread-name">' + U.escapeHtml(c.otherName) + "</span>" +
            '<span class="chat-thread-time">' + U.escapeHtml(U.formatRelativeTime(c.lastMessageTime)) + "</span></div>" +
            '<div class="chat-thread-bottom"><span class="chat-thread-preview">' +
            (c.lastSenderId === ctx.user.uid ? "You: " : "") + U.escapeHtml(c.lastMessage || "") + "</span>" +
            (c.unreadCount > 0 ? '<span class="chat-unread-badge">' + (c.unreadCount > 99 ? "99+" : c.unreadCount) + "</span>" : "") +
            "</div></div></button>"
          );
        })
        .join("");
    }

    function renderActiveHeaderPresence() {
      var el = document.getElementById("chat-active-presence");
      if (!el) return;
      el.textContent = U.formatPresenceLabel(activePresence.online, activePresence.lastSeen);
      el.style.color = activePresence.online ? "var(--accent)" : "var(--text-muted)";
    }

    function renderMessages(messages) {
      var scrollEl = document.getElementById("chat-messages-scroll");
      if (!scrollEl) return;
      if (messages.length === 0) {
        scrollEl.innerHTML =
          '<div class="chat-empty-pane"><p>No messages yet. Say salam to ' + U.escapeHtml(activeRecipient.name) + "!</p></div>";
        return;
      }

      scrollEl.innerHTML = messages
        .map(function (m) {
          var mine = m.senderId === ctx.user.uid;
          return (
            '<div class="msg-row ' + (mine ? "mine" : "theirs") + '">' +
            '<div class="msg-bubble">' + U.escapeHtml(m.text) + "</div>" +
            '<div class="msg-meta"><span>' + U.escapeHtml(U.formatMessageTime(m.createdAt)) + "</span>" +
            (mine ? '<span class="msg-read-tick" title="' + (m.read ? "Read" : "Sent") + '">' + (m.read ? "✓✓" : "✓") + "</span>" : "") +
            "</div></div>"
          );
        })
        .join("");

      scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    function detachActiveListeners() {
      if (activeMsgRef && activeMsgCb) activeMsgRef.off("value", activeMsgCb);
      if (activePresRef && activePresCb) activePresRef.off("value", activePresCb);
      activeMsgRef = null;
      activeMsgCb = null;
      activePresRef = null;
      activePresCb = null;
    }

    function openConversation(recipientProfile) {
      if (!recipientProfile || recipientProfile.uid === ctx.user.uid) return;
      activeRecipient = recipientProfile;
      activeChatId = U.getPairId(ctx.user.uid, recipientProfile.uid);
      chatShell.classList.add("thread-open");
      renderThreadList();
      detachActiveListeners();

      mainPaneEl.innerHTML =
        '<div class="chat-main-header"><div class="chat-main-user">' +
        '<button type="button" class="icon-btn chat-back-btn" id="chat-mobile-back" aria-label="Back to chats">' + U.ICONS.arrowLeft + "</button>" +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '">' +
        U.renderAvatarHtml({ name: recipientProfile.name, avatarUrl: recipientProfile.avatarUrl, avatarColor: recipientProfile.avatarColor, size: "sm" }) +
        '</a><div style="min-width:0;">' +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '" class="user-row-name">' + U.escapeHtml(recipientProfile.name) + "</a>" +
        '<div id="chat-active-presence" style="font-size:12px;color:var(--text-muted);">Checking status...</div></div></div>' +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '" class="btn btn-secondary btn-sm">Profile</a></div>' +
        '<div class="chat-messages-scroll" id="chat-messages-scroll"><div class="chat-empty-pane"><div class="spinner"></div></div></div>' +
        '<form class="chat-composer" id="chat-send-form">' +
        '<input id="chat-message-input" type="text" maxlength="' + U.LIMITS.MESSAGE_TEXT_MAX + '" placeholder="Type a message..." autocomplete="off" required />' +
        '<button type="submit" id="chat-send-btn" class="btn btn-primary">' + U.ICONS.send + "<span>Send</span></button></form>";

      document.getElementById("chat-mobile-back").addEventListener("click", function () {
        chatShell.classList.remove("thread-open");
      });

      document.getElementById("chat-send-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var input = document.getElementById("chat-message-input");
        var btn = document.getElementById("chat-send-btn");
        if (!input || !input.value.trim()) return;
        var text = input.value;
        input.value = "";
        btn.disabled = true;
        try {
          await sendPrivateMessage({ sender: ctx.profile, recipient: activeRecipient, rawText: text });
        } catch (err) {
          input.value = text;
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          btn.disabled = false;
          input.focus();
        }
      });

      activePresRef = HMM.rtdb.ref("presence/" + recipientProfile.uid);
      activePresCb = function (snap) {
        var val = snap.val();
        activePresence = {
          online: Boolean(val && val.online),
          lastSeen: val && typeof val.lastSeen === "number" ? val.lastSeen : 0,
        };
        renderActiveHeaderPresence();
      };
      activePresRef.on("value", activePresCb);

      activeMsgRef = HMM.rtdb.ref("messages/" + activeChatId).limitToLast(100);
      activeMsgCb = function (snap) {
        var val = snap.val();
        var list = val
          ? Object.keys(val)
              .map(function (messageId) {
                var m = val[messageId];
                return {
                  messageId: messageId,
                  senderId: m.senderId,
                  text: m.text,
                  createdAt: m.createdAt || 0,
                  read: Boolean(m.read),
                };
              })
              .sort(function (a, b) { return a.createdAt - b.createdAt; })
          : [];
        renderMessages(list);
        markChatAsRead(activeChatId, ctx.user.uid, list);
      };
      activeMsgRef.on("value", activeMsgCb);
    }

    threadListEl.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-open-uid]");
      if (!btn) return;
      var uid = btn.dataset.openUid;
      var summary = chatList.find(function (c) { return c.otherUid === uid; });
      var fullProfile = (await HMM.authService.getUserProfile(uid)) || {
        uid: uid,
        name: (summary && summary.otherName) || "HMM Member",
        username: (summary && summary.otherUsername) || "member",
        avatarUrl: (summary && summary.otherAvatarUrl) || "",
        avatarColor: (summary && summary.otherAvatarColor) || "#006A4E",
      };
      openConversation(fullProfile);
    });

    filterInput.addEventListener("input", renderThreadList);

    document.getElementById("btn-new-chat").addEventListener("click", function () {
      U.openModal(
        "Start a new chat",
        '<div class="form-group" style="margin-bottom:12px;">' +
          '<input id="new-chat-search" class="form-input" type="search" placeholder="Search by name or @username..." /></div>' +
          '<div id="new-chat-results" style="max-height:320px;overflow-y:auto;"><p class="text-muted" style="font-size:13px;">Loading people...</p></div>',
        function (body, close) {
          var resultsEl = body.querySelector("#new-chat-results");
          var inputEl = body.querySelector("#new-chat-search");

          function renderPickList(users) {
            if (users.length === 0) {
              resultsEl.innerHTML = '<p class="text-muted" style="font-size:13px;">No users found.</p>';
              return;
            }
            resultsEl.innerHTML = users
              .map(function (u) {
                return (
                  '<div class="user-row"><div class="user-row-left">' +
                  U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm" }) +
                  '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u.name) + "</span>" +
                  '<span class="user-row-handle">@' + U.escapeHtml(u.username) + "</span></div></div>" +
                  '<button type="button" class="btn btn-primary btn-sm" data-pick-uid="' + U.escapeHtml(u.uid) + '">Chat</button></div>'
                );
              })
              .join("");

            resultsEl.querySelectorAll("[data-pick-uid]").forEach(function (btn) {
              btn.addEventListener("click", function () {
                var chosen = users.find(function (u) { return u.uid === btn.dataset.pickUid; });
                if (chosen) {
                  close();
                  openConversation(chosen);
                }
              });
            });
          }

          HMM.authService.getSuggestedUsers(ctx.user.uid, 10).then(renderPickList).catch(function () {});

          var timer = null;
          inputEl.addEventListener("input", function () {
            clearTimeout(timer);
            timer = setTimeout(async function () {
              var q = inputEl.value.trim();
              var list = q
                ? await HMM.authService.searchUsers(q, ctx.user.uid)
                : await HMM.authService.getSuggestedUsers(ctx.user.uid, 10);
              renderPickList(list);
            }, 260);
          });
        }
      );
    });

    var myChatsRef = HMM.rtdb.ref("userChats/" + ctx.user.uid);
    var myChatsCb = function (snap) {
      var val = snap.val();
      chatList = val
        ? Object.values(val).sort(function (a, b) { return (b.lastMessageTime || 0) - (a.lastMessageTime || 0); })
        : [];
      chatList.forEach(function (c) { watchPresenceFor(c.otherUid); });
      renderThreadList();
    };
    myChatsRef.on("value", myChatsCb);

    ctx.onCleanup(function () {
      myChatsRef.off("value", myChatsCb);
      detachActiveListeners();
      presenceListeners.forEach(function (entry) {
        entry.ref.off("value", entry.cb);
      });
      presenceListeners.clear();
    });

    var targetUid = params.get("uid");
    if (targetUid && targetUid !== ctx.user.uid) {
      var target = await HMM.authService.getUserProfile(targetUid);
      if (target) openConversation(target);
    }
  }

  HMM.chat = { mountView: mountChatView };
})(window.HMM = window.HMM || {});
