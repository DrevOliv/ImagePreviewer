const FOLDER_SVG = `
  <svg class="folder-icon" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
    <path d="M6 14c0-2.2 1.8-4 4-4h14l6 6h24c2.2 0 4 1.8 4 4v30c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V14z"/>
  </svg>`;

const TREE_FOLDER_SVG = `<svg viewBox="0 0 64 64" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 14c0-2.2 1.8-4 4-4h14l6 6h24c2.2 0 4 1.8 4 4v30c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V14z"/></svg>`;

const TREE_ARROW_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5l8 7-8 7z"/></svg>`;

const PLAY_BADGE_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

const VIDEO_EXTS = new Set(["mp4", "webm", "m4v", "mov", "ogv", "ogg"]);

const state = {
  path: "",
  folders: [],
  files: [],
  previewable: [],   // files array filtered to items we can preview
  likedSet: new Set(),
  lightboxIndex: -1,
  likedView: false,
  lightboxLoading: false,
  selectMode: false,
  selected: new Set(),
};

const CHECKBOX_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const el = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  loading: document.getElementById("loading"),
  location: document.getElementById("location"),
  sizeChip: document.getElementById("size-chip"),
  sizeChipLabel: document.getElementById("size-chip-label"),
  tree: document.getElementById("tree"),
  logout: document.getElementById("logout-btn"),
  likesBtn: document.getElementById("likes-btn"),
  selectBtn: document.getElementById("select-btn"),
  selectAllBtn: document.getElementById("select-all-btn"),
  uploadBtn: document.getElementById("upload-btn"),
  uploadInput: document.getElementById("upload-input"),
  uploadToast: document.getElementById("upload-toast"),
  uploadToastTitle: document.getElementById("upload-toast-title"),
  uploadToastPct: document.getElementById("upload-toast-pct"),
  uploadBarFill: document.getElementById("upload-bar-fill"),
  uploadToastDetail: document.getElementById("upload-toast-detail"),
  dupModal: document.getElementById("dup-modal"),
  dupMsg: document.getElementById("dup-msg"),
  dupAll: document.getElementById("dup-all"),
  dupAllLabel: document.getElementById("dup-all-label"),
  dupSkip: document.getElementById("dup-skip"),
  dupUpload: document.getElementById("dup-upload"),
  newFolderBtn: document.getElementById("new-folder-btn"),
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menu-btn"),
  backBtn: document.getElementById("back-btn"),
  sidebarClose: document.getElementById("sidebar-close"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalInput: document.getElementById("modal-input"),
  modalError: document.getElementById("modal-error"),
  modalConfirm: document.getElementById("modal-confirm"),
  modalCancel: document.getElementById("modal-cancel"),
  downloadWrap: document.getElementById("download-wrap"),
  downloadBtn: document.getElementById("download-btn"),
  downloadLabel: document.getElementById("download-label"),
  downloadMenu: document.getElementById("download-menu"),
  lightbox: document.getElementById("lightbox"),
  lbImage: document.getElementById("lb-image"),
  lbVideo: document.getElementById("lb-video"),
  lbVideoWrap: document.getElementById("lb-video-wrap"),
  lbSpinner: document.getElementById("lb-spinner"),
  vcBigPlay: document.getElementById("vc-big-play"),
  vcPlay: document.getElementById("vc-play"),
  vcCurrent: document.getElementById("vc-current"),
  vcDuration: document.getElementById("vc-duration"),
  vcScrub: document.getElementById("vc-scrub"),
  vcMute: document.getElementById("vc-mute"),
  vcFs: document.getElementById("vc-fs"),
  lbFs: document.getElementById("lb-fs"),
  lbPrev: document.getElementById("lb-prev"),
  lbNext: document.getElementById("lb-next"),
  lbClose: document.getElementById("lb-close"),
  lbLike: document.getElementById("lb-like"),
  lbFilename: document.getElementById("lb-filename"),
  lbCounter: document.getElementById("lb-counter"),
};

// ───── API ─────
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function loadLikes() {
  const data = await api("/api/likes");
  state.likedSet = new Set(data.liked);
}

