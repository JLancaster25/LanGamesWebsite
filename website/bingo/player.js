import { supabase } from './supabase.js';

/* ===============================
   SETUP
================================ */
const code = prompt('Game code');
const name = prompt('Your name');

if (!code || !name) {
  alert('Game code and name are required');
  throw new Error('Missing player info');
}

/* ===============================
   LOAD GAME
================================ */
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
   STATE
================================ */
let called = new Set();
let marked = new Set(['2-2']); // FREE space

/* ===============================
   DOM
================================ */
const board = document.getElementById('board');
const callsEl = document.getElementById('calls');
const banner = document.getElementById('banner');
const currentBall = document.getElementById('currentBall');
const claimBtn = document.getElementById('claimBtn');

/* ===============================
   CARD
================================ */
const card = generateCard();
render();

/* ===============================
   REALTIME: CALLS
================================ */
supabase
  .channel('calls')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calls' },
    payload => {
      if (payload.new.game_id !== gameId) return;

      const num = payload.new.number;
      called.add(num);

      updateCurrentBall(num);
      addCalledNumber(num);
      render();
    }
  )
  .subscribe();

/* ===============================
   REALTIME: WINNER
================================ */
supabase
  .channel('winners')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'winners' },
    payload => {
      if (payload.new.game_id !== gameId) return;
      banner.classList.remove('hidden');
    }
  )
  .subscribe();

/* ===============================
   CLAIM BINGO
================================ */
claimBtn.onclick = async () => {
  await supabase.from('claims').insert({
    game_id: gameId,
    player_name: name,
    marked: [...marked]
  });
};

/* ===============================
   RENDER
================================ */
function render() {
  board.innerHTML = '';

  card.forEach((row, y) => {
    row.forEach((value, x) => {
      const key = `${x}-${y}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (value === 'FREE') {
        cell.textContent = '★';
        cell.classList.add('free', 'marked');
        board.appendChild(cell);
        return;
      }

      cell.textContent = value;

      if (!called.has(value)) cell.classList.add('locked');
      if (marked.has(key)) cell.classList.add('marked');

      cell.onclick = () => {
        if (!called.has(value)) return;

        marked.has(key)
          ? marked.delete(key)
          : marked.add(key);

        render();
      };

      board.appendChild(cell);
    });
  });
}

/* ===============================
   UI HELPERS
================================ */
function updateCurrentBall(num) {
  const letter =
    num <= 15 ? 'B' :
    num <= 30 ? 'I' :
    num <= 45 ? 'N' :
    num <= 60 ? 'G' : 'O';

  currentBall.textContent = `${letter} ${num}`;
  currentBall.classList.remove('hidden');

  currentBall.style.animation = 'none';
  currentBall.offsetHeight;
  currentBall.style.animation = '';
}

function addCalledNumber(num) {
  const letter =
    num <= 15 ? 'B' :
    num <= 30 ? 'I' :
    num <= 45 ? 'N' :
    num <= 60 ? 'G' : 'O';

  const span = document.createElement('span');
  span.textContent = `${letter} ${num}`;
  callsEl.prepend(span);
}

/* ===============================
   CARD GENERATION
================================ */
function generateCard() {
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75]
  ];

  const grid = Array.from({ length: 5 }, () => Array(5));

  ranges.forEach(([min, max], col) => {
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    [...nums].forEach((num, row) => {
      grid[row][col] = num;
    });
  });

  grid[2][2] = 'FREE';
  return grid;
}
