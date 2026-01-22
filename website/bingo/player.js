import { supabase } from './supabase.js';

const code = prompt('Room code');
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

  await supabase.from('players').insert({
    game_id: gameId,
    name,
    card
  });
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
supabase.channel('calls')
  .on('postgres_changes',
    { event:'INSERT', schema:'public', table:'calls' },
    p => {
      if (p.new.game_id !== gameId) return;
      const n = p.new.number;
      called.add(n);
      updateCurrentBall(n);
      addCalledNumber(n);
      render();
    }
  )
  .subscribe();

/* ===============================
   RENDER
================================ */
function render() {
  board.innerHTML = '';
  card.forEach((row,y)=>{
    row.forEach((v,x)=>{
      const key = `${x}-${y}`;
      const d = document.createElement('div');
      d.className = 'cell';
      if (v === 'FREE') {
        d.textContent = '★';
        d.classList.add('free','marked');
      } else {
        d.textContent = v;
        if (!called.has(v)) d.classList.add('locked');
        if (marked.has(key)) d.classList.add('marked');
        d.onclick = ()=> {
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
    n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O';
  currentBall.textContent = `${letter} ${n}`;
  currentBall.classList.remove('hidden');
}

function addCalledNumber(n) {
  const letter =
    n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O';
  const s = document.createElement('span');
  s.textContent = `${letter} ${n}`;
  callsEl.prepend(s);
}

function generateCard() {
  const r=[[1,15],[16,30],[31,45],[46,60],[61,75]];
  const g=[[],[],[],[],[]];
  r.forEach(([a,b],x)=>{
    const s=new Set();
    while(s.size<5)s.add(Math.floor(Math.random()*(b-a+1))+a);
    [...s].forEach((n,y)=>g[y][x]=n);
  });
  g[2][2]='FREE';
  return g;
}