async function toggleLike(path) {
  const data = await api("/api/likes/toggle", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (data.liked) state.likedSet.add(data.path);
  else state.likedSet.delete(data.path);
  return data.liked;
}

// ───── Navigation ─────
// `push` controls the browser history: opening a folder pushes a new entry so
// the phone/hardware back button (and the in-app one) walks back out of it,
// while refreshes and back/forward themselves only replace the current entry.
async function navigate(path, { push = true } = {}) {
  state.likedView = false;
  el.likesBtn.classList.remove("active");
  showLoading(true);
  cancelFullPreviewWarm();
  try {
    const data = await api(`/api/browse?path=${encodeURIComponent(path)}`);
    state.path = data.path === "." ? "" : data.path;
    state.folders = data.folders;
    state.files = data.files;
    state.previewable = data.files.filter((f) => f.previewable);
    const url = `#/${state.path}`;
    if (push && location.hash !== url) {
      window.history.pushState({ path: state.path }, "", url);
    } else {
      window.history.replaceState({ path: state.path }, "", url);
    }
    render();
    revealAndSelect(state.path);
    warmFullPreviews();
  } catch (err) {
    if (err.message !== "unauthorized") alert(err.message);
  } finally {
    showLoading(false);
  }
}

// The parent of "a/b/c" is "a/b"; the parent of a top-level folder is the root.
function parentPath(path) {
  if (!path) return "";
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

// The toolbar back button: step up one folder (or leave the liked view). It
// always targets the *parent*, regardless of how the user got here.
function goBack() {
  if (state.likedView) {
    navigate(state.path || "");
    return;
  }
  if (!state.path) return; // already at the root
  navigate(parentPath(state.path));
}

// Reflect whether there's anywhere to go back to (hidden at the root).
function updateBackButton() {
  const canGoBack = state.likedView || !!state.path;
  el.backBtn.classList.toggle("hidden", !canGoBack);
}

// Browser / hardware back & forward. With the lightbox open, the back press
// just closes it (its history entry sits on top of the folder's). Otherwise
// re-load whatever folder the URL now names.
window.addEventListener("popstate", () => {
  if (!el.lightbox.classList.contains("hidden")) {
    closeLightbox();
    return;
  }
  const target = decodeURIComponent((location.hash || "").replace(/^#\/?/, ""));
  navigate(target, { push: false });
});

async function showLikedView() {
  state.likedView = true;
  el.likesBtn.classList.add("active");
  showLoading(true);
  cancelFullPreviewWarm();
  try {
    const { liked } = await api("/api/likes");
    state.likedSet = new Set(liked);
    state.folders = [];
    state.files = liked.map((p) => {
      const extension = (p.split(".").pop() || "").toLowerCase();
      return {
        name: p.split("/").pop(),
        path: p,
        type: "file",
        previewable: true,
        is_video: VIDEO_EXTS.has(extension),
        extension,
      };
    });
    state.previewable = state.files;
    renderLiked();
    clearTreeSelection();
    warmFullPreviews();
  } catch (err) {
    if (err.message !== "unauthorized") alert(err.message);
  } finally {
    showLoading(false);
  }
}

// ───── Render ─────
function render() {
  el.location.textContent = state.path ? state.path : "Home";
  // Uploading and folder creation act on the current directory; hide them
  // in the liked view, which isn't a real folder.
  el.uploadBtn.classList.remove("hidden");
  el.newFolderBtn.classList.remove("hidden");
  resetSizeChip();
  updateBackButton();
  renderGrid();
}

function renderLiked() {
  el.location.textContent = "Liked Images";
  el.uploadBtn.classList.add("hidden");
  el.newFolderBtn.classList.add("hidden");
  el.sizeChip.classList.add("hidden");
  updateBackButton();
  renderGrid();
}

// ───── Folder size ─────
// Computing a folder's size walks the whole subtree, which is slow on a big or
// sluggish drive — so we never do it automatically. The chip sits idle until
// the user taps it, then shows a spinner while the scan runs.
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

// Token guards against a slow scan landing after the user moved to another
// folder, and against double-taps while one is already in flight.
let folderSizeToken = 0;
let folderSizeBusy = false;

function resetSizeChip() {
  folderSizeToken++; // invalidate any in-flight scan from the previous folder
  folderSizeBusy = false;
  el.sizeChip.classList.remove("hidden", "is-loading");
  el.sizeChip.title = "Calculate this folder's size on disk";
  el.sizeChipLabel.textContent = "Calculate size";
}

async function calculateFolderSize() {
  if (folderSizeBusy || state.likedView) return;
  folderSizeBusy = true;
  const token = ++folderSizeToken;
  const path = state.path;
  el.sizeChip.classList.add("is-loading");
  el.sizeChipLabel.textContent = "Calculating…";
  try {
    const data = await api(`/api/browse/size?path=${encodeURIComponent(path)}`);
    if (token !== folderSizeToken) return; // user navigated away
    el.sizeChipLabel.textContent =
      `${formatBytes(data.bytes)} · ${data.files} file${data.files === 1 ? "" : "s"}`;
    el.sizeChip.title = "Tap to recalculate";
  } catch (err) {
    if (token !== folderSizeToken) return;
    el.sizeChipLabel.textContent = "Calculate size";
    if (err.message !== "unauthorized") el.sizeChip.title = "Couldn't read size — tap to retry";
  } finally {
    if (token === folderSizeToken) {
      el.sizeChip.classList.remove("is-loading");
      folderSizeBusy = false;
    }
  }
}

const HEART_BADGE_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21s-7.5-4.58-10-9.13C.49 8.36 2.42 5 5.5 5c1.74 0 3.41.81 4.5 2.09C11.09 5.81 12.76 5 14.5 5 17.58 5 19.51 8.36 18 11.87 19.5 16.42 12 21 12 21z"/></svg>`;

// Build a path → fast-lookup map so delegated click handlers can find the
// corresponding file in O(1) on huge folders.
let pathIndex = new Map();

// ───── Incremental grid rendering ─────
// A very big folder can hold thousands of items. Building every tile up front
// blocks the main thread for hundreds of ms, so we render in batches: the
// first batch paints immediately and the rest stream in as the user scrolls
// (or until the viewport is full).
const RENDER_BATCH = 80;
const RENDER_AHEAD_PX = 800;
let renderQueue = [];      // ordered {kind, data} entries not yet in the DOM
let renderObserver = null; // fires when the trailing sentinel nears the viewport
let gridSentinel = null;

function teardownIncrementalRender() {
  if (renderObserver) {
    renderObserver.disconnect();
    renderObserver = null;
  }
  if (gridSentinel) {
    gridSentinel.remove();
    gridSentinel = null;
  }
  renderQueue = [];
}

function renderNextBatch() {
  const batch = renderQueue.splice(0, RENDER_BATCH);
  const fragment = document.createDocumentFragment();
  for (const entry of batch) {
    fragment.appendChild(
      entry.kind === "folder" ? folderTile(entry.data) : fileTile(entry.data),
    );
  }
  el.grid.insertBefore(fragment, gridSentinel);
}

// Render a batch, then keep going on later frames while the sentinel is still
// near the viewport. An IntersectionObserver alone won't do this: it only
// fires when intersection *changes*, so a sentinel that stays on-screen after
// a batch never re-triggers. The rAF loop fills that gap.
function pumpRender() {
  if (renderQueue.length === 0) {
    teardownIncrementalRender();
    return;
  }
  renderNextBatch();
  requestAnimationFrame(() => {
    if (renderQueue.length === 0 || !gridSentinel) {
      teardownIncrementalRender();
      return;
    }
    const rect = gridSentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + RENDER_AHEAD_PX) pumpRender();
  });
}

// Grid <video> thumbnails are mounted lazily AND throttled. A live <video> per
// tile streams the real file off the (possibly slow) drive and holds one of the
// browser's scarce decoder slots, so mounting a whole folder of them at once
// craters scrolling. The IntersectionObserver below decides which tiles are
// *eligible*; this queue then streams at most VIDEO_THUMB_CONCURRENCY at a time
// and frees the slot the moment a frame decodes (or the tile scrolls away).
const VIDEO_THUMB_CONCURRENCY = 3;
let videoLoadQueue = [];   // nodes waiting for a free slot (FIFO)
let videoLoadActive = 0;   // how many are streaming right now

function resetVideoThumbQueue() {
  videoLoadQueue = [];
  videoLoadActive = 0;
}

function pumpVideoQueue() {
  while (videoLoadActive < VIDEO_THUMB_CONCURRENCY && videoLoadQueue.length) {
    const node = videoLoadQueue.shift();
    const video = node.querySelector("video");
    if (!video) continue;
    delete video.dataset.queued;
    // It may have scrolled away (and been dropped) while waiting in line.
    if (!node.isConnected || !video.dataset.src || video.getAttribute("src")) continue;
    startVideoThumb(video);
  }
}

function startVideoThumb(video) {
  const thumb = video.parentElement;
  video.dataset.loading = "1";
  videoLoadActive++;
  if (!video.classList.contains("loaded")) thumb.classList.add("loading");
  let timer;
  const release = () => {
    if (video.dataset.loading !== "1") return; // already released
    delete video.dataset.loading;
    clearTimeout(timer);
    videoLoadActive = Math.max(0, videoLoadActive - 1);
    pumpVideoQueue();
  };
  // Free the slot as soon as the first frame is decoded (or it errors out).
  video.addEventListener("loadeddata", release, { once: true });
  video.addEventListener("error", release, { once: true });
  // Safety net: a fetch can stall on a slow drive — never let it block the queue.
  timer = setTimeout(release, 12000);
  video.setAttribute("src", video.dataset.src);
  video.load();
}

const videoThumbObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const node = entry.target;
      const video = node.querySelector("video");
      if (!video) continue;
      const thumb = video.parentElement;
      if (entry.isIntersecting) {
        // Eligible to load: queue it unless it's already queued/loading/loaded.
        if (!video.getAttribute("src") && video.dataset.src && video.dataset.queued !== "1") {
          video.dataset.queued = "1";
          videoLoadQueue.push(node);
          pumpVideoQueue();
        }
      } else {
        // Off-screen: pull it from the queue and/or drop the src so the slot,
        // decoder and connection are freed for tiles that are actually visible.
        if (video.dataset.queued === "1") {
          const i = videoLoadQueue.indexOf(node);
          if (i !== -1) videoLoadQueue.splice(i, 1);
          delete video.dataset.queued;
        }
        if (video.dataset.loading === "1") {
          delete video.dataset.loading;
          videoLoadActive = Math.max(0, videoLoadActive - 1);
          pumpVideoQueue();
        }
        if (video.getAttribute("src")) {
          video.removeAttribute("src");
          video.load();
          video.classList.remove("loaded");
          thumb.classList.remove("loading");
        }
      }
    }
  },
  { rootMargin: "400px 0px" },
);

