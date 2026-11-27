# HMM HMM — Connect. Share. Belong.

**HMM HMM** is a standalone Bangladeshi social networking web application built strictly with **HTML5, CSS3, Vanilla JavaScript, and the official Firebase Web SDK v11.6.1 Compat CDN**.

- **Direct Local Device Launch (`file://`)**: Just download/unzip the folder and **double-click `index.html`** — the entire application starts immediately with **zero local server, zero CORS errors, zero build tools, and zero frameworks**.
- **cPanel Ready**: Upload the same files directly to `public_html` in cPanel and open your domain over HTTPS.
- **Firebase Project**: `hmm-e3899` (`Hmm Hmm`)
- **Realtime Database**: `https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## Quick Start on Your Local Device (No Server Needed!)

1. Download or copy the project folder to your computer or phone.
2. Double-click **`index.html`** to open it directly in Chrome, Edge, Firefox, or Safari.
3. Everything runs automatically:
   - **Email/Password Registration, Login & Password Reset**
   - **Home Feed** (create/edit/delete posts, likes, comments, share, report)
   - **Profiles** (`@username`, bio, avatar customization, online presence)
   - **Friends & Follows** (requests, accept/reject, friends list, follow/unfollow)
   - **Real-Time Private Chat** (Firebase Realtime Database, unread counts, read receipts)
   - **Notifications, Explore/Search, Settings, Dark Mode & Admin Moderation**

> **Note about Google Sign-In on `file://`**: Browsers and Firebase Auth restrict Google OAuth popups on `file://` URLs. Email/Password works immediately when double-clicking `index.html`; **Google Sign-In** automatically works as soon as you host the files on cPanel (HTTPS) or `localhost`.

---

## Project Structure

```text
hmm-hmm/
├── index.html                  # Main single entry point — double-click to launch the entire app
├── login.html                  # Direct route forwarder -> index.html#login
├── register.html               # Direct route forwarder -> index.html#register
├── forgot-password.html        # Direct route forwarder -> index.html#forgot
├── profile.html                # Direct route forwarder -> index.html#profile
├── friends.html                # Direct route forwarder -> index.html#friends
├── messages.html               # Direct route forwarder -> index.html#messages
├── notifications.html          # Direct route forwarder -> index.html#notifications
├── explore.html                # Direct route forwarder -> index.html#explore
├── settings.html               # Direct route forwarder -> index.html#settings
├── admin.html                  # Direct route forwarder -> index.html#admin
├── .htaccess                   # Apache/cPanel MIME types, headers, caching & firebase/ protection
├── css/
│   ├── style.css               # Core design tokens (light/dark), layout & UI primitives
│   ├── auth.css                # Auth, email verification & onboarding screens
│   ├── feed.css                # Composer, posts, comments & dropdowns
│   ├── profile.css             # Profile cover, stats & avatar swatches
│   ├── chat.css                # 2-column real-time messaging layout
│   └── responsive.css          # Desktop, tablet, iPhone & Android breakpoints
├── js/
│   ├── firebase.js             # Firebase Web SDK v11.6.1 compat init & hmm-e3899 config
│   ├── utils.js                # Sanitization, validation, hash router, avatars, icons, theme, toasts, modals
│   ├── auth.js                 # Auth actions, profile CRUD & login/register/forgot views
│   ├── friends.js              # Friends, requests, follows services & Friends view
│   ├── feed.js                 # Posts, likes, comments services & Home Feed view
│   ├── profile.js              # Profile view & Edit Profile modal
│   ├── search.js               # Explore & search view
│   ├── chat.js                 # RTDB 1-to-1 real-time chat & read receipts view
│   ├── notifications.js        # Notifications view
│   ├── settings.js             # Settings view
│   ├── admin.js                # Admin moderation console view
│   └── app.js                  # App bootstrap, hash router, shell, presence, badges & report modal
├── assets/
│   ├── icons/
│   │   ├── logo.svg
│   │   └── favicon.svg
│   └── images/
│       └── og-banner.svg
└── firebase/
    ├── firestore.rules         # Production Cloud Firestore security rules
    ├── database.rules.json     # Production Realtime Database security rules
    └── firestore.indexes.json  # Composite Firestore indexes
```

---

## 1. Firebase Setup

This application is pre-configured for Firebase project **`hmm-e3899`** inside `js/firebase.js` using official Firebase Web SDK v11.6.1 compat scripts from `https://www.gstatic.com/firebasejs/11.6.1/`.

- **Never** use Android `google-services.json` for web applications.
- Only Firebase Web App configuration is used in `js/firebase.js`.

---

## 2. Authentication Setup

In **Firebase Console → Project `hmm-e3899` → Authentication**:

1. Open **Sign-in method** and ensure both providers are **Enabled**:
   - **Email/Password**
   - **Google** (select a Project support email)
2. Open **Settings → Authorized domains** and click **Add domain**:
   - Add your cPanel domain (for example, `yourdomain.com` and `www.yourdomain.com`).
   - Google Sign-In and email verification links work automatically on authorized HTTPS domains.

> **Important Security Note**: Production Firestore rules require verified emails (`email_verified == true`) before creating profiles, posts, or social actions. Google accounts are automatically verified; Email/Password registrations automatically send a verification email and guide the user through the built-in verification screen.

---

## 3. Cloud Firestore & Realtime Database Setup

- **Cloud Firestore Named Database**: `js/firebase.js` connects to `FIRESTORE_DATABASE_ID = "ai-studio-1db84c66-9714-4593-92c0-e74c85edc7e4"` (where HMM HMM's production rules are deployed). To switch to `(default)`, update `FIRESTORE_DATABASE_ID` in `js/firebase.js` and publish `firebase/firestore.rules` there.
- **Realtime Database URL**: `https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app`. Publish `firebase/database.rules.json` in **Firebase Console → Realtime Database → Rules**.

---

## 4. cPanel Upload Instructions

No build command or Node.js setup is required:

1. ZIP `index.html`, the other `.html` files, `.htaccess`, `css/`, `js/`, and `assets/`.
2. Open **cPanel → File Manager → `public_html`** (or any subfolder).
3. Upload and **Extract** the ZIP file.
4. Enable **SSL / HTTPS** (cPanel → **SSL/TLS Status → Run AutoSSL**).
5. Add your domain under **Firebase Console → Authentication → Settings → Authorized domains**.
6. Visit `https://yourdomain.com`.

---

## 5. Admin Setup

- **Primary Admin**: `tahasinahammed58@gmail.com` (bootstrapped in `firebase/firestore.rules` and `js/utils.js`).
- **Additional Admins**: In Firestore, create `admins/{target_user_uid}` with `{ role: "admin" }`. Client writes to `admins` are blocked by rules.

---

## 6. Troubleshooting

| Symptom | Cause & Fix |
| --- | --- |
| **Google Sign-In shows a `file://` notice when opened locally** | Browsers block Firebase OAuth popups on `file://`. Use Email/Password locally, or open via cPanel HTTPS / `localhost` for Google Sign-In. |
| **Google Sign-In fails with `auth/unauthorized-domain` on cPanel** | Add your cPanel domain in Firebase Console → Authentication → Settings → Authorized domains. |
| **Action blocked by security rules / `permission-denied`** | Ensure the user verified their email address, and verify `firebase/firestore.rules` is published to the database specified in `FIRESTORE_DATABASE_ID`. |
| **Chat messages do not load or send** | Publish `firebase/database.rules.json` in Firebase Console → Realtime Database → Rules. |
