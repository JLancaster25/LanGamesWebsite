// ==========================================
// AUTH GUARD (HOST ONLY)
// ==========================================
const sb = window.supabaseClient;

async function requireAuth() {
  const { data, error } = await sb.auth.getSession();

  if (error || !data.session) {
    // Not logged in → send to login page
    window.location.replace("/WebsiteLogin/");
    return;
  }
}

// BLOCK EXECUTION UNTIL AUTH CHECK PASSES
await requireAuth();
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ==========================================
// AUTH GUARD (REQUIRED)
// ==========================================

async function requireAuth() {
  const { data } = await sb.auth.getSession();

  if (!data.session) {
    // Not logged in → redirect to login
    window.location.replace("/WebsiteLogin/");
  }
}

// Run immediately
requireAuth();
/* ===============================
   AI VOICE CALLER
================================ */
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ===============================
   DOM
================================ */
const roomCodeEl = document.getElementById('roomCode');
const callsEl = document.getElementById('calls');
const playerListEl = document.getElementById('playerList');

const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const autoBtn = document.getElementById('autoBtn');
const stopBtn = document.getElementById('stopBtn');
const newBtn = document.getElementById('newBtn');
const speedInput = document.getElementById('speed');
const modeInputs = document.querySelectorAll('.modes input');

/* ===============================
   STATE
================================ */
let gameId;
let gameActive = false;
let autoTimer = null;
let called = new Set();
let winners = new Set();

/* ===============================
   CREATE GAME
================================ */
let game = null;
let code = null;
let attempts = 0;

while (!game && attempts < 5) {
  attempts++;
  code = generateRoomCode();

  const { data, error } = await sb
    .from("games")
    .insert({
      code,
      host_id: (await sb.auth.getSession()).data.session.user.id,
      modes
    })
    .select()
    .single();

  if (!error) {
    game = data;
  }
}

if (!game) {
  alert("Failed to create unique room. Please try again.");
  throw new Error("Room creation failed");
}

const gameId = game.id;

// Display room code clearly
document.getElementById("roomCode").textContent = code;

/* ===============================
   LOAD EXISTING PLAYERS
================================ */
const { data: existingPlayers } = await sb
  .from('players')
  .select('name')
  .eq('game_id', gameId);

existingPlayers.forEach(p => addPlayer(p.name));

/* ===============================
   REALTIME PLAYERS
================================ */
sb.channel(`players-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'players' },
    p => {
      if (p.new.game_id === gameId) addPlayer(p.new.name);
    }
  )
  .subscribe();

/* ===============================
   MODE CONTROL
================================ */
async function updateModes() {
  const modes = [...modeInputs].filter(i => i.checked).map(i => i.value);
  if (!modes.length) {
    modeInputs[0].checked = true;
    modes.push('normal');
  }
  await sb.from('games').update({ modes }).eq('id', gameId);
}
modeInputs.forEach(i => i.onchange = updateModes);
await updateModes();

/* ===============================
   START GAME
================================ */
startBtn.onclick = async () => {
  gameActive = true;
  modeInputs.forEach(i => i.disabled = true);

  callBtn.disabled = autoBtn.disabled = stopBtn.disabled = false;

  await sb.from('games').update({ status: 'active' }).eq('id', gameId);
  speak('Game started');
};

/* ===============================
   CALLING
================================ */
callBtn.onclick = async () => {
  if (!gameActive) return;

  const n = nextNumber();
  if (!n) return;

  called.add(n);

  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  const label = `${letter} ${n}`;
  speak(label);

  renderCall(label);

  await sb.from('calls').insert({
    game_id: gameId,
    number: n
  });
};

autoBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callBtn.onclick, speedInput.value * 1000);
};

stopBtn.onclick = () => clearInterval(autoTimer);

/* ===============================
   REALTIME CALL HISTORY
================================ */
sb.channel(`calls-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calls' },
    p => {
      if (p.new.game_id !== gameId) return;
      renderCall(formatCall(p.new.number));
    }
  )
  .subscribe();

/* ===============================
   CLAIMS + WINNERS
================================ */
sb.channel(`claims-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async p => {
      if (!gameActive || p.new.game_id !== gameId) return;

      winners.add(p.new.player_name);
      crownWinner(p.new.player_name);

      speak(`${p.new.player_name} has bingo`);

      await sb.from('winners').insert({
        game_id: gameId,
        player_name: p.new.player_name,
        pattern: 'BINGO'
      });

      endGame();
    }
  )
  .subscribe();

/* ===============================
   END GAME
================================ */
async function endGame() {
  gameActive = false;
  clearInterval(autoTimer);

  callBtn.disabled = autoBtn.disabled = stopBtn.disabled = true;
  speak('Bingo! Game over');

  await sb.from('games').update({ status: 'finished' }).eq('id', gameId);
}

/* ===============================
   NEW GAME
================================ */
newBtn.onclick = async () => {
  gameActive = false;
  called.clear();
  winners.clear();
  callsEl.innerHTML = '';

  modeInputs.forEach(i => i.disabled = false);
  callBtn.disabled = autoBtn.disabled = stopBtn.disabled = true;

  await sb.rpc('start_game', { p_game_id: gameId });
  await sb.from('games').update({ status: 'lobby' }).eq('id', gameId);
};

/* ===============================
   HELPERS
================================ */
function addPlayer(name) {
  if (document.getElementById(`player-${name}`)) return;
  const li = document.createElement('li');
  li.id = `player-${name}`;
  li.textContent = name;
  playerListEl.appendChild(li);
}

function crownWinner(name) {
  const li = document.getElementById(`player-${name}`);
  if (li && !li.textContent.includes('👑')) li.textContent += ' 👑';
}

function renderCall(text) {
  const span = document.createElement('span');
  span.textContent = text;
  callsEl.prepend(span);
}

function formatCall(n) {
  const l = n <= 15 ? 'B' : n <= 30 ? 'I' : n <= 45 ? 'N' : n <= 60 ? 'G' : 'O';
  return `${l} ${n}`;
}

function nextNumber() {
  const remaining = [];

  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }

  if (remaining.length === 0) return null;

  const index = Math.floor(Math.random() * remaining.length);
  return remaining[index];
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}