function renderGrid() {
  const items = state.folders.length + state.files.length;
  el.empty.classList.toggle("hidden", items > 0);

  pathIndex = new Map();
  state.folders.forEach((f, i) => pathIndex.set(f.path, { kind: "folder", data: f, i }));
  state.files.forEach((f, i) => pathIndex.set(f.path, { kind: "file", data: f, i }));

  teardownIncrementalRender();
  videoThumbObserver.disconnect();
  resetVideoThumbQueue();
  el.grid.replaceChildren();

  renderQueue = [
    ...state.folders.map((data) => ({ kind: "folder", data })),
    ...state.files.map((data) => ({ kind: "file", data })),
  ];

  // The sentinel trails the grid; when it scrolls near the viewport we append
  // the next batch of tiles.
  gridSentinel = document.createElement("div");
  gridSentinel.className = "grid-sentinel";
  el.grid.appendChild(gridSentinel);

  renderObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) pumpRender();
    },
    { rootMargin: `${RENDER_AHEAD_PX}px 0px` },
  );
  renderObserver.observe(gridSentinel);

  pumpRender();
  updateSelectAllButton();
}

function folderTile(folder) {
  const node = document.createElement("div");
  node.className = "item";
  node.dataset.path = folder.path;
  node.dataset.kind = "folder";
  node.innerHTML = `
    <div class="item-thumb">${FOLDER_SVG}</div>
    <div class="item-name">${escapeHtml(folder.name)}</div>
  `;
  node.appendChild(selectCheckbox());
  if (state.selected.has(folder.path)) node.classList.add("selected");
  return node;
}

function fileTile(file) {
  const node = document.createElement("div");
  node.className = "item";
  node.dataset.path = file.path;
  node.dataset.kind = "file";
  const liked = state.likedSet.has(file.path);

  const thumb = document.createElement("div");
  thumb.className = "item-thumb";
  if (file.is_video) {
    thumb.classList.add("video");
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    // The src is attached by videoThumbObserver only while the tile is near
    // the viewport — see the observer above for why.
    video.dataset.src = `/api/video?path=${encodeURIComponent(file.path)}#t=0.1`;
    video.addEventListener("loadeddata", () => {
      video.classList.add("loaded");
      thumb.classList.remove("loading");
    });
    video.addEventListener("error", () => {
      thumb.classList.remove("loading");
    });
    thumb.appendChild(video);
    const badge = document.createElement("div");
    badge.className = "play-badge";
    badge.innerHTML = PLAY_BADGE_SVG;
    thumb.appendChild(badge);
    videoThumbObserver.observe(node);
  } else if (file.previewable) {
    thumb.classList.add("loading");
    const img = document.createElement("img");
    img.alt = file.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      thumb.classList.remove("loading");
    });
    img.addEventListener("error", () => {
      thumb.classList.remove("loading");
    });
    img.src = `/api/preview?path=${encodeURIComponent(file.path)}&size=thumbnail`;
    thumb.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = file.extension || "FILE";
    thumb.appendChild(ph);
  }

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = file.name;

  node.appendChild(thumb);
  node.appendChild(name);

  if (liked) node.appendChild(heartBadge());
  node.appendChild(selectCheckbox());
  if (state.selected.has(file.path)) node.classList.add("selected");
  return node;
}

function selectCheckbox() {
  const box = document.createElement("div");
  box.className = "select-checkbox";
  box.innerHTML = CHECKBOX_SVG;
  return box;
}

function heartBadge() {
  const badge = document.createElement("div");
  badge.className = "heart-badge";
  badge.innerHTML = HEART_BADGE_SVG;
  return badge;
}

function updateTileLiked(path, liked) {
  const tile = el.grid.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!tile) return;
  const existing = tile.querySelector(".heart-badge");
  if (liked && !existing) tile.appendChild(heartBadge());
  else if (!liked && existing) existing.remove();
}

