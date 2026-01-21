import { supabase } from './supabase.js';

const code = prompt('Game code');
let modes = []; // extendable

let gameId;
let called = new Set();
let autoTimer = null;

/* LOAD OR CREATE GAME */
// Always define modes explicitly
const modes = ['normal']; // later you’ll read this from checkboxes

let gameId;

// 1. Try to load existing game
const { data: existingGame, error: loadError } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (loadError) {
  console.error(loadError);
  alert('Failed to load game');
  throw loadError;
}

if (existingGame) {
  // Game already exists → host reconnect
  gameId = existingGame.id;
} else {
  // 2. Create new game
  const { data: newGame, error: insertError } = await supabase
    .from('games')
    .insert({
      code,
      modes,            // ✅ REQUIRED
      status: 'active',
      host_connected: true
    })
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    alert('Failed to create game. Check console.');
    throw insertError;
  }

  gameId = newGame.id;
}

// 3. Reset game state safely
await supabase.rpc('start_game', { p_game_id: gameId });

/* MARK HOST CONNECTED */
await supabase
  .from('games')
  .update({ host_connected: true })
  .eq('id', gameId);

/* RESET GAME SAFELY */
await supabase.rpc('start_game', { p_game_id: gameId });

/* CALL NUMBER */
function nextNumber() {
  for (let i = 1; i <= 75; i++) {
    if (!called.has(i)) return i;
  }
}

document.getElementById('callBtn').onclick = async () => {
  const n = nextNumber();
  if (!n) return;
  called.add(n);
  document.getElementById('current').textContent = n;
  await supabase.from('calls').insert({ game_id: gameId, number: n });
};

document.getElementById('autoBtn').onclick = () => {
  autoTimer = setInterval(
    document.getElementById('callBtn').onclick,
    document.getElementById('speed').value * 1000
  );
};

document.getElementById('stopBtn').onclick = () => clearInterval(autoTimer);

/* CLAIM LISTENER */
supabase.channel('claims')
  .on('postgres_changes',{event:'INSERT',table:'claims'}, async p => {
    if (p.new.game_id !== gameId) return;
    await supabase.from('winners').insert({
      game_id: gameId,
      player_name: p.new.player_name,
      pattern: 'BINGO'
    });
    document.getElementById('winners').innerHTML +=
      `<li>${p.new.player_name}</li>`;
    clearInterval(autoTimer);
  })
  .subscribe();

/* CLEAN DISCONNECT */
window.addEventListener('beforeunload', async () => {
  await supabase.from('games')
    .update({ host_connected: false })
    .eq('id', gameId);
});


