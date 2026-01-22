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
   RESET GAME STATE
================================ */
await supabase.rpc('start_game', { p_game_id: gameId });

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