// One delegated click listener for the whole grid.
let lastTap = { path: null, time: 0 };
el.grid.addEventListener("click", (e) => {
  const tile = e.target.closest(".item");
  if (!tile) return;
  const entry = pathIndex.get(tile.dataset.path);
  if (!entry) return;

  if (state.selectMode) {
    toggleSelected(entry.data.path, tile);
    return;
  }

  if (entry.kind === "folder") {
    // Touch devices open a folder on a single tap; mouse keeps double-click.
    if (isTouch()) {
      navigate(entry.data.path);
      return;
    }
    const now = Date.now();
    if (lastTap.path === entry.data.path && now - lastTap.time < 300) {
      navigate(entry.data.path);
    }
    lastTap = { path: entry.data.path, time: now };
    return;
  }

  if (entry.data.previewable) {
    const idx = state.previewable.findIndex((f) => f.path === entry.data.path);
    if (idx >= 0) openLightbox(idx);
  }
});

el.grid.addEventListener("dblclick", (e) => {
  if (state.selectMode) return;
  const tile = e.target.closest(".item[data-kind='folder']");
  if (!tile) return;
  const entry = pathIndex.get(tile.dataset.path);
  if (entry) navigate(entry.data.path);
});

// ───── Sidebar tree ─────
function buildTreeNode(folder, depth) {
  const li = document.createElement("li");
  li.className = "tree-node";
  li.dataset.path = folder.path;
  li.dataset.depth = String(depth);
  li.dataset.loaded = "false";
  if (folder.has_subfolders === false) {
    li.classList.add("is-leaf");
  }

  const row = document.createElement("div");
  row.className = "tree-row";
  row.style.setProperty("--depth", String(depth));

  const arrow = document.createElement("button");
  arrow.className = "tree-arrow";
  arrow.type = "button";
  arrow.tabIndex = -1;
  arrow.setAttribute("aria-label", "Expand");
  arrow.innerHTML = TREE_ARROW_SVG;

  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.innerHTML = TREE_FOLDER_SVG;

  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = folder.name;

  row.append(icon, label, arrow);

  const children = document.createElement("ul");
  children.className = "tree-children";

  li.append(row, children);
  return li;
}

async function loadChildren(li) {
  if (li.dataset.loaded === "true") return;
  const path = li.dataset.path;
  const depth = parseInt(li.dataset.depth, 10) + 1;
  const children = li.querySelector(":scope > .tree-children");
  try {
    const data = await api(`/api/browse?path=${encodeURIComponent(path)}`);
    children.replaceChildren();
    for (const folder of data.folders) {
      children.appendChild(buildTreeNode(folder, depth));
    }
    if (data.folders.length === 0) li.classList.add("is-leaf");
    li.dataset.loaded = "true";
  } catch (err) {
    if (err.message !== "unauthorized") console.warn("tree load failed", err);
  }
}

async function toggleNode(li, expand) {
  const shouldExpand =
    expand === undefined ? !li.classList.contains("expanded") : expand;
  if (shouldExpand) {
    await loadChildren(li);
    li.classList.add("expanded");
  } else {
    li.classList.remove("expanded");
  }
}

function clearTreeSelection() {
  el.tree.querySelectorAll(".tree-row.selected").forEach((r) =>
    r.classList.remove("selected"),
  );
}

async function revealAndSelect(targetPath) {
  clearTreeSelection();
  if (!targetPath) return;

  const parts = targetPath.split("/");
  let currentLi = Array.from(el.tree.children).find(
    (li) => li.dataset.path === parts[0],
  );
  if (!currentLi) return;
  await toggleNode(currentLi, true);

  let acc = parts[0];
  for (let i = 1; i < parts.length; i++) {
    acc = `${acc}/${parts[i]}`;
    const childUl = currentLi.querySelector(":scope > .tree-children");
    const nextLi = Array.from(childUl.children).find(
      (c) => c.dataset.path === acc,
    );
    if (!nextLi) break;
    await toggleNode(nextLi, true);
    currentLi = nextLi;
  }

  const row = currentLi.querySelector(":scope > .tree-row");
  row.classList.add("selected");
  row.scrollIntoView({ block: "nearest" });
}

async function initTree() {
  el.tree.replaceChildren();
  try {
    const data = await api(`/api/browse?path=`);
    for (const folder of data.folders) {
      el.tree.appendChild(buildTreeNode(folder, 0));
    }
  } catch (err) {
    if (err.message !== "unauthorized") console.warn("tree init failed", err);
  }
}

el.tree.addEventListener("click", async (e) => {
  const arrow = e.target.closest(".tree-arrow");
  const row = e.target.closest(".tree-row");
  if (!row) return;
  const li = row.closest(".tree-node");
  if (!li) return;

  if (arrow) {
    e.stopPropagation();
    await toggleNode(li);
    return;
  }

  clearTreeSelection();
  row.classList.add("selected");

  // On touch, a single tap opens the folder and dismisses the drawer. Mouse
  // keeps select-on-click / navigate-on-dblclick.
  if (isTouch()) {
    closeSidebar();
    await navigate(li.dataset.path);
  }
});

el.tree.addEventListener("dblclick", async (e) => {
  if (e.target.closest(".tree-arrow")) return;
  const row = e.target.closest(".tree-row");
  if (!row) return;
  const li = row.closest(".tree-node");
  if (!li) return;
  await navigate(li.dataset.path);
});

// ───── Sidebar drawer (mobile) ─────
const mobileQuery = window.matchMedia("(max-width: 768px)");

// Whether to open folders on a single tap. This is a pointer check, not a
// width check, so it stays correct on a phone in landscape or on a tablet:
// touch devices get single-tap, mouse devices keep file-manager double-click.
const touchQuery = window.matchMedia("(pointer: coarse)");
function isTouch() {
  return touchQuery.matches;
}

function openSidebar() {
  el.sidebar.classList.add("open");
  el.sidebarBackdrop.classList.remove("hidden");
}

function closeSidebar() {
  el.sidebar.classList.remove("open");
  el.sidebarBackdrop.classList.add("hidden");
}

function toggleSidebar() {
  if (el.sidebar.classList.contains("open")) closeSidebar();
  else openSidebar();
}

