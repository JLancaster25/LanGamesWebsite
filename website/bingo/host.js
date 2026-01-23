const sb = window.supabaseClient;
const playersList = document.getElementById("playersList");
const roomCodeEl = document.getElementById("roomCode");

let gameId, hostId;

await init();

async function init() {
  const session = await sb.auth.getSession();
  if (!session.data.session) location.href = "/WebsiteLogin/";
  hostId = session.data.session.user.id;

  const game = await createGame();
  gameId = game.id;
  roomCodeEl.textContent = game.code;

  loadPlayers();
  subscribePlayers();
}

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
}

async function loadPlayers() {
  if (!playersList) return;
  const { data } = await sb.from("claims").select("id,player_name").eq("game_id", gameId);
  playersList.innerHTML = "";
  data?.forEach(addPlayer);
}

function subscribePlayers() {
  sb.channel("players")
    .on("postgres_changes", { event: "*", table: "claims" }, loadPlayers)
    .subscribe();
}

function addPlayer(p) {
  const li = document.createElement("li");
  li.textContent = p.player_name;

  const btn = document.createElement("button");
  btn.textContent = "Kick";
  btn.onclick = () => sb.from("claims").delete().eq("id", p.id);

  li.appendChild(btn);
  playersList.appendChild(li);
}
