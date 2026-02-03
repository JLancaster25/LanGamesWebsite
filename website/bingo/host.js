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
const hostWinnersEl = document.getElementById("hostWinners");
const hostWinnersListEl = document.getElementById("hostWinnersList");
const callsEl = document.getElementById("calls");

const startGameBtn = document.getElementById("startGameBtn");
const aiCallBtn = document.getElementById("aiCallBtn");
const autoCallBtn = document.getElementById("autoCallBtn");
const stopAutoCallBtn = document.getElementById("stopAutoCallBtn");
const newGameBtn = document.getElementById("newGameBtn")
const presenterToggleBtn = document.getElementById("presenterToggleBtn");;
const speedInput = document.getElementById("callSpeed");

let presenterMode = false;

const presenterLayer = document.getElementById("presenterLayer");
const ballField = document.getElementById("ballField");
const activeBall = document.getElementById("activeBall");
const activeBallText = document.getElementById("activeBallText");

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

const winners = new Map();

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
let claimsChannel;
let winnerTimeout = null;

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
gameChannel
  .on("broadcast", { event: "bingo_claim" }, async payload => {
    const { playerId } = payload.payload;

    if (gameEnded) return;
    if (winners.has(playerId)) return;

    const isValid = await validateClaim({ player_id: playerId });
    if (!isValid) return;

    // fetch name
    const { data: player } = await sb
      .from("players")
      .select("display_name")
      .eq("id", playerId)
      .single();

     winners.set(playerId, {name: player.display_name});
    console.log("[HOST] Bingo winner:", player.display_name);
    addPlayer(player.display_name)
    broadcastWinners();
    renderHostWinners();

    // ⏱ allow more winners for 2 seconds
    if (!winnerTimeout) {
      winnerTimeout = setTimeout(finalizeWinners, 2000);
    }
  });
 
  
}
function initPresenterBackground() {
  ballField.innerHTML = "";

  for (let i = 0; i < 25; i++) {
    const ball = document.createElement("div");
    ball.className = "bg-ball";

    ball.style.left = `${Math.random() * 100}%`;
    ball.style.animationDuration = `${15 + Math.random() * 20}s`;
    ball.style.animationDelay = `${Math.random() * 10}s`;

    ballField.appendChild(ball);
  }
}


// ==========================================
// REALTIME
// ==========================================
function subscribeHostRealtime() {
  claimsChannel = sb.channel("claims-listener");

  claimsChannel
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "claims" },
      payload => {
        console.log("[HOST] CLAIM EVENT RECEIVED:", payload);
      }
    )
    .subscribe(status => {
      console.log("[HOST] Claims channel status:", status);
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


presenterToggleBtn.onclick = () => {
  presenterMode = !presenterMode;

  presenterLayer.classList.toggle("hidden", !presenterMode);

  if (presenterMode) {
    initPresenterBackground();
  }
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
  
  if (presenterMode) {
    animatePresenterBall(n);
  }
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

function animatePresenterBall(number) {
  activeBallText.textContent = formatCall(number);
  activeBall.classList.remove("hidden", "roll-away");
  activeBall.classList.add("show");

  // Hold center
  setTimeout(() => {
    activeBall.classList.remove("show");
    activeBall.classList.add("roll-away");
  }, 2000);

  // Reset
  setTimeout(() => {
    activeBall.classList.add("hidden");
    activeBall.classList.remove("roll-away");
  }, 3000);
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
  console.log("ValidateClaim Triggered");
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

function broadcastWinners() {
  gameChannel.send({
    type: "broadcast",
    event: "winners_update",
    payload: {
      winners: Array.from(winners.values())
    }
  });
}

function renderHostWinners() {
  if (!hostWinnersEl || !hostWinnersListEl) return;

  hostWinnersListEl.innerHTML = "";

  for (const w of winners.values()) {
    const li = document.createElement("li");
    li.textContent = `${w.name} (${formatPattern(w.pattern)})`;
    hostWinnersListEl.appendChild(li);
  }

  hostWinnersEl.classList.remove("hidden");
}

function formatPattern(p) {
  return {
    cross: "Cross",
    blackout: "Blackout",
    four_corners: "4 Corners"
  }[p] ?? p;
}

function finalizeWinners() {
  console.log("[HOST] Finalizing winners");

  gameEnded = true;
  gameActive = false;

  clearInterval(autoTimer);
  autoTimer = null;

  aiCallBtn.disabled = true;
  autoCallBtn.disabled = true;
  stopAutoCallBtn.disabled = true;

  gameChannel.send({
    type: "broadcast",
    event: "game_over",
    payload: {
      winners: Array.from(winners.values())
    }
  });

  endGame();
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
























































