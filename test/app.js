(() => {
"use strict";

const UNLOCK_MS = 3000;
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const webFrame = document.getElementById("webFrame");
const youtubePlayer = document.getElementById("youtubePlayer");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const pocketButton = document.getElementById("pocketButton");
const lockOverlay = document.getElementById("lockOverlay");
const unlockProgress = document.getElementById("unlockProgress");

let wakeLock = null;
let pocketMode = false;
let holdTimer = null;
let holdStart = 0;

/* =========================
   デバッグ表示
========================= */

const debugPanel = document.createElement("div");

debugPanel.style.position = "fixed";
debugPanel.style.top = "10px";
debugPanel.style.left = "10px";
debugPanel.style.zIndex = "99999";
debugPanel.style.background = "rgba(0,0,0,0.85)";
debugPanel.style.color = "#00ff88";
debugPanel.style.padding = "10px";
debugPanel.style.fontSize = "12px";
debugPanel.style.fontFamily = "monospace";
debugPanel.style.lineHeight = "1.5";
debugPanel.style.maxWidth = "90vw";
debugPanel.style.pointerEvents = "none";
debugPanel.style.whiteSpace = "pre-wrap";

debugPanel.textContent = "DEBUG START";

document.body.appendChild(debugPanel);

function debug(message) {
  const time = new Date().toLocaleTimeString();

  debugPanel.textContent =
    `${time}\n` +
    `pocketMode: ${pocketMode}\n` +
    `holdStart: ${holdStart ? "YES" : "NO"}\n` +
    `holdTimer: ${holdTimer !== null ? "YES" : "NO"}\n` +
    `progress: ${unlockProgress.style.width || "0%"}\n\n` +
    message;
}


/* =========================
   URL
========================= */

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL("https://" + trimmed);
    } catch {
      return null;
    }
  }
}

function getYouTubeVideoId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "shorts" || parts[0] === "embed") {
      return parts[1] || null;
    }
  }

  return null;
}

function showOnly(element) {
  [emptyState, webFrame, youtubePlayer, errorState]
    .forEach(el => el.hidden = el !== element);
}

function showError(message) {
  errorState.textContent = message;
  showOnly(errorState);
}

function loadUrl() {
  const url = normalizeUrl(urlInput.value);

  if (!url || !/^https?:$/.test(url.protocol)) {
    showError("http:// または https:// のURLを入力してください。");
    return;
  }

  localStorage.setItem("pocketWeb.lastUrl", url.href);

  const videoId = getYouTubeVideoId(url);

  if (videoId) {
    loadYouTube(videoId);
  } else {
    loadWebPage(url.href);
  }
}

function loadYouTube(videoId) {
  youtubePlayer.innerHTML = "";

  const iframe = document.createElement("iframe");

  iframe.src =
    "https://www.youtube.com/embed/" +
    encodeURIComponent(videoId) +
    "?autoplay=1&playsinline=1&rel=0";

  iframe.title = "YouTube video";

  iframe.allow =
    "autoplay; encrypted-media; picture-in-picture; fullscreen";

  iframe.allowFullscreen = true;

  youtubePlayer.appendChild(iframe);

  showOnly(youtubePlayer);
}

function loadWebPage(url) {
  youtubePlayer.innerHTML = "";
  webFrame.src = url;
  showOnly(webFrame);
}


/* =========================
   Wake Lock
========================= */

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    debug("Wake Lock API unavailable");
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    debug("Wake Lock acquired");
  } catch (e) {
    console.warn("Wake Lock unavailable:", e);
    debug("Wake Lock ERROR");
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;

  try {
    await wakeLock.release();
  } catch {}

  wakeLock = null;

  debug("Wake Lock released");
}


/* =========================
   Pocket Mode
========================= */

async function enterPocketMode() {
  if (pocketMode) return;

  pocketMode = true;

  lockOverlay.hidden = false;

  lockOverlay.setAttribute("aria-hidden", "false");

  pocketButton.textContent = "ポケットモード中";

  debug("ENTER POCKET MODE");

  await requestWakeLock();
}

async function exitPocketMode() {
  debug("EXIT POCKET MODE");

  pocketMode = false;

  lockOverlay.hidden = true;

  lockOverlay.setAttribute("aria-hidden", "true");

  pocketButton.textContent = "ポケットモード";

  stopHold();

  await releaseWakeLock();
}


/* =========================
   Long Press
========================= */

function stopHold() {
  debug("stopHold()");

  holdStart = 0;

  if (holdTimer !== null) {
    cancelAnimationFrame(holdTimer);
  }

  holdTimer = null;

  unlockProgress.style.width = "0%";
}

function startHold(event) {
  debug(
    "START HOLD\n" +
    "event: " + event.type
  );

  if (!pocketMode) {
    debug("startHold ignored: pocketMode=false");
    return;
  }

  event.preventDefault();

  stopHold();

  holdStart = performance.now();

  debug(
    "HOLD STARTED\n" +
    "event: " + event.type
  );

  const update = () => {
    if (!holdStart) {
      debug("update stopped: holdStart=0");
      return;
    }

    const progress = Math.min(
      (performance.now() - holdStart) / UNLOCK_MS,
      1
    );

    unlockProgress.style.width =
      (progress * 100) + "%";

    if (progress >= 1) {

      debug(
        "3 SECONDS REACHED\n" +
        "UNLOCK"
      );

      stopHold();

      exitPocketMode();

    } else {

      holdTimer =
        requestAnimationFrame(update);
    }
  };

  holdTimer =
    requestAnimationFrame(update);
}

function cancelHold(event) {

  debug(
    "CANCEL HOLD\n" +
    "event: " + (event ? event.type : "none")
  );

  if (event) {
    event.preventDefault();
  }

  stopHold();
}


/* =========================
   iPhone / iPad
========================= */

lockOverlay.addEventListener(
  "touchstart",
  startHold,
  {
    passive: false
  }
);

lockOverlay.addEventListener(
  "touchmove",
  event => {

    debug("touchmove");

    if (!pocketMode) return;

    event.preventDefault();

  },
  {
    passive: false
  }
);

lockOverlay.addEventListener(
  "touchend",
  cancelHold,
  {
    passive: false
  }
);

lockOverlay.addEventListener(
  "touchcancel",
  cancelHold,
  {
    passive: false
  }
);


/* =========================
   PC / Pointer Events
========================= */

lockOverlay.addEventListener(
  "pointerdown",
  startHold,
  {
    passive: false
  }
);

lockOverlay.addEventListener(
  "pointerup",
  cancelHold,
  {
    passive: false
  }
);

lockOverlay.addEventListener(
  "pointercancel",
  cancelHold,
  {
    passive: false
  }
);


/* =========================
   Context Menu
========================= */

lockOverlay.addEventListener(
  "contextmenu",
  event => {
    event.preventDefault();
    debug("contextmenu");
  }
);


/* =========================
   Visibility
========================= */

document.addEventListener(
  "visibilitychange",
  () => {

    debug(
      "visibilitychange: " +
      document.visibilityState
    );

    if (
      document.visibilityState === "visible" &&
      pocketMode
    ) {
      requestWakeLock();
    }
  }
);


/* =========================
   Saved URL
========================= */

const savedUrl =
  localStorage.getItem("pocketWeb.lastUrl");

if (savedUrl) {
  urlInput.value = savedUrl;
}


/* =========================
   Service Worker
========================= */

if (
  "serviceWorker" in navigator &&
  window.isSecureContext
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .catch(console.warn);

    }
  );
}


/* =========================
   Initial Debug
========================= */

debug("READY");

})();
