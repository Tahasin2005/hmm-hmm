# KLORIX — Connect. Share. Belong.

**KLORIX** (*KLORIX Community*, `https://klorixcommunity.vercel.app`) is a standalone social networking web application built strictly with **HTML5, CSS3, Vanilla JavaScript, and the official Firebase Web SDK v11.6.1 Compat CDN** — with **zero `package.json`**, zero build tools, and zero frameworks.

- **Production URL**: `https://klorixcommunity.vercel.app`
- **Vercel Static Ready**: Deploy directly to Vercel as a pure static site (no `package.json`, no build step required).
- **cPanel Ready**: Upload files directly to `public_html` over HTTPS.
- **Local Device Launch (`file://`)**: Double-click **`index.html`** to run immediately on any device.
- **Firebase Project**: `hmm-e3899`
- **Realtime Database**: `https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## Key Features

1. **KLORIX Rebranding & Static OpenGraph Social Share Cards**
   - Full **KLORIX** branding across all 11 HTML pages, custom geometric `K` SVG logo/favicon, and a static 1200×630 raster OpenGraph banner (`assets/images/og-banner.png`) with canonical URL `https://klorixcommunity.vercel.app/`, Twitter Cards, and JSON-LD structured data.
   - Internal KLORIX links shared inside the app render live KLORIX branding immediately instead of stale third-party preview caches.
2. **User-to-User Block / Unblock System (Two-Way Isolation)**
   - Block or unblock any user directly from **Chat**, **User Profiles**, or **Settings → Blocked Users**.
   - Blocking immediately isolates both users: removes friendships/requests/follows, hides posts, comments, profiles, search results, and chat pickers both ways, and is enforced in Firestore & Realtime Database security rules.
3. **Official Admin Global Home Feed Announcements**
   - Admins can publish, edit, toggle, or delete pinned announcements (with optional image) directly from their **Official Admin Profile** or the **Admin Console → Announcements** tab.
4. **`@Mentions`, Tag People & `#Hashtags`**
   - Live `@` user autocomplete dropdown in Post Composer and Comment inputs, **Tag People** multi-select picker, `#Hashtag` helper, clickable `@mentions` and `#hashtags` across posts and comments, and automatic `mention` & `tag` notifications.
5. **Dual-Mode Post Composer (Text Post & Safe Embedded Videos)**
   - Switch seamlessly between **Text Post** and **Embed Video** (YouTube, YouTube Shorts, Facebook Videos/Reels, Vimeo) with strict URL/iframe whitelist parsing, live preview, optional caption, tags, and native responsive video playback.
6. **Admin Anonymous In-Feed Promos / Videos & Ads**
   - Publish YouTube/Facebook videos or image banner ads from **Admin Console → Feed Ads & Videos** (`feedPromos`) that appear interleaved every *N* posts on the Home Feed with **zero author name or avatar**.
7. **Admin "View As User" Account Inspector**
   - Inspect any user's account in read-only mode from **Admin Console → Users → View As** (`#inspect?uid=...`) to review Account Overview & Private Email, Home Feed View, Posts, Friends & Network, Notifications, Blocked Users, and Chats.
8. **AI Bulk Moderation & Trash, 7 Reactions, Real-Time 1-to-1 & Group Chat**
   - Admin-controlled Gemini AI scanning + Trash restore/delete, dynamic Logo/Favicon/SEO settings, Facebook-style 7 reactions, smart link previews, and strictly text-only real-time 1-to-1 & Group Messenger.

---

## Publishing Required Firebase Security Rules

Before using the new features in production, publish both updated rules files in **Firebase Console (`hmm-e3899`)**:

1. **Cloud Firestore Rules**: Copy **`firebase/firestore.rules`** into **Firebase Console → Firestore Database (`ai-studio-1db84c66-9714-4593-92c0-e74c85edc7e4`) → Rules** and click **Publish**.
   - Enables two-way `blocks`, pinned `announcements`, anonymous `feedPromos`, post `embed`/`tags`/`hashtags`/`mentions`, `mention`/`tag` notifications, and Admin Account Inspector read access.
2. **Realtime Database Rules**: Copy **`firebase/database.rules.json`** into **Firebase Console → Realtime Database → Rules** and click **Publish**.
   - Enables `/blocks/$blockerUid/$blockedUid`, direct message block enforcement, Group Chat (`grp_*`), and Admin read-only inspection of user threads.

---

## Deployment & Social Link Cache Refresh

### Vercel (Static)
1. Deploy/push to Vercel (`Framework Preset: Other`, empty Build Command, Output Directory `.`).
2. Ensure `klorixcommunity.vercel.app` is listed under **Firebase Console → Authentication → Settings → Authorized domains**.
3. If Facebook, Messenger, or WhatsApp still shows an old cached preview for `https://klorixcommunity.vercel.app`, paste the URL into **Meta Sharing Debugger** (`https://developers.facebook.com/tools/debug/`) and click **Scrape Again**.

---

## Admin Access

- **Primary Admin**: `tahasinahammed58@gmail.com` (bootstrapped in `firebase/firestore.rules`, `firebase/database.rules.json`, and `js/utils.js`).
- **Additional Admins**: Add `admins/{uid}` with `{ role: "admin" }` in Firestore Console.
