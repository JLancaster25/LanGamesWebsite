import { supabase } from './supabase.js';

const code = prompt('Game code');

let modes = ['normal']; // later wired to checkboxes
let gameId = null;
let called = new Set();
let autoTimer = null;

/* ===============================
   LOAD OR CREATE GAME (SAFE)
================================ */
const { data: existingGame, error: loadError } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (loadError) {
  console.error('Load game failed:', loadError);
  alert('Failed to load game');
  throw new Error(loadError.message);
}

if (existingGame) {
  gameId = existingGame.id;
} else {
  const { data: newGame, error: insertError } = await supabase
    .from('games')
    .insert({
      code,
      modes,
      status: 'active',
      host_connected: true
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert game failed:', insertError);
    alert(insertError.message);
    throw new Error(insertError.message);
  }

  gameId = newGame.id;
}

/* ===============================
   MARK HOST CONNECTED (SAFE)
================================ */
const { error: updateError } = await supabase
  .from('games')
  .update({ host_connected: true })
  .eq('id', gameId);

if (updateError) {
  console.error('Host connect update failed:', updateError);
  alert(updateError.message);
  throw new Error(updateError.message);
}

/* ===============================
   RESET GAME STATE (SAFE)
================================ */
const { error: resetError } = await supabase.rpc('start_game', {
  p_game_id: gameId
});

if (resetError) {
  console.error('Game reset failed:', resetError);
  alert(resetError.message);
  throw new Error(resetError.message);
}

/* ===============================
   CALLING LOGIC
================================ */
function nextNumber() {
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) return i;
  }
  return null;
}

document.getElementById('callBtn').onclick = async () => {
  const n = nextNumber();
  if (!n) return;

  called.add(n);
  document.getElementById('current').textContent = n;

  const { error } = await supabase
    .from('calls')
    .insert({ game_id: gameId, number: n });

  if (error) console.error(error);
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

/* ===============================
   CLAIM LISTENER
================================ */
supabase.channel('claims')
  .on('postgres_changes', { event: 'INSERT', table: 'claims' }, async p => {
    if (p.new.game_id !== gameId) return;

    await supabase.from('winners').insert({
      game_id: gameId,
      player_name: p.new.player_name,
      pattern: 'BINGO'
    });

    document.getElementById('winners').innerHTML +=
      `<li>${p.new.player_name} — BINGO</li>`;

    clearInterval(autoTimer);
  })
  .subscribe();

/* ===============================
   CLEAN DISCONNECT
================================ */
window.addEventListener('beforeunload', () => {
  supabase
    .from('games')
    .update({ host_connected: false })
    .eq('id', gameId);
});
