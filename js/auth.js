/**
 * KLORIX — Authentication, User Profile Services & Auth Views (Login / Register / Forgot)
 * Classic script (works directly via file://, Vercel, and cPanel).
 */
(function (HMM) {
  "use strict";

  var U = HMM.utils;
  var PENDING_SIGNUP_KEY = "hmm_pending_signup";

  function savePendingSignup(data) {
    try {
      sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function readPendingSignup() {
    try {
      var raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearPendingSignup() {
    try {
      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    } catch (e) {}
  }

  async function setPresenceOffline(uid) {
    if (!uid || !HMM.rtdb) return;
    try {
      await HMM.rtdb.ref("presence/" + uid).set({
        online: false,
        lastSeen: Date.now(),
      });
    } catch (e) {}
  }

  // ============================================================================
  // AUTH ACTIONS
  // ============================================================================
  async function registerWithEmail(params) {
    var cleanName = U.sanitizeText(params.name, U.LIMITS.NAME_MAX);
    var cleanUsername = U.normalizeUsername(params.username);
    var usernameErr = U.validateUsername(cleanUsername);
    if (!cleanName) throw new Error("Please enter your full name.");
    if (usernameErr) throw new Error(usernameErr);
    if (!params.email || !params.email.trim()) throw new Error("Please enter your email address.");
    if (!params.password || params.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    var cred = await HMM.auth.createUserWithEmailAndPassword(
      params.email.trim(),
      params.password
    );
    await cred.user.updateProfile({ displayName: cleanName });

    savePendingSignup({
      name: cleanName,
      username: cleanUsername,
      location: U.sanitizeText(params.location || "Dhaka, Bangladesh", U.LIMITS.LOCATION_MAX),
    });

    await cred.user.sendEmailVerification();
    return cred.user;
  }

  async function loginWithEmail(email, password) {
    var cred = await HMM.auth.signInWithEmailAndPassword(email.trim(), password);
    return cred.user;
  }

  async function loginWithGoogle() {
    if (U.isFileProtocol()) {
      throw new Error(
        "Google Sign-In popup requires HTTP/HTTPS (cPanel or Live Server). When opening index.html directly from your device (file://), please sign in or register with Email & Password."
      );
    }
    var provider = new HMM.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    var cred = await HMM.auth.signInWithPopup(provider);
    return cred.user;
  }

  async function sendPasswordReset(email) {
    var trimmed = String(email || "").trim();
    if (!trimmed) throw new Error("Please enter your email address.");
    await HMM.auth.sendPasswordResetEmail(trimmed);
  }

  async function resendVerificationEmail() {
    if (!HMM.auth.currentUser) throw new Error("Your session has expired. Please sign in again.");
    await HMM.auth.currentUser.sendEmailVerification();
  }

  async function changeUserPassword(currentPassword, newPassword) {
    var user = HMM.auth.currentUser;
    if (!user || !user.email) throw new Error("Your session has expired.");
    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters.");
    }
    var credential = HMM.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  async function logoutUser() {
    var uid = HMM.auth.currentUser ? HMM.auth.currentUser.uid : null;
    if (uid) await setPresenceOffline(uid);
    await HMM.auth.signOut();
    U.navigateTo("login");
  }

  async function deleteUserAccount(params) {
    var user = HMM.auth.currentUser;
    if (!user) throw new Error("Your session has expired.");

    var usesPassword = user.providerData.some(function (p) {
      return p.providerId === "password";
    });
    if (usesPassword) {
      if (!params.currentPassword || !user.email) {
        throw new Error("Please enter your current password to confirm account deletion.");
      }
      var cred = HMM.firebase.auth.EmailAuthProvider.credential(user.email, params.currentPassword);
      await user.reauthenticateWithCredential(cred);
    } else {
      var provider = new HMM.firebase.auth.GoogleAuthProvider();
      await user.reauthenticateWithPopup(provider);
    }

    await setPresenceOffline(user.uid);

    var batch = HMM.db.batch();
    if (params.profile && params.profile.username) {
      batch.delete(HMM.db.collection("usernames").doc(params.profile.username));
    }
    batch.delete(
      HMM.db.collection("users").doc(user.uid).collection("private").doc("account")
    );
    batch.delete(HMM.db.collection("users").doc(user.uid));
    await batch.commit();

    await user.delete();
    U.navigateTo("login");
  }

  // ============================================================================
  // USER PROFILE SERVICES
  // ============================================================================
  async function getUserProfile(uid) {
    if (!uid) return null;
    var snap = await HMM.db.collection("users").doc(uid).get();
    return snap.exists ? snap.data() : null;
  }

  async function getUserByUsername(username) {
    var normalized = U.normalizeUsername(username);
    if (U.validateUsername(normalized)) return null;
    var snap = await HMM.db.collection("usernames").doc(normalized).get();
    if (!snap.exists) return null;
    var data = snap.data();
    return data && data.uid ? getUserProfile(data.uid) : null;
  }

  async function isUsernameAvailable(username) {
    var normalized = U.normalizeUsername(username);
    if (U.validateUsername(normalized)) return false;
    var snap = await HMM.db.collection("usernames").doc(normalized).get();
    return !snap.exists;
  }

  function generateDefaultUsername(name, uid) {
    var base = U.normalizeUsername(String(name || "").replace(/\s+/g, "_")).slice(0, 12) || "member";
    var suffix = String(uid || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "kx01";
    var candidate = (base + "_" + suffix).slice(0, 20);
    return candidate.length >= 3 ? candidate : "kx_" + suffix;
  }

  async function createUserProfile(params) {
    var uid = params.firebaseUser.uid;
    var cleanName = U.sanitizeText(params.name, U.LIMITS.NAME_MAX);
    var cleanUsername = U.normalizeUsername(params.username);
    var usernameErr = U.validateUsername(cleanUsername);
    if (usernameErr) throw new Error(usernameErr);
    if (!cleanName) throw new Error("Full name is required.");

    var available = await isUsernameAvailable(cleanUsername);
    if (!available) throw new Error("That username is already taken. Please choose another.");

    var avatarColor = U.pickAvatarColor(uid);
    var cleanBio = U.sanitizeText(params.bio || "", U.LIMITS.BIO_MAX);
    var cleanLocation = U.sanitizeText(params.location || "Dhaka, Bangladesh", U.LIMITS.LOCATION_MAX);
    var email = String(params.firebaseUser.email || "").trim().slice(0, 254);

    var batch = HMM.db.batch();
    batch.set(HMM.db.collection("usernames").doc(cleanUsername), {
      uid: uid,
      username: cleanUsername,
      createdAt: HMM.serverTimestamp(),
    });
    batch.set(HMM.db.collection("users").doc(uid), {
      uid: uid,
      name: cleanName,
      username: cleanUsername,
      bio: cleanBio,
      avatarUrl: String(params.firebaseUser.photoURL || "").slice(0, U.LIMITS.AVATAR_URL_MAX),
      avatarColor: avatarColor,
      location: cleanLocation,
      visibility: "public",
      friendRequestPref: "everyone",
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      postsCount: 0,
      isSuspended: false,
      createdAt: HMM.serverTimestamp(),
      updatedAt: HMM.serverTimestamp(),
    });
    if (email) {
      batch.set(
        HMM.db.collection("users").doc(uid).collection("private").doc("account"),
        {
          uid: uid,
          email: email,
          updatedAt: HMM.serverTimestamp(),
        }
      );
    }

    await batch.commit();
    var created = await getUserProfile(uid);
    if (!created) throw new Error("Profile created but could not be loaded. Please refresh.");
    return created;
  }

  async function updateUserProfile(params) {
    var currentProfile = params.currentProfile;
    var uid = currentProfile.uid;
    var cleanName = U.sanitizeText(params.name, U.LIMITS.NAME_MAX);
    if (!cleanName) throw new Error("Full name cannot be empty.");

    var cleanUsername = U.normalizeUsername(params.username);
    var usernameErr = U.validateUsername(cleanUsername);
    if (usernameErr) throw new Error(usernameErr);

    var urlErr = U.validateOptionalUrl(params.avatarUrl);
    if (urlErr) throw new Error(urlErr);

    var cleanBio = U.sanitizeText(params.bio, U.LIMITS.BIO_MAX);
    var cleanLocation = U.sanitizeText(params.location, U.LIMITS.LOCATION_MAX);
    var cleanAvatarUrl = String(params.avatarUrl || "").trim().slice(0, U.LIMITS.AVATAR_URL_MAX);
    var cleanAvatarColor = String(params.avatarColor || "").trim().slice(0, 32) || currentProfile.avatarColor;

    var usernameChanged = cleanUsername !== currentProfile.username;
    if (usernameChanged) {
      var available = await isUsernameAvailable(cleanUsername);
      if (!available) throw new Error("That username is already taken.");
    }

    var batch = HMM.db.batch();
    if (usernameChanged) {
      batch.set(HMM.db.collection("usernames").doc(cleanUsername), {
        uid: uid,
        username: cleanUsername,
        createdAt: HMM.serverTimestamp(),
      });
      batch.delete(HMM.db.collection("usernames").doc(currentProfile.username));
    }

    batch.update(HMM.db.collection("users").doc(uid), {
      name: cleanName,
      username: cleanUsername,
      bio: cleanBio,
      location: cleanLocation,
      avatarUrl: cleanAvatarUrl,
      avatarColor: cleanAvatarColor,
      visibility: params.visibility === "friends" ? "friends" : "public",
      friendRequestPref: params.friendRequestPref === "none" ? "none" : "everyone",
      updatedAt: HMM.serverTimestamp(),
    });

    await batch.commit();
    return getUserProfile(uid);
  }

  async function getSuggestedUsers(excludeUid, maxResults) {
    var cap = maxResults || 12;
    var snap = await HMM.db
      .collection("users")
      .where("visibility", "==", "public")
      .limit(40)
      .get();
    return snap.docs
      .map(function (d) { return d.data(); })
      .filter(function (u) {
        if (u.uid === excludeUid || u.isSuspended) return false;
        if (HMM.blocks && HMM.blocks.isEitherBlocked(u.uid)) return false;
        return true;
      })
      .sort(function (a, b) { return (b.followersCount || 0) - (a.followersCount || 0); })
      .slice(0, cap);
  }

  async function searchUsers(rawQuery, excludeUid) {
    var term = String(rawQuery || "").trim().toLowerCase();
    if (!term) return [];
    var snap = await HMM.db
      .collection("users")
      .where("visibility", "==", "public")
      .limit(80)
      .get();
    var normalizedHandle = term.replace(/^@/, "");
    return snap.docs
      .map(function (d) { return d.data(); })
      .filter(function (u) {
        if (excludeUid && u.uid === excludeUid) return false;
        if (u.isSuspended) return false;
        if (HMM.blocks && HMM.blocks.isEitherBlocked(u.uid)) return false;
        return (
          String(u.username || "").toLowerCase().indexOf(normalizedHandle) !== -1 ||
          String(u.name || "").toLowerCase().indexOf(term) !== -1 ||
          String(u.location || "").toLowerCase().indexOf(term) !== -1
        );
      })
      .sort(function (a, b) {
        var aExact = String(a.username || "").indexOf(normalizedHandle) === 0 ? 1 : 0;
        var bExact = String(b.username || "").indexOf(normalizedHandle) === 0 ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return (b.followersCount || 0) - (a.followersCount || 0);
      })
      .slice(0, 25);
  }

  async function getUsersByIds(uids) {
    var unique = Array.from(new Set((uids || []).filter(Boolean))).slice(0, 50);
    if (unique.length === 0) return [];
    var results = await Promise.all(
      unique.map(async function (uid) {
        try {
          var snap = await HMM.db.collection("users").doc(uid).get();
          return snap.exists ? snap.data() : null;
        } catch (e) {
          return null;
        }
      })
    );
    return results.filter(Boolean);
  }

  async function checkIsAdmin(user) {
    if (!user || !user.emailVerified) return false;
    if (user.email === U.BOOTSTRAPPED_ADMIN_EMAIL) return true;
    try {
      var snap = await HMM.db.collection("admins").doc(user.uid).get();
      return snap.exists;
    } catch (e) {
      return false;
    }
  }

  // ============================================================================
  // RENDER AUTH VIEWS DIRECTLY INSIDE index.html (Login / Register / Forgot)
  // ============================================================================
  function renderAuthView(root, mode) {
    var cfg = HMM.siteConfig.get();
    var fileNote = U.isFileProtocol()
      ? '<div class="alert alert-info" style="margin-bottom:14px;font-size:12.5px;">Local mode (<code>file://</code>): Email &amp; Password works directly. Google Sign-In works once hosted on HTTPS (Vercel / cPanel).</div>'
      : "";

    if (mode === "forgot") {
      root.innerHTML =
        '<div class="gate-page">' +
        '<div class="gate-card">' +
        '<a href="#login" style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">' +
        '<img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" data-site-logo style="width:40px;height:40px;border-radius:10px;object-fit:cover;" />' +
        '<div><div class="brand-name" data-site-name>' + U.escapeHtml(cfg.siteName) + '</div>' +
        '<div class="brand-tagline" data-site-tagline>' + U.escapeHtml(cfg.tagline) + "</div></div>" +
        "</a>" +
        "<h2>Reset your password</h2>" +
        '<p class="text-muted" style="margin-top:6px;margin-bottom:20px;font-size:14px;">Enter your email address and we will send you a password reset link.</p>' +
        '<div id="auth-error" class="alert alert-danger hidden" style="margin-bottom:14px;"></div>' +
        '<div id="auth-success" class="alert alert-info hidden" style="margin-bottom:14px;"></div>' +
        '<form id="forgot-form" class="auth-form">' +
        '<div class="form-group"><label class="form-label" for="forgot-email">Email address</label>' +
        '<input id="forgot-email" class="form-input" type="email" required autocomplete="email" placeholder="you@example.com" /></div>' +
        '<button type="submit" id="forgot-submit" class="btn btn-primary btn-lg btn-block">Send reset link</button>' +
        "</form>" +
        '<p class="auth-footer-links">Remembered your password? <a href="#login">Back to Sign in</a></p>' +
        "</div></div>";

      wireAuthHandlers("forgot");
      return;
    }

    var isRegister = mode === "register";
    var formHtml = isRegister
      ? '<form id="register-form" class="auth-form">' +
        '<div class="form-group"><label class="form-label" for="reg-name">Full name</label>' +
        '<input id="reg-name" class="form-input" type="text" required maxlength="80" placeholder="e.g. Tahasin Ahammed" /></div>' +
        '<div class="form-group"><label class="form-label" for="reg-username">Username (@)</label>' +
        '<input id="reg-username" class="form-input" type="text" required minlength="3" maxlength="20" placeholder="e.g. tahasin_bd" />' +
        '<span id="username-hint" class="username-status text-muted">3–20 lowercase letters, numbers, or underscores.</span></div>' +
        '<div class="form-group"><label class="form-label" for="reg-location">City / Location</label>' +
        '<input id="reg-location" class="form-input" type="text" maxlength="80" placeholder="Dhaka, Bangladesh" value="Dhaka, Bangladesh" /></div>' +
        '<div class="form-group"><label class="form-label" for="reg-email">Email address</label>' +
        '<input id="reg-email" class="form-input" type="email" required autocomplete="email" placeholder="you@example.com" /></div>' +
        '<div class="form-group"><label class="form-label" for="reg-password">Password</label>' +
        '<input id="reg-password" class="form-input" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters" /></div>' +
        '<button type="submit" id="register-submit" class="btn btn-primary btn-lg btn-block">Create ' + U.escapeHtml(cfg.siteName) + " account</button>" +
        "</form>"
      : '<form id="login-form" class="auth-form">' +
        '<div class="form-group"><label class="form-label" for="login-email">Email address</label>' +
        '<input id="login-email" class="form-input" type="email" required autocomplete="email" placeholder="you@example.com" /></div>' +
        '<div class="form-group"><label class="form-label" for="login-password">Password</label>' +
        '<input id="login-password" class="form-input" type="password" required autocomplete="current-password" placeholder="Enter your password" /></div>' +
        '<a href="#forgot" class="auth-inline-link">Forgot password?</a>' +
        '<button type="submit" id="login-submit" class="btn btn-primary btn-lg btn-block">Sign in</button>' +
        "</form>";

    root.innerHTML =
      '<div class="auth-page">' +
      '<section class="auth-hero">' +
      '<a href="#login" class="auth-hero-brand"><img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" data-site-logo style="object-fit:cover;" /><span data-site-name>' + U.escapeHtml(cfg.siteName) + "</span></a>" +
      '<div class="auth-hero-content">' +
      "<h1>" + (isRegister ? "Claim your @username today." : U.escapeHtml(cfg.tagline)) + "</h1>" +
      "<p>Join Bangladesh's warm, modern social community. Share daily moments, react with friends, and chat in real time from any phone or computer.</p>" +
      '<div class="auth-hero-features">' +
      '<div class="auth-feature-item"><span class="auth-feature-dot"></span><span>Real-time 1-to-1 &amp; Group Messenger with online presence</span></div>' +
      '<div class="auth-feature-item"><span class="auth-feature-dot"></span><span>Expressive reactions, smart media previews &amp; post sharing</span></div>' +
      '<div class="auth-feature-item"><span class="auth-feature-dot"></span><span>Friends, followers, unique @username profiles &amp; AI safety</span></div>' +
      "</div></div>" +
      '<div class="auth-hero-footer"><span data-site-name>' + U.escapeHtml(cfg.siteName) + "</span> Social Network · Built for Bangladesh &amp; beyond</div>" +
      "</section>" +
      '<main class="auth-panel"><div class="auth-card">' +
      '<div class="auth-mobile-brand"><img src="' + U.escapeHtml(cfg.logoUrl) + '" alt="' + U.escapeHtml(cfg.siteName) + '" data-site-logo style="object-fit:cover;" /><div><div class="brand-name" data-site-name>' + U.escapeHtml(cfg.siteName) + '</div><div class="brand-tagline" data-site-tagline>' + U.escapeHtml(cfg.tagline) + "</div></div></div>" +
      "<h2>" + (isRegister ? "Create account" : "Welcome back") + "</h2>" +
      '<p class="auth-subtitle">' + (isRegister ? "Join the " + U.escapeHtml(cfg.siteName) + " community in under a minute." : "Sign in to continue to your " + U.escapeHtml(cfg.siteName) + " feed.") + "</p>" +
      fileNote +
      '<div id="auth-error" class="alert alert-danger hidden" style="margin-bottom:14px;"></div>' +
      '<div id="auth-success" class="alert alert-info hidden" style="margin-bottom:14px;"></div>' +
      formHtml +
      '<div class="auth-divider">or continue with</div>' +
      '<button type="button" id="google-auth-btn" class="btn-google">' + U.ICONS.google + "<span>Continue with Google</span></button>" +
      '<p class="auth-footer-links">' +
      (isRegister
        ? 'Already have an account? <a href="#login">Sign in</a>'
        : 'New to ' + U.escapeHtml(cfg.siteName) + '? <a href="#register">Create an account</a>') +
      "</p>" +
      "</div></main></div>";

    wireAuthHandlers(isRegister ? "register" : "login");
  }

  function wireAuthHandlers(pageType) {
    var errorBox = document.getElementById("auth-error");
    var successBox = document.getElementById("auth-success");

    function showError(msg) {
      if (successBox) successBox.classList.add("hidden");
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.classList.remove("hidden");
      }
    }
    function showSuccess(msg) {
      if (errorBox) errorBox.classList.add("hidden");
      if (successBox) {
        successBox.textContent = msg;
        successBox.classList.remove("hidden");
      }
    }
    function clearAlerts() {
      if (errorBox) errorBox.classList.add("hidden");
      if (successBox) successBox.classList.add("hidden");
    }

    var googleBtn = document.getElementById("google-auth-btn");
    if (googleBtn) {
      googleBtn.addEventListener("click", async function () {
        clearAlerts();
        googleBtn.disabled = true;
        try {
          await loginWithGoogle();
        } catch (err) {
          showError(U.getFriendlyErrorMessage(err));
          googleBtn.disabled = false;
        }
      });
    }

    if (pageType === "login") {
      var loginForm = document.getElementById("login-form");
      if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
          e.preventDefault();
          clearAlerts();
          var btn = document.getElementById("login-submit");
          btn.disabled = true;
          btn.textContent = "Signing in...";
          try {
            await loginWithEmail(
              document.getElementById("login-email").value,
              document.getElementById("login-password").value
            );
          } catch (err) {
            showError(U.getFriendlyErrorMessage(err));
            btn.disabled = false;
            btn.textContent = "Sign in";
          }
        });
      }
    }

    if (pageType === "register") {
      var uInput = document.getElementById("reg-username");
      var uHint = document.getElementById("username-hint");
      if (uInput) {
        uInput.addEventListener("input", function () {
          var norm = U.normalizeUsername(uInput.value);
          if (uInput.value !== norm) uInput.value = norm;
          var err = U.validateUsername(norm);
          if (!norm) {
            uHint.textContent = "3–20 lowercase letters, numbers, or underscores.";
            uHint.className = "username-status text-muted";
          } else if (err) {
            uHint.textContent = err;
            uHint.className = "username-status err";
          } else {
            uHint.textContent = "@" + norm + " looks valid";
            uHint.className = "username-status ok";
          }
        });
      }

      var regForm = document.getElementById("register-form");
      if (regForm) {
        regForm.addEventListener("submit", async function (e) {
          e.preventDefault();
          clearAlerts();
          var btn = document.getElementById("register-submit");
          btn.disabled = true;
          btn.textContent = "Creating account...";
          try {
            await registerWithEmail({
              name: document.getElementById("reg-name").value,
              username: document.getElementById("reg-username").value,
              location: document.getElementById("reg-location").value,
              email: document.getElementById("reg-email").value,
              password: document.getElementById("reg-password").value,
            });
            U.showToast("Verification email sent! Please check your inbox.", "success");
          } catch (err) {
            showError(U.getFriendlyErrorMessage(err));
            btn.disabled = false;
            btn.textContent = "Create " + HMM.siteConfig.get().siteName + " account";
          }
        });
      }
    }

    if (pageType === "forgot") {
      var forgotForm = document.getElementById("forgot-form");
      if (forgotForm) {
        forgotForm.addEventListener("submit", async function (e) {
          e.preventDefault();
          clearAlerts();
          var btn = document.getElementById("forgot-submit");
          btn.disabled = true;
          btn.textContent = "Sending reset link...";
          try {
            await sendPasswordReset(document.getElementById("forgot-email").value);
            showSuccess("Password reset link sent! Check your email inbox and spam folder.");
            forgotForm.reset();
          } catch (err) {
            showError(U.getFriendlyErrorMessage(err));
          } finally {
            btn.disabled = false;
            btn.textContent = "Send reset link";
          }
        });
      }
    }
  }

  HMM.authService = {
    savePendingSignup: savePendingSignup,
    readPendingSignup: readPendingSignup,
    clearPendingSignup: clearPendingSignup,
    setPresenceOffline: setPresenceOffline,
    registerWithEmail: registerWithEmail,
    loginWithEmail: loginWithEmail,
    loginWithGoogle: loginWithGoogle,
    sendPasswordReset: sendPasswordReset,
    resendVerificationEmail: resendVerificationEmail,
    changeUserPassword: changeUserPassword,
    logoutUser: logoutUser,
    deleteUserAccount: deleteUserAccount,
    getUserProfile: getUserProfile,
    getUserByUsername: getUserByUsername,
    isUsernameAvailable: isUsernameAvailable,
    generateDefaultUsername: generateDefaultUsername,
    createUserProfile: createUserProfile,
    updateUserProfile: updateUserProfile,
    getSuggestedUsers: getSuggestedUsers,
    searchUsers: searchUsers,
    getUsersByIds: getUsersByIds,
    checkIsAdmin: checkIsAdmin,
    renderAuthView: renderAuthView,
  };
})(window.HMM = window.HMM || {});
