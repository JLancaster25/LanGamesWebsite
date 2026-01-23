// ==========================================
// SUPABASE POINTER
// ==========================================
const sb = window.supabaseClient;

/* ===============================
/* ===============================
   RESOLVE PLAYER ID + NAME
================================ */
let name = null;
let userId = null;

const { data: sessionData } = await sb.auth.getSession();

if (sessionData.session) {
  userId = sessionData.session.user.id;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!error && profile?.username) {
    name = profile.username.slice(0, 10);
  }
}

// Fallback for anonymous users
if (!name) {
  name = prompt("Your name (max 10 chars)")?.trim();

  if (!name || name.length > 10) {
    alert("Invalid name");
    throw new Error("Invalid name");
  }
}

// ==========================================
// PREVENT DUPLICATE USERNAMES (UX CHECK)
// ==========================================
const { data: existingPlayer } = await sb
  .from("claims")
  .select("id")
  .eq("game_id", gameId)
  .eq("player_name", name)
  .maybeSingle();

if (existingPlayer) {
  alert(`The name "${name}" is already taken in this game.`);
  throw new Error("Duplicate username");
}

/* ===============================
   JOIN GAME
================================ */
// ==========================================
// REQUIRE ROOM CODE
// ==========================================
const code = prompt("Enter room code")?.trim().toUpperCase();

if (!code || code.length !== 6) {
  alert("Invalid room code.");
  throw new Error("Invalid code");
}

// Lookup game by code
const { data: game, error } = await sb
  .from("games")
  .select("*")
  .eq("code", code)
  .single();

if (error || !game) {
  alert("Room not found.");
  throw new Error("Game not found");
}
if (game.ended_at) {
  alert("This game has already ended.");
  throw new Error("Game ended");
}

const gameId = game.id;

/* ===============================
   SHOW MODES
================================ */
const modesList = document.getElementById("modesList");
function renderModes(modes) {
  modesList.innerHTML = "";
  modes.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m.replace("_", " ");
    modesList.appendChild(li);
  });
}
renderModes(game.modes);

/* ===============================
   CARD + CALLS
================================ */
let called = new Set();
let marked = new Set(["2-2"]);

const board = document.getElementById("board");
const callsEl = document.getElementById("calls");
const currentBall = document.getElementById("currentBall");

const card = generateCard();
render();

sb.channel(`calls-${gameId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "calls" },
    p => {
      if (p.new.game_id !== gameId) return;
      const n = p.new.number;
      called.add(n);
      updateCurrentBall(n);
      addCalledNumber(n);
      render();
    }
  )
  .subscribe();

/* ===============================
   BINGO CLAIM
================================ */
document.getElementById("bingoBtn").onclick = async () => {
  if (marked.size === 0) {
    alert("You must mark at least one number before calling Bingo");
    return;
  }

  document.getElementById("bingoBtn").disabled = true;

const { error } = await sb.from("claims").insert({
  game_id: gameId,
  player_name: name,
  user_id: userId, // null if anonymous
  marked: [...marked]
});

  if (error) {
    console.error("[CLAIM ERROR]", error);
    alert("Unable to submit Bingo claim");
    document.getElementById("bingoBtn").disabled = false;
  }
};

/* ===============================
   RENDER
================================ */
function render() {
  board.innerHTML = "";
  card.forEach((r, y) =>
    r.forEach((v, x) => {
      const d = document.createElement("div");
      const k = `${x}-${y}`;
      d.className = "cell";
      d.textContent = v === "FREE" ? "★" : v;
      if (v === "FREE" || marked.has(k)) d.classList.add("marked");
      if (v !== "FREE" && !called.has(v)) d.classList.add("locked");
      d.onclick = () => {
        if (!called.has(v)) return;
        marked.has(k) ? marked.delete(k) : marked.add(k);
        render();
      };
      board.appendChild(d);
    })
  );
}

/* ===============================
   HELPERS
================================ */
function updateCurrentBall(n) {
  const l = n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
  currentBall.textContent = `${l} ${n}`;
  currentBall.classList.remove("hidden");
}

function addCalledNumber(n) {
  const l = n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
  const s = document.createElement("span");
  s.textContent = `${l} ${n}`;
  callsEl.prepend(s);
}

function generateCard() {
  const r = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const g = [[],[],[],[],[]];
  r.forEach(([a,b],x)=>{
    const s=new Set();
    while(s.size<5)s.add(Math.floor(Math.random()*(b-a+1))+a);
    [...s].forEach((n,y)=>g[y][x]=n);
  });
  g[2][2]="FREE";
  return g;
}
const { error } = await sb.from("claims").insert({
  game_id: gameId,
  player_name: name,
  marked: [...marked]
});

if (error) {
  if (error.message.includes("unique_player_per_game")) {
    alert("That username is already taken in this game.");
  } else {
    alert("Unable to submit Bingo claim.");
  }
}



