'use strict';

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
let gameChannel;
let gameChannelReady = false;
let lastSeenCall = null;
let gameEnded = false;

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

if (!user) {
  document.body.innerHTML = `
    <div class="auth-blocked">
      <h1>🔒 Host Login Required</h1>
      <p>You must be logged in to host a Bingo game.</p>
      <button id="loginBtn">Log In</button>
    </div>
  `;

  document.getElementById("loginBtn").onclick = () => {
    window.location.href = "/WebsiteLogin/";
  };

  return;
}

    
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
gameChannel = sb.channel(`game-${gameId}`);
gameChannel.subscribe(status => {
    console.log("[HOST] Game channel:", status);
  if(status === "SUBSCRIBED"){ 
    gameChannelReady = true;
    startGameBtn.disabled = false;
  }
});
subscribeHostRealtime();
}

// ==========================================
// REALTIME
// ==========================================
function subscribeHostRealtime() {
  sb.channel("public:claims")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "claims" },
      async payload => {

        console.log("[HOST] Bingo claim received", payload);

        if (payload.new.game_id !== gameId) return;
        if (gameEnded) return; // ✔ correct guard

        const isValid = await validateClaim(payload.new);

        if (!isValid) {
          console.warn("[HOST] Invalid bingo claim");
          return;
        }

        handleVerifiedBingo(payload.new.player_id);
      }
    )
    .subscribe(status => {
      console.log("[HOST] Claims channel:", status);
    });
}
// ==========================================
// CONTROLS
// ==========================================
startGameBtn.onclick = async () => {
  gameActive = true;
  modeInputs.forEach(i => (i.disabled = true));
  await sb.from("games").update({ status: "active" }).eq("id", gameId);
  speak("Game started");
};

aiCallBtn.onclick = callNumber;

autoCallBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callNumber, speedInput.value * 1000);
};

stopAutoCallBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = null;
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
  if (autoTimer === null && !gameActive) return;

  // 🔒 HARD STOP after bingo
  if (gameEnded) return;
  
  const n = nextNumber();
  if (!n || called.has(n)) return;
  
  called.add(n);

  // UI + voice
  speak(formatCall(n));
  renderCurrentBall(n);
  renderCallHistory(n);

  //console.log("[HOST] Calling number:", n);

  // 1️⃣ Persist to DB (history / replay)
  const { error } = await sb.from("calls").insert({
    game_id: gameId,
    number: n
  });
  
 // 2️⃣ Broadcast live to players
broadcastCall(n);
  
  if (error) {
    console.error("[HOST] Call insert failed:", error);
    return;
  }
}

function broadcastCall(number) {
  /*
  if (!gameChannel || !gameChannelReady) {
    console.warn("[HOST] Channel not ready, cannot broadcast");
    return;
  }

  console.log("[HOST] Broadcasting:", number);
*/
  gameChannel.send({
    type: "broadcast",
    event: "call",
    payload: { number }
  });
}

function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) if (!called.has(i)) remaining.push(i);
  return remaining[Math.floor(Math.random() * remaining.length)];
}

async function validateClaim(claim) {
  const { data: player, error } = await sb
    .from("players")
    .select("card")
    .eq("id", claim.player_id)
    .single();

  if (error || !player) return false;

  const flatCard = player.card.flat();
  const calledSet = new Set([...called, 0]); // include FREE

  // simple row/column/diagonal check
  const wins = [
    // rows
    [0,1,2,3,4],
    [5,6,7,8,9],
    [10,11,12,13,14],
    [15,16,17,18,19],
    [20,21,22,23,24],
    // cols
    [0,5,10,15,20],
    [1,6,11,16,21],
    [2,7,12,17,22],
    [3,8,13,18,23],
    [4,9,14,19,24],
    // diagonals
    [0,6,12,18,24],
    [4,8,12,16,20]
  ];

  return wins.some(pattern =>
    pattern.every(i => calledSet.has(flatCard[i]))
  );
  //handleVerifiedBingo();
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
  if (!el) return;

  const letter = formatCall(number);

  // reset animation + state
  el.className = "current-ball";
  void el.offsetWidth;

  el.textContent = `${letter} ${number}`;
  el.classList.add(letter, "animate");
}

function renderCallHistory(number) {
  const callsEl = document.getElementById("calls");
  if (!callsEl) return;

  const div = document.createElement("div");
  div.className = "called-number";
  div.textContent = formatCall(number);
  callsEl.prepend(div);
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

function handleVerifiedBingo(playerId) {
  console.log("[HOST] Bingo verified");

  gameEnded = true;
  gameActive = false;
  
  // stop calling immediately
  if(autoTimer){
    clearInterval(autoTimer);
    autoTimer = null;
  }
  
  // disable controls
  aiCallBtn.disabled = true;
  autoCallBtn.disabled = true;
  stopAutoCallBtn.disabled = true;
  startGameBtn.disabled = true;

  speak("Bingo confirmed. Game over.");
  
  broadcastGameOver(playerId);
  endGame();
}
function broadcastGameOver(winnerId) {
  if (!gameChannel || !gameChannelReady) return;

  gameChannel.send({
    type: "broadcast",
    event: "game_over",
    payload: { winnerId }
  });
}

async function endGame() {
  clearInterval(autoTimer);
  gameActive = false;
  await sb.from("games").update({ status: "finished" }).eq("id", gameId);
  speak("Game over");
}
















































