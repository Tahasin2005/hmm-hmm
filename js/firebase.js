/**
 * KLORIX — Firebase Web SDK Initialization (Classic Script — Works on file:// & HTTPS)
 *
 * Uses official Firebase Web SDK v11.6.1 Compat CDN scripts loaded in index.html.
 * Works directly when double-clicking index.html locally, on Vercel static deploy, and on cPanel.
 *
 * Project ID: hmm-e3899
 * Realtime Database: https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app
 */
(function (HMM) {
  "use strict";

  var REALTIME_DATABASE_URL =
    "https://hmm-e3899-default-rtdb.asia-southeast1.firebasedatabase.app";

  var FIRESTORE_DATABASE_ID =
    "ai-studio-1db84c66-9714-4593-92c0-e74c85edc7e4";

  var firebaseConfig = {
    apiKey: "AIzaSyCF-eRtKEDaxjEycgmLshhDr4bgK_7vKoA",
    authDomain: "hmm-e3899.firebaseapp.com",
    projectId: "hmm-e3899",
    storageBucket: "hmm-e3899.firebasestorage.app",
    messagingSenderId: "126719727888",
    appId: "1:126719727888:web:220f8034aeb896bf83ed95",
    databaseURL: REALTIME_DATABASE_URL,
  };

  if (typeof window.firebase === "undefined") {
    console.error("Firebase CDN scripts failed to load. Please check your internet connection.");
    HMM.firebaseLoadError =
      "Firebase SDK could not load. Please check your internet connection and reload index.html.";
    return;
  }

  var app =
    window.firebase.apps.length > 0
      ? window.firebase.app()
      : window.firebase.initializeApp(firebaseConfig);

  var auth = window.firebase.auth(app);
  try {
    auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
  } catch (e) {}

  var db = window.firebase.firestore(app);
  if (FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== "(default)") {
    try {
      var namedDelegate = app._delegate.container
        .getProvider("firestore")
        .getImmediate({ identifier: FIRESTORE_DATABASE_ID });
      db = new window.firebase.firestore.Firestore(
        app,
        namedDelegate,
        db._persistenceProvider
      );
    } catch (err) {
      console.warn("Named Firestore database fallback to default:", err);
    }
  }

  var rtdb = window.firebase.database(app);

  HMM.firebaseConfig = firebaseConfig;
  HMM.REALTIME_DATABASE_URL = REALTIME_DATABASE_URL;
  HMM.FIRESTORE_DATABASE_ID = FIRESTORE_DATABASE_ID;
  HMM.firebase = window.firebase;
  HMM.app = app;
  HMM.auth = auth;
  HMM.db = db;
  HMM.rtdb = rtdb;
  HMM.serverTimestamp = function () {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  };
  HMM.increment = function (n) {
    return window.firebase.firestore.FieldValue.increment(n);
  };
  HMM.rtdbServerTimestamp = function () {
    return window.firebase.database.ServerValue.TIMESTAMP;
  };
  HMM.rtdbIncrement = function (n) {
    return window.firebase.database.ServerValue.increment(n);
  };
})(window.HMM = window.HMM || {});
