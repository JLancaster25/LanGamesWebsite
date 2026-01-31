'use strict';
//sb = window.supabaseClient;

if (!sb) {
  console.error("❌ Supabase client not loaded");
}
// ==========================================
// AI VOICE
// ==========================================
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ==========================================
// DOM
// ==========================================
const roomCodeEl = document.getElementById("roomCode");
const playerListEl = document.getElementById("playerList");
const callsEl = document.getElementById("calls");

const startGameBtn = document.getElementById("startGameBtn");
const aiCallBtn = document.getElementById("aiCallBtn");
const autoCallBtn = document.getElementById("autoCallBtn");
const stopAutoCallBtn = document.getElementById("stopAutoCallBtn");
const newGameBtn = document.getElementById("newGameBtn");
const speedInput = document.getElementById("callSpeed");

const modeInputs = document.querySelectorAll(".modes input");
[
  ["roomCode", roomCodeEl],
  ["startGameBtn", startGameBtn],
  ["newGameBtn", newGameBtn],
  ["aiCallBtn", aiCallBtn],
  ["autoCallBtn", autoCallBtn],
  ["stopAutoCallBtn", stopAutoCallBtn],
  ["playerList", playerListEl],
  ["calls", callsEl]
].forEach(([name, el]) => {
  if (!el) console.error(`❌ Missing DOM element: ${name}`);
});

// ==========================================
// STATE
// ==========================================
let gameId;
let gameActive = false;
let autoTimer = null;
const called = new Set();

// ==========================================
// INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initHost();
});

async function initHost() {
const {
  data: { user }
} = await sb.auth.getUser();

if (!user) throw new Error("Host not logged in");

const roomCode = generateCode();
roomCodeEl.textContent = roomCode;

const { data: game } = await sb
  .from("games")
  .insert({
    code: roomCode,
    host_id: user.id,
    status: "lobby",
    modes: ["normal"]
  })
  .select()
  .single();

gameId = game.id;
}

// ==========================================
// REALTIME
// ==========================================
sb.channel(`players-${gameId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "players" },
    p => {
      if (p.new.game_id === gameId) addPlayer(p.new.display_name);
    }
  )
  .subscribe();

sb.channel(`calls-${gameId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "calls" },
    p => {
      if (p.new.game_id === gameId) renderCall(formatCall(p.new.number));
    }
  )
  .subscribe();

sb.channel(`claims-${gameId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "claims" },
    async p => {
      if (!gameActive) return;
      const valid = await validateClaim(p.new);
      if (!valid) return;

      speak("Bingo!");
      await window.sb.from("winners").insert({
        game_id: gameId,
        player_id: p.new.player_id,
        pattern: p.new.pattern
      });
      endGame();
    }
  )
  .subscribe();

// ==========================================
// CONTROLS
// ==========================================
startGameBtn.onclick = async () => {
  gameActive = true;
  modeInputs.forEach(i => (i.disabled = true));
  await window.sb.from("games").update({ status: "active" }).eq("id", gameId);
  speak("Game started");
};

aiCallBtn.onclick = callNumber;

autoCallBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callNumber, speedInput.value * 1000);
};

stopAutoCallBtn.onclick = () => {
  clearInterval(autoTimer);
};

newGameBtn.onclick = async () => {
  called.clear();
  callsEl.innerHTML = "";
  gameActive = false;
  modeInputs.forEach(i => (i.disabled = false));
  await sb.from("games").update({ status: "lobby" }).eq("id", gameId);
};

// ==========================================
// GAME LOGIC
// ==========================================
async function callNumber() {
  if (!gameActive) return;
  const n = nextNumber();
  if (!n) return;

  called.add(n);
  speak(formatCall(n));

  await window.sb.from("calls").insert({
    game_id: gameId,
    number: n
  });
}

function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) if (!called.has(i)) remaining.push(i);
  return remaining[Math.floor(Math.random() * remaining.length)];
}

async function validateClaim(claim) {
  const { data: player } = await window.sb
    .from("players")
    .select("card")
    .eq("id", claim.player_id)
    .single();

  if (!player) return false;
  return true; // authoritative validation placeholder
}

// ==========================================
// UI
// ==========================================
function addPlayer(name) {
  const li = document.createElement("li");
  li.textContent = name;
  playerListEl.appendChild(li);
}

function renderCall(text) {
  const span = document.createElement("span");
  span.textContent = text;
  callsEl.prepend(span);
}

function renderCurrentBall(number) {
  const el = document.getElementById("currentBall");
  if (el) el.textContent = number;
}

function renderCallHistory(number) {
  const callsEl = document.getElementById("calls");
  if (!callsEl) return;

  const div = document.createElement("div");
  div.className = "called-number";
  div.textContent = formatCall(number);
  callsEl.prepend(div);
}

function subscribeHostCalls() {
  sb.channel(`calls-${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "calls" },
      payload => {
        if (payload.new.game_id !== gameId) return;

        const number = payload.new.number;
        renderCurrentBall(number);
        renderCallHistory(number);
      }
    )
    .subscribe();
}
//gameId = game.id;
subscribeHostCalls();

function formatCall(n) {
  const l =
    n <= 15 ? "B" :
    n <= 30 ? "I" :
    n <= 45 ? "N" :
    n <= 60 ? "G" : "O";
  return `${l} ${n}`;
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

async function endGame() {
  clearInterval(autoTimer);
  gameActive = false;
  await sb.from("games").update({ status: "finished" }).eq("id", gameId);
  speak("Game over");
}



















