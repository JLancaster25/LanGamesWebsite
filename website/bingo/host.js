import { supabase } from './supabase.js';

const code = prompt('Game code');
const modes = [...document.querySelectorAll('input[type=checkbox]:checked')]
  .map(c => c.value);

const game = await supabase.from('games')
  .insert({ code, modes })
  .select()
  .single();

const gameId = game.data.id;
let called = new Set();
let autoTimer;

const current = document.getElementById('currentCall');
const winnersEl = document.getElementById('winners');

function pickNumber() {
  for (let i=1;i<=75;i++) if (!called.has(i)) return i;
}

async function callNumber() {
  const n = pickNumber();
  if (!n) return;
  called.add(n);
  current.textContent = n;
  await supabase.from('calls').insert({ game_id: gameId, number: n });
}

document.getElementById('callBtn').onclick = callNumber;
document.getElementById('autoBtn').onclick = () =>
  autoTimer = setInterval(callNumber, document.getElementById('speed').value*1000);
document.getElementById('stopBtn').onclick = () => clearInterval(autoTimer);

supabase.channel('claims')
  .on('postgres_changes',{event:'INSERT',table:'claims'}, async p => {
    if (p.new.game_id !== gameId) return;
    if (validate(p.new.marked)) {
      await supabase.from('winners').insert({
        game_id: gameId,
        player_name: p.new.player_name,
        pattern: 'BINGO'
      });
      winnersEl.innerHTML += `<li>${p.new.player_name} BINGO</li>`;
    }
  }).subscribe();

function validate(marked) {
  const s = new Set(marked);
  const lines = [];

  for (let i=0;i<5;i++) {
    lines.push([`0-${i}`,`1-${i}`,`2-${i}`,`3-${i}`,`4-${i}`]);
    lines.push([`${i}-0`,`${i}-1`,`${i}-2`,`${i}-3`,`${i}-4`]);
  }

  return lines.some(l => l.every(c => s.has(c)));
}