el.menuBtn.addEventListener("click", toggleSidebar);
el.backBtn.addEventListener("click", goBack);
el.sidebarClose.addEventListener("click", closeSidebar);
el.sidebarBackdrop.addEventListener("click", closeSidebar);
el.sizeChip.addEventListener("click", calculateFolderSize);

// A drawer left open while rotating to a wide layout would otherwise linger.
mobileQuery.addEventListener("change", (e) => {
  if (!e.matches) closeSidebar();
});

// ───── Lightbox ─────
function openLightbox(index) {
  state.lightboxIndex = index;
  el.lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  // Push a history entry so the phone/hardware back button closes the viewer
  // first, instead of stepping out of the folder behind it.
  window.history.pushState({ path: state.path, lightbox: true }, "", location.hash);
  showLightboxImage();
}

// User-initiated close (X, backdrop, Escape): unwind the history entry we
// pushed on open, which fires popstate → closeLightbox().
function dismissLightbox() {
  if (window.history.state && window.history.state.lightbox) {
    window.history.back();
  } else {
    closeLightbox();
  }
}

function closeLightbox() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  el.lightbox.classList.add("hidden");
  document.body.style.overflow = "";
  el.lbImage.src = "";
  el.lbImage.classList.remove("loaded");
  resetVideo();
  el.lbSpinner.classList.add("hidden");
  state.lightboxLoading = false;
  state.lightboxIndex = -1;
}

function resetVideo() {
  el.lbVideo.pause();
  el.lbVideo.removeAttribute("src");
  el.lbVideo.load();
  el.lbVideoWrap.classList.add("hidden");
  el.lbVideoWrap.classList.remove("playing");
  el.lightbox.classList.remove("idle");
  stopIdleTimer();
}

function setLightboxLoading(loading) {
  state.lightboxLoading = loading;
  el.lbSpinner.classList.toggle("hidden", !loading);
  updateLightboxNavDisabled();
}

function updateLightboxNavDisabled() {
  el.lbPrev.disabled =
    state.lightboxLoading || state.lightboxIndex === 0;
  el.lbNext.disabled =
    state.lightboxLoading ||
    state.lightboxIndex === state.previewable.length - 1;
}

function showLightboxImage() {
  const file = state.previewable[state.lightboxIndex];
  if (!file) return;
  setLightboxLoading(true);

  if (file.is_video) {
    el.lbImage.classList.add("hidden");
    el.lbImage.src = "";
    el.lbImage.classList.remove("loaded");
    el.lbVideoWrap.classList.remove("hidden", "playing");
    el.lightbox.classList.remove("idle");
    resetVideoUi();
    el.lbVideo.src = `/api/video?path=${encodeURIComponent(file.path)}`;
    el.lbVideo.load();
  } else {
    resetVideo();
    el.lbImage.classList.remove("hidden", "loaded");
    el.lbImage.src = `/api/preview?path=${encodeURIComponent(file.path)}&size=full`;
    if (el.lbImage.complete && el.lbImage.naturalWidth > 0) {
      el.lbImage.classList.add("loaded");
      setLightboxLoading(false);
    }
    preloadNeighbors();
  }

  el.lbFilename.textContent = file.name;
  el.lbCounter.textContent = `${state.lightboxIndex + 1} / ${state.previewable.length}`;
  el.lbLike.classList.toggle("liked", state.likedSet.has(file.path));
}

el.lbImage.addEventListener("load", () => {
  if (el.lightbox.classList.contains("hidden")) return;
  el.lbImage.classList.add("loaded");
  setLightboxLoading(false);
});

el.lbImage.addEventListener("error", () => {
  setLightboxLoading(false);
});

el.lbVideo.addEventListener("canplay", () => {
  if (el.lightbox.classList.contains("hidden")) return;
  setLightboxLoading(false);
});

el.lbVideo.addEventListener("error", () => {
  setLightboxLoading(false);
});

// ───── Custom video controls ─────
function formatTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function togglePlay() {
  if (el.lbVideo.paused) el.lbVideo.play();
  else el.lbVideo.pause();
}

el.vcPlay.addEventListener("click", togglePlay);
el.vcBigPlay.addEventListener("click", togglePlay);
el.lbVideo.addEventListener("click", togglePlay);

el.lbVideo.addEventListener("play", () => {
  el.lbVideoWrap.classList.add("playing");
  startIdleTimer();
});
el.lbVideo.addEventListener("pause", () => {
  el.lbVideoWrap.classList.remove("playing");
  el.lightbox.classList.remove("idle");
  stopIdleTimer();
});
el.lbVideo.addEventListener("ended", () => {
  el.lbVideoWrap.classList.remove("playing");
  el.lightbox.classList.remove("idle");
  stopIdleTimer();
});

el.lbVideo.addEventListener("loadedmetadata", () => {
  el.vcDuration.textContent = formatTime(el.lbVideo.duration);
  el.vcScrub.max = String(el.lbVideo.duration || 0);
});

el.lbVideo.addEventListener("timeupdate", () => {
  el.vcCurrent.textContent = formatTime(el.lbVideo.currentTime);
  const dur = el.lbVideo.duration || 0;
  const pct = dur > 0 ? (el.lbVideo.currentTime / dur) * 100 : 0;
  el.vcScrub.value = String(el.lbVideo.currentTime);
  el.vcScrub.style.backgroundSize = `${pct}% 100%`;
});

el.vcScrub.addEventListener("input", () => {
  el.lbVideo.currentTime = parseFloat(el.vcScrub.value) || 0;
});

el.vcMute.addEventListener("click", () => {
  el.lbVideo.muted = !el.lbVideo.muted;
});
el.lbVideo.addEventListener("volumechange", () => {
  el.lbVideoWrap.classList.toggle("muted", el.lbVideo.muted);
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else el.lightbox.requestFullscreen?.();
}
el.vcFs.addEventListener("click", toggleFullscreen);
el.lbFs.addEventListener("click", toggleFullscreen);

// Auto-hide controls while playing
let idleTimer = null;
let lastPointer = { x: 0, y: 0, t: 0 };

function startIdleTimer() {
  stopIdleTimer();
  idleTimer = setTimeout(() => {
    if (!el.lbVideo.paused) el.lightbox.classList.add("idle");
  }, 2500);
}
function stopIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}
function wakeControls() {
  el.lightbox.classList.remove("idle");
  if (!el.lbVideo.paused) startIdleTimer();
}

