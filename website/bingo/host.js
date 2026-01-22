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
   UTIL
================================ */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/* ===============================
   GAME SETUP
================================ */
const roomCode = generateCode();
document.getElementById('roomCode').textContent = roomCode;

let gameId;
let autoTimer = null;
let calledLocal = new Set();

/* ===============================
   CREATE GAME
================================ */
const { data: game } = await supabase
  .from('games')
  .insert({
    code: roomCode,
    status: 'active'
  })
  .select()
  .single();

gameId = game.id;

/* ===============================
   MODE CONTROL (LOCKED AFTER START)
================================ */
const modeInputs = document.querySelectorAll('.modes input');

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
modeInputs.forEach(i => (i.disabled = true));

/* ===============================
   CALLING LOGIC
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

document.getElementById('callBtn').onclick = async () => {
  const n = nextNumber();
  if (!n) return;

  calledLocal.add(n);

  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  const spoken = `${letter} ${n}`;
  document.getElementById('current').textContent = spoken;
  speak(spoken);

  await supabase.from('calls').insert({
    game_id: gameId,
    number: n
  });

  await checkForBingo(); // 🔥 AUTO-DETECT
};

document.getElementById('autoBtn').onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(
    document.getElementById('callBtn').onclick,
    document.getElementById('speed').value * 1000
  );
};

document.getElementById('stopBtn').onclick = () => {
  clearInterval(autoTimer);
};

document.getElementById('newBtn').onclick = async () => {
  clearInterval(autoTimer);
  calledLocal.clear();
  document.getElementById('current').textContent = '—';

  await supabase.rpc('start_game', { p_game_id: gameId });
  await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
};

/* ===============================
   AUTO BINGO DETECTION
================================ */
async function checkForBingo() {
  // Load called numbers
  const { data: calls } = await supabase
    .from('calls')
    .select('number')
    .eq('game_id', gameId);

  const called = new Set(calls.map(c => c.number));

  // Load game modes
  const { data: game } = await supabase
    .from('games')
    .select('modes, status')
    .eq('id', gameId)
    .single();

  if (game.status !== 'active') return;

  // Load players
  const { data: players } = await supabase
    .from('players')
    .select('name, card')
    .eq('game_id', gameId);

  for (const player of players) {
    const allMarks = getMarksFromCalled(player.card, called);

    if (validateBingo(player.card, allMarks, called, game.modes)) {
      await endGame(player.name);
      break;
    }
  }
}

/* ===============================
   END GAME
================================ */
async function endGame(winnerName) {
  clearInterval(autoTimer);

  await supabase.from('winners').insert({
    game_id: gameId,
    player_name: winnerName,
    pattern: 'BINGO'
  });

  await supabase
    .from('games')
    .update({ status: 'finished' })
    .eq('id', gameId);
}

/* ===============================
   BINGO VALIDATION ENGINE
================================ */
function validateBingo(card, marked, called, modes) {
  const marks = new Set(marked);

  const isMarked = (x, y) => {
    const v = card[y][x];
    return v === 'FREE' || (called.has(v) && marks.has(`${x}-${y}`));
  };

  // Normal
  if (modes.includes('normal')) {
    for (let i = 0; i < 5; i++) {
      if ([0,1,2,3,4].every(x => isMarked(x, i))) return true;
      if ([0,1,2,3,4].every(y => isMarked(i, y))) return true;
    }
    if ([0,1,2,3,4].every(i => isMarked(i, i))) return true;
    if ([0,1,2,3,4].every(i => isMarked(4 - i, i))) return true;
  }

  // Four corners
  if (modes.includes('four_corners')) {
    if (
      isMarked(0,0) &&
      isMarked(4,0) &&
      isMarked(0,4) &&
      isMarked(4,4)
    ) return true;
  }

  // Cross
  if (modes.includes('cross')) {
    if (
      [0,1,2,3,4].every(i => isMarked(2, i)) &&
      [0,1,2,3,4].every(i => isMarked(i, 2))
    ) return true;
  }

  // Blackout
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

/* ===============================
   MARK HELPER
================================ */
function getMarksFromCalled(card, called) {
  const marks = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const v = card[y][x];
      if (v === 'FREE' || called.has(v)) {
        marks.push(`${x}-${y}`);
      }
    }
  }
  return marks;
}
