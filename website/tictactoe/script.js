const cells = document.querySelectorAll(".cell");
const status = document.getElementById("status");
const resetBtn = document.getElementById("reset");

let board = Array(9).fill(null);
let current = "X";
let active = true;

const wins = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function clickCell(e) {
  const i = e.target.dataset.index;
  if (!active || board[i]) return;

  board[i] = current;
  e.target.textContent = current;

  if (wins.some(w => w.every(x => board[x] === current))) {
    status.textContent = `🎉 ${current} wins!`;
    active = false;
    return;
  }

  if (board.every(Boolean)) {
    status.textContent = "🤝 Draw!";
    active = false;
    return;
  }

  current = current === "X" ? "O" : "X";
  status.textContent = `${current}'s turn`;
}

function reset() {
  board.fill(null);
  current = "X";
  active = true;
  status.textContent = "X's turn";
  cells.forEach(c => c.textContent = "");
}

cells.forEach(c => {
  c.addEventListener("click", clickCell);
  c.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      c.click();
    }
  });
});

resetBtn.addEventListener("click", reset);
status.textContent = "X's turn";