// Entry point: wire UI to the game engine, audio, and Supabase.
import { Tetris } from "./tetris.js";
import { Audio } from "./audio.js";
import {
  isEnabled as supabaseEnabled,
  saveScore,
  fetchTopScores,
  submitFeedback,
  fetchFeedback,
} from "./supabase.js";

const $ = (id) => document.getElementById(id);

// --- Elements ---
const boardCanvas = $("board");
const nextCanvas  = $("next");
const overlay     = $("overlay");
const overlayTitle = $("overlay-title");
const overlayBody  = $("overlay-body");
const btnStart    = $("btn-start");
const btnPause    = $("btn-pause");
const btnMute     = $("btn-mute");
const statScore   = $("stat-score");
const statLines   = $("stat-lines");
const statLevel   = $("stat-level");

const leaderboardList = $("leaderboard-list");
const btnRefreshScores = $("btn-refresh-scores");

const feedbackForm = $("feedback-form");
const fbName = $("fb-name");
const fbMessage = $("fb-message");
const fbStatus = $("fb-status");
const feedbackList = $("feedback-list");

const saveModal = $("save-modal");
const saveScoreEl = $("save-score");
const saveName = $("save-name");
const saveSubmit = $("save-submit");
const saveSkip = $("save-skip");
const saveStatus = $("save-status");

// --- Audio ---
const audio = new Audio();

// --- Game ---
let lastGame = null;
const game = new Tetris({
  boardCanvas,
  nextCanvas,
  audio,
  onStats: ({ score, lines, level }) => {
    statScore.textContent = score;
    statLines.textContent = lines;
    statLevel.textContent = level;
  },
  onGameOver: ({ score, lines, level }) => {
    lastGame = { score, lines, level };
    overlayTitle.textContent = "Game Over";
    overlayBody.innerHTML = `Score <strong>${score}</strong> · Lines ${lines} · Level ${level}<br/>Press <kbd>R</kbd> or Start to play again.`;
    btnStart.textContent = "Restart";
    overlay.classList.remove("hidden");
    if (supabaseEnabled()) {
      saveScoreEl.textContent = score;
      saveName.value = "";
      saveStatus.textContent = "";
      saveModal.classList.remove("hidden");
      saveName.focus();
    }
  },
});

// --- UI wiring ---
async function startGame() {
  await audio.resume();
  audio.startBGM();
  overlay.classList.add("hidden");
  btnStart.textContent = "Restart";
  game.start();
}

btnStart.addEventListener("click", startGame);

btnPause.addEventListener("click", () => {
  if (!game.isPlaying() && !game.isPaused()) return;
  const paused = game.pause();
  if (paused === true) {
    overlayTitle.textContent = "Paused";
    overlayBody.textContent = "Press P to resume.";
    overlay.classList.remove("hidden");
  } else if (paused === false) {
    overlay.classList.add("hidden");
  }
});

btnMute.addEventListener("click", async () => {
  await audio.resume();
  const m = audio.toggleMute();
  btnMute.textContent = m ? "Unmute (M)" : "Mute (M)";
});

// --- Keyboard ---
const repeatKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowDown"]);
window.addEventListener("keydown", async (e) => {
  // Skip when user types in form fields
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (e.key === "Enter" && !game.isPlaying() && !game.isPaused()) {
    e.preventDefault();
    await startGame();
    return;
  }
  if (e.key.toLowerCase() === "r" && game.isOver()) {
    e.preventDefault();
    await startGame();
    return;
  }
  if (e.key.toLowerCase() === "p") {
    e.preventDefault();
    btnPause.click();
    return;
  }
  if (e.key.toLowerCase() === "m") {
    e.preventDefault();
    btnMute.click();
    return;
  }
  if (!game.isPlaying()) return;

  if (repeatKeys.has(e.key) && e.repeat) {
    // allow repeats, just route to handler below
  }

  switch (e.key) {
    case "ArrowLeft":  e.preventDefault(); game.moveLeft(); break;
    case "ArrowRight": e.preventDefault(); game.moveRight(); break;
    case "ArrowDown":  e.preventDefault(); game.softDrop(); break;
    case "ArrowUp":
    case "x": case "X": e.preventDefault(); game.rotateCW(); break;
    case "z": case "Z": e.preventDefault(); game.rotateCCW(); break;
    case " ": e.preventDefault(); game.hardDrop(); break;
  }
});

// --- Leaderboard ---
async function refreshLeaderboard() {
  if (!supabaseEnabled()) {
    leaderboardList.innerHTML = `<li class="placeholder">Supabase is not configured. Edit <code>config.js</code> to enable the leaderboard.</li>`;
    return;
  }
  leaderboardList.innerHTML = `<li class="placeholder">Loading…</li>`;
  try {
    const rows = await fetchTopScores(10);
    if (rows.length === 0) {
      leaderboardList.innerHTML = `<li class="placeholder">No scores yet — be the first!</li>`;
      return;
    }
    leaderboardList.innerHTML = "";
    for (const r of rows) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="nick"></span><span class="score"></span>`;
      li.querySelector(".nick").textContent = r.nickname;
      li.querySelector(".score").textContent = r.score.toLocaleString();
      leaderboardList.appendChild(li);
    }
  } catch (err) {
    console.error(err);
    leaderboardList.innerHTML = `<li class="placeholder">Failed to load leaderboard.</li>`;
  }
}
btnRefreshScores.addEventListener("click", refreshLeaderboard);

// --- Score save modal ---
saveSkip.addEventListener("click", () => saveModal.classList.add("hidden"));
saveSubmit.addEventListener("click", async () => {
  const nickname = saveName.value.trim();
  if (!nickname) { saveStatus.textContent = "Please enter a nickname."; return; }
  if (!lastGame) { saveModal.classList.add("hidden"); return; }
  saveSubmit.disabled = true;
  saveStatus.textContent = "Saving…";
  try {
    await saveScore({ nickname, ...lastGame });
    saveStatus.textContent = "Saved! ";
    saveModal.classList.add("hidden");
    refreshLeaderboard();
  } catch (err) {
    console.error(err);
    saveStatus.textContent = "Failed: " + (err.message || "unknown error");
  } finally {
    saveSubmit.disabled = false;
  }
});

// --- Feedback ---
async function refreshFeedback() {
  if (!supabaseEnabled()) {
    feedbackList.innerHTML = `<li class="placeholder">Supabase is not configured. Edit <code>config.js</code> to enable feedback.</li>`;
    return;
  }
  feedbackList.innerHTML = `<li class="placeholder">Loading…</li>`;
  try {
    const rows = await fetchFeedback(20);
    if (rows.length === 0) {
      feedbackList.innerHTML = `<li class="placeholder">No feedback yet.</li>`;
      return;
    }
    feedbackList.innerHTML = "";
    for (const r of rows) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="meta"><span class="name"></span><span class="time"></span></div>
        <div class="msg"></div>`;
      li.querySelector(".name").textContent = r.name || "Anonymous";
      li.querySelector(".time").textContent = formatTime(r.created_at);
      li.querySelector(".msg").textContent = r.message;
      feedbackList.appendChild(li);
    }
  } catch (err) {
    console.error(err);
    feedbackList.innerHTML = `<li class="placeholder">Failed to load feedback.</li>`;
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return d.toLocaleDateString();
  } catch { return ""; }
}

let lastFeedbackAt = 0;
feedbackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const now = Date.now();
  if (now - lastFeedbackAt < 10_000) {
    fbStatus.textContent = "Please wait a few seconds before posting again.";
    return;
  }
  const name = fbName.value;
  const message = fbMessage.value.trim();
  if (!message) { fbStatus.textContent = "Message is required."; return; }
  if (!supabaseEnabled()) {
    fbStatus.textContent = "Supabase is not configured.";
    return;
  }
  fbStatus.textContent = "Sending…";
  try {
    await submitFeedback({ name, message });
    lastFeedbackAt = now;
    fbMessage.value = "";
    fbStatus.textContent = "Thanks for the feedback!";
    refreshFeedback();
  } catch (err) {
    console.error(err);
    fbStatus.textContent = "Failed: " + (err.message || "unknown error");
  }
});

// --- Init ---
refreshLeaderboard();
refreshFeedback();
if (!supabaseEnabled()) {
  console.info("[supabase-tetris] Supabase is not configured — leaderboard/feedback are disabled. Edit config.js to enable them.");
}
