import { supabase } from './supabase.js';
let gameActive = false;
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
   UTIL
================================ */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/* ===============================
   ELEMENTS
================================ */
const roomCodeEl = document.getElementById('roomCode');
const countdownEl = document.getElementById('countdown');
const currentEl = document.getElementById('current');

const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const autoBtn = document.getElementById('autoBtn');
const stopBtn = document.getElementById('stopBtn');
const newBtn = document.getElementById('newBtn');
const speedInput = document.getElementById('speed');

const modeInputs = document.querySelectorAll('.modes input');

/* ===============================
   GAME STATE
================================ */
let gameId;
let calledLocal = new Set();
let autoTimer = null;

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
   MODE CONTROL
================================ */
async function updateModes() {
  const modes = [...modeInputs]
    .filter(i => i.checked)
    .map(i => i.value);

  if (modes.length === 0) {
    modeInputs[0].checked = true;
    modes.push('normal');
  }

  await supabase.from('games').update({ modes }).eq('id', gameId);
}

modeInputs.forEach(i => (i.onchange = updateModes));
await updateModes();

/* ===============================
   START GAME + COUNTDOWN
================================ */
startBtn.onclick = async () => {
  startBtn.disabled = true;
  modeInputs.forEach(i => (i.disabled = true));

  let count = 5;
  countdownEl.textContent = count;
  countdownEl.classList.remove('hidden');

  const timer = setInterval(async () => {
    count--;
    countdownEl.textContent = count;

    if (count === 0) {
      clearInterval(timer);
      countdownEl.classList.add('hidden');

      await supabase
        .from('games')
        .update({ status: 'active' })
        .eq('id', gameId);
      gameActive = true;
       
      callBtn.disabled = false;
      autoBtn.disabled = false;
      stopBtn.disabled = false;
    }
  }, 1000);
};

/* ===============================
   CALLING
================================ */
function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!calledLocal.has(i)) remaining.push(i);
  }
  return remaining.length
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : null;
}

callBtn.onclick = async () => {
  if (!gameActive) return;   // 🔒 HARD BLOCK

  const n = nextNumber();
  if (!n) return;

  calledLocal.add(n);

  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  const spoken = `${letter} ${n}`;
  currentEl.textContent = spoken;
  speak(spoken);

  await supabase.from('calls').insert({
    game_id: gameId,
    number: n
  });

  await checkForBingo();
};


autoBtn.onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(callBtn.onclick, speedInput.value * 1000);
};

stopBtn.onclick = () => clearInterval(autoTimer);

/* ===============================
   NEW GAME
================================ */
newBtn.onclick = async () => {
  clearInterval(autoTimer);
  autoTimer = null;

  gameActive = false;   // 🔁 reset

  calledLocal.clear();
  currentEl.textContent = '—';

  startBtn.disabled = false;
  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  modeInputs.forEach(i => (i.disabled = false));

  await supabase.rpc('start_game', { p_game_id: gameId });
  await supabase.from('games').update({ status: 'lobby' }).eq('id', gameId);
};

/* ===============================
   AUTO BINGO DETECTION
================================ */
async function checkForBingo() {
  const { data: calls } = await supabase
    .from('calls')
    .select('number')
    .eq('game_id', gameId);

  const called = new Set(calls.map(c => c.number));

  const { data: game } = await supabase
    .from('games')
    .select('modes, status')
    .eq('id', gameId)
    .single();

  if (game.status !== 'active') return;

  const { data: players } = await supabase
    .from('players')
    .select('name, card')
    .eq('game_id', gameId);

  for (const p of players) {
    const marks = getMarksFromCalled(p.card, called);
    if (validateBingo(p.card, marks, called, game.modes)) {
      await endGame(p.name);
      break;
    }
  }
}

/* ===============================
   END GAME
================================ */
async function endGame(winner) {
  // 🔴 HARD STOP
  gameActive = false;
  clearInterval(autoTimer);
  autoTimer = null;

  callBtn.disabled = true;
  autoBtn.disabled = true;
  stopBtn.disabled = true;

  speak('Bingo!');

  await supabase.from('winners').insert({
    game_id: gameId,
    player_name: winner,
    pattern: 'BINGO'
  });

  await supabase
    .from('games')
    .update({ status: 'finished' })
    .eq('id', gameId);
}

/* ===============================
   BINGO VALIDATION
================================ */
function validateBingo(card, marked, called, modes) {
  const m = new Set(marked);
  const isMarked = (x,y) => {
    const v = card[y][x];
    return v === 'FREE' || (called.has(v) && m.has(`${x}-${y}`));
  };

  if (modes.includes('normal')) {
    for (let i=0;i<5;i++) {
      if ([0,1,2,3,4].every(x=>isMarked(x,i))) return true;
      if ([0,1,2,3,4].every(y=>isMarked(i,y))) return true;
    }
    if ([0,1,2,3,4].every(i=>isMarked(i,i))) return true;
    if ([0,1,2,3,4].every(i=>isMarked(4-i,i))) return true;
  }

  if (modes.includes('four_corners')) {
    if (isMarked(0,0)&&isMarked(4,0)&&isMarked(0,4)&&isMarked(4,4)) return true;
  }

  if (modes.includes('cross')) {
    if ([0,1,2,3,4].every(i=>isMarked(2,i)) &&
        [0,1,2,3,4].every(i=>isMarked(i,2))) return true;
  }

  if (modes.includes('blackout')) {
    for (let y=0;y<5;y++) for (let x=0;x<5;x++)
      if (!isMarked(x,y)) return false;
    return true;
  }

  return false;
}

function getMarksFromCalled(card, called) {
  const marks=[];
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){
    const v=card[y][x];
    if(v==='FREE'||called.has(v))marks.push(`${x}-${y}`);
  }
  return marks;
}

