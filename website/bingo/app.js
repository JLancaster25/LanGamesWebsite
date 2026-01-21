(() => {
  'use strict';

  const boardEl = document.getElementById('bingo-board');
  const callBtn = document.getElementById('callBtn');
  const autoBtn = document.getElementById('autoBtn');
  const stopBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const currentCallEl = document.getElementById('currentCall');
  const calledListEl = document.getElementById('calledList');

  const synth = window.speechSynthesis;
  let autoTimer = null;

  const state = {
    card: [],
    marked: new Set(['2-2']),
    called: [],
    remaining: [],
    hasBingo: false,
    winningCells: new Set()
  };

  /* VOICE */
  function speak(text) {
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(text));
  }

  function speakCall(num) {
    speak(formatCall(num));
  }

  /* CARD */
  function generateCard() {
    const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
    const card = Array.from({ length: 5 }, () => Array(5));

    ranges.forEach(([min,max], col) => {
      const nums = new Set();
      while (nums.size < 5) {
        nums.add(Math.floor(Math.random()*(max-min+1))+min);
      }
      [...nums].forEach((n,row)=>card[row][col]=n);
    });

    card[2][2] = 'FREE';
    return card;
  }

  /* CALLER */
  function initCaller() {
    state.remaining = Array.from({ length: 75 }, (_, i) => i + 1);
    shuffle(state.remaining);
    state.called = [];
    currentCallEl.textContent = '—';
    renderCalled();
  }

  function callNumber() {
    if (!state.remaining.length || state.hasBingo) return;

    const num = state.remaining.pop();
    state.called.push(num);

    currentCallEl.textContent = formatCall(num);
    renderCalled();
    speakCall(num);

    autoCheckBingo();
  }

  function formatCall(n) {
    return n<=15?`B ${n}`:n<=30?`I ${n}`:n<=45?`N ${n}`:n<=60?`G ${n}`:`O ${n}`;
  }

  function renderCalled() {
    calledListEl.innerHTML = state.called
      .slice().reverse()
      .map(n => `<span>${formatCall(n)}</span>`)
      .join('');
  }

  /* AUTO */
  function startAuto() {
    autoBtn.disabled = true;
    stopBtn.disabled = false;
    autoTimer = setInterval(callNumber, 3000);
  }

  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.disabled = false;
    stopBtn.disabled = true;
  }

  /* BOARD */
  function renderBoard() {
    boardEl.innerHTML = '';

    state.card.forEach((row,r)=>{
      row.forEach((val,c)=>{
        const key = `${c}-${r}`;
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (state.marked.has(key)) cell.classList.add('marked');
        if (state.winningCells.has(key)) cell.classList.add('win');
        if (key === '2-2') cell.classList.add('free');
        if (val !== 'FREE' && !state.called.includes(val)) cell.classList.add('disabled');

        cell.textContent = val === 'FREE' ? '★' : val;

        cell.onclick = () => {
          if (val !== 'FREE' && !state.called.includes(val)) return;
          state.marked.has(key)
            ? state.marked.delete(key)
            : state.marked.add(key);
          renderBoard();
          autoCheckBingo();
        };

        boardEl.appendChild(cell);
      });
    });
  }

  /* BINGO */
  function autoCheckBingo() {
    if (state.hasBingo) return;

    const has = cells => cells.every(c => state.marked.has(c));
    const wins = [];

    for (let i=0;i<5;i++) {
      if (has([`0-${i}`,`1-${i}`,`2-${i}`,`3-${i}`,`4-${i}`])) wins.push('Row');
      if (has([`${i}-0`,`${i}-1`,`${i}-2`,`${i}-3`,`${i}-4`])) wins.push('Column');
    }

    if (has(['0-0','1-1','2-2','3-3','4-4'])) wins.push('Diagonal');
    if (has(['4-0','3-1','2-2','1-3','0-4'])) wins.push('Diagonal');

    if (wins.length) {
      state.hasBingo = true;
      stopAuto();
      state.winningCells = new Set([...state.marked]);
      renderBoard();
      speak('Bingo!');
      alert('🎉 BINGO!');
    }
  }

  function shuffle(a) {
    for (let i=a.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
  }

  /* INIT */
  function resetGame() {
    stopAuto();
    state.hasBingo = false;
    state.winningCells.clear();
    state.marked = new Set(['2-2']);
    state.card = generateCard();
    initCaller();
    renderBoard();
  }

  callBtn.onclick = callNumber;
  autoBtn.onclick = startAuto;
  stopBtn.onclick = stopAuto;
  resetBtn.onclick = resetGame;

  resetGame();
})();
