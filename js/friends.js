/**
 * HMM HMM — Friends, Friend Requests & Follow/Unfollow Services + Friends View
 * Classic script (works directly via file:// and HTTP/HTTPS).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;

  function subscribeToSocialState(uid, onChange) {
    var state = {
      incomingRequests: [],
      outgoingRequests: [],
      friendships: [],
      following: [],
      followers: [],
      friendUids: new Set(),
      followingUids: new Set(),
      incomingBySender: new Map(),
      outgoingByReceiver: new Map(),
    };

    function emit() {
      state.friendUids = new Set(
        state.friendships.map(function (f) {
          return f.user1Id === uid ? f.user2Id : f.user1Id;
        })
      );
      state.followingUids = new Set(
        state.following.map(function (f) {
          return f.followingId;
        })
      );
      state.incomingBySender = new Map(
        state.incomingRequests.map(function (r) {
          return [r.senderId, r];
        })
      );
      state.outgoingByReceiver = new Map(
        state.outgoingRequests.map(function (r) {
          return [r.receiverId, r];
        })
      );
      onChange(Object.assign({}, state));
    }

    var unsubs = [
      HMM.db
        .collection("friendRequests")
        .where("receiverId", "==", uid)
        .limit(100)
        .onSnapshot(
          function (snap) {
            state.incomingRequests = snap.docs
              .map(function (d) { return d.data(); })
              .filter(function (r) { return r.status === "pending"; })
              .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
            emit();
          },
          function () {}
        ),
      HMM.db
        .collection("friendRequests")
        .where("senderId", "==", uid)
        .limit(100)
        .onSnapshot(
          function (snap) {
            state.outgoingRequests = snap.docs
              .map(function (d) { return d.data(); })
              .filter(function (r) { return r.status === "pending"; })
              .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
            emit();
          },
          function () {}
        ),
      HMM.db
        .collection("friendships")
        .where("participants", "array-contains", uid)
        .limit(200)
        .onSnapshot(
          function (snap) {
            state.friendships = snap.docs
              .map(function (d) { return d.data(); })
              .sort(function (a, b) { return U.timestampToMs(b.createdAt) - U.timestampToMs(a.createdAt); });
            emit();
          },
          function () {}
        ),
      HMM.db
        .collection("follows")
        .where("followerId", "==", uid)
        .limit(300)
        .onSnapshot(
          function (snap) {
            state.following = snap.docs.map(function (d) { return d.data(); });
            emit();
          },
          function () {}
        ),
      HMM.db
        .collection("follows")
        .where("followingId", "==", uid)
        .limit(300)
        .onSnapshot(
          function (snap) {
            state.followers = snap.docs.map(function (d) { return d.data(); });
            emit();
          },
          function () {}
        ),
    ];

    return function () {
      unsubs.forEach(function (u) { if (u) u(); });
    };
  }

  async function sendFriendRequest(me, target) {
    if (me.uid === target.uid) throw new Error("You cannot send a friend request to yourself.");
    if (target.friendRequestPref === "none") {
      throw new Error("This user is not accepting friend requests right now.");
    }

    var pairId = U.getPairId(me.uid, target.uid);
    var existingFriendship = await HMM.db.collection("friendships").doc(pairId).get();
    if (existingFriendship.exists) throw new Error("You are already friends.");

    var requestId = U.getFriendRequestId(me.uid, target.uid);
    var reqRef = HMM.db.collection("friendRequests").doc(requestId);
    var existingReq = await reqRef.get();
    if (existingReq.exists) {
      if (existingReq.data().status === "pending") throw new Error("Friend request already sent.");
      await reqRef.delete();
    }

    await reqRef.set({
      requestId: requestId,
      senderId: me.uid,
      receiverId: target.uid,
      status: "pending",
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });

    await U.createNotificationRecord({
      recipientId: target.uid,
      sender: me,
      type: "friend_request",
      referenceId: me.uid,
      message: me.name + " sent you a friend request.",
    });
  }

  async function cancelFriendRequest(senderId, receiverId) {
    var requestId = U.getFriendRequestId(senderId, receiverId);
    await HMM.db.collection("friendRequests").doc(requestId).update({
      status: "cancelled",
      updatedAt: HMM.serverTimestamp(),
    });
  }

  async function rejectFriendRequest(senderId, receiverId) {
    var requestId = U.getFriendRequestId(senderId, receiverId);
    await HMM.db.collection("friendRequests").doc(requestId).update({
      status: "rejected",
      updatedAt: HMM.serverTimestamp(),
    });
  }

  async function acceptFriendRequest(request, accepter) {
    var pairId = U.getPairId(request.senderId, request.receiverId);
    var pair = U.getSortedPair(request.senderId, request.receiverId);
    var batch = HMM.db.batch();

    batch.update(HMM.db.collection("friendRequests").doc(request.requestId), {
      status: "accepted",
      updatedAt: HMM.serverTimestamp(),
    });
    batch.set(HMM.db.collection("friendships").doc(pairId), {
      friendshipId: pairId,
      user1Id: pair[0],
      user2Id: pair[1],
      participants: [pair[0], pair[1]],
      createdAt: HMM.serverTimestamp(),
    });
    batch.update(HMM.db.collection("users").doc(request.senderId), {
      friendsCount: HMM.increment(1),
    });
    batch.update(HMM.db.collection("users").doc(request.receiverId), {
      friendsCount: HMM.increment(1),
    });
    await batch.commit();

    await U.createNotificationRecord({
      recipientId: request.senderId,
      sender: accepter,
      type: "friend_accepted",
      referenceId: accepter.uid,
      message: accepter.name + " accepted your friend request.",
    });
  }

  async function removeFriend(myUid, friendUid) {
    var pairId = U.getPairId(myUid, friendUid);
    var batch = HMM.db.batch();
    batch.delete(HMM.db.collection("friendships").doc(pairId));
    batch.update(HMM.db.collection("users").doc(myUid), { friendsCount: HMM.increment(-1) });
    batch.update(HMM.db.collection("users").doc(friendUid), { friendsCount: HMM.increment(-1) });
    await batch.commit();

    await Promise.all([
      HMM.db.collection("friendRequests").doc(U.getFriendRequestId(myUid, friendUid)).delete().catch(function () {}),
      HMM.db.collection("friendRequests").doc(U.getFriendRequestId(friendUid, myUid)).delete().catch(function () {}),
    ]);
  }

  async function followUser(me, targetUid) {
    if (me.uid === targetUid) throw new Error("You cannot follow yourself.");
    var followId = U.getFollowId(me.uid, targetUid);
    var existing = await HMM.db.collection("follows").doc(followId).get();
    if (existing.exists) return;

    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("follows").doc(followId), {
      followId: followId,
      followerId: me.uid,
      followingId: targetUid,
      createdAt: HMM.serverTimestamp(),
    });
    batch.update(HMM.db.collection("users").doc(me.uid), { followingCount: HMM.increment(1) });
    batch.update(HMM.db.collection("users").doc(targetUid), { followersCount: HMM.increment(1) });
    await batch.commit();

    await U.createNotificationRecord({
      recipientId: targetUid,
      sender: me,
      type: "follow",
      referenceId: me.uid,
      message: me.name + " started following you.",
    });
  }

  async function unfollowUser(myUid, targetUid) {
    var followId = U.getFollowId(myUid, targetUid);
    var existing = await HMM.db.collection("follows").doc(followId).get();
    if (!existing.exists) return;

    var batch = HMM.db.batch();
    batch.delete(HMM.db.collection("follows").doc(followId));
    batch.update(HMM.db.collection("users").doc(myUid), { followingCount: HMM.increment(-1) });
    batch.update(HMM.db.collection("users").doc(targetUid), { followersCount: HMM.increment(-1) });
    await batch.commit();
  }

  // ============================================================================
  // FRIENDS VIEW CONTROLLER
  // ============================================================================
  function mountFriendsView(ctx) {
    var activeTab = "friends";
    var socialState = null;
    var profileCache = new Map();

    ctx.mainEl.innerHTML =
      '<div class="page-header">' +
      '<div><h1 class="page-title">Friends &amp; Network</h1>' +
      '<p class="page-subtitle">Manage your friendships, incoming requests, and follows.</p></div>' +
      '<a href="#explore" class="btn btn-primary btn-sm">Find people</a>' +
      "</div>" +
      '<div class="card" style="padding-bottom:0;">' +
      '<div class="tabs" id="friends-tabs">' +
      '<button type="button" class="tab-btn active" data-tab="friends">Friends <span class="tab-count" id="cnt-friends">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="incoming">Requests <span class="tab-count" id="cnt-incoming">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="outgoing">Sent <span class="tab-count" id="cnt-outgoing">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="following">Following <span class="tab-count" id="cnt-following">0</span></button>' +
      '<button type="button" class="tab-btn" data-tab="followers">Followers <span class="tab-count" id="cnt-followers">0</span></button>' +
      "</div>" +
      '<div id="friends-list-container" style="padding:16px 0;"><p class="text-muted">Loading your network...</p></div>' +
      "</div>";

    async function loadMissingProfiles(uids) {
      var missing = uids.filter(function (id) { return id && !profileCache.has(id); });
      if (missing.length === 0) return;
      var users = await HMM.authService.getUsersByIds(missing);
      users.forEach(function (u) { profileCache.set(u.uid, u); });
    }

    async function renderTab() {
      if (!socialState) return;
      var container = document.getElementById("friends-list-container");
      if (!container) return;

      document.getElementById("cnt-friends").textContent = String(socialState.friendships.length);
      document.getElementById("cnt-incoming").textContent = String(socialState.incomingRequests.length);
      document.getElementById("cnt-outgoing").textContent = String(socialState.outgoingRequests.length);
      document.getElementById("cnt-following").textContent = String(socialState.following.length);
      document.getElementById("cnt-followers").textContent = String(socialState.followers.length);

      var uids = [];
      if (activeTab === "friends") uids = Array.from(socialState.friendUids);
      else if (activeTab === "incoming") uids = socialState.incomingRequests.map(function (r) { return r.senderId; });
      else if (activeTab === "outgoing") uids = socialState.outgoingRequests.map(function (r) { return r.receiverId; });
      else if (activeTab === "following") uids = socialState.following.map(function (f) { return f.followingId; });
      else if (activeTab === "followers") uids = socialState.followers.map(function (f) { return f.followerId; });

      await loadMissingProfiles(uids);

      if (uids.length === 0) {
        var emptyMap = {
          friends: ["No friends yet", "Explore HMM HMM and send friend requests to connect."],
          incoming: ["No pending requests", "When someone sends you a friend request, it will appear here."],
          outgoing: ["No sent requests", "Friend requests you send will appear here until accepted."],
          following: ["Not following anyone yet", "Follow people on Explore to keep up with their updates."],
          followers: ["No followers yet", "Share posts and connect with others to grow your followers."],
        };
        var item = emptyMap[activeTab];
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">' +
          U.ICONS.users +
          "</div><h3>" + item[0] + "</h3><p>" + item[1] + "</p></div>";
        return;
      }

      container.innerHTML = uids
        .map(function (uid) {
          var u = profileCache.get(uid) || {
            uid: uid,
            name: "HMM Member",
            username: "member",
            avatarUrl: "",
            avatarColor: "#006A4E",
          };
          var actions = "";
          if (activeTab === "friends") {
            actions =
              '<a href="#messages?uid=' + encodeURIComponent(u.uid) + '" class="btn btn-primary btn-sm">Message</a>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-action="unfriend" data-uid="' + U.escapeHtml(u.uid) + '">Remove</button>';
          } else if (activeTab === "incoming") {
            actions =
              '<button type="button" class="btn btn-primary btn-sm" data-action="accept" data-uid="' + U.escapeHtml(u.uid) + '">Accept</button>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-action="reject" data-uid="' + U.escapeHtml(u.uid) + '">Reject</button>';
          } else if (activeTab === "outgoing") {
            actions =
              '<button type="button" class="btn btn-secondary btn-sm" data-action="cancel" data-uid="' + U.escapeHtml(u.uid) + '">Cancel request</button>';
          } else if (activeTab === "following") {
            actions =
              '<button type="button" class="btn btn-secondary btn-sm" data-action="unfollow" data-uid="' + U.escapeHtml(u.uid) + '">Unfollow</button>';
          } else if (activeTab === "followers") {
            var isFollowing = socialState.followingUids.has(u.uid);
            actions = isFollowing
              ? '<button type="button" class="btn btn-secondary btn-sm" data-action="unfollow" data-uid="' + U.escapeHtml(u.uid) + '">Following</button>'
              : '<button type="button" class="btn btn-primary btn-sm" data-action="follow" data-uid="' + U.escapeHtml(u.uid) + '">Follow back</button>';
          }

          return (
            '<div class="user-row">' +
            '<a href="#profile?uid=' + encodeURIComponent(u.uid) + '" class="user-row-left">' +
            U.renderAvatarHtml({ name: u.name, avatarUrl: u.avatarUrl, avatarColor: u.avatarColor, size: "md" }) +
            '<div class="user-row-meta"><span class="user-row-name">' + U.escapeHtml(u.name) + "</span>" +
            '<span class="user-row-handle">@' + U.escapeHtml(u.username) + (u.location ? " · " + U.escapeHtml(u.location) : "") + "</span></div>" +
            "</a>" +
            '<div class="user-row-actions">' + actions + "</div></div>"
          );
        })
        .join("");
    }

    document.getElementById("friends-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab-btn");
      if (!btn) return;
      activeTab = btn.dataset.tab;
      document.querySelectorAll("#friends-tabs .tab-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderTab();
    });

    document.getElementById("friends-list-container").addEventListener("click", async function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn || !socialState) return;
      var action = btn.dataset.action;
      var targetUid = btn.dataset.uid;
      btn.disabled = true;
      try {
        if (action === "accept") {
          var req = socialState.incomingBySender.get(targetUid);
          if (req) await acceptFriendRequest(req, ctx.profile);
          U.showToast("Friend request accepted!", "success");
        } else if (action === "reject") {
          await rejectFriendRequest(targetUid, ctx.user.uid);
          U.showToast("Friend request declined.");
        } else if (action === "cancel") {
          await cancelFriendRequest(ctx.user.uid, targetUid);
          U.showToast("Friend request cancelled.");
        } else if (action === "unfriend") {
          await removeFriend(ctx.user.uid, targetUid);
          U.showToast("Friend removed.");
        } else if (action === "follow") {
          await followUser(ctx.profile, targetUid);
          U.showToast("Followed user.", "success");
        } else if (action === "unfollow") {
          await unfollowUser(ctx.user.uid, targetUid);
          U.showToast("Unfollowed user.");
        }
      } catch (err) {
        U.showToast(U.getFriendlyErrorMessage(err), "error");
        btn.disabled = false;
      }
    });

    var unsub = subscribeToSocialState(ctx.user.uid, function (next) {
      socialState = next;
      renderTab();
    });
    ctx.onCleanup(unsub);
  }

  HMM.friends = {
    subscribeToSocialState: subscribeToSocialState,
    sendFriendRequest: sendFriendRequest,
    cancelFriendRequest: cancelFriendRequest,
    rejectFriendRequest: rejectFriendRequest,
    acceptFriendRequest: acceptFriendRequest,
    removeFriend: removeFriend,
    followUser: followUser,
    unfollowUser: unfollowUser,
    mountView: mountFriendsView,
  };
})(window.HMM = window.HMM || {});
