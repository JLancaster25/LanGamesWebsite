// ==========================================
// SUPABASE CLIENT
// ==========================================
const sb = window.supabaseClient;

// ==========================================
// DOM ELEMENTS
// ==========================================
const roomCodeEl = document.getElementById("roomCode");
const playersListEl = document.getElementById("playersList");
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");
const newGameBtn = document.getElementById("newGameBtn");
const startGameBtn = document.getElementById("startGameBtn");
const aiCallBtn = document.getElementById("aiCallBtn");
const autoCallBtn = document.getElementById("autoCallBtn");
const stopAutoCallBtn = document.getElementById("stopAutoCallBtn");

const callSpeedInput = document.getElementById("callSpeed");
const speedLabel = document.getElementById("speedLabel");
// ==========================================
// APP STATE
// ==========================================
let gameId = null;
let hostId = null;
let playerChannel = null;
let autoCallTimer = null;
let calledNumbers = new Set();

// ==========================================
// ENTRY POINT
// ==========================================
document.addEventListener("DOMContentLoaded", initHost);

// ==========================================
// INITIALIZATION
// ==========================================
async function initHost() {
  setupMenu();
  setupNewGameButton();

  const session = await requireAuth();
  hostId = session.user.id;
  setupControls();
  updateSpeedLabel();

  await startNewGame();
}

// ==========================================
// MENU LOGIC (SAFE)
// ==========================================
function setupMenu() {
  if (!menu || !menuBtn) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    menu.classList.add("hidden");
  });
}

// ==========================================
// NEW GAME BUTTON
// ==========================================
function setupNewGameButton() {
  if (!newGameBtn) return;

  newGameBtn.addEventListener("click", async () => {
    await startNewGame();
  });
}

// ==========================================
// START / RESTART GAME
// ==========================================
async function startNewGame() {
  clearPlayersUI();
  unsubscribePlayers();
  stopAutoCall();
  calledNumbers.clear();

  const game = await createGameWithUniqueCode(hostId);
  gameId = game.id;

  roomCodeEl.textContent = game.code;

  await loadPlayers();
  subscribeToPlayers();
}

// ==========================================
// AUTH GUARD
// ==========================================
async function requireAuth() {
  const { data } = await sb.auth.getSession();

  if (!data.session) {
    window.location.replace("/WebsiteLogin/");
    throw new Error("Not authenticated");
  }

  return data.session;
}

// ==========================================
// CONTROL SETUP
// ==========================================
function setupControls() {
  startGameBtn?.addEventListener("click", startGame);
  newGameBtn?.addEventListener("click", startNewGame);
  aiCallBtn?.addEventListener("click", aiCallOnce);
  autoCallBtn?.addEventListener("click", startAutoCall);
  stopAutoCallBtn?.addEventListener("click", stopAutoCall);

  callSpeedInput?.addEventListener("input", updateSpeedLabel);
}

// ==========================================
// GAME LIFECYCLE
// ==========================================
function startGame() {
  if (!gameId) {
    alert("Create a game first.");
    return;
  }

  alert("Game started!");
}

// ==========================================
// GAME CREATION
// ==========================================
async function createGameWithUniqueCode(hostId) {
  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();

    const { data, error } = await sb
      .from("games")
      .insert({ code, host_id: hostId })
      .select()
      .single();

    if (!error) return data;
  }

  alert("Failed to create a unique room.");
  throw new Error("Room creation failed");
}

// ==========================================
// ROOM CODE
// ==========================================
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ==========================================
// CALLING LOGIC
// ==========================================
async function aiCallOnce() {
  if (!gameId) return;

  const number = drawNextNumber();
  if (!number) {
    alert("All numbers have been called.");
    return;
  }

  await recordCall(number);
}

function startAutoCall() {
  if (autoCallTimer) return;

  autoCallBtn.classList.add("hidden");
  stopAutoCallBtn.classList.remove("hidden");

  autoCallTimer = setInterval(async () => {
    const number = drawNextNumber();
    if (!number) {
      stopAutoCall();
      alert("All numbers called.");
      return;
    }
    await recordCall(number);
  }, callSpeedInput.value * 1000);
}

function stopAutoCall() {
  if (autoCallTimer) {
    clearInterval(autoCallTimer);
    autoCallTimer = null;
  }

  autoCallBtn?.classList.remove("hidden");
  stopAutoCallBtn?.classList.add("hidden");
}

function drawNextNumber() {
  if (calledNumbers.size >= 75) return null;

  let num;
  do {
    num = Math.floor(Math.random() * 75) + 1;
  } while (calledNumbers.has(num));

  calledNumbers.add(num);
  return num;
}

async function recordCall(number) {
  await sb.from("calls").insert({
    game_id: gameId,
    number
  });
}

// ==========================================
// SPEED UI
// ==========================================
function updateSpeedLabel() {
  if (!speedLabel || !callSpeedInput) return;
  speedLabel.textContent = `${callSpeedInput.value}s`;
}

// ==========================================
// PLAYER LIST
// ==========================================
async function loadPlayers() {
  if (!playersListEl || !gameId) return;

  const { data } = await sb
    .from("claims")
    .select("id, player_name")
    .eq("game_id", gameId);

  clearPlayersUI();
  data?.forEach(addPlayerRow);
}

function subscribeToPlayers() {
  if (!gameId) return;

  playerChannel = sb.channel(`players-${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "claims" },
      payload => {
        if (payload.new.game_id === gameId) {
          addPlayerRow(payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "claims" },
      payload => {
        if (payload.old.game_id === gameId) {
          removePlayerRow(payload.old.id);
        }
      }
    )
    .subscribe();
}

function unsubscribePlayers() {
  if (playerChannel) {
    sb.removeChannel(playerChannel);
    playerChannel = null;
  }
}

// ==========================================
// REALTIME SUBSCRIPTION
// ==========================================
function subscribeToPlayers() {
  if (!gameId) return;

  playerChannel = sb.channel(`players-${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "claims" },
      payload => {
        if (payload.new.game_id === gameId) {
          addPlayerRow(payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "claims" },
      payload => {
        if (payload.old.game_id === gameId) {
          removePlayerRow(payload.old.id);
        }
      }
    )
    .subscribe();
}

function unsubscribePlayers() {
  if (playerChannel) {
    sb.removeChannel(playerChannel);
    playerChannel = null;
  }
}

// ==========================================
// UI HELPERS
// ==========================================
function clearPlayersUI() {
  if (playersListEl) playersListEl.innerHTML = "";
}

function addPlayerRow(player) {
  if (!playersListEl) return;
  if (document.getElementById(`player-${player.id}`)) return;

  const li = document.createElement("li");
  li.id = `player-${player.id}`;
  li.className = "player-row";

  const name = document.createElement("span");
  name.textContent = player.player_name;

  const kickBtn = document.createElement("button");
  kickBtn.textContent = "Kick";
  kickBtn.onclick = () => kickPlayer(player.id);

  li.appendChild(name);
  li.appendChild(kickBtn);
  playersListEl.appendChild(li);
}

function removePlayerRow(playerId) {
  const el = document.getElementById(`player-${playerId}`);
  if (el) el.remove();
}

// ==========================================
// KICK PLAYER
// ==========================================
async function kickPlayer(playerId) {
  if (!confirm("Kick this player?")) return;

  const { error } = await sb
    .from("claims")
    .delete()
    .eq("id", playerId)
    .eq("game_id", gameId);

  if (error) {
    alert("Failed to kick player.");
  }
}



