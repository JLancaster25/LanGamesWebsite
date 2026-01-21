import { supabase } from './supabase.js';

const code = prompt('Game code');
const name = prompt('Your name');

const game = await supabase.from('games').select('*').eq('code', code).single();
const gameId = game.data.id;

let called = new Set();
let marked = new Set(['2-2']);
const board = document.getElementById('board');
const calledEl = document.getElementById('called');
const banner = document.getElementById('bingoBanner');

const card = generate();

supabase.channel('calls')
  .on('postgres_changes',{event:'INSERT',table:'calls'}, p => {
    if (p.new.game_id === gameId) {
      called.add(p.new.number);
      calledEl.textContent += p.new.number + ' ';
    }
  }).subscribe();

supabase.channel('winners')
  .on('postgres_changes',{event:'INSERT',table:'winners'}, p => {
    if (p.new.game_id === gameId) banner.classList.remove('hidden');
  }).subscribe();

render();

function render() {
  board.innerHTML='';
  card.forEach((r,y)=>r.forEach((v,x)=>{
    const k=`${x}-${y}`;
    const d=document.createElement('div');
    d.className='cell';
    if(marked.has(k))d.classList.add('marked');
    d.textContent=v==='FREE'?'★':v;
    d.onclick=()=>{ if(v!=='FREE'&&!called.has(v))return;
      marked.has(k)?marked.delete(k):marked.add(k);
      render();
    };
    board.appendChild(d);
  }));
}

document.getElementById('claimBtn').onclick = async () => {
  await supabase.from('claims').insert({
    game_id: gameId,
    player_name: name,
    marked: [...marked]
  });
};

function generate(){
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