// Ignore sub-pixel jitter and events closer than 80ms apart so a stationary
// cursor doesn't keep resetting the hide timer.
el.lightbox.addEventListener("pointermove", (e) => {
  if (el.lbVideoWrap.classList.contains("hidden")) return;
  const now = performance.now();
  const dx = Math.abs(e.clientX - lastPointer.x);
  const dy = Math.abs(e.clientY - lastPointer.y);
  if (dx + dy < 3 || now - lastPointer.t < 80) return;
  lastPointer = { x: e.clientX, y: e.clientY, t: now };
  wakeControls();
});
el.lbVideoWrap.addEventListener("touchstart", wakeControls);

function resetVideoUi() {
  el.vcCurrent.textContent = "0:00";
  el.vcDuration.textContent = "0:00";
  el.vcScrub.max = "0";
  el.vcScrub.value = "0";
  el.vcScrub.style.backgroundSize = "0% 100%";
}

const PRELOAD_AHEAD = 2;
const PRELOAD_BEHIND = 1;
const preloadCache = new Map();

// Background warming of full-size previews after entering a directory. Fires
// HTTP requests so the server-side cache fills before the user opens the
// lightbox; browser HTTP cache then serves the lightbox <img> instantly.
const WARM_CONCURRENCY = 2;
// Warming every full-size preview in a huge folder would saturate the server
// and starve the visible thumbnails, so only warm a bounded leading window —
// the lightbox preloads neighbours on demand for anything past it.
const WARM_LIMIT = 60;
let warmController = null;

function cancelFullPreviewWarm() {
  if (warmController) {
    warmController.abort();
    warmController = null;
  }
}

function warmFullPreviews() {
  cancelFullPreviewWarm();
  const targets = state.previewable
    .filter((f) => !f.is_video)
    .slice(0, WARM_LIMIT);
  if (targets.length === 0) return;

  const controller = new AbortController();
  warmController = controller;
  let cursor = 0;

  const worker = async () => {
    while (!controller.signal.aborted) {
      const i = cursor++;
      if (i >= targets.length) return;
      const file = targets[i];
      try {
        const res = await fetch(
          `/api/preview?path=${encodeURIComponent(file.path)}&size=full`,
          { signal: controller.signal, credentials: "same-origin" },
        );
        // Drain the body so the browser commits it to the HTTP cache.
        if (res.ok) await res.blob();
      } catch (_) {
        // Ignore aborts and transient failures; lightbox will retry on open.
      }
    }
  };

  for (let i = 0; i < WARM_CONCURRENCY; i++) worker();
}

function preload(index) {
  const file = state.previewable[index];
  if (!file || file.is_video) return;
  if (preloadCache.has(file.path)) return;
  const img = new Image();
  img.src = `/api/preview?path=${encodeURIComponent(file.path)}&size=full`;
  preloadCache.set(file.path, img);
  if (preloadCache.size > 8) {
    const firstKey = preloadCache.keys().next().value;
    preloadCache.delete(firstKey);
  }
}

function preloadNeighbors() {
  for (let i = 1; i <= PRELOAD_AHEAD; i++) preload(state.lightboxIndex + i);
  for (let i = 1; i <= PRELOAD_BEHIND; i++) preload(state.lightboxIndex - i);
}

function lightboxNext() {
  if (state.lightboxLoading) return;
  if (state.lightboxIndex < state.previewable.length - 1) {
    state.lightboxIndex += 1;
    showLightboxImage();
  }
}

function lightboxPrev() {
  if (state.lightboxLoading) return;
  if (state.lightboxIndex > 0) {
    state.lightboxIndex -= 1;
    showLightboxImage();
  }
}

async function toggleCurrentLike() {
  const file = state.previewable[state.lightboxIndex];
  if (!file) return;
  try {
    const liked = await toggleLike(file.path);
    el.lbLike.classList.toggle("liked", liked);
    el.lbLike.classList.remove("pop");
    void el.lbLike.offsetWidth;
    el.lbLike.classList.add("pop");
    updateTileLiked(file.path, liked);
  } catch (err) {
    if (err.message !== "unauthorized") alert(err.message);
  }
}

// ───── Select & Download ─────
function toggleSelectMode() {
  state.selectMode = !state.selectMode;
  if (!state.selectMode) state.selected.clear();
  document.body.classList.toggle("select-mode", state.selectMode);
  el.selectBtn.classList.toggle("active", state.selectMode);
  // On the mobile tab bar the Select tab doubles as the way out of select
  // mode, so label it accordingly.
  const selectLabel = el.selectBtn.querySelector(".btn-label");
  if (selectLabel) selectLabel.textContent = state.selectMode ? "Done" : "Select";
  refreshSelectionClasses();
  updateDownloadButton();
  updateSelectAllButton();
}

function toggleSelected(path, tile) {
  if (state.selected.has(path)) {
    state.selected.delete(path);
    tile.classList.remove("selected");
  } else {
    state.selected.add(path);
    tile.classList.add("selected");
  }
  updateDownloadButton();
  updateSelectAllButton();
}

function visiblePaths() {
  const paths = [];
  for (const f of state.folders) paths.push(f.path);
  for (const f of state.files) paths.push(f.path);
  return paths;
}

function allVisibleSelected() {
  const paths = visiblePaths();
  if (paths.length === 0) return false;
  for (const p of paths) if (!state.selected.has(p)) return false;
  return true;
}

function toggleSelectAll() {
  const paths = visiblePaths();
  if (paths.length === 0) return;
  if (allVisibleSelected()) {
    for (const p of paths) state.selected.delete(p);
  } else {
    for (const p of paths) state.selected.add(p);
  }
  refreshSelectionClasses();
  updateDownloadButton();
  updateSelectAllButton();
}

function updateSelectAllButton() {
  el.selectAllBtn.classList.toggle("hidden", !state.selectMode);
  el.selectAllBtn.classList.toggle("active", state.selectMode && allVisibleSelected());
}

function refreshSelectionClasses() {
  el.grid.querySelectorAll(".item").forEach((tile) => {
    tile.classList.toggle("selected", state.selected.has(tile.dataset.path));
  });
}

function updateDownloadButton() {
  const count = state.selected.size;
  const show = state.selectMode && count > 0;
  el.downloadWrap.classList.toggle("hidden", !show);
  el.downloadLabel.textContent = count > 0 ? `Download (${count})` : "Download";
  if (!show) closeDownloadMenu();
}

