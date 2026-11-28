/**
 * KLORIX (window.HMM) — Real-Time Text Messenger (1-to-1 Direct & Multi-Member Group Chat)
 * 100% Text-Only (zero voice note or audio/video call code).
 * Includes Two-Way User Block/Unblock directly from Chat Header + Live Presence + Read Receipts.
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  // ============================================================================
  // DIRECT 1-TO-1 TEXT MESSAGING (With Two-Way Block Enforcement)
  // ============================================================================
  async function sendDirectMessage(params) {
    var sender = params.sender;
    var recipient = params.recipient;
    if (!recipient || sender.uid === recipient.uid) {
      throw new Error("You cannot message yourself.");
    }
    if (HMM.blocks && HMM.blocks.isBlockedByMe(recipient.uid)) {
      throw new Error("You have blocked this user. Unblock them to send messages.");
    }
    if (HMM.blocks && HMM.blocks.hasBlockedMe(recipient.uid)) {
      throw new Error("You cannot message this user.");
    }

    var text = U.sanitizeText(params.rawText, U.LIMITS.MESSAGE_TEXT_MAX);
    if (!text) throw new Error("Message cannot be empty.");

    var chatId = U.getPairId(sender.uid, recipient.uid);
    var now = Date.now();

    var chatUpdate = {
      type: "direct",
      lastMessage: text,
      lastMessageTime: now,
      lastSenderId: sender.uid,
      lastSenderName: sender.name,
    };
    chatUpdate["participants/" + sender.uid] = true;
    chatUpdate["participants/" + recipient.uid] = true;
    chatUpdate["participantNames/" + sender.uid] = sender.name;
    chatUpdate["participantNames/" + recipient.uid] = recipient.name;
    await HMM.rtdb.ref("chats/" + chatId).update(chatUpdate);

    await HMM.rtdb.ref("messages/" + chatId).push({
      senderId: sender.uid,
      senderName: sender.name,
      text: text,
      createdAt: now,
      read: false,
    });

    await Promise.all([
      HMM.rtdb.ref("userChats/" + sender.uid + "/" + chatId).update({
        chatId: chatId,
        type: "direct",
        otherUid: recipient.uid,
        name: recipient.name,
        otherName: recipient.name,
        otherUsername: recipient.username || "",
        avatarUrl: recipient.avatarUrl || "",
        otherAvatarUrl: recipient.avatarUrl || "",
        avatarColor: recipient.avatarColor || "#006A4E",
        otherAvatarColor: recipient.avatarColor || "#006A4E",
        lastMessage: text,
        lastMessageTime: now,
        lastSenderId: sender.uid,
        lastSenderName: sender.name,
        unreadCount: 0,
      }),
      HMM.rtdb.ref("userChats/" + recipient.uid + "/" + chatId).update({
        chatId: chatId,
        type: "direct",
        otherUid: sender.uid,
        name: sender.name,
        otherName: sender.name,
        otherUsername: sender.username || "",
        avatarUrl: sender.avatarUrl || "",
        otherAvatarUrl: sender.avatarUrl || "",
        avatarColor: sender.avatarColor || "#006A4E",
        otherAvatarColor: sender.avatarColor || "#006A4E",
        lastMessage: text,
        lastMessageTime: now,
        lastSenderId: sender.uid,
        lastSenderName: sender.name,
        unreadCount: HMM.rtdbIncrement(1),
      }),
    ]);

    U.createNotificationRecord({
      recipientId: recipient.uid,
      sender: sender,
      type: "message",
      referenceId: sender.uid,
      message: sender.name + " sent you a message.",
    });
  }

  // ============================================================================
  // GROUP CHAT CREATION & REAL-TIME GROUP TEXT MESSAGING
  // ============================================================================
  async function createGroupChat(params) {
    var creator = params.creator;
    var members = (params.members || []).filter(function (m) {
      return m && m.uid && m.uid !== creator.uid && !(HMM.blocks && HMM.blocks.isEitherBlocked(m.uid));
    });
    var groupName = U.sanitizeText(params.name, U.LIMITS.GROUP_NAME_MAX);
    if (!groupName || groupName.length < 2) {
      throw new Error("Group name must be at least 2 characters.");
    }
    if (members.length < 1) {
      throw new Error("Select at least 1 friend to create a group chat.");
    }

    var avatarUrl = String(params.avatarUrl || "").trim();
    if (avatarUrl) {
      var err = U.validateOptionalUrl(avatarUrl);
      if (err) throw new Error(err);
    }
    var avatarColor = params.avatarColor || U.pickAvatarColor(groupName);
    var groupId = U.generateId("grp");
    var now = Date.now();
    var allMembers = [creator].concat(members);

    var participants = {};
    var participantNames = {};
    allMembers.forEach(function (m) {
      participants[m.uid] = true;
      participantNames[m.uid] = m.name;
    });

    var introText = creator.name + ' created the group "' + groupName + '".';

    await HMM.rtdb.ref("chats/" + groupId).set({
      type: "group",
      name: groupName,
      avatarUrl: avatarUrl,
      avatarColor: avatarColor,
      createdBy: creator.uid,
      createdAt: now,
      participants: participants,
      participantNames: participantNames,
      lastMessage: introText,
      lastMessageTime: now,
      lastSenderId: creator.uid,
      lastSenderName: creator.name,
    });

    await HMM.rtdb.ref("messages/" + groupId).push({
      senderId: creator.uid,
      senderName: creator.name,
      text: introText,
      createdAt: now,
      read: true,
    });

    await Promise.all(
      allMembers.map(function (m) {
        return HMM.rtdb.ref("userChats/" + m.uid + "/" + groupId).set({
          chatId: groupId,
          type: "group",
          otherUid: "",
          name: groupName,
          otherName: groupName,
          otherUsername: "",
          avatarUrl: avatarUrl,
          otherAvatarUrl: avatarUrl,
          avatarColor: avatarColor,
          otherAvatarColor: avatarColor,
          memberCount: allMembers.length,
          lastMessage: introText,
          lastMessageTime: now,
          lastSenderId: creator.uid,
          lastSenderName: creator.name,
          unreadCount: m.uid === creator.uid ? 0 : 1,
        });
      })
    );

    return {
      chatId: groupId,
      type: "group",
      name: groupName,
      avatarUrl: avatarUrl,
      avatarColor: avatarColor,
      participants: participants,
      participantNames: participantNames,
      memberCount: allMembers.length,
    };
  }

  async function sendGroupMessage(params) {
    var sender = params.sender;
    var group = params.group;
    var text = U.sanitizeText(params.rawText, U.LIMITS.MESSAGE_TEXT_MAX);
    if (!text) throw new Error("Message cannot be empty.");

    var chatId = group.chatId;
    var now = Date.now();
    var participantUids = Object.keys(group.participants || {}).filter(function (uid) {
      return group.participants[uid] === true;
    });
    if (participantUids.indexOf(sender.uid) === -1) {
      participantUids.push(sender.uid);
    }

    await HMM.rtdb.ref("chats/" + chatId).update({
      lastMessage: text,
      lastMessageTime: now,
      lastSenderId: sender.uid,
      lastSenderName: sender.name,
    });

    await HMM.rtdb.ref("messages/" + chatId).push({
      senderId: sender.uid,
      senderName: sender.name,
      text: text,
      createdAt: now,
      read: false,
    });

    await Promise.all(
      participantUids.map(function (uid) {
        var payload = {
          chatId: chatId,
          type: "group",
          otherUid: "",
          name: group.name,
          otherName: group.name,
          otherUsername: "",
          avatarUrl: group.avatarUrl || "",
          otherAvatarUrl: group.avatarUrl || "",
          avatarColor: group.avatarColor || "#006A4E",
          otherAvatarColor: group.avatarColor || "#006A4E",
          memberCount: participantUids.length,
          lastMessage: text,
          lastMessageTime: now,
          lastSenderId: sender.uid,
          lastSenderName: sender.name,
          unreadCount: uid === sender.uid ? 0 : HMM.rtdbIncrement(1),
        };
        return HMM.rtdb.ref("userChats/" + uid + "/" + chatId).update(payload).catch(function () {});
      })
    );
  }

  async function markChatAsRead(chatId, myUid, messages, isGroup) {
    var updates = {};
    if (!isGroup) {
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.senderId !== myUid && !m.read) {
          updates["messages/" + chatId + "/" + m.messageId + "/read"] = true;
        }
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

  // ============================================================================
  // MESSENGER VIEW CONTROLLER (#messages)
  // ============================================================================
  async function mountChatView(ctx, params) {
    var chatList = [];
    var activeThread = null;
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
      '<div class="chat-sidebar-title-row"><h2>Messenger</h2>' +
      '<div class="chat-header-btns">' +
      '<button type="button" id="btn-new-group" class="btn btn-secondary btn-sm" title="Create Group Chat">' + U.ICONS.usersPlus + "<span>Group</span></button>" +
      '<button type="button" id="btn-new-chat" class="btn btn-primary btn-sm">New chat</button>' +
      "</div></div>" +
      '<input id="chat-filter-input" class="form-input" type="search" placeholder="Search chats or groups..." style="height:36px;font-size:13.5px;" />' +
      '</div><div class="chat-thread-list" id="chat-thread-list">' +
      '<div class="empty-state" style="padding:24px 12px;"><div class="spinner"></div></div></div></aside>' +
      '<div class="chat-main" id="chat-main-pane"><div class="chat-empty-pane">' +
      '<div class="empty-state-icon">' + U.ICONS.message + "</div>" +
      '<h3>Real-Time Text Messenger</h3><p>Select a conversation, start a private chat, or create a group chat with your friends.</p>' +
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
      pRef.on("value", cb, function () {});
      presenceListeners.set(uid, { ref: pRef, cb: cb });
    }

    function renderThreadList() {
      var term = (filterInput ? filterInput.value : "").trim().toLowerCase();
      var filtered = term
        ? chatList.filter(function (c) {
            var label = String(c.name || c.otherName || "").toLowerCase();
            var handle = String(c.otherUsername || "").toLowerCase();
            return label.indexOf(term) !== -1 || handle.indexOf(term) !== -1;
          })
        : chatList;

      if (filtered.length === 0) {
        threadListEl.innerHTML =
          '<div class="empty-state" style="padding:28px 12px;"><p style="font-size:13px;">' +
          (term ? "No matching chats." : "No conversations yet. Start a new chat or group!") +
          "</p></div>";
        return;
      }

      var activeId = activeThread ? activeThread.chatId : null;
      threadListEl.innerHTML = filtered
        .map(function (c) {
          var isGroup = c.type === "group" || String(c.chatId || "").indexOf("grp_") === 0;
          var isActive = c.chatId === activeId;
          var isBlocked = !isGroup && c.otherUid && HMM.blocks && HMM.blocks.isBlockedByMe(c.otherUid);
          var displayName = c.name || c.otherName || (isGroup ? "Group Chat" : "KLORIX Member");
          var avatarUrl = c.avatarUrl || c.otherAvatarUrl || "";
          var avatarColor = c.avatarColor || c.otherAvatarColor || "#006A4E";
          var p = !isGroup && c.otherUid && !isBlocked ? presenceMap.get(c.otherUid) : null;
          var previewPrefix =
            c.lastSenderId === ctx.user.uid
              ? "You: "
              : isGroup && c.lastSenderName
              ? c.lastSenderName.split(" ")[0] + ": "
              : "";

          var otherVerified = !isGroup && c.otherUid && U.isVerifiedUser({ uid: c.otherUid });
          return (
            '<button type="button" class="chat-thread-item ' + (isActive ? "active" : "") +
            '" data-open-chat="' + U.escapeHtml(c.chatId) + '" data-chat-type="' + (isGroup ? "group" : "direct") +
            '" data-open-uid="' + U.escapeHtml(c.otherUid || "") + '">' +
            U.renderAvatarHtml({
              name: displayName,
              avatarUrl: avatarUrl,
              avatarColor: avatarColor,
              size: "md",
              online: isGroup || isBlocked ? undefined : p ? p.online : false,
              isVerified: otherVerified,
            }) +
            '<div class="chat-thread-meta"><div class="chat-thread-top">' +
            '<span class="chat-thread-name name-with-badge">' + U.escapeHtml(displayName) +
            (otherVerified ? " " + U.renderVerifiedBadgeHtml({ uid: c.otherUid }, "compact") : "") +
            (isGroup ? ' <span class="chat-group-tag">Group</span>' : "") +
            (isBlocked ? ' <span class="chat-blocked-tag">Blocked</span>' : "") + "</span>" +
            '<span class="chat-thread-time">' + U.escapeHtml(U.formatRelativeTime(c.lastMessageTime)) + "</span></div>" +
            '<div class="chat-thread-bottom"><span class="chat-thread-preview">' +
            U.escapeHtml(previewPrefix + (c.lastMessage || "")) + "</span>" +
            (c.unreadCount > 0 ? '<span class="chat-unread-badge">' + (c.unreadCount > 99 ? "99+" : c.unreadCount) + "</span>" : "") +
            "</div></div></button>"
          );
        })
        .join("");
    }

    function renderActiveHeaderPresence() {
      var el = document.getElementById("chat-active-presence");
      if (!el || !activeThread || activeThread.type !== "direct") return;
      if (HMM.blocks && HMM.blocks.isEitherBlocked(activeThread.recipient.uid)) {
        el.textContent = HMM.blocks.isBlockedByMe(activeThread.recipient.uid) ? "Blocked" : "Unavailable";
        el.style.color = "var(--crimson)";
        return;
      }
      el.textContent = U.formatPresenceLabel(activePresence.online, activePresence.lastSeen);
      el.style.color = activePresence.online ? "var(--accent)" : "var(--text-muted)";
    }

    function renderMessages(messages) {
      var scrollEl = document.getElementById("chat-messages-scroll");
      if (!scrollEl || !activeThread) return;
      if (messages.length === 0) {
        var targetName = activeThread.type === "group" ? activeThread.group.name : activeThread.recipient.name;
        scrollEl.innerHTML =
          '<div class="chat-empty-pane"><p>No messages yet. Say hello to ' + U.escapeHtml(targetName) + "!</p></div>";
        return;
      }

      var isGroup = activeThread.type === "group";
      var namesMap = (isGroup && activeThread.group.participantNames) || {};

      scrollEl.innerHTML = messages
        .map(function (m) {
          var mine = m.senderId === ctx.user.uid;
          var senderLabel = !mine && isGroup ? m.senderName || namesMap[m.senderId] || "Member" : "";
          return (
            '<div class="msg-row ' + (mine ? "mine" : "theirs") + '">' +
            (senderLabel
              ? '<a href="#profile?uid=' + encodeURIComponent(m.senderId) + '" class="msg-sender-name">' + U.escapeHtml(senderLabel) + "</a>"
              : "") +
            '<div class="msg-bubble">' + U.linkifyText(m.text) + "</div>" +
            '<div class="msg-meta"><span>' + U.escapeHtml(U.formatMessageTime(m.createdAt)) + "</span>" +
            (mine && !isGroup
              ? '<span class="msg-read-tick" title="' + (m.read ? "Read" : "Sent") + '">' + (m.read ? "✓✓" : "✓") + "</span>"
              : "") +
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

    function attachMessageStream(chatId, isGroup) {
      activeMsgRef = HMM.rtdb.ref("messages/" + chatId).limitToLast(120);
      activeMsgCb = function (snap) {
        var val = snap.val();
        var list = val
          ? Object.keys(val)
              .map(function (messageId) {
                var m = val[messageId];
                return {
                  messageId: messageId,
                  senderId: m.senderId,
                  senderName: m.senderName || "",
                  text: m.text || "",
                  createdAt: m.createdAt || 0,
                  read: Boolean(m.read),
                };
              })
              .sort(function (a, b) { return a.createdAt - b.createdAt; })
          : [];
        renderMessages(list);
        markChatAsRead(chatId, ctx.user.uid, list, isGroup);
      };
      activeMsgRef.on("value", activeMsgCb, function (err) {
        var scrollEl = document.getElementById("chat-messages-scroll");
        if (scrollEl) {
          scrollEl.innerHTML =
            '<div class="chat-empty-pane"><p class="text-danger">' +
            U.escapeHtml(U.getFriendlyErrorMessage(err, "Unable to load messages. Check Firebase Realtime Database rules.")) +
            "</p></div>";
        }
      });
    }

    function renderDirectComposerArea(recipientProfile) {
      var footerEl = document.getElementById("chat-composer-slot");
      var blockBtn = document.getElementById("btn-chat-block-toggle");
      if (!footerEl) return;

      var iBlocked = HMM.blocks && HMM.blocks.isBlockedByMe(recipientProfile.uid);
      var theyBlocked = HMM.blocks && HMM.blocks.hasBlockedMe(recipientProfile.uid);

      if (blockBtn) {
        blockBtn.innerHTML = U.ICONS.ban + (iBlocked ? "<span>Unblock</span>" : "<span>Block</span>");
        blockBtn.className = iBlocked ? "btn btn-secondary btn-sm" : "btn btn-danger-soft btn-sm";
      }

      if (iBlocked) {
        footerEl.innerHTML =
          '<div class="chat-blocked-banner">' +
          '<div class="chat-blocked-text">' + U.ICONS.ban +
          "<span>You blocked <strong>" + U.escapeHtml(recipientProfile.name) + "</strong>. Unblock to resume chatting.</span></div>" +
          '<button type="button" id="btn-chat-banner-unblock" class="btn btn-secondary btn-sm">Unblock</button></div>';
        var unbBtn = document.getElementById("btn-chat-banner-unblock");
        if (unbBtn) {
          unbBtn.addEventListener("click", async function () {
            unbBtn.disabled = true;
            try {
              await HMM.blocks.unblockUser(ctx.user.uid, recipientProfile.uid);
              U.showToast("Unblocked " + recipientProfile.name + ".", "success");
            } catch (err) {
              U.showToast(U.getFriendlyErrorMessage(err), "error");
              unbBtn.disabled = false;
            }
          });
        }
        return;
      }

      if (theyBlocked) {
        footerEl.innerHTML =
          '<div class="chat-blocked-banner">' +
          '<div class="chat-blocked-text">' + U.ICONS.ban +
          "<span>You cannot reply to this conversation right now.</span></div></div>";
        return;
      }

      footerEl.innerHTML =
        '<form class="chat-composer" id="chat-send-form">' +
        '<input id="chat-message-input" type="text" maxlength="' + U.LIMITS.MESSAGE_TEXT_MAX + '" placeholder="Type a message..." autocomplete="off" required />' +
        '<button type="submit" id="chat-send-btn" class="btn btn-primary">' + U.ICONS.send + "<span>Send</span></button></form>";

      document.getElementById("chat-send-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var input = document.getElementById("chat-message-input");
        var btn = document.getElementById("chat-send-btn");
        if (!input || !input.value.trim()) return;
        var text = input.value;
        input.value = "";
        btn.disabled = true;
        try {
          await sendDirectMessage({ sender: ctx.profile, recipient: recipientProfile, rawText: text });
        } catch (err) {
          input.value = text;
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          btn.disabled = false;
          input.focus();
        }
      });
    }

    function openDirectConversation(recipientProfile) {
      if (!recipientProfile || recipientProfile.uid === ctx.user.uid) return;
      var chatId = U.getPairId(ctx.user.uid, recipientProfile.uid);
      activeThread = { type: "direct", chatId: chatId, recipient: recipientProfile };
      chatShell.classList.add("thread-open");
      renderThreadList();
      detachActiveListeners();

      var isAdm = U.isOfficialAdminUser(recipientProfile);
      var isVer = isAdm || U.isVerifiedUser(recipientProfile);
      var iBlocked = HMM.blocks && HMM.blocks.isBlockedByMe(recipientProfile.uid);

      mainPaneEl.innerHTML =
        '<div class="chat-main-header"><div class="chat-main-user">' +
        '<button type="button" class="icon-btn chat-back-btn" id="chat-mobile-back" aria-label="Back to chats">' + U.ICONS.back + "</button>" +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '">' +
        U.renderAvatarHtml({ name: recipientProfile.name, avatarUrl: recipientProfile.avatarUrl, avatarColor: recipientProfile.avatarColor, size: "sm", isAdmin: isAdm, isVerified: isVer }) +
        '</a><div style="min-width:0;">' +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '" class="user-row-name name-with-badge">' +
        U.escapeHtml(recipientProfile.name) + (isVer ? " " + U.renderVerifiedBadgeHtml(recipientProfile, "compact") : "") + "</a>" +
        '<div id="chat-active-presence" style="font-size:12px;color:var(--text-muted);">Checking status...</div></div></div>' +
        '<div class="chat-main-actions">' +
        '<button type="button" id="btn-chat-block-toggle" class="btn ' + (iBlocked ? "btn-secondary" : "btn-danger-soft") + ' btn-sm">' +
        U.ICONS.ban + "<span>" + (iBlocked ? "Unblock" : "Block") + "</span></button>" +
        '<a href="#profile?uid=' + encodeURIComponent(recipientProfile.uid) + '" class="btn btn-secondary btn-sm">Profile</a>' +
        "</div></div>" +
        '<div class="chat-messages-scroll" id="chat-messages-scroll"><div class="chat-empty-pane"><div class="spinner"></div></div></div>' +
        '<div id="chat-composer-slot"></div>';

      document.getElementById("chat-mobile-back").addEventListener("click", function () {
        chatShell.classList.remove("thread-open");
      });

      document.getElementById("btn-chat-block-toggle").addEventListener("click", async function () {
        var currentlyBlocked = HMM.blocks && HMM.blocks.isBlockedByMe(recipientProfile.uid);
        if (currentlyBlocked) {
          try {
            await HMM.blocks.unblockUser(ctx.user.uid, recipientProfile.uid);
            U.showToast("Unblocked " + recipientProfile.name + ".", "success");
          } catch (err) {
            U.showToast(U.getFriendlyErrorMessage(err), "error");
          }
          return;
        }
        U.openModal(
          "Block " + recipientProfile.name + "?",
          '<p style="font-size:14px;line-height:1.6;">Blocking <strong>' + U.escapeHtml(recipientProfile.name) + "</strong> (@" +
            U.escapeHtml(recipientProfile.username) + ") will immediately:</p>" +
            '<ul style="font-size:13.5px;color:var(--text-muted);margin:10px 0 16px 18px;line-height:1.6;">' +
            "<li>Stop messages between you and this user</li>" +
            "<li>Hide each other's posts, comments, and profiles</li>" +
            "<li>Remove friendship, pending requests, and follows</li></ul>" +
            '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button type="button" id="blk-cancel" class="btn btn-secondary">Cancel</button>' +
            '<button type="button" id="blk-confirm" class="btn btn-danger">' + U.ICONS.ban + " Block User</button></div>",
          function (body, close) {
            body.querySelector("#blk-cancel").addEventListener("click", close);
            body.querySelector("#blk-confirm").addEventListener("click", async function (ev) {
              ev.currentTarget.disabled = true;
              try {
                await HMM.blocks.blockUser(ctx.profile, recipientProfile);
                U.showToast("Blocked " + recipientProfile.name + ".", "success");
                close();
              } catch (err) {
                U.showToast(U.getFriendlyErrorMessage(err), "error");
                ev.currentTarget.disabled = false;
              }
            });
          }
        );
      });

      renderDirectComposerArea(recipientProfile);

      activePresRef = HMM.rtdb.ref("presence/" + recipientProfile.uid);
      activePresCb = function (snap) {
        var val = snap.val();
        activePresence = {
          online: Boolean(val && val.online),
          lastSeen: val && typeof val.lastSeen === "number" ? val.lastSeen : 0,
        };
        renderActiveHeaderPresence();
      };
      activePresRef.on("value", activePresCb, function () {});

      attachMessageStream(chatId, false);
    }

    async function openGroupConversation(groupSummary) {
      if (!groupSummary || !groupSummary.chatId) return;
      var chatId = groupSummary.chatId;
      var groupData = Object.assign({}, groupSummary);

      try {
        var snap = await HMM.rtdb.ref("chats/" + chatId).once("value");
        if (snap.exists() && snap.val()) {
          groupData = Object.assign(groupData, snap.val(), { chatId: chatId, type: "group" });
        }
      } catch (e) {}

      var memberUids = Object.keys(groupData.participants || {}).filter(function (k) {
        return groupData.participants[k] === true;
      });
      var memberCount = memberUids.length || groupData.memberCount || 2;

      activeThread = { type: "group", chatId: chatId, group: groupData };
      chatShell.classList.add("thread-open");
      renderThreadList();
      detachActiveListeners();

      mainPaneEl.innerHTML =
        '<div class="chat-main-header"><div class="chat-main-user">' +
        '<button type="button" class="icon-btn chat-back-btn" id="chat-mobile-back" aria-label="Back to chats">' + U.ICONS.back + "</button>" +
        U.renderAvatarHtml({ name: groupData.name, avatarUrl: groupData.avatarUrl, avatarColor: groupData.avatarColor, size: "sm" }) +
        '<div style="min-width:0;">' +
        '<div class="user-row-name">' + U.escapeHtml(groupData.name || "Group Chat") + ' <span class="chat-group-tag">Group</span></div>' +
        '<div style="font-size:12px;color:var(--text-muted);">' + memberCount + " members</div></div></div>" +
        '<button type="button" id="btn-group-members" class="btn btn-secondary btn-sm">' + U.ICONS.users + " Members</button></div>" +
        '<div class="chat-messages-scroll" id="chat-messages-scroll"><div class="chat-empty-pane"><div class="spinner"></div></div></div>' +
        '<form class="chat-composer" id="chat-send-form">' +
        '<input id="chat-message-input" type="text" maxlength="' + U.LIMITS.MESSAGE_TEXT_MAX + '" placeholder="Message ' + U.escapeHtml(groupData.name || "group") + '..." autocomplete="off" required />' +
        '<button type="submit" id="chat-send-btn" class="btn btn-primary">' + U.ICONS.send + "<span>Send</span></button></form>";

      document.getElementById("chat-mobile-back").addEventListener("click", function () {
        chatShell.classList.remove("thread-open");
      });

      document.getElementById("btn-group-members").addEventListener("click", function () {
        var names = groupData.participantNames || {};
        var html =
          '<div style="max-height:340px;overflow-y:auto;">' +
          memberUids
            .map(function (uid) {
              var n = names[uid] || "KLORIX Member";
              return (
                '<div class="user-row"><a href="#profile?uid=' + encodeURIComponent(uid) + '" class="user-row-left" data-close-m="1">' +
                U.renderAvatarHtml({ name: n, avatarColor: U.pickAvatarColor(uid), size: "sm" }) +
                '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(n) +
                (uid === ctx.user.uid ? ' <span class="text-muted" style="font-weight:500;">(You)</span>' : "") +
                "</span></div></a>" +
                '<a href="#profile?uid=' + encodeURIComponent(uid) + '" class="btn btn-secondary btn-sm" data-close-m="1">Profile</a></div>'
              );
            })
            .join("") +
          "</div>";
        U.openModal("Group Members (" + memberUids.length + ")", html, function (body, close) {
          body.querySelectorAll("[data-close-m]").forEach(function (a) { a.addEventListener("click", close); });
        });
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
          await sendGroupMessage({ sender: ctx.profile, group: activeThread.group, rawText: text });
        } catch (err) {
          input.value = text;
          U.showToast(U.getFriendlyErrorMessage(err), "error");
        } finally {
          btn.disabled = false;
          input.focus();
        }
      });

      attachMessageStream(chatId, true);
    }

    function openCreateGroupModal() {
      var selectedUsers = new Map();
      var selectedColor = U.AVATAR_COLORS[0];
      var uploadedAvatarDataUrl = "";
      var allCandidates = [];

      var swatchesHtml = U.AVATAR_COLORS.map(function (c) {
        return (
          '<button type="button" class="color-swatch ' + (c === selectedColor ? "active" : "") +
          '" data-gcolor="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '"></button>'
        );
      }).join("");

      U.openModal(
        "Create Group Chat",
        '<form id="create-group-form" class="auth-form">' +
          '<div class="form-group"><label class="form-label" for="grp-name">Group name</label>' +
          '<input id="grp-name" class="form-input" type="text" required minlength="2" maxlength="' + U.LIMITS.GROUP_NAME_MAX + '" placeholder="e.g., Dhaka Friends, Study Group" /></div>' +
          '<div class="form-group"><label class="form-label">Group avatar (optional)</label>' +
          '<div class="group-avatar-row">' +
          '<div id="grp-avatar-preview">' + U.renderAvatarHtml({ name: "GC", avatarColor: selectedColor, size: "md" }) + "</div>" +
          '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' +
          '<input id="grp-avatar-url" class="form-input" type="url" placeholder="Paste image URL or upload below..." />' +
          '<input id="grp-avatar-file" type="file" accept="image/*" style="font-size:12.5px;" />' +
          "</div></div></div>" +
          '<div class="form-group"><label class="form-label">Group color</label><div class="color-swatches" id="grp-swatches">' + swatchesHtml + "</div></div>" +
          '<div class="form-group"><label class="form-label">Select friends &amp; members</label>' +
          '<div id="grp-selected-chips" class="selected-chips"></div>' +
          '<input id="grp-member-search" class="form-input" type="search" placeholder="Search friends by name or @username..." />' +
          '<div id="grp-member-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:6px;margin-top:6px;">' +
          '<p class="text-muted" style="font-size:13px;padding:8px;">Loading people...</p></div></div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" id="grp-cancel">Cancel</button>' +
          '<button type="submit" class="btn btn-primary" id="grp-submit">Create Group</button></div></form>',
        function (body, close) {
          var nameInput = body.querySelector("#grp-name");
          var urlInput = body.querySelector("#grp-avatar-url");
          var fileInput = body.querySelector("#grp-avatar-file");
          var previewEl = body.querySelector("#grp-avatar-preview");
          var chipsEl = body.querySelector("#grp-selected-chips");
          var searchEl = body.querySelector("#grp-member-search");
          var listEl = body.querySelector("#grp-member-list");

          function updatePreview() {
            previewEl.innerHTML = U.renderAvatarHtml({
              name: nameInput.value.trim() || "GC",
              avatarUrl: uploadedAvatarDataUrl || urlInput.value.trim(),
              avatarColor: selectedColor,
              size: "md",
            });
          }

          function renderChips() {
            if (selectedUsers.size === 0) {
              chipsEl.innerHTML = '<span class="text-muted" style="font-size:12px;">No members selected yet</span>';
              return;
            }
            var html = "";
            selectedUsers.forEach(function (u) {
              html +=
                '<span class="member-chip">' + U.escapeHtml(u.name) +
                '<button type="button" data-remove-member="' + U.escapeHtml(u.uid) + '" aria-label="Remove">&times;</button></span>';
            });
            chipsEl.innerHTML = html;
          }

          function renderCandidates(users) {
            var clean = (users || []).filter(function (u) {
              return !(HMM.blocks && HMM.blocks.isEitherBlocked(u.uid));
            });
            if (clean.length === 0) {
              listEl.innerHTML = '<p class="text-muted" style="font-size:13px;padding:8px;">No matching users found.</p>';
              return;
            }
            listEl.innerHTML = clean
              .map(function (u) {
                var checked = selectedUsers.has(u.uid);
                return (
                  '<label class="group-member-pick">' +
                  '<input type="checkbox" data-pick-member="' + U.escapeHtml(u.uid) + '" ' + (checked ? "checked" : "") + " />" +
                  U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "xs" }) +
                  '<span class="group-member-pick-info"><strong>' + U.escapeHtml(u.name) + '</strong><span class="text-muted">@' + U.escapeHtml(u.username) + "</span></span>" +
                  "</label>"
                );
              })
              .join("");
          }

          nameInput.addEventListener("input", updatePreview);
          urlInput.addEventListener("input", function () { uploadedAvatarDataUrl = ""; updatePreview(); });
          fileInput.addEventListener("change", async function () {
            if (!fileInput.files || !fileInput.files[0]) return;
            try {
              uploadedAvatarDataUrl = await U.compressImageFileToDataUrl(fileInput.files[0], 160, 0.82);
              urlInput.value = "";
              updatePreview();
              U.showToast("Group icon ready!", "success");
            } catch (err) {
              U.showToast(err.message, "error");
            }
          });

          body.querySelector("#grp-swatches").addEventListener("click", function (e) {
            var b = e.target.closest("[data-gcolor]");
            if (!b) return;
            selectedColor = b.dataset.gcolor;
            body.querySelectorAll("[data-gcolor]").forEach(function (x) { x.classList.toggle("active", x === b); });
            updatePreview();
          });

          listEl.addEventListener("change", function (e) {
            var cb = e.target.closest("[data-pick-member]");
            if (!cb) return;
            var uid = cb.dataset.pickMember;
            var found = allCandidates.find(function (u) { return u.uid === uid; });
            if (cb.checked && found) selectedUsers.set(uid, found);
            else selectedUsers.delete(uid);
            renderChips();
          });

          chipsEl.addEventListener("click", function (e) {
            var rm = e.target.closest("[data-remove-member]");
            if (!rm) return;
            selectedUsers.delete(rm.dataset.removeMember);
            renderChips();
            renderCandidates(allCandidates);
          });

          body.querySelector("#grp-cancel").addEventListener("click", close);

          HMM.authService.getSuggestedUsers(ctx.user.uid, 30).then(function (list) {
            allCandidates = list;
            renderCandidates(list);
          }).catch(function () {});

          var t = null;
          searchEl.addEventListener("input", function () {
            clearTimeout(t);
            t = setTimeout(async function () {
              var q = searchEl.value.trim();
              var list = q
                ? await HMM.authService.searchUsers(q, ctx.user.uid)
                : await HMM.authService.getSuggestedUsers(ctx.user.uid, 30);
              allCandidates = list;
              renderCandidates(list);
            }, 240);
          });

          renderChips();

          body.querySelector("#create-group-form").addEventListener("submit", async function (e) {
            e.preventDefault();
            if (selectedUsers.size === 0) {
              U.showToast("Please select at least 1 member for the group.", "error");
              return;
            }
            var submitBtn = body.querySelector("#grp-submit");
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating...";
            try {
              var group = await createGroupChat({
                creator: ctx.profile,
                members: Array.from(selectedUsers.values()),
                name: nameInput.value,
                avatarUrl: uploadedAvatarDataUrl || urlInput.value.trim(),
                avatarColor: selectedColor,
              });
              close();
              U.showToast('Group "' + group.name + '" created!', "success");
              openGroupConversation(group);
            } catch (err) {
              U.showToast(U.getFriendlyErrorMessage(err), "error");
              submitBtn.disabled = false;
              submitBtn.textContent = "Create Group";
            }
          });
        }
      );
    }

    threadListEl.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-open-chat]");
      if (!btn) return;
      var chatId = btn.dataset.openChat;
      var type = btn.dataset.chatType;
      var summary = chatList.find(function (c) { return c.chatId === chatId; });

      if (type === "group") {
        openGroupConversation(summary || { chatId: chatId, type: "group", name: "Group Chat" });
        return;
      }

      var uid = btn.dataset.openUid;
      var fullProfile = (await HMM.authService.getUserProfile(uid)) || {
        uid: uid,
        name: (summary && (summary.name || summary.otherName)) || "KLORIX Member",
        username: (summary && summary.otherUsername) || "member",
        avatarUrl: (summary && (summary.avatarUrl || summary.otherAvatarUrl)) || "",
        avatarColor: (summary && (summary.avatarColor || summary.otherAvatarColor)) || "#006A4E",
      };
      openDirectConversation(fullProfile);
    });

    filterInput.addEventListener("input", renderThreadList);
    document.getElementById("btn-new-group").addEventListener("click", openCreateGroupModal);

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
            var clean = (users || []).filter(function (u) {
              return !(HMM.blocks && HMM.blocks.isEitherBlocked(u.uid));
            });
            if (clean.length === 0) {
              resultsEl.innerHTML = '<p class="text-muted" style="font-size:13px;">No users found.</p>';
              return;
            }
            resultsEl.innerHTML = clean
              .map(function (u) {
                var isAdm = U.isOfficialAdminUser(u);
                var isVer = isAdm || U.isVerifiedUser(u);
                return (
                  '<div class="user-row"><div class="user-row-left">' +
                  U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "sm", isAdmin: isAdm, isVerified: isVer }) +
                  '<div class="user-row-meta"><span class="user-row-name name-with-badge">' + U.escapeHtml(u.name) +
                  (isVer ? " " + U.renderVerifiedBadgeHtml(u, "compact") : "") + "</span>" +
                  '<span class="user-row-handle">@' + U.escapeHtml(u.username) + "</span></div></div>" +
                  '<button type="button" class="btn btn-primary btn-sm" data-pick-uid="' + U.escapeHtml(u.uid) + '">Chat</button></div>'
                );
              })
              .join("");

            resultsEl.querySelectorAll("[data-pick-uid]").forEach(function (btn) {
              btn.addEventListener("click", function () {
                var chosen = clean.find(function (u) { return u.uid === btn.dataset.pickUid; });
                if (chosen) {
                  close();
                  openDirectConversation(chosen);
                }
              });
            });
          }

          HMM.authService.getSuggestedUsers(ctx.user.uid, 12).then(renderPickList).catch(function () {});

          var timer = null;
          inputEl.addEventListener("input", function () {
            clearTimeout(timer);
            timer = setTimeout(async function () {
              var q = inputEl.value.trim();
              var list = q
                ? await HMM.authService.searchUsers(q, ctx.user.uid)
                : await HMM.authService.getSuggestedUsers(ctx.user.uid, 12);
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
      chatList.forEach(function (c) {
        if (c.type !== "group" && c.otherUid) watchPresenceFor(c.otherUid);
      });
      renderThreadList();
    };
    myChatsRef.on("value", myChatsCb, function (err) {
      threadListEl.innerHTML =
        '<div class="empty-state" style="padding:20px 12px;"><p class="text-danger" style="font-size:13px;">' +
        U.escapeHtml(U.getFriendlyErrorMessage(err, "Unable to load conversations.")) +
        "</p></div>";
    });

    var unsubBlocks = HMM.blocks.subscribe(function () {
      renderThreadList();
      if (activeThread && activeThread.type === "direct") {
        renderDirectComposerArea(activeThread.recipient);
        renderActiveHeaderPresence();
      }
    });

    ctx.onCleanup(function () {
      myChatsRef.off("value", myChatsCb);
      if (unsubBlocks) unsubBlocks();
      detachActiveListeners();
      presenceListeners.forEach(function (entry) {
        entry.ref.off("value", entry.cb);
      });
      presenceListeners.clear();
    });

    var targetUid = params.get("uid");
    if (targetUid && targetUid !== ctx.user.uid) {
      var target = await HMM.authService.getUserProfile(targetUid);
      if (target) openDirectConversation(target);
    }
  }

  HMM.chat = { mountView: mountChatView };
})(window.HMM = window.HMM || {});
