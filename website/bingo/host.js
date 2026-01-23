import { supabase } from './supabase.js';

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
const roomCode = generateCode();
roomCodeEl.textContent = roomCode;

const { data: game } = await supabase
  .from('games')
  .insert({ code: roomCode, status: 'lobby' })
  .select()
  .single();

gameId = game.id;

/* ===============================
   LOAD EXISTING PLAYERS
================================ */
const { data: existingPlayers } = await supabase
  .from('players')
  .select('name')
  .eq('game_id', gameId);

existingPlayers.forEach(p => addPlayer(p.name));

/* ===============================
   REALTIME PLAYERS
================================ */
supabase.channel(`players-${gameId}`)
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
  await supabase.from('games').update({ modes }).eq('id', gameId);
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

  await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
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

  await supabase.from('calls').insert({
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
supabase.channel(`calls-${gameId}`)
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
supabase.channel(`claims-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async p => {
      if (!gameActive || p.new.game_id !== gameId) return;

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

  callBtn.disabled = autoBtn.disabled = stopBtn.disabled = true;
  speak('Bingo! Game over');

  await supabase.from('games').update({ status: 'finished' }).eq('id', gameId);
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

  await supabase.rpc('start_game', { p_game_id: gameId });
  await supabase.from('games').update({ status: 'lobby' }).eq('id', gameId);
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

