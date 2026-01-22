import { supabase } from './supabase.js';

const code = prompt('Game code');

let gameId;
let called = new Set();
let autoTimer = null;

const themeBtn = document.getElementById('themeToggle');

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') document.body.classList.add('light');

themeBtn.onclick = () => {
  document.body.classList.toggle('light');
  localStorage.setItem(
    'theme',
    document.body.classList.contains('light') ? 'light' : 'dark'
  );
};

/* ===============================
   LOAD OR CREATE GAME
================================ */
const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (game) {
  gameId = game.id;
} else {
  const res = await supabase
    .from('games')
    .insert({
      code,
      modes: getSelectedModes()
    })
    .select()
    .single();

  gameId = res.data.id;
}

/* RESET GAME */
await supabase.rpc('start_game', { p_game_id: gameId });

/* ===============================
   RANDOM CALL (FIXED)
================================ */
function randomCall() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) remaining.push(i);
  }
  if (!remaining.length) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}

/* ===============================
   AI VOICE CALLER
================================ */
function speakCall(n) {
  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  const msg = new SpeechSynthesisUtterance(`${letter} ${n}`);
  msg.rate = 0.9;
  msg.pitch = 1.1;
  speechSynthesis.speak(msg);
}

/* ===============================
   CALL BUTTON
================================ */
document.getElementById('callBtn').onclick = async () => {
  const n = randomCall();
  if (!n) return;

  console.log('[HOST] Calling number:', n);

  const { data, error } = await supabase
    .from('calls')
    .insert({
      game_id: gameId,
      number: n
    })
    .select();

  if (error) {
    console.error('[HOST] Call insert failed:', error);
    alert(error.message);
    return;
  }

  console.log('[HOST] Call inserted:', data);
};

/* AUTO CALL */
document.getElementById('autoBtn').onclick = () => {
  clearInterval(autoTimer);
  autoTimer = setInterval(
    document.getElementById('callBtn').onclick,
    document.getElementById('speed').value * 1000
  );
};

document.getElementById('stopBtn').onclick = () => clearInterval(autoTimer);

/* ===============================
   CLAIM VALIDATION (MODES)
================================ */
supabase.channel('claims')
  .on('postgres_changes', { event: 'INSERT', table: 'claims' }, async p => {
    if (p.new.game_id !== gameId) return;

    const win = validateClaim(p.new.marked, game.modes);
    if (!win) return;

    await supabase.from('winners').insert({
      game_id: gameId,
      player_name: p.new.player_name,
      pattern: win
    });

    document.getElementById('winners').innerHTML +=
      `<li>${p.new.player_name} — ${win}</li>`;

    clearInterval(autoTimer);
  })
  .subscribe();

/* ===============================
   GAME MODES
================================ */
function getSelectedModes() {
  return [...document.querySelectorAll('input[type=checkbox]:checked')]
    .map(c => c.value);
}

function validateClaim(markedArr, modes) {
  const s = new Set(markedArr);

  if (modes.includes('blackout') && s.size === 25) return 'Blackout';

  if (modes.includes('corners')) {
    const corners = ['0-0','4-0','0-4','4-4'];
    if (corners.every(c => s.has(c))) return '4 Corners';
  }

  if (modes.includes('cross')) {
    const cross = [
      '2-0','2-1','2-2','2-3','2-4',
      '0-2','1-2','3-2','4-2'
    ];
    if (cross.every(c => s.has(c))) return 'Cross';
  }

  if (modes.includes('normal')) {
    for (let i = 0; i < 5; i++) {
      const row = [`0-${i}`,`1-${i}`,`2-${i}`,`3-${i}`,`4-${i}`];
      const col = [`${i}-0`,`${i}-1`,`${i}-2`,`${i}-3`,`${i}-4`];
      if (row.every(c => s.has(c)) || col.every(c => s.has(c))) {
        return 'Normal';
      }
    }
    if (['0-0','1-1','2-2','3-3','4-4'].every(c=>s.has(c))) return 'Diagonal';
    if (['4-0','3-1','2-2','1-3','0-4'].every(c=>s.has(c))) return 'Diagonal';
  }

  return null;
}


