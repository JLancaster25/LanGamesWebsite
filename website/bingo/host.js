import { supabase } from './supabase.js';

const code = prompt('Game code');
let gameId;
let called = new Set();
let autoTimer = null;

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
    .insert({ code })
    .select()
    .single();

  gameId = res.data.id;
}

/* ===============================
   RESET GAME
================================ */
await supabase.rpc('start_game', { p_game_id: gameId });

/* ===============================
   RANDOM CALL
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
   CALL BUTTON
================================ */
document.getElementById('callBtn').onclick = async () => {
  const n = randomCall();
  if (!n) return;

  called.add(n);
  document.getElementById('current').textContent = n;

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
   CLAIM LISTENER
================================ */
supabase
  .channel('claims')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'claims' },
    async payload => {
      if (payload.new.game_id !== gameId) return;

      await supabase.from('winners').insert({
        game_id: gameId,
        player_name: payload.new.player_name,
        pattern: 'BINGO'
      });

      clearInterval(autoTimer);
    }
  )
  .subscribe();
