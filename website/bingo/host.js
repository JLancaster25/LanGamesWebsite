// ==========================================
// SUPABASE CLIENT
// ==========================================
const sb = window.supabaseClient;

// ==========================================
// APP STATE
// ==========================================
let gameId = null;
let roomCode = null;
let hostId = null;

let playerChannel = null;

// UI
const playersList = document.getElementById("playersList");
const roomCodeEl = document.getElementById("roomCode");
const playersListEl = document.getElementById("playersList");

// ==========================================
// ENTRY POINT
// ==========================================
await initHost();

// ==========================================
// INITIALIZATION
// ==========================================
async function initHost() {
  const session = await requireHostAuth();
  hostId = session.user.id;
let gameId, hostId;

  const existing = await tryReconnectHost(hostId);
await init();

  if (existing) {
    gameId = existing.id;
    roomCode = existing.code;
  } else {
    const game = await createGame(hostId);
    gameId = game.id;
    roomCode = game.code;
  }

  roomCodeEl.textContent = roomCode;
async function init() {
  const session = await sb.auth.getSession();
  if (!session.data.session) location.href = "/WebsiteLogin/";
  hostId = session.data.session.user.id;

  await loadPlayers(gameId);
  subscribeToPlayers(gameId);
}
  const game = await createGame();
  gameId = game.id;
  roomCodeEl.textContent = game.code;

// ==========================================
// AUTH
// ==========================================
async function requireHostAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.replace("/WebsiteLogin/");
    throw new Error("Not authenticated");
  }
  return data.session;
  loadPlayers();
  subscribePlayers();
}

// ==========================================
// RECONNECTION LOGIC
// ==========================================
async function tryReconnectHost(hostId) {
  const { data, error } = await sb
    .from("games")
    .select("*")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return error ? null : data;
}

// ==========================================
// GAME CREATION
// ==========================================
async function createGame(hostId) {
  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();

async function createGame() {
  while (true) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await sb
      .from("games")
      .insert({ code, host_id: hostId })
      .select()
      .single();

    if (!error) return data;
  }

  alert("Failed to create unique room.");
  throw new Error("Room creation failed");
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ==========================================
// PLAYER LIST (INITIAL LOAD)
// ==========================================
async function loadPlayers(gameId) {
  if (!gameId) return;

  const { data, error } = await sb
    .from("claims")
    .select("id, player_name")
    .eq("game_id", gameId);

  if (error || !data) return;

  playersListEl.innerHTML = "";
  data.forEach(addPlayerRow);
async function loadPlayers() {
  if (!playersList) return;
  const { data } = await sb.from("claims").select("id,player_name").eq("game_id", gameId);
  playersList.innerHTML = "";
  data?.forEach(addPlayer);
}

// ==========================================
// REALTIME PLAYER JOIN / LEAVE
// ==========================================
function subscribeToPlayers(gameId) {
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
function subscribePlayers() {
  sb.channel("players")
    .on("postgres_changes", { event: "*", table: "claims" }, loadPlayers)
    .subscribe();
}

// ==========================================
// UI HELPERS
// ==========================================
function addPlayerRow(player) {
  if (document.getElementById(`player-${player.id}`)) return;

function addPlayer(p) {
  const li = document.createElement("li");
  li.id = `player-${player.id}`;
  li.className = "player-row";

  const nameSpan = document.createElement("span");
  nameSpan.textContent = player.player_name;
  li.textContent = p.player_name;

  const kickBtn = document.createElement("button");
  kickBtn.textContent = "Kick";
  kickBtn.onclick = () => kickPlayer(player.id);
  const btn = document.createElement("button");
  btn.textContent = "Kick";
  btn.onclick = () => sb.from("claims").delete().eq("id", p.id);

  li.appendChild(nameSpan);
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
  const confirmKick = confirm("Kick this player?");
  if (!confirmKick) return;

  const { error } = await sb
    .from("claims")
    .delete()
    .eq("id", playerId)
    .eq("game_id", gameId);

  if (error) {
    alert("Failed to kick player.");
  }
  li.appendChild(btn);
  playersList.appendChild(li);
