import { supabase } from './supabase.js';

/* ===============================
   UTIL
================================ */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;

  speechSynthesis.cancel(); // stop overlap
  speechSynthesis.speak(utterance);
}

/* ===============================
   GAME CREATION
================================ */
const roomCode = generateCode();
document.getElementById('roomCode').textContent = roomCode;

let called = new Set();
let gameId;
let autoTimer = null;

const modeInputs = document.querySelectorAll('.modes input');
async function updateModes() {
  const modes = [...modeInputs]
    .filter(i => i.checked)
    .map(i => i.value);

  // Always ensure at least one mode
  if (modes.length === 0) {
    modeInputs[0].checked = true;
    modes.push('normal');
  }

  await supabase
    .from('games')
    .update({ modes })
    .eq('id', gameId);
}
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

supabase
  .channel(`claims-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async payload => {
      if (payload.new.game_id !== gameId) return;

      const playerName = payload.new.player_name;
      const marked = payload.new.marked;

      // Load player card
      const { data: player } = await supabase
        .from('players')
        .select('card')
        .eq('game_id', gameId)
        .eq('name', playerName)
        .single();

      // Load called numbers
      const { data: calls } = await supabase
        .from('calls')
        .select('number')
        .eq('game_id', gameId);

      const called = new Set(calls.map(c => c.number));

      // Load game modes
      const { data: game } = await supabase
        .from('games')
        .select('modes')
        .eq('id', gameId)
        .single();

      const isValid = validateBingo(
        player.card,
        marked,
        called,
        game.modes
      );

      if (!isValid) return;

      // STOP GAME
      clearInterval(autoTimer);

      // DECLARE WINNER
      await supabase.from('winners').insert({
        game_id: gameId,
        player_name: playerName,
        pattern: 'BINGO'
      });

      // Mark game finished
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId);
    }
  )
  .subscribe();

function validateBingo(card, marked, called, modes) {
  const marks = new Set(marked);

  const valueAt = (x, y) => card[y][x];
  const isMarked = (x, y) =>
    valueAt(x, y) === 'FREE' ||
    (marks.has(`${x}-${y}`) && called.has(valueAt(x, y)));

  // Normal (rows, cols, diagonals)
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
   RESET GAME STATE
================================ */
await supabase.rpc('start_game', { p_game_id: gameId });

await supabase
  .from('games')
  .update({ status: 'active' })
  .eq('id', gameId);

/* ===============================
   RANDOM CALL
================================ */
function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }
  if (!remaining.length) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}

/* ===============================
   CALL
================================ */
document.getElementById('callBtn').onclick = async () => {
  const n = nextNumber();
  if (!n) return;

  called.add(n);

  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  document.getElementById('current').textContent = `${letter} ${n}`;

  speak(`${letter} ${n}`);

  await supabase.from('calls').insert({
    game_id: gameId,
    number: n
  });
};


/* ===============================
   AUTO CALL
================================ */
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

/* ===============================
   NEW GAME
================================ */
document.getElementById('newBtn').onclick = async () => {
  clearInterval(autoTimer);
  called.clear();
  document.getElementById('current').textContent = '—';

  await supabase.rpc('start_game', { p_game_id: gameId });
};





