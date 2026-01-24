const cells = document.querySelectorAll(".cell");
const status = document.getElementById("status");
const resetBtn = document.getElementById("reset");

const HUMAN = "X";
const AI = "O";

let board = Array(9).fill(null);
let active = true;

const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");

/* MENU LOGIC */
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // ⛔ prevent document click
  menu.classList.toggle("hidden");
});

/* Close menu when clicking outside */
document.addEventListener("click", (e) => {
  const clickedInsideMenu = menu.contains(e.target);
  const clickedMenuButton = menuBtn.contains(e.target);

  if (!clickedInsideMenu && !clickedMenuButton) {
    menu.classList.add("hidden");
  }
});

/* Menu item navigation */
document.querySelectorAll("[data-target]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.getAttribute("data-target");
    menu.classList.add("hidden");
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});

const wins = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

/* ================================
   GAME FLOW
================================ */
function handleHumanMove(e) {
  const index = e.target.dataset.index;
  if (!active || board[index]) return;

  makeMove(index, HUMAN);

  if (checkEnd(HUMAN)) return;

  status.textContent = "AI thinking…";

  setTimeout(() => {
    const aiMove = getBestMove();
    makeMove(aiMove, AI);
    checkEnd(AI);
  }, 300); // slight delay feels natural
}

function makeMove(index, player) {
  board[index] = player;
  cells[index].textContent = player;
}

function checkEnd(player) {
  if (isWinner(board, player)) {
    status.textContent = `🎉 ${player === HUMAN ? "You win!" : "AI wins!"}`;
    active = false;
    return true;
  }

  if (board.every(Boolean)) {
    status.textContent = "🤝 It's a draw!";
    active = false;
    return true;
  }

  status.textContent = player === HUMAN ? "AI's turn" : "Your turn";
  return false;
}

/* ================================
   AI LOGIC (MINIMAX)
================================ */
function getBestMove() {
  let bestScore = -Infinity;
  let move;

  board.forEach((cell, index) => {
    if (!cell) {
      board[index] = AI;
      let score = minimax(board, 0, false);
      board[index] = null;

      if (score > bestScore) {
        bestScore = score;
        move = index;
      }
    }
  });

  return move;
}

function minimax(boardState, depth, isMaximizing) {
  if (isWinner(boardState, AI)) return 10 - depth;
  if (isWinner(boardState, HUMAN)) return depth - 10;
  if (boardState.every(Boolean)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    boardState.forEach((cell, i) => {
      if (!cell) {
        boardState[i] = AI;
        best = Math.max(best, minimax(boardState, depth + 1, false));
        boardState[i] = null;
      }
    });
    return best;
  } else {
    let best = Infinity;
    boardState.forEach((cell, i) => {
      if (!cell) {
        boardState[i] = HUMAN;
        best = Math.min(best, minimax(boardState, depth + 1, true));
        boardState[i] = null;
      }
    });
    return best;
  }
}

function isWinner(boardState, player) {
  return wins.some(combo =>
    combo.every(i => boardState[i] === player)
  );
}

/* ================================
   RESET
================================ */
function resetGame() {
  board.fill(null);
  active = true;
  cells.forEach(c => (c.textContent = ""));
  status.textContent = "Your turn";
}

/* ================================
   EVENTS
================================ */
cells.forEach(cell => {
  cell.addEventListener("click", handleHumanMove);
  cell.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cell.click();
    }
  });
});

resetBtn.addEventListener("click", resetGame);

/* INIT */
status.textContent = "Your turn";

