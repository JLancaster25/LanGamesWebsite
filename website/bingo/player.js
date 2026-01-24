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

// ==========================================
// ENTRY POINT
// ==========================================
await initPlayer();

// ==========================================
// INIT
// ==========================================
async function initPlayer() {
  playerName = resolvePlayerName();
  const roomCode = resolveRoomCode();

  const game = await fetchGameByCodeWithRetry(roomCode);

  if (!game) {
    alert("Room not found. Please wait a moment and try again.");
    throw new Error("Room invalid");
  }

  gameId = game.id;

  await joinGame(gameId, playerName);

  document.getElementById("cardTitle").textContent =
    `${playerName}'s card`;

  // (Gameplay logic can continue from here)
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
// JOIN GAME
// ==========================================
async function joinGame(gameId, playerName) {
  const { error } = await sb.from("claims").insert({
    game_id: gameId,
    player_name: playerName,
    marked: []
  });

  if (error) {
    if (error.message.includes("unique")) {
      alert("That username is already taken in this game.");
    } else {
      alert("Failed to join game.");
    }
    throw error;
  }
}

// ==========================================
// UTIL
// ==========================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


