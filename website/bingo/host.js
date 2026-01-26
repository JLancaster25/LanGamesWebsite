'use strict';

import { supabase as sb } from './supabase.js';

/* =====================================================
   AI VOICE CALLER
===================================================== */
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* =====================================================
   DOM
===================================================== */
const roomCodeEl = document.getElementById('roomCode');
const playerListEl = document.getElementById('playerList');
const callsEl = document.getElementById('calls');

const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const autoBtn = document.getElementById('autoBtn');
const stopBtn = document.getElementById('stopBtn');
const newBtn = document.getElementById('newBtn');
const speedInput = document.getElementById('speed');

const modeInputs = document.querySelectorAll('.modes input');

/* =====================================================
   STATE
===================================================== */
let gameId;
let gameActive = false;
let autoTimer = null;
let called = new Set();
let winners = new Set();

/* =====================================================
   CREATE GAME
===================================================== */
const roomCode = generateCode();
roomCodeEl.textContent = roomCode;

const { data: game, error: gameErr } = await sb
  .from('games')
  .insert({ code: roomCode, status: 'lobby' })
  .select()
  .single();

if (gameErr) throw gameErr;
gameId = game.id;

/* =====================================================
   LOAD EXISTING PLAYERS
===================================================== */
const { data: existingPlayers } = await sb
  .from('players')
  .select('name')
  .eq('game_id', gameId);

existingPlayers?.forEach(p => addPlayer(p.name));

/* =====================================================
   REALTIME: PLAYERS
===================================================== */
sb.channel(`players-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'players' },
    p => {
      if (p.new.game_id === gameId) addPlayer(p.new.name);
    }
  )
  .subscribe();

/* =====================================================
   MODE CONTROL
===================================================== */
async function updateModes() {
  const modes = [...modeInputs]
    .filter(i => i.checked)
    .map(i => i.value);

  if (!modes.length) {
    modeInputs[0].checked = true;
    modes.push('normal');
  }

  await sb.from('games').update({ modes }).eq('id', gameId);
}

modeInputs.forEach(i => (i.onchange = updateModes));
await updateModes();

/* =====================================================
   START GAME
===================================================== */
startBtn.onclick = async () => {
  gameActive = true;
  modeInputs.forEach(i => (i.disabled = true));

  callBtn.disabled = false;
  autoBtn.disabled = false;
  stopBtn.disabled = false;

  await sb.from('games').update({ status: 'active' }).eq('id', gameId);
  speak('Game started');
};

/* =====================================================
   RANDOM CALLING
===================================================== */
function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }
  if (!remaining.length) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}

callBtn.onclick = async () => {
  if (!gameActive) return;

  const n = nextNumber();
  if (!n) return;

  called.add(n);

  const label = formatCall(n);
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

stopBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = null;
};

/* =====================================================
   REALTIME: CALL HISTORY
===================================================== */
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

/* =====================================================
   REALTIME: CLAIMS → HOST VALIDATION
===================================================== */
sb.channel(`claims-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async p => {
      if (!gameActive || p.new.game_id !== gameId) return;

      const valid = await validateClaim(p.new);
      if (!valid) return;

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

/* =====================================================
   HOST-SIDE BINGO VALIDATION
===================================================== */
async function validateClaim(claim) {
  const { data: player } = await sb
    .from('players')
    .select('card')
    .eq('game_id', gameId)
    .eq('name', claim.player_name)
    .single();

  if (!player) return false;

  const card = player.card;
  const marked = new Set(claim.marked);
  const calledSet = called;

  const { data: game } = await sb
    .from('games')
    .select('modes')
    .eq('id', gameId)
    .single();

  return validateBingo(card, marked, calledSet, game.modes);
}

/* =====================================================
   BINGO ENGINE
===================================================== */
function validateBingo(card, marked, calledSet, modes) {
  const isMarked = (x, y) => {
    const v = card[y][x];
    return v === 'FREE' || (calledSet.has(v) && marked.has(`${x}-${y}`));
  };

  if (modes.includes('normal')) {
    for (let i = 0; i < 5; i++) {
      if ([0,1,2,3,4].every(x => isMarked(x, i))) return true;
      if ([0,1,2,3,4].every(y => isMarked(i, y))) return true;
    }
    if ([0,1,2,3,4].every(i => isMarked(i, i))) return true;
    if ([0,1,2,3,4].every(i => isMarked(4 - i, i))) return true;
  }

  if (modes.includes('four_corners')) {
    if (
      isMarked(0,0) &&
      isMarked(4,0) &&
      isMarked(0,4) &&
      isMarked(4,4)
    ) return true;
  }

  if (modes.includes('cross')) {
    if (
      [0,1,2,3,4].every(i => isMarked(2, i)) &&
      [0,1,2,3,4].every(i => isMarked(i, 2))
    ) return true;
  }

  if (modes.includes('blackout')) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (!isMarked(x, y)) return false;
      }
    }
    return true;
  }

  return false;
}

/* =====================================================
   END GAME
===================================================== */
async function endGame() {
  gameActive = false;
  clearInterval(autoTimer);
  autoTimer = null;

  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  speak('Bingo! Game over');

  await sb.from('games').update({ status: 'finished' }).eq('id', gameId);
}

/* =====================================================
   NEW GAME
===================================================== */
newBtn.onclick = async () => {
  clearInterval(autoTimer);
  autoTimer = null;

  called.clear();
  winners.clear();
  callsEl.innerHTML = '';

  gameActive = false;
  modeInputs.forEach(i => (i.disabled = false));

  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  await sb.rpc('start_game', { p_game_id: gameId });
  await sb.from('games').update({ status: 'lobby' }).eq('id', gameId);

  speak('New game ready');
};

/* =====================================================
   UI HELPERS
===================================================== */
function addPlayer(name) {
  if (document.getElementById(`player-${name}`)) return;
  const li = document.createElement('li');
  li.id = `player-${name}`;
  li.textContent = name;
  playerListEl.appendChild(li);
}

function crownWinner(name) {
  const li = document.getElementById(`player-${name}`);
  if (li && !li.textContent.includes('👑')) {
    li.textContent += ' 👑';
  }
}

function renderCall(text) {
  const span = document.createElement('span');
  span.textContent = text;
  callsEl.prepend(span);
}

function formatCall(n) {
  const l = n <= 15 ? 'B' :
            n <= 30 ? 'I' :
            n <= 45 ? 'N' :
            n <= 60 ? 'G' : 'O';
  return `${l} ${n}`;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
