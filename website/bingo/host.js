import { supabase } from './supabase.js';

/* ===============================
   AI VOICE CALLER
================================ */
function speak(text) {
  if (!('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
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

let called = new Set();
let autoTimer = null;
let gameId;

/* ===============================
   CREATE GAME
================================ */
const { data: game } = await supabase
  .from('games')
  .insert({ code: roomCode, status: 'lobby' })
  .select()
  .single();

gameId = game.id;

/* ===============================
   MODE CONTROL
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

modeInputs.forEach(i => i.onchange = updateModes);
await updateModes();

/* ===============================
   START GAME (LOCK MODES)
================================ */
await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
modeInputs.forEach(i => i.disabled = true);

/* ===============================
   CALL LOGIC
================================ */
function nextNumber() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }
  return remaining.length
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : null;
}

document.getElementById('callBtn').onclick = async () => {
  const n = nextNumber();
  if (!n) return;

  called.add(n);

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
  called.clear();
  document.getElementById('current').textContent = '—';

  modeInputs.forEach(i => i.disabled = false);

  await supabase.rpc('start_game', { p_game_id: gameId });
  await supabase.from('games').update({ status: 'lobby' }).eq('id', gameId);
};