function toggleDownloadMenu() {
  el.downloadMenu.classList.toggle("hidden");
}

function closeDownloadMenu() {
  el.downloadMenu.classList.add("hidden");
}

function downloadSelected(format) {
  if (!state.selected.size) return;
  const paths = Array.from(state.selected);

  // POST into a hidden iframe so the browser streams the response directly to
  // its download UI. The save dialog appears as soon as bytes start arriving,
  // without blocking or replacing the current page.
  let iframe = document.getElementById("__download-iframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.name = "__download";
    iframe.id = "__download-iframe";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/download";
  form.target = "__download";
  form.style.display = "none";
  for (const p of paths) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "paths";
    input.value = p;
    form.appendChild(input);
  }
  const fmt = document.createElement("input");
  fmt.type = "hidden";
  fmt.name = "format";
  fmt.value = format || "original";
  form.appendChild(fmt);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

// ───── Upload & New folder ─────
function setUploadLabel(text) {
  const label = el.uploadBtn.querySelector(".btn-label");
  if (label) label.textContent = text;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

let uploadToastTimer = null;

function showUploadToast({ state: cls = "", title, pct, detail }) {
  clearTimeout(uploadToastTimer);
  el.uploadToast.classList.remove("hidden", "processing", "done", "error");
  if (cls) el.uploadToast.classList.add(cls);
  if (title != null) el.uploadToastTitle.textContent = title;
  if (detail != null) el.uploadToastDetail.textContent = detail;
  if (cls === "processing") {
    // Let the CSS sweep animation drive the bar; clear any inline width so the
    // class-based rule applies, and show a spinner-style label.
    el.uploadBarFill.style.width = "";
    el.uploadToastPct.textContent = "•••";
  } else if (pct != null) {
    el.uploadToastPct.textContent = `${pct}%`;
    el.uploadBarFill.style.width = `${pct}%`;
  }
}

function hideUploadToast(delay = 0) {
  clearTimeout(uploadToastTimer);
  uploadToastTimer = setTimeout(() => {
    el.uploadToast.classList.add("hidden");
  }, delay);
}

// Files whose name collides with something already in the current folder.
function findConflicts(files) {
  const existing = new Set([
    ...state.files.map((f) => f.name),
    ...state.folders.map((f) => f.name),
  ]);
  return files.filter((f) => existing.has(f.name));
}

// Show the duplicate dialog for one file. Resolves to { choice, all } where
// choice is "skip" or "upload" and `all` means apply it to every remaining one.
let dupResolve = null;

function openDupModal(name, remaining) {
  return new Promise((resolve) => {
    dupResolve = resolve;
    const more = remaining > 1 ? ` (${remaining} duplicates)` : "";
    el.dupMsg.innerHTML =
      `<strong>${escapeHtml(name)}</strong> already exists in this folder.`;
    el.dupAllLabel.textContent =
      remaining > 1 ? `Do this for all ${remaining} duplicates` : "Do this for all duplicates";
    el.dupAll.checked = false;
    el.dupAll.parentElement.style.display = remaining > 1 ? "" : "none";
    el.dupModal.classList.remove("hidden");
  });
}

function closeDupModal(choice) {
  if (!dupResolve) return;
  const resolve = dupResolve;
  dupResolve = null;
  el.dupModal.classList.add("hidden");
  resolve({ choice, all: el.dupAll.checked });
}

el.dupSkip.addEventListener("click", () => closeDupModal("skip"));
el.dupUpload.addEventListener("click", () => closeDupModal("upload"));
el.dupModal.addEventListener("click", (e) => {
  // Click on the backdrop = skip this file (the safe, non-destructive choice).
  if (e.target === el.dupModal) closeDupModal("skip");
});

// Ask about each colliding file and return the files that should be uploaded.
async function resolveConflicts(files) {
  const conflicts = findConflicts(files);
  if (conflicts.length === 0) return files;

  const skip = new Set();
  let applyAll = null;
  for (let i = 0; i < conflicts.length; i++) {
    let choice = applyAll;
    if (!choice) {
      const res = await openDupModal(conflicts[i].name, conflicts.length - i);
      choice = res.choice;
      if (res.all) applyAll = choice;
    }
    if (choice === "skip") skip.add(conflicts[i]);
  }
  return files.filter((f) => !skip.has(f));
}

async function uploadFiles(fileList) {
  let files = Array.from(fileList || []);
  if (files.length === 0 || state.likedView) return;

  files = await resolveConflicts(files);
  if (files.length === 0) return;   // everything was skipped

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const noun = files.length === 1 ? "file" : "files";

  const form = new FormData();
  form.append("path", state.path || "");
  for (const file of files) form.append("files", file);

  // XHR (not fetch) so the upload progress event can drive the progress bar.
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");

  el.uploadBtn.disabled = true;
  setUploadLabel("Uploading…");
  showUploadToast({
    title: `Uploading ${files.length} ${noun}`,
    pct: 0,
    detail: `0 / ${formatBytes(totalBytes)}`,
  });

  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    setUploadLabel(`Uploading ${pct}%`);
    if (e.loaded >= e.total) {
      // Bytes are all sent; the server is now writing the files to disk. There
      // is no further byte progress to report, so show an indeterminate state
      // instead of a bar stuck at 100%.
      showUploadToast({
        state: "processing",
        title: `Saving ${files.length} ${noun}…`,
        detail: "Almost done — writing to disk",
      });
    } else {
      showUploadToast({
        title: `Uploading ${files.length} ${noun}`,
        pct,
        detail: `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`,
      });
    }
  });

  const reset = () => {
    el.uploadBtn.disabled = false;
    setUploadLabel("Upload");
  };

  xhr.addEventListener("load", async () => {
    reset();
    if (xhr.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (xhr.status >= 200 && xhr.status < 300) {
      let count = files.length;
      try { count = JSON.parse(xhr.responseText).saved.length || count; } catch (_) {}
      showUploadToast({
        state: "done",
        title: `Uploaded ${count} ${count === 1 ? "file" : "files"}`,
        pct: 100,
        detail: formatBytes(totalBytes),
      });
      hideUploadToast(2500);
      await navigate(state.path || "", { push: false });
    } else {
      let detail = `Upload failed (${xhr.status})`;
      try { detail = JSON.parse(xhr.responseText).detail || detail; } catch (_) {}
      showUploadToast({ state: "error", title: "Upload failed", pct: 100, detail });
      hideUploadToast(5000);
    }
  });

  xhr.addEventListener("error", () => {
    reset();
    showUploadToast({
      state: "error",
      title: "Upload failed",
      pct: 100,
      detail: "Network error — check your connection and try again",
    });
    hideUploadToast(5000);
  });

  xhr.addEventListener("abort", () => {
    reset();
    hideUploadToast();
  });

  xhr.send(form);
}

// A small in-app prompt dialog, used instead of window.prompt so it looks and
// behaves identically on desktop and phone. `onSubmit(value)` may return an
// error string to show inline (dialog stays open) or nothing to close it.
let modalOnSubmit = null;
let modalSubmitting = false;

function openPromptModal({ title, placeholder = "", confirmText = "OK", onSubmit }) {
  modalOnSubmit = onSubmit;
  modalSubmitting = false;
  el.modalTitle.textContent = title;
  el.modalInput.value = "";
  el.modalInput.placeholder = placeholder;
  el.modalConfirm.textContent = confirmText;
  el.modalConfirm.disabled = false;
  el.modalError.textContent = "";
  el.modal.classList.remove("hidden");
  // Focus once the dialog has painted so mobile keyboards open reliably.
  requestAnimationFrame(() => el.modalInput.focus());
}

function closePromptModal() {
  modalOnSubmit = null;
  el.modal.classList.add("hidden");
}

async function submitPromptModal() {
  if (modalSubmitting || !modalOnSubmit) return;
  modalSubmitting = true;
  el.modalConfirm.disabled = true;
  el.modalError.textContent = "";
  try {
    const error = await modalOnSubmit(el.modalInput.value.trim());
    if (error) {
      el.modalError.textContent = error;
      el.modalInput.focus();
      el.modalInput.select();
    } else {
      closePromptModal();
    }
  } catch (err) {
    el.modalError.textContent = err.message || "Something went wrong.";
  } finally {
    modalSubmitting = false;
    el.modalConfirm.disabled = false;
  }
}

el.modalConfirm.addEventListener("click", submitPromptModal);
el.modalCancel.addEventListener("click", closePromptModal);
el.modal.addEventListener("click", (e) => {
  if (e.target === el.modal) closePromptModal();
});
el.modalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitPromptModal();
  }
});

