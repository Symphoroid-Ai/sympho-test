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
let pocketMode = true;
let holdTimer = null;
let holdStart = 0;
function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try { return new URL(trimmed); }
  catch { try { return new URL("https://" + trimmed); } catch { return null; } }
}
function getYouTubeVideoId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed") return parts[1] || null;
  }
  return null;
}
function showOnly(element) {
  [emptyState, webFrame, youtubePlayer, errorState].forEach(el => el.hidden = el !== element);
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
  if (videoId) loadYouTube(videoId);
  else loadWebPage(url.href);
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
async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {
    console.warn("Wake Lock unavailable:", e);
  }
}
async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {}
  wakeLock = null;
}
async function enterPocketMode() {
  if (pocketMode) return;
  pocketMode = true;
  lockOverlay.hidden = false;
  lockOverlay.setAttribute("aria-hidden", "false");
  pocketButton.textContent = "ポケットモード中";
  await requestWakeLock();
}
async function exitPocketMode() {
  pocketMode = false;
  lockOverlay.hidden = true;
  lockOverlay.setAttribute("aria-hidden", "true");
  pocketButton.textContent = "ポケットモード";
  stopHold();
  await releaseWakeLock();
}
function stopHold() {
  holdStart = 0;
  if (holdTimer !== null) {
    cancelAnimationFrame(holdTimer);
  }
  holdTimer = null;
  unlockProgress.style.width = "0%";
}
function startHold(event) {
  if (!pocketMode) return;
  event.preventDefault();
  stopHold();
  holdStart = performance.now();
  const update = () => {
    if (!holdStart) return;
    const progress = Math.min(
      (performance.now() - holdStart) / UNLOCK_MS,
      1
    );
    unlockProgress.style.width = (progress * 100) + "%";
    if (progress >= 1) {
      stopHold();
      exitPocketMode();
    } else {
      holdTimer = requestAnimationFrame(update);
    }
  };
  holdTimer = requestAnimationFrame(update);
}
function cancelHold(event) {
  if (event) event.preventDefault();
  stopHold();
}
/* iPhone / iPad 用 */
lockOverlay.addEventListener("touchstart", startHold, {
  passive: false
});
lockOverlay.addEventListener("touchmove", event => {
  if (!pocketMode) return;
  event.preventDefault();
}, {
  passive: false
});
lockOverlay.addEventListener("touchend", cancelHold, {
  passive: false
});
lockOverlay.addEventListener("touchcancel", cancelHold, {
  passive: false
});
/* PC用 */
lockOverlay.addEventListener("pointerdown", startHold, {
  passive: false
});
lockOverlay.addEventListener("pointerup", cancelHold, {
  passive: false
});
lockOverlay.addEventListener("pointercancel", cancelHold, {
  passive: false
});
lockOverlay.addEventListener("contextmenu", event => {
  event.preventDefault();
});
/* 初期状態：ポケットモードON */
lockOverlay.hidden = false;
lockOverlay.setAttribute("aria-hidden", "false");
pocketButton.textContent = "ポケットモード中";
requestWakeLock();
/* Wake Lock再取得 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && pocketMode) {
    requestWakeLock();
  }
});
const savedUrl = localStorage.getItem("pocketWeb.lastUrl");
if (savedUrl) {
  urlInput.value = savedUrl;
}
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}
})();
