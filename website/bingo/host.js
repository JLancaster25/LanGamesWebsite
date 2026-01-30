'use strict';

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./supabaseClient.js"></script>
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

const startBtn = document.getElementById("startBtn");
const callBtn = document.getElementById("aiCallBtn");
const autoBtn = document.getElementById("autoCallBtn");
const stopBtn = document.getElementById("stopAutoCallBtn");
const newBtn = document.getElementById("newBtn");
const speedInput = document.getElementById("callSpeed");

const modeInputs = document.querySelectorAll(".modes input");

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
      await sb.from("winners").insert({
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
startBtn.onclick = async () => {
  gameActive = true;
  modeInputs.forEach(i => (i.disabled = true));
  await sb.from("games").update({ status: "active" }).eq("id", gameId);
  speak("Game started");
};

callBtn.onclick = callNumber;

autoBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callNumber, speedInput.value * 1000);
};

stopBtn.onclick = () => {
  clearInterval(autoTimer);
};

newBtn.onclick = async () => {
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

  await sb.from("calls").insert({
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
  const { data: player } = await sb
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







