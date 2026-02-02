// ==========================================
// SUPABASE CLIENT
// ==========================================
'use strict';
//const sb = window.supabaseClient;
//if (!sb) {
//  console.error("❌ Supabase client not loaded");
//}
// ==========================================
// DOM
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

const bingoBtn = document.getElementById("bingoBtn");
const bingoMessage = document.getElementById("bingoMessage");
const currentBallEl = document.getElementById("currentBall");

// ==========================================
// STATE
// ==========================================
let gameId = null;
let playerId = null;
let userId = null;

let daubColor = "#32d46b"; // default GREEN
const calledNumbers = new Set();
const markedNumbers = new Set();
let card = [];

// ==========================================
// INIT
// ==========================================
document.addEventListener("DOMContentLoaded", initPlayer);

async function initPlayer() {
  const { data } = await sb.auth.getSession();
  userId = data?.session?.user?.id ?? null;

  // load daub color
  if (userId) {
  const { data: profiles } = await sb
  .from("profiles")
  .select("daub_color")
  .eq("id", userId)
  .limit(1);
  }
  
  if (data && data.length && data[0].daub_color) {
    daubColor = data[0].daub_color;
    localStorage.setItem("bingo_daub_color", daubColor);
  } else {
    daubColor = "#32d46b";
  }

  bingoBtn.onclick = submitBingoClaim;
  joinForm.onsubmit = handleJoin;
}

// ==========================================
// JOIN
// ==========================================
async function handleJoin(e) {
  e.preventDefault();
  showLobbyError("");

  const name = nameInput.value.trim();
  const code = roomInput.value.trim().toUpperCase();

  if (!name) return showLobbyError("Enter a name");
  if (code.length !== 7) return showLobbyError("Invalid room code");

  const { data: game } = await sb
    .from("games")
    .select("id,status")
    .eq("code", code)
    .single();

  if (!game) return showLobbyError("Game not found");

  gameId = game.id;

  // generate card (25 numbers, FREE=0)
  card = generateCard();

  const { data: player, error } = await sb
    .from("players")
    .insert({
      game_id: gameId,
      user_id: userId,
      display_name: name,
      card
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return showLobbyError("Failed to join game");
  }

  playerId = player.id;

  lobbyEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  titleEl.textContent = `${name}'s Bingo Card`;

  renderCard();
  subscribeCalls();
}

// ==========================================
// CARD
// ==========================================
function renderCard() {
  bingoCardEl.innerHTML = "";
  markedNumbers.clear();

  card.forEach((n, i) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    if (n === 0) {
      cell.textContent = "FREE";
      cell.classList.add("free", "marked");
      markedNumbers.add(0);
    } else {
      cell.textContent = n;
      cell.onclick = () => {
        if (!calledNumbers.has(n)) return;
        cell.classList.toggle("marked");

        if (cell.classList.contains("marked")) {
          cell.style.setProperty("--daub-color", daubColor);
          markedNumbers.add(n);
        } else {
          markedNumbers.delete(n);
        }
      };
    }

    bingoCardEl.appendChild(cell);
  });
}

// ==========================================
// REALTIME CALLS
// ==========================================
function subscribeCalls() {
  sb.channel(`calls-${gameId}`)
    .on(
      "postgres_changes", 
        { event: "INSERT", schema: "public", table: "calls" },
      p => {
        if (p.new.game_id !== gameId) return;
        handleCall(p.new.number);
      }
    )
    .subscribe();
}
/*
function handleCall(number) {
  if (calledNumbers.has(number)) return;
  calledNumbers.add(number);

  const badge = document.createElement("div");
  badge.className = "called-number";

  const letter =
    number <= 15 ? "B" :
    number <= 30 ? "I" :
    number <= 45 ? "N" :
    number <= 60 ? "G" : "O";

  badge.textContent = `${letter} ${number}`;
  calledNumbersListEl.prepend(badge);
}
*/
function handleCall(number) {
  if (calledNumbers.has(number)) return;

  calledNumbers.add(number);
  renderPlayerCalled(number);
  renderPlayerCurrentBall(number);

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

function renderPlayerCurrentBall(number) {
  if (!currentBallEl) return;

  const letter = getBingoLetter(number);

  currentBallEl.className = "current-ball";
  void currentBallEl.offsetWidth;

  currentBallEl.textContent = `${letter} ${number}`;
  currentBallEl.classList.add(letter, "animate");
}

function renderPlayerCalled(number) {
  const list = document.getElementById("calledNumbersList");
  if (!list) return;

  const letter =
    number <= 15 ? "B" :
    number <= 30 ? "I" :
    number <= 45 ? "N" :
    number <= 60 ? "G" : "O";

  const el = document.createElement("span");
  el.className = "called-number";
  el.textContent = `${letter} ${number}`;

  list.prepend(el);
}
// ==========================================
// CLAIM
// ==========================================
async function submitBingoClaim() {
  bingoMessage.classList.remove("hidden", "error", "success");

  const { error } = await sb.from("claims").insert({
    game_id: gameId,
    player_id: playerId,
    pattern: "normal"
  });

  if (error) {
    bingoMessage.textContent = "Claim failed";
    bingoMessage.classList.add("error");
  } else {
    bingoMessage.textContent = "🎉 BINGO! Waiting for host…";
    bingoMessage.classList.add("success");
  }
}

// ==========================================
// UTIL
// ==========================================
function generateCard() {
  const card = [];

  const ranges = [
    range(1, 15),   // B
    range(16, 30),  // I
    range(31, 45),  // N
    range(46, 60),  // G
    range(61, 75)   // O
  ];

  for (let col = 0; col < 5; col++) {
    shuffle(ranges[col]);
    for (let row = 0; row < 5; row++) {
      if (!card[row]) card[row] = [];
      card[row][col] = ranges[col][row];
    }
  }

  // FREE space
  card[2][2] = "FREE";

  return card;
}

function range(min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
  
function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.toggle("hidden", !msg);
}





















