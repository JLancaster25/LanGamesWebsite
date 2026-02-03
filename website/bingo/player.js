// ==========================================
// SUPABASE CLIENT
// ==========================================
console.log("[SUPABASE] Client ready:", window.sb);
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
const closeWinnerBannerBtn = document.getElementById("closeWinnerBanner");

const bingoMessage = document.getElementById("bingoMessage");
const currentBallEl = document.getElementById("currentBall");

const winnerOverlay = document.getElementById("winnerOverlay");
const winnerContent = document.getElementById("winnerContent");

// ==========================================
// STATE
// ==========================================
let gameId = null;
let playerId = null;
let userId = null;
let gameChannel;
let gameEnded = false;

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
  
  closeWinnerBannerBtn.onclick = () => {
  winnerOverlay.classList.add("hidden");
};
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

// 🔁 Replay first
  await replayCallsFromDB();

// 📡 Then listen live
  subscribeCalls();
}

// ==========================================
// CARD
// ==========================================
function renderCard() {
  bingoCardEl.innerHTML = "";
  markedNumbers.clear();

  card.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cell = document.createElement("div");
      cell.className = "bingo-cell";

      // FREE space (stored as 0)
      if (value === 0) {
        cell.textContent = "FREE";
        cell.classList.add("free", "marked");
        markedNumbers.add(0);
      } else {
        cell.textContent = value;
        cell.dataset.number = value;

        cell.onclick = () => {
          const n = Number(value);
          if (!calledNumbers.has(n)) return;

          cell.classList.toggle("marked");

          if (cell.classList.contains("marked")) {
            cell.style.setProperty("--daub-color", daubColor);
            markedNumbers.add(value);
          } else {
            markedNumbers.delete(value);
          }
           console.log("Called set:", [calledNumbers]);
        };
      }

      bingoCardEl.appendChild(cell);
    });
  });
}

// ==========================================
// REALTIME CALLS
// ==========================================
function subscribeCalls() {
  if (gameChannel) {
    console.log("[PLAYER] Game channel already exists, skipping subscribe");
    return;
  }

  console.log("[PLAYER] Subscribing to game channel:", gameId);

  gameChannel = sb.channel(`game-${gameId}`);

  gameChannel
    .on("broadcast", { event: "call" }, payload => {
      const number = payload?.payload?.number;
      if (number == null) return;

      console.log("🔥 PLAYER RECEIVED LIVE CALL:", number);
      handleCall(Number(number));
    })
    .subscribe(status => {
      console.log("[PLAYER] Game channel status:", status);
    });
  gameChannel
  .on("broadcast", { event: "game_over" }, payload => {
    console.log("🏁 GAME OVER");
    
    // stop accepting calls
    gameEnded = true;
  });
  .on("broadcast", { event: "game_over" }, payload => {
    gameEnded = true;
    showWinners(payload.payload.winners, true);
    showWinnerBanner(payload.payload.winners);
  });
}

async function replayCallsFromDB() {
  console.log("[PLAYER] Replaying calls from DB…");

  const { data, error } = await sb
    .from("calls")
    .select("number")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[PLAYER] Replay failed:", error);
    return;
  }

  data.forEach(row => {
    handleCall(Number(row.number));
  });

  console.log(`[PLAYER] Replayed ${data.length} calls`);
}

function handleCall(number) {
  if (gameEnded) return;
  if (calledNumbers.has(number)) return;

  calledNumbers.add(number);
  renderPlayerCurrentBall(number);
  renderPlayerCalled(number);

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
  if (gameEnded) return;

  bingoBtn.disabled = true;

  bingoMessage.classList.remove("hidden", "error", "success");

  // 1️⃣ Broadcast claim to host (INSTANT)
  gameChannel.send({
    type: "broadcast",
    event: "bingo_claim",
    payload: {
      gameId,
      playerId
    }
  });

  // 2️⃣ Persist claim (for audit / history)
  await sb.from("claims").insert({
    game_id: gameId,
    player_id: playerId,
    pattern: "normal"
  });

  bingoMessage.textContent = "🎉 BINGO! Waiting for host…";
  bingoMessage.classList.add("success");
}

function showWinnerBanner(winners) {
  winnerContent.innerHTML = `
    <ul>
      ${winners
        .map(
          w => `<li>🎉 <strong>${w.name}}</li>`
        )
        .join("")}
    </ul>
  `;

  winnerOverlay.classList.remove("hidden");
}

function formatPattern(p) {
  return {
    cross: "Cross",
    blackout: "Blackout",
    four_corners: "4 Corners"
  }[p] ?? p;
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
  card[2][2] = 0;

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











