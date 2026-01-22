import { supabase } from './supabase.js';

/* ===============================
   JOIN GAME
================================ */
const code = prompt('Room code');
let name = prompt('Your name (max 10 chars)').trim();

if (!name || name.length > 10) {
  alert('Invalid name');
  throw new Error();
}

const { data: game } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .single();

const gameId = game.id;
document.getElementById('cardTitle').textContent = `${name}'s card`;

/* ===============================
   SHOW MODES
================================ */
const modesList = document.getElementById('modesList');
function renderModes(modes) {
  modesList.innerHTML = '';
  modes.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.replace('_', ' ');
    modesList.appendChild(li);
  });
}
renderModes(game.modes);

/* ===============================
   SUBSCRIBE MODE CHANGES
================================ */
supabase.channel(`modes-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'games' },
    p => {
      if (p.new.id === gameId) renderModes(p.new.modes);
    }
  )
  .subscribe();

/* ===============================
   CARD + CALLS
================================ */
let called = new Set();
let marked = new Set(['2-2']);

const board = document.getElementById('board');
const callsEl = document.getElementById('calls');
const currentBall = document.getElementById('currentBall');

const card = generateCard();
render();

supabase.channel(`calls-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calls' },
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
  card.forEach((r,y)=>r.forEach((v,x)=>{
    const d=document.createElement('div');
    const k=`${x}-${y}`;
    d.className='cell';
    d.textContent=v==='FREE'?'★':v;
    if(v==='FREE'||marked.has(k))d.classList.add('marked');
    if(v!=='FREE'&&!called.has(v))d.classList.add('locked');
    d.onclick=()=>{if(!called.has(v))return;marked.has(k)?marked.delete(k):marked.add(k);render();};
    board.appendChild(d);
  }));
}

/* ===============================
   HELPERS
================================ */
function updateCurrentBall(n){
  const l=n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O';
  currentBall.textContent=`${l} ${n}`;
  currentBall.classList.remove('hidden');
}

function addCalledNumber(n){
  const l=n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O';
  const s=document.createElement('span');
  s.textContent=`${l} ${n}`;
  callsEl.prepend(s);
}

function generateCard(){
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
