(() => {
  'use strict';

  const boardEl = document.getElementById('bingo-board');
  const callBtn = document.getElementById('callBtn');
  const autoBtn = document.getElementById('autoBtn');
  const stopBtn = document.getElementById('stopBtn');
  const bingoBtn = document.getElementById('bingoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const currentCallEl = document.getElementById('currentCall');
  const calledListEl = document.getElementById('calledList');

  let autoInterval = null;

  const state = {
    card: [],
    marked: new Set(['2-2']),
    called: [],
    remaining: []
  };

  /* ===============================
     CARD GENERATION (CORRECT BINGO)
  =============================== */
function generateCard() {
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75]   // O
  ];

  // Create empty 5x5 grid (rows)
  const card = Array.from({ length: 5 }, () => Array(5).fill(null));

  // Generate each column correctly
  ranges.forEach(([min, max], col) => {
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    [...nums].forEach((num, row) => {
      card[row][col] = num;
    });
  });

  // Free space
  card[2][2] = 'FREE';

  return card;
}

  /* ===============================
     CALLER (AI)
  =============================== */
  function initCaller() {
    state.remaining = [];
    for (let i = 1; i <= 75; i++) state.remaining.push(i);
    shuffle(state.remaining);
    state.called = [];
    currentCallEl.textContent = '—';
    renderCalled();
  }

  function callNumber() {
    if (!state.remaining.length) return;

    const num = state.remaining.pop();
    state.called.push(num);
    currentCallEl.textContent = formatCall(num);
    renderCalled();
  }

  function formatCall(num) {
    if (num <= 15) return `B ${num}`;
    if (num <= 30) return `I ${num}`;
    if (num <= 45) return `N ${num}`;
    if (num <= 60) return `G ${num}`;
    return `O ${num}`;
  }

  function renderCalled() {
    calledListEl.innerHTML = state.called
      .map(n => `<span>${formatCall(n)}</span>`)
      .join('');
  }

  /* ===============================
     AUTO CALL
  =============================== */
  function startAuto() {
    autoBtn.disabled = true;
    stopBtn.disabled = false;

    autoInterval = setInterval(() => {
      if (!state.remaining.length) stopAuto();
      callNumber();
    }, 3000);
  }

  function stopAuto() {
    clearInterval(autoInterval);
    autoInterval = null;
    autoBtn.disabled = false;
    stopBtn.disabled = true;
  }

  /* ===============================
     BOARD
  =============================== */
 function renderBoard() {
  boardEl.innerHTML = '';

  state.card.forEach((row, r) => {
    row.forEach((val, c) => {
      const key = `${c}-${r}`;
      const cell = document.createElement('div');

      cell.className = 'cell';
      if (state.marked.has(key)) cell.classList.add('marked');
      if (key === '2-2') cell.classList.add('free');

      cell.textContent = val === 'FREE' ? '★' : val;
      cell.onclick = () => {
  // FREE space allowed
		if (val === 'FREE') {
			toggleMark(key);
		return;
		}
  // 🔒 Enforce called-number rule
		if (!isNumberCalled(val)) {
			alert(`❌ ${formatCall(val)} has not been called yet`);
		return;
	}

  toggleMark(key);
};

      boardEl.appendChild(cell);
    });
  });
}

function isNumberCalled(value) {
  // FREE space always allowed
  if (value === 'FREE') return true;

  return state.called.includes(value);
}

  function toggleMark(key) {
    if (key === '2-2') return;
    state.marked.has(key)
      ? state.marked.delete(key)
      : state.marked.add(key);
    renderBoard();
  }

  /* ===============================
     BINGO CHECK
  =============================== */
  function has(cells) {
    return cells.every(c => state.marked.has(c));
  }

  function checkBingo() {
    const wins = [];

    for (let i = 0; i < 5; i++) {
      if (has([`${i}-0`,`${i}-1`,`${i}-2`,`${i}-3`,`${i}-4`])) wins.push('Row');
      if (has([`0-${i}`,`1-${i}`,`2-${i}`,`3-${i}`,`4-${i}`])) wins.push('Column');
    }

    if (has(['0-0','1-1','2-2','3-3','4-4'])) wins.push('Diagonal');
    if (has(['4-0','3-1','2-2','1-3','0-4'])) wins.push('Diagonal');
    if (has(['0-0','4-0','0-4','4-4'])) wins.push('4 Corners');
    if (
      has(['2-0','2-1','2-2','2-3','2-4']) ||
      has(['0-2','1-2','2-2','3-2','4-2'])
    ) wins.push('Cross');

    if (state.marked.size === 25) wins.push('Blackout');

    alert(wins.length ? `🎉 BINGO! (${wins.join(', ')})` : '❌ No Bingo yet');
  }

  /* ===============================
     UTILS
  =============================== */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /* ===============================
     INIT
  =============================== */
  function resetGame() {
    stopAuto();
    state.card = generateCard();
    state.marked = new Set(['2-2']);
    initCaller();
    renderBoard();
  }

  callBtn.onclick = callNumber;
  autoBtn.onclick = startAuto;
  stopBtn.onclick = stopAuto;
  bingoBtn.onclick = checkBingo;
  resetBtn.onclick = resetGame;

  resetGame();
})();
