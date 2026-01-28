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
const daubColor = localStorage.getItem("bingo_daub_color") || "#7c4dff"; 

const bingoBtn = document.getElementById("bingoBtn");
const bingoMessage = document.getElementById("bingoMessage");
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
let cardNumbers = {};  
let cardPositionMap = {};
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
  const {data: { user }} = await sb.auth.getUser();
   if (user) {
  // Try Supabase profile first
  const { data, error } = await sb
    .from("profiles")
    .select("daub_color")
    .eq("id", user.id)
    .single();

  if (!error && data?.daub_color) {
    daubColor = data.daub_color;
    localStorage.setItem("bingo_daub_color", daubColor);
  } else {
    // fallback to localStorage if profile missing
    daubColor =
      localStorage.getItem("bingo_daub_color") || "#7c4dff";
  }
} else {
  // Guest user → always green
  daubColor = "#7c4dff";
}
  bingoBtn.addEventListener("click", handleBingoClaim);
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
  subscribeToGameLock(gameId);
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
  Object.keys(cardPositionMap).forEach(k => delete cardPositionMap[k]);

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
      // FREE space
      cell.textContent = "FREE";
      cell.classList.add("free", "marked");
      markedNumbers.add("FREE");
      cardPositionMap["FREE"] = { row: 2, col: 2 };
    } else {
      // NORMAL NUMBER CELL
      const number = cardNumbers[col][row];

      cell.textContent = number;
      cell.dataset.number = number;
      cell.onclick = () => toggleMark(cell, number);

      // ✅ IMPORTANT: map position INSIDE this block
      cardPositionMap[number] = { row, col: colIndex };
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
    let letter =
    number <= 15 ? "B" :
    number <= 30 ? "I" :
    number <= 45 ? "N" :
    number <= 60 ? "G" : "O";

  badge.textContent = `${letter} ${number}`;
  calledNumbersListEl.appendChild(badge);
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
  if (cell.classList.contains("marked")) {
  cell.style.setProperty("--daub-color", daubColor);
  }

  if (markedNumbers.has(number)) {
    markedNumbers.delete(number);
  } else {
    markedNumbers.add(number);
  }
}

function checkForBingo() {
  const grid = Array.from({ length: 5 }, () =>
    Array(5).fill(false)
  );

  markedNumbers.forEach(num => {
    const pos = cardPositionMap[num];
    if (pos) grid[pos.row][pos.col] = true;
  });

  return (
    hasCompleteRow(grid) ||
    hasCompleteColumn(grid) ||
    hasCompleteDiagonal(grid)
  );
}

function hasCompleteRow(grid) {
  return grid.some(row => row.every(Boolean));
}

function hasCompleteColumn(grid) {
  for (let col = 0; col < 5; col++) {
    if (grid.every(row => row[col])) return true;
  }
  return false;
}

function hasCompleteDiagonal(grid) {
  const diag1 = grid.every((row, i) => row[i]);
  const diag2 = grid.every((row, i) => row[4 - i]);
  return diag1 || diag2;
}
function isMarkedSetValid() {
  for (const num of markedNumbers) {
    if (num === "FREE") continue;
    if (!calledNumbers.has(num)) return false;
  }
  return true;
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

function handleBingoClaim() {
  bingoMessage.classList.remove("hidden", "success", "error");

  if (!isMarkedSetValid()) {
    bingoMessage.textContent = "Invalid card: uncalled numbers marked.";
    bingoMessage.classList.add("error");
    return;
  }

  if (!checkForBingo()) {
    bingoMessage.textContent = "No Bingo detected yet.";
    bingoMessage.classList.add("error");
    return;
  }

  bingoMessage.textContent = "🎉 BINGO! You win!";
  bingoMessage.classList.add("success");

  // OPTIONAL: server-side validation hook
  submitBingoClaim();
}
async function submitBingoClaim() {
  if (!gameId) return;

  const { error } = await sb.from("bingo_claims").insert({
    game_id: gameId,
    user_id: userId
  });

  if (error) {
    console.error("Failed to submit bingo claim:", error);
  }
}

function subscribeToGameLock(gameId) {
  sb.channel(`game-lock-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`
      },
      payload => {
        if (payload.new.is_locked) {
          gameLocked = true;
          disableGameInteraction();
          bingoMessage.textContent = "Game Over";
          bingoMessage.classList.remove("hidden");
        }
      }
    )
    .subscribe();
}









