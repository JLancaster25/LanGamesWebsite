import { supabase } from './supabase.js';

/* ===============================
   AI VOICE CALLER
================================ */
function speak(text) {
  if (!('speechSynthesis' in window)) return;

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.1;
  u.volume = 1;

  speechSynthesis.cancel(); // prevent overlap
  speechSynthesis.speak(u);
}

/* ===============================
   DOM
================================ */
const roomCodeEl = document.getElementById('roomCode');
const playerListEl = document.getElementById('playerList');

const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const autoBtn = document.getElementById('autoBtn');
const stopBtn = document.getElementById('stopBtn');
const newBtn = document.getElementById('newBtn');

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
const roomCode = generateCode();
roomCodeEl.textContent = roomCode;

const { data: game } = await supabase
  .from('games')
  .insert({ code: roomCode, status: 'lobby' })
  .select()
  .single();

gameId = game.id;

/* ===============================
   PLAYER LIST (REALTIME)
================================ */
supabase.channel(`players-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'players' },
    p => {
      if (p.new.game_id !== gameId) return;
      addPlayer(p.new.name);
    }
  )
  .subscribe();

function addPlayer(name) {
  const li = document.createElement('li');
  li.id = `player-${name}`;
  li.textContent = name;
  playerListEl.appendChild(li);
}

/* ===============================
   START GAME
================================ */
startBtn.onclick = async () => {
  gameActive = true;

  callBtn.disabled = false;
  autoBtn.disabled = false;
  stopBtn.disabled = false;

  await supabase
    .from('games')
    .update({ status: 'active' })
    .eq('id', gameId);

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

  const spoken = `${letter} ${n}`;
  speak(spoken);

  await supabase.from('calls').insert({
    game_id: gameId,
    number: n
  });
};

autoBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callBtn.onclick, 3000);
};

stopBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = null;
};

/* ===============================
   CLAIMS → HOST VALIDATION
================================ */
supabase.channel(`claims-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async p => {
      if (!gameActive) return;
      if (p.new.game_id !== gameId) return;

      const valid = await validateClaim(p.new);
      if (!valid) return;

      winners.add(p.new.player_name);
      crownWinner(p.new.player_name);

      speak(`${p.new.player_name} has bingo`);

      await supabase.from('winners').insert({
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
  autoTimer = null;

  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  speak('Bingo! Game over');

  await supabase
    .from('games')
    .update({ status: 'finished' })
    .eq('id', gameId);
}

/* ===============================
   NEW GAME
================================ */
newBtn.onclick = async () => {
  clearInterval(autoTimer);
  autoTimer = null;

  gameActive = false;
  called.clear();
  winners.clear();

  playerListEl.innerHTML = '';

  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  await supabase.rpc('start_game', { p_game_id: gameId });
  await supabase
    .from('games')
    .update({ status: 'lobby' })
    .eq('id', gameId);

  speak('New game ready');
};

/* ===============================
   HELPERS
================================ */
function crownWinner(name) {
  const li = document.getElementById(`player-${name}`);
  if (li && !li.textContent.includes('👑')) {
    li.textContent += ' 👑';
  }
}

function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }
  return remaining.length
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : null;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/* ===============================
   PLACEHOLDER VALIDATION
   (replace with real validation if desired)
================================ */
async function validateClaim() {
  return true; // host-authoritative placeholder
}
