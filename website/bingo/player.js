// ==========================================
// SUPABASE CLIENT
// ==========================================
const sb = window.supabaseClient;

/* MENU LOGIC */
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");

/* MENU LOGIC */
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // ⛔ prevent document click
  menu.classList.toggle("hidden");
});

/* Close menu when clicking outside */
document.addEventListener("click", (e) => {
  const clickedInsideMenu = menu.contains(e.target);
  const clickedMenuButton = menuBtn.contains(e.target);

  if (!clickedInsideMenu && !clickedMenuButton) {
    menu.classList.add("hidden");
  }
});

/* Menu item navigation */
document.querySelectorAll("[data-target]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.getAttribute("data-target");
    menu.classList.add("hidden");
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});
// ==========================================
// APP STATE
// ==========================================
let gameId = null;
let playerName = null;
let userId = null;

const calledNumbers = new Set();
const markedCells = new Set(["2-2"]);
const card = generateCard();
const titleEl = document.getElementById("cardTitle");
// ==========================================
// ENTRY POINT
// ==========================================
await initPlayer();

// ==========================================
// INITIALIZATION
// ==========================================
async function initPlayer() {
  const session = await getSessionUser();
  const identity = await resolvePlayerIdentity(session);
  const roomCode = await requireRoomCode();
  const game = await fetchGameByCode(roomCode);

  const profileUsername = await getUsernameFromProfileIfLoggedIn();

  const playerName =
  profileUsername ||
  prompt("Enter your name (max 10 chars)")?.trim();

if (!playerName) {
  alert("Name required");
  throw new Error("Missing player name");
}
  if (!game) {
    alert("Room not found. Please wait a moment and try again.");
    throw new Error("Room invalid");
  }
  
  gameId = game.id;
  playerName = identity.name;
  userId = identity.userId;

  await joinGame(gameId, playerName, userId);

  titleEl.textContent = `${playerName}'s card`;
  subscribeToCalls(gameId);
  renderBoard();
}

// ==========================================
// PLAYER NAME
// ==========================================
function resolvePlayerName() {
  const name = prompt("Enter your name (max 10 characters)")?.trim();

  if (!name || name.length > 10) {
    alert("Invalid name.");
    throw new Error("Invalid player name");
  }

  return name;
}

// ==========================================
// ROOM CODE
// ==========================================
function resolveRoomCode() {
  const code = prompt("Enter room code")
    ?.trim()
    .toUpperCase();

  if (!code || code.length !== 7) {
    alert("Invalid room code format.");
    throw new Error("Invalid room code");
  }

  return code;
}

// ==========================================
// GAME LOOKUP WITH RETRY (CRITICAL FIX)
// ==========================================
async function fetchGameByCodeWithRetry(code, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await sb
      .from("games")
      .select("*")
      .eq("code", code)
      .single();

    if (data && !error) {
      return data;
    }

    // Wait before retry (eventual consistency)
    await sleep(500);
  }

  return null;
}

// ==========================================
// SUPABASE HELPERS (CENTRALIZED)
// ==========================================
async function getSessionUser() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

async function fetchProfile(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  return error ? null : data;
}

async function fetchGameByCode(code) {
  const { data, error } = await sb
    .from("games")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) {
    alert("Room not found.");
    throw new Error("Invalid room");
  }
  return data;
}

async function joinGame(gameId, name, userId) {
  // Check if already joined (prevents duplicates)
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

  // Insert new player
  const { error } = await sb.from("claims").insert({
    game_id: gameId,
    user_id: userId ?? null,
    player_name: name,
    marked: []
  });

  if (error) {
    if (error.message?.toLowerCase().includes("unique")) {
      alert("That username is already taken in this game.");
    } else {
      alert("Unable to join game.");
    }
    throw error;
  }
  const { data: profile } = await sb
  .from("profiles")
  .select("username")
  .eq("id", userId)
  .maybeSingle();

if (profile?.username) {
  playerName = profile.username;
}
}
async function getUsernameFromProfileIfLoggedIn() {
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    // Not logged in → DO NOT query profiles
    return null;
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.username ?? null;
}

