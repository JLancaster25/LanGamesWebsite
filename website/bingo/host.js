// ==========================================
// SUPABASE CLIENT
// ==========================================
const sb = window.supabaseClient;

// ==========================================
// DOM ELEMENTS (SAFE TO QUERY AFTER LOAD)
// ==========================================
const roomCodeEl = document.getElementById("roomCode");
const playersListEl = document.getElementById("playersList");

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
});;
});
// ==========================================
// APP STATE
// ==========================================
let gameId = null;
let hostId = null;

// ==========================================
// ENTRY POINT
// ==========================================
await initHost();

// ==========================================
// INITIALIZATION
// ==========================================
async function initHost() {
  const session = await requireAuth();
  hostId = session.user.id;

  const game = await createGameWithUniqueCode(hostId);
  gameId = game.id;

  roomCodeEl.textContent = game.code;

  await loadPlayers(gameId);
  subscribeToPlayers(gameId);
}

// ==========================================
// AUTH GUARD (LOCK PAGE)
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
// GAME CREATION
// ==========================================
async function createGameWithUniqueCode(hostId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();

    const { data, error } = await sb
      .from("games")
      .insert({
        code,
        host_id: hostId
      })
      .select()
      .single();

    if (!error) return data;
  }

  alert("Failed to create a unique room. Please refresh.");
  throw new Error("Room creation failed");
}

// ==========================================
// 7-CHAR ALPHANUMERIC CODE
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
// PLAYER LIST (INITIAL LOAD)
// ==========================================
async function loadPlayers(gameId) {
  if (!playersListEl) return;

  const { data, error } = await sb
    .from("claims")
    .select("id, player_name")
    .eq("game_id", gameId);

  if (error || !data) return;

  playersListEl.innerHTML = "";
  data.forEach(addPlayerRow);
}

// ==========================================
// REALTIME JOIN / LEAVE
// ==========================================
function subscribeToPlayers(gameId) {
  sb.channel(`players-${gameId}`)
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

// ==========================================
// UI HELPERS
// ==========================================
function addPlayerRow(player) {
  if (!playersListEl) return;
  if (document.getElementById(`player-${player.id}`)) return;

  const li = document.createElement("li");
  li.id = `player-${player.id}`;

  const nameSpan = document.createElement("span");
  nameSpan.textContent = player.player_name;

  const kickBtn = document.createElement("button");
  kickBtn.textContent = "Kick";
  kickBtn.onclick = () => kickPlayer(player.id);

  li.appendChild(nameSpan);
  li.appendChild(kickBtn);
  playersListEl.appendChild(li);
}

function removePlayerRow(playerId) {
  const el = document.getElementById(`player-${playerId}`);
  if (el) el.remove();
}

// ==========================================
// KICK PLAYER (HOST ONLY)
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

const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");

if (menuBtn && menuDropdown) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    menuDropdown.classList.add("hidden");
  });
}


