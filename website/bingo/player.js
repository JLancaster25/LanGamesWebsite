import { supabase } from './supabase.js';

const code = prompt('Game code');
const name = prompt('Your name');

const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (!game) {
  alert('Game not found');
  throw new Error();
}

const gameId = game.id;
let called = new Set();
let marked = new Set(['2-2']);
const board = document.getElementById('board');
const callsEl = document.getElementById('calls');
const banner = document.getElementById('banner');

const card = generateCard();

/* CALL LISTENER */
supabase.channel('calls')
  .on('postgres_changes',{event:'INSERT',table:'calls'}, p => {
    if (p.new.game_id !== gameId) return;
    called.add(p.new.number);
    const span = document.createElement('span');
    span.textContent = p.new.number;
    callsEl.prepend(span);
  })
  .subscribe();

/* WIN LISTENER */
supabase.channel('winners')
  .on('postgres_changes',{event:'INSERT',table:'winners'}, p => {
    if (p.new.game_id === gameId) banner.classList.remove('hidden');
  })
  .subscribe();

render();

document.getElementById('claimBtn').onclick = async () => {
  await supabase.from('claims').insert({
    game_id: gameId,
    player_name: name,
    marked: [...marked]
  });
};

function render() {
  board.innerHTML = '';

  card.forEach((row, y) => {
    row.forEach((value, x) => {
      const key = `${x}-${y}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      // FREE cell
      if (value === 'FREE') {
        cell.textContent = '★';
        cell.classList.add('free', 'marked');
        board.appendChild(cell);
        return;
      }

      cell.textContent = value;

      const isCalled = called.has(value);
      const isMarked = marked.has(key);

      if (!isCalled) {
        cell.classList.add('locked'); // 🔒 visual lock
      }

      if (isMarked) {
        cell.classList.add('marked');
      }

      cell.onclick = () => {
        if (!isCalled) return; // ❌ enforce rules

        if (marked.has(key)) {
          marked.delete(key);
        } else {
          marked.add(key);
        }
        render();
      };

      board.appendChild(cell);
    });
  });
}


function generateCard() {
  const r=[[1,15],[16,30],[31,45],[46,60],[61,75]];
  const c=Array.from({length:5},()=>Array(5));
  r.forEach(([a,b],x)=>{
    const s=new Set();
    while(s.size<5)s.add(Math.floor(Math.random()*(b-a+1))+a);
    [...s].forEach((n,y)=>c[y][x]=n);
  });
  c[2][2]='FREE';
  return c;
}

supabase.channel('winners')
  .on('postgres_changes', { event:'INSERT', table:'winners' }, p => {
    if (p.new.game_id === gameId) {
      banner.classList.remove('hidden');
      document.querySelectorAll('.cell.marked')
        .forEach(c => c.classList.add('winner'));
    }
  })
  .subscribe();



