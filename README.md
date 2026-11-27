# HMM HMM — Connect. Share. Belong.

**HMM HMM** is a standalone Bangladeshi social networking web application built strictly with **HTML5, CSS3, Vanilla JavaScript, and the official Firebase Web SDK v11.6.1 Compat CDN** — with **zero `package.json`**, zero build tools, and zero frameworks.

- **Vercel Static Ready**: Deploy directly to Vercel as a pure static site (no `package.json`, no build step required).
- **cPanel Ready**: Upload files directly to `public_html` over HTTPS.
- **Local Device Launch (`file://`)**: Double-click **`index.html`** to run immediately on any device.
- **Firebase Project**: `hmm-e3899` (`Hmm Hmm`)
- **Realtime Database**: `https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## Key Features

1. **AI Bulk Moderation & Trash (Admin Controlled)**
   - Configure a Google AI Studio API Key inside **Admin Console (`admin.html` / `#admin`)** with an instant On/Off toggle and free-tier Gemini model selector (`gemini-3.1-flash-lite`, `gemini-4-hydrogen`, `gemini-2.5-flash`, or custom model ID).
   - Run **Scan All Posts with AI** to scan posts and comments in batches; toxic, abusive, or spam items are automatically moved into the Firestore `trash` collection.
   - Review trashed items in the **Trash** tab to **Restore** or **Permanently Delete** them.
2. **Dynamic Branding & SEO Controls**
   - Upload or link a custom Website Logo & Favicon and edit Site Name, Tagline, Meta Description, and Meta Keywords in Admin Console (`siteConfig/general`), applied live across all pages.
3. **Distinguished Official Admin Profile**
   - Verified executive Official Admin badge, gold-emerald avatar ring, and Official Administrator profile banner across profiles, posts, comments, search, and navigation.
4. **Facebook-Style 7 Reactions & Post Sharing**
   - React with **Like, Love, Care, Haha, Wow, Sad, Angry** on both posts and comments, inspect who reacted by reaction type, and share posts via direct link (`#feed?post=<id>`), native share sheet, or Quote to Feed.
5. **Smart Link Previews**
   - Automatically detects and renders inline previews for direct images (with lightbox), HTML5 videos, YouTube (click-to-play embed), Vimeo, and rich OpenGraph web cards.
6. **Real-Time Text-Only Messenger (1-to-1 & Group Chat)**
   - Instant Firebase Realtime Database messaging with online presence, unread counters, read receipts, and full **Group Chat** creation (custom name, avatar, multi-friend picker, member list). Strictly text-only.
7. **100% Responsive Mobile & Desktop UI**
   - Slide-in **Mobile Navigation Drawer** with search, profile, full menu, dark mode, and sign out; responsive mobile card-transformed Admin Panel tables; zero horizontal overflow.

---

## Publishing Required Firebase Security Rules

Before using the new features in production, publish both updated rules files in **Firebase Console (`hmm-e3899`)**:

1. **Cloud Firestore Rules**: Copy **`firebase/firestore.rules`** into **Firebase Console → Firestore Database (`ai-studio-1db84c66-9714-4593-92c0-e74c85edc7e4`) → Rules** and click **Publish**.
   - Enables `siteConfig/general`, admin-only `adminConfig/aiModeration` and `trash`, 7-reaction `likes` and `commentReactions`, and Official Admin `role`.
2. **Realtime Database Rules**: Copy **`firebase/database.rules.json`** into **Firebase Console → Realtime Database → Rules** and click **Publish**.
   - Enables real-time 1-to-1 and **Group Chat** (`grp_*`) threads with text-only validation and reliable unread counters.

---

## Deployment

### Vercel (Static)
1. Import the project folder/repository in Vercel.
2. Leave **Framework Preset** as `Other`, **Build Command** empty, and **Output Directory** as `.`.
3. Add your Vercel domain under **Firebase Console → Authentication → Settings → Authorized domains**.

### cPanel / Local
- **cPanel**: Upload `index.html`, the redirect `.html` files, `.htaccess`, `css/`, `js/`, and `assets/` into `public_html`, enable AutoSSL, and authorize your domain in Firebase Authentication.
- **Local (`file://`)**: Double-click `index.html` (Email/Password works locally; Google Sign-In works over HTTPS).

---

## Admin Access

- **Primary Admin**: `tahasinahammed58@gmail.com` (bootstrapped in `firebase/firestore.rules` and `js/utils.js`).
- **Additional Admins**: Add `admins/{uid}` with `{ role: "admin" }` in Firestore Console.
