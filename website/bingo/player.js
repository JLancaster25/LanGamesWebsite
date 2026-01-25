// ==========================================
// SUPABASE CLIENT
// ==========================================
const sb = window.supabaseClient;

// ==========================================
// DOM ELEMENTS
// ==========================================
const lobbyEl = document.getElementById("lobby");
const gameEl = document.getElementById("game");
const joinForm = document.getElementById("joinForm");

const nameInput = document.getElementById("playerNameInput");
const roomInput = document.getElementById("roomCodeInput");
const lobbyError = document.getElementById("lobbyError");

const titleEl = document.getElementById("cardTitle");
const bingoCardEl = document.getElementById("bingoCard");
const calledNumbersListEl = document.getElementById("calledNumbersList");

// ==========================================
// APP STATE
// ==========================================
let gameId = null;
let playerName = null;
let userId = null;

// ==========================================
// GAME STATE (GLOBAL)
// ==========================================
const calledNumbers = new Set();   // numbers called by host
const markedNumbers = new Set();   // numbers player has marked

// ==========================================
// ENTRY POINT
// ==========================================
document.addEventListener("DOMContentLoaded", initPlayer);

// ==========================================
// INIT
// ==========================================
async function initPlayer() {
  userId = await getCurrentUserId();

  if (userId) {
    const displayName = await getDisplayUsername(userId);
    if (displayName) {
      nameInput.value = displayName;
      nameInput.readOnly = true;
    }
  }

  joinForm.addEventListener("submit", handleJoin);
}

// ==========================================
// JOIN HANDLER
// ==========================================
async function handleJoin(e) {
  e.preventDefault();
  showLobbyError("");

  playerName = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();

  if (!playerName) {
    return showLobbyError("Please enter your name.");
  }

  if (roomCode.length !== 7) {
    return showLobbyError("Room code must be 7 characters.");
  }

  const game = await fetchGameByCodeWithRetry(roomCode);
  if (!game) {
    return showLobbyError("Room not found. Try again.");
  }

  gameId = game.id;

  await joinGame(gameId, playerName, userId);

  lobbyEl.classList.add("hidden");
  gameEl.classList.remove("hidden");

  titleEl.textContent = `${playerName}'s Bingo Card`;

  renderBingoCard();
  await joinGame(gameId, playerName, userId);
  subscribeToCalls(gameId);
}

// ==========================================
// SUPABASE HELPERS
// ==========================================
async function getCurrentUserId() {
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.id ?? null;
}

async function getDisplayUsername(userId) {
  const { data } = await sb
    .from("profiles")
    .select("display_username")
    .eq("id", userId)
    .maybeSingle();

  return data?.display_username ?? null;
}

async function fetchGameByCodeWithRetry(code, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const { data } = await sb
      .from("games")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (data) return data;
    await sleep(500);
  }
  return null;
}

async function joinGame(gameId, name, userId) {
  const { data: existing } = await sb
    .from("claims")
    .select("id")
    .eq("game_id", gameId)
    .or(
      userId
        ? `user_id.eq.${userId}`
        : `player_name.eq.${name}`
    )
    .maybeSingle();

  if (existing) return;

  const { error } = await sb.from("claims").insert({
    game_id: gameId,
    user_id: userId,
    player_name: name,
    marked: []
  });

  if (error) throw error;
}

// ==========================================
// REALTIME CALLS
// ==========================================
function subscribeToCalls(gameId) {
  console.log("📡 Subscribing to calls for game:", gameId);

  sb.channel(`calls-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "calls",
        filter: `game_id=eq.${gameId}`
      },
      payload => {
        console.log("📣 Call received:", payload.new.number);
        handleCall(payload.new.number);
      }
    )
    .subscribe(status => {
      console.log("📡 Calls channel status:", status);
    });
}

// ==========================================
// BINGO CARD LOGIC
// ==========================================
function renderBingoCard() {
  bingoCardEl.innerHTML = "";
  markedNumbers.clear();
  cardNumbers = generateBingoNumbers();

  const headers = ["B", "I", "N", "G", "O"];

  headers.forEach(h => {
    const cell = document.createElement("div");
    cell.className = "bingo-cell header";
    cell.textContent = h;
    bingoCardEl.appendChild(cell);
  });

  for (let row = 0; row < 5; row++) {
    headers.forEach((col, colIndex) => {
      const cell = document.createElement("div");
      cell.className = "bingo-cell";

      if (row === 2 && colIndex === 2) {
        cell.textContent = "FREE";
        cell.classList.add("free", "marked");
      } else {
        const number = cardNumbers[col][row];
        cell.textContent = number;
        cell.dataset.number = number;
        cell.onclick = () => toggleMark(cell, number);
      }

      bingoCardEl.appendChild(cell);
    });
  }
}

function handleCall(number) {
  if (calledNumbers.has(number)) return;

  calledNumbers.add(number);

  // Show in called numbers UI
  const badge = document.createElement("div");
  badge.className = "called-number";
  badge.textContent = number;
  calledNumbersListEl.appendChild(badge);

  // Enable matching cell
  const cell = document.querySelector(
    `.bingo-cell[data-number="${number}"]`
  );

  if (cell) {
    cell.classList.add("call-available");
  }
}

function toggleMark(cell, number) {
  // ❌ Not called yet → cannot mark
  if (!calledNumbers.has(number)) return;

  cell.classList.toggle("marked");

  if (markedNumbers.has(number)) {
    markedNumbers.delete(number);
  } else {
    markedNumbers.add(number);
  }
}

// ==========================================
// UTIL
// ==========================================
function generateBingoNumbers() {
  return {
    B: shuffle(range(1, 15)).slice(0, 5),
    I: shuffle(range(16, 30)).slice(0, 5),
    N: shuffle(range(31, 45)).slice(0, 5),
    G: shuffle(range(46, 60)).slice(0, 5),
    O: shuffle(range(61, 75)).slice(0, 5)
  };
}

function range(min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => i + min);
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.toggle("hidden", !msg);
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}



