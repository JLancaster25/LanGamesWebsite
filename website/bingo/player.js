import { supabase } from './supabase.js';

/* ===============================
   JOIN GAME
================================ */
const code = prompt('Room code');
const name = prompt('Your name');
const bingoBtn = document.getElementById('bingoBtn');


const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (!game) {
  alert('Game not found');
  throw new Error('Game not found');
}

const gameId = game.id;

/* ===============================
   LOAD OR CREATE PLAYER
================================ */
let { data: player } = await supabase
  .from('players')
  .select('*')
  .eq('game_id', gameId)
  .eq('name', name)
  .maybeSingle();

let card;

if (player && player.card) {
  card = player.card;
} else {
  card = generateCard();
  const res = await supabase.from('players').insert({
    game_id: gameId,
    name,
    card
  }).select().single();
  player = res.data;
}

/* ===============================
   STATE
================================ */
let called = new Set();
let marked = new Set(['2-2']);

const board = document.getElementById('board');
const callsEl = document.getElementById('calls');
const currentBall = document.getElementById('currentBall');
const banner = document.getElementById('banner');

/* ===============================
   REALTIME CALLS
================================ */
supabase.channel(`calls-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calls' },
    payload => {
      if (payload.new.game_id !== gameId) return;

      const n = payload.new.number;
      called.add(n);
      updateCurrentBall(n);
      addCalledNumber(n);
      render();
    }
  )
  .subscribe();

supabase.channel('game-reset')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'games' },
    payload => {
      if (payload.new.id !== gameId) return;

      if (payload.new.status === 'active') {
        // Reset local state
        called.clear();
        marked = new Set(['2-2']);
        callsEl.innerHTML = '';
        currentBall.classList.add('hidden');
        banner.classList.add('hidden');
        render();
      }
    }
  )
  .subscribe();


/* ===============================
   RENDER
================================ */
function render() {
  board.innerHTML = '';

  card.forEach((row, y) => {
    row.forEach((v, x) => {
      const key = `${x}-${y}`;
      const d = document.createElement('div');
      d.className = 'cell';

      if (v === 'FREE') {
        d.textContent = '★';
        d.classList.add('free', 'marked');
      } else {
        d.textContent = v;
        if (!called.has(v)) d.classList.add('locked');
        if (marked.has(key)) d.classList.add('marked');

        d.onclick = () => {
          if (!called.has(v)) return;
          marked.has(key) ? marked.delete(key) : marked.add(key);
          render();
        };
      }
      board.appendChild(d);
    });
  });
}

render();

/* ===============================
   HELPERS
================================ */
function updateCurrentBall(n) {
  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  currentBall.textContent = `${letter} ${n}`;
  currentBall.classList.remove('hidden');
}

function addCalledNumber(n) {
  const letter =
    n <= 15 ? 'B' :
    n <= 30 ? 'I' :
    n <= 45 ? 'N' :
    n <= 60 ? 'G' : 'O';

  const span = document.createElement('span');
  span.textContent = `${letter} ${n}`;
  callsEl.prepend(span);
}

function generateCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const grid = Array.from({ length: 5 }, () => Array(5));

  ranges.forEach(([min,max], x) => {
    const nums = new Set();
    while (nums.size < 5)
      nums.add(Math.floor(Math.random()*(max-min+1))+min);
    [...nums].forEach((n,y)=>grid[y][x]=n);
  });

  grid[2][2] = 'FREE';
  return grid;
}


