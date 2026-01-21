import { supabase } from './supabase.js';

/* ===============================
   BASIC SETUP
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
const { data: game, error: gameError } = await supabase
  .from('games')
  .select('*')
  .eq('code', code)
  .maybeSingle();

if (gameError || !game) {
  alert('Game not found');
  throw new Error('Game not found');
}

const gameId = game.id;

/* ===============================
   STATE (DECLARE ONCE)
================================ */
let called = new Set();          // numbers called by host
let marked = new Set(['2-2']);   // FREE space

/* ===============================
   DOM REFERENCES
================================ */
const board = document.getElementById('board');
const callsEl = document.getElementById('calls');
const banner = document.getElementById('banner');
const currentBall = document.getElementById('currentBall');
const claimBtn = document.getElementById('claimBtn');

/* ===============================
   GENERATE CARD
================================ */
const card = generateCard();
render();

/* ===============================
   REALTIME: CALLS
================================ */
console.log('[PLAYER] Subscribing to calls…');

const callsChannel = supabase.channel('calls');

callsChannel
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'calls'
    },
    payload => {
      console.log('[PLAYER] CALL EVENT RECEIVED:', payload);

      if (!payload.new) return;
      if (payload.new.game_id !== gameId) return;

      const num = payload.new.number;

      console.log('[PLAYER] ACCEPTED CALL:', num);

      called.add(num);
      updateCurrentBall(num);
      addCalledNumber(num);
      render();
    }
  )
  .subscribe(status => {
    console.log('[PLAYER] Calls channel status:', status);
  });

/* ===============================
   REALTIME: WINNERS
================================ */
supabase
  .channel('player-winners')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'winners'
    },
    payload => {
      if (payload.new.game_id !== gameId) return;

      console.log('[PLAYER] Bingo confirmed by host');

      banner.classList.remove('hidden');

      // Highlight marked cells
      document.querySelectorAll('.cell.marked').forEach(cell => {
        cell.style.boxShadow = '0 0 12px gold';
        cell.style.transform = 'scale(1.05)';
      });
    }
  )
  .subscribe();

/* ===============================
   CLAIM BINGO
================================ */
claimBtn.onclick = async () => {
  console.log('[PLAYER] Claiming bingo');

  const { error } = await supabase.from('claims').insert({
    game_id: gameId,
    player_name: name,
    marked: [...marked]
  });

  if (error) {
    console.error('[PLAYER] Claim failed:', error);
    alert('Failed to claim bingo');
  }
};

/* ===============================
   RENDER BOARD
================================ */
function render() {
  board.innerHTML = '';

  card.forEach((row, y) => {
    row.forEach((value, x) => {
      const key = `${x}-${y}`;
      const cell = document.createElement('div');
      cell.className = 'cell';

      // FREE SPACE
      if (value === 'FREE') {
        cell.textContent = '★';
        cell.classList.add('free', 'marked');
        board.appendChild(cell);
        return;
      }

      cell.textContent = value;

      const isCalled = called.has(value);
      const isMarked = marked.has(key);

      if (!isCalled) cell.classList.add('locked');
      if (isMarked) cell.classList.add('marked');

      cell.onclick = () => {
        if (!called.has(value)) return;

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

  // Restart animation
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

