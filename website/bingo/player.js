const sb = window.supabaseClient;

const name = prompt("Your name");
const code = prompt("Room code").toUpperCase();

const { data: game } = await sb.from("games").select("*").eq("code", code).single();
if (!game) alert("Invalid room");

await sb.from("claims").insert({
  game_id: game.id,
  player_name: name,
  marked: []
});

document.getElementById("cardTitle").textContent = name;