// ==========================================
// IDENTITY RESOLUTION
// ==========================================
async function resolvePlayerIdentity(session) {
  // Try reconnect
  const cachedName = localStorage.getItem("playerName");

  if (session) {
    const profile = await fetchProfile(session.user.id);
    if (profile?.username) {
      return {
        name: profile.username.slice(0, 10),
        userId: session.user.id
      };
    }
  }

  if (cachedName) {
    return { name: cachedName, userId: null };
  }

  const name = prompt("Enter your name (max 10 chars)")?.trim();
  if (!name || name.length > 10) {
    alert("Invalid name.");
    throw new Error("Invalid name");
  }

  localStorage.setItem("playerName", name);
  return { name, userId: null };
}

// ==========================================
// ROOM CODE HANDLING (RECONNECT SAFE)
// ==========================================
async function requireRoomCode() {
  const cachedCode = localStorage.getItem("roomCode");

  if (cachedCode) return cachedCode;

  const code = prompt("Enter room code")?.trim().toUpperCase();
  if (!code || code.length !== 7) {
    alert("Invalid room code.");
    throw new Error("Invalid room code");
  }

  localStorage.setItem("roomCode", code);
  return code;
}

// ==========================================
// REALTIME SUBSCRIPTION
// ==========================================
function subscribeToCalls(gameId) {
  sb.channel(`calls-${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "calls" },
      payload => {
        if (payload.new.game_id !== gameId) return;
        handleCall(payload.new.number);
      }
    )
    .subscribe();
}

function handleCall(number) {
  calledNumbers.add(number);
  updateCurrentBall(number);
  addCalledNumber(number);
  renderBoard();
}

// ==========================================
// BINGO CLAIM
// ==========================================
bingoBtn.onclick = async () => {
  bingoBtn.disabled = true;

  const { error } = await sb
    .from("claims")
    .update({ marked: [...markedCells] })
    .eq("game_id", gameId)
    .eq("player_name", playerName);

  if (error) {
    alert("Failed to submit Bingo.");
    bingoBtn.disabled = false;
  }
};

// ==========================================
// RENDERING
// ==========================================
function renderBoard() {
  board.innerHTML = "";

  card.forEach((row, y) => {
    row.forEach((value, x) => {
      const cell = document.createElement("div");
      const key = `${x}-${y}`;

      cell.className = "cell";
      cell.textContent = value === "FREE" ? "★" : value;

      if (value === "FREE" || markedCells.has(key)) {
        cell.classList.add("marked");
      }

      if (value !== "FREE" && !calledNumbers.has(value)) {
        cell.classList.add("locked");
      }

      cell.onclick = () => {
        if (value !== "FREE" && !calledNumbers.has(value)) return;
        markedCells.has(key)
          ? markedCells.delete(key)
          : markedCells.add(key);
        renderBoard();
      };

      board.appendChild(cell);
    });
  });
}

// ==========================================
// UI HELPERS
// ==========================================
function updateCurrentBall(n) {
  const letter =
    n <= 15 ? "B" :
    n <= 30 ? "I" :
    n <= 45 ? "N" :
    n <= 60 ? "G" : "O";

  currentBall.textContent = `${letter} ${n}`;
  currentBall.classList.remove("hidden");
}

function addCalledNumber(n) {
  const span = document.createElement("span");
  span.textContent = n;
  callsEl.prepend(span);
}

// ==========================================
// CARD GENERATION
// ==========================================
function generateCard() {
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75]
  ];

  const grid = Array.from({ length: 5 }, () => []);

  ranges.forEach(([min, max], col) => {
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    [...nums].forEach((n, row) => {
      grid[row][col] = n;
    });
  });

  grid[2][2] = "FREE";
  return grid;
}