function createFolder() {
  if (state.likedView) return;
  openPromptModal({
    title: "New folder",
    placeholder: "Folder name",
    confirmText: "Create",
    onSubmit: async (name) => {
      if (!name) return "Please enter a folder name.";
      if (name.includes("/") || name.includes("\\")) {
        return "The name can't contain slashes.";
      }
      const form = new FormData();
      form.append("path", state.path || "");
      form.append("name", name);
      const res = await fetch("/api/upload/folder", { method: "POST", body: form });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return body.detail || `Could not create folder (${res.status}).`;
      }
      closePromptModal();
      await initTree();                 // surface the new folder in the sidebar
      await navigate(state.path || "", { push: false });
    },
  });
}

el.uploadBtn.addEventListener("click", () => el.uploadInput.click());
el.uploadInput.addEventListener("change", () => {
  uploadFiles(el.uploadInput.files);
  el.uploadInput.value = "";            // allow re-picking the same file
});
el.newFolderBtn.addEventListener("click", createFolder);

// ───── Helpers ─────
function showLoading(on) {
  el.loading.classList.toggle("hidden", !on);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ───── Events ─────
el.logout.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
});

el.likesBtn.addEventListener("click", () => {
  if (state.likedView) navigate(state.path || "", { push: false });
  else showLikedView();
});

el.selectBtn.addEventListener("click", toggleSelectMode);
el.selectAllBtn.addEventListener("click", toggleSelectAll);
el.downloadBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleDownloadMenu();
});

el.downloadMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".download-menu-item");
  if (!item) return;
  closeDownloadMenu();
  downloadSelected(item.dataset.format);
});

document.addEventListener("click", (e) => {
  if (el.downloadMenu.classList.contains("hidden")) return;
  if (!el.downloadWrap.contains(e.target)) closeDownloadMenu();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDownloadMenu();
    closeSidebar();
    closePromptModal();
    closeDupModal("skip");
  }
});

el.lbClose.addEventListener("click", dismissLightbox);
el.lbPrev.addEventListener("click", lightboxPrev);
el.lbNext.addEventListener("click", lightboxNext);
el.lbLike.addEventListener("click", toggleCurrentLike);
el.lightbox.addEventListener("click", (e) => {
  if (e.target === el.lightbox || e.target.classList.contains("lightbox-stage")) {
    dismissLightbox();
  }
});

// Swipe left/right to move between images. Disabled while a video is showing
// so it doesn't fight the scrubber and playback controls.
let lbTouch = null;
el.lightbox.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1 || !el.lbVideoWrap.classList.contains("hidden")) {
    lbTouch = null;
    return;
  }
  lbTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

el.lightbox.addEventListener("touchend", (e) => {
  if (!lbTouch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - lbTouch.x;
  const dy = t.clientY - lbTouch.y;
  lbTouch = null;
  // Require a clearly horizontal flick.
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx < 0) lightboxNext();
  else lightboxPrev();
}, { passive: true });

document.addEventListener("keydown", (e) => {
  if (el.lightbox.classList.contains("hidden")) return;
  const videoActive = !el.lbVideoWrap.classList.contains("hidden");
  const onScrubber = document.activeElement === el.vcScrub;
  if (e.key === "Escape") dismissLightbox();
  else if (e.key === " " && videoActive) { e.preventDefault(); togglePlay(); }
  else if (e.key === "ArrowLeft" && !onScrubber) lightboxPrev();
  else if (e.key === "ArrowRight" && !onScrubber) lightboxNext();
  else if (e.key.toLowerCase() === "h") toggleCurrentLike();
});

// ───── Init ─────
(async function init() {
  try {
    await loadLikes();
    await initTree();
    const initial = decodeURIComponent((window.location.hash || "").replace(/^#\/?/, ""));
    await navigate(initial, { push: false });
  } catch (err) {
    if (err.message !== "unauthorized") alert(err.message);
  }
})();
