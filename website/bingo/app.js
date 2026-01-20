/*********************************************************
 * CONFIG
 *********************************************************/
const SUPABASE_URL = 'https://kppgmvfdfuhmtuaukkdn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e4AhlY9ZIgdlsG8rl111Fg_tWghrBW4';
const GAME_ID = '00000000-0000-0000-0000-000000000001';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const synth = window.speechSynthesis;

/*********************************************************
 * STATE
 *********************************************************/
const state = {
  user: null,
  game: null,
  player: null,
  players: [],
  winners: [],
  marked: ['2-2'], // FREE
};

/*********************************************************
 * UTILS
 *********************************************************/
function speak(text) {
  if (!state.game?.voice_enabled) return;
  synth.cancel();
  synth.speak(new SpeechSynthesisUtterance(text));
}

const qs = id => document.getElementById(id);

/*********************************************************
 * AUTH
 *********************************************************/
async function initAuth() {
  const { data } = await supabase.auth.getUser();
  state.user = data.user;
}

/*********************************************************
 * GAME
 *********************************************************/
async function loadGame() {
  const { data } = await supabase
    .from('games')
    .select('*')
    .eq('id', GAME_ID)
    .single();
  state.game = data;
}

async function loadPlayers() {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', GAME_ID);
  state.players = data || [];
}

async function loadWinners() {
  const { data } = await supabase
    .from('winners')
    .select('*')
    .eq('game_id', GAME_ID);
  state.winners = data || [];
}

/*********************************************************
 * REALTIME
 *********************************************************/
function setupRealtime() {
  supabase.channel('game')
    .on('postgres_changes',
      { table: 'games', event: '*', filter: `id=eq.${GAME_ID}` },
      p => { state.game = p.new; render(); }
    ).subscribe();

  supabase.channel('players')
    .on('postgres_changes',
      { table: 'players', event: '*', filter: `game_id=eq.${GAME_ID}` },
      () => loadPlayers().then(render)
    ).subscribe();

  supabase.channel('winners')
    .on('postgres_changes',
      { table: 'winners', event: 'INSERT', filter: `game_id=eq.${GAME_ID}` },
      p => {
        speak(`Bingo! ${p.new.player_name} wins`);
        loadWinners().then(render);
      }
    ).subscribe();
}

/*********************************************************
 * CARD
 *********************************************************/
function generateCard() {
  const ranges = [
    [1,15],[16,30],[31,45],[46,60],[61,75]
  ];

  const card = ranges.map(([min,max]) => {
    const s = new Set();
    while (s.size < 5)
      s.add(Math.floor(Math.random()*(max-min+1))+min);
    return [...s];
  });

  card[2][2] = 'FREE';
  return card;
}

/*********************************************************
 * PLAYER
 *********************************************************/
async function joinGame(name) {
  const { data } = await supabase
    .from('players')
    .insert({
      game_id: GAME_ID,
      name,
      bingo_card: generateCard(),
      marked_cells: ['2-2']
    })
    .select()
    .single();

  state.player = data;
  state.marked = data.marked_cells;
}

async function toggleCell(c, r) {
  const key = `${c}-${r}`;
  if (!state.marked.includes(key)) state.marked.push(key);

  await supabase
    .from('players')
    .update({ marked_cells: state.marked })
    .eq('id', state.player.id);
}

async function declareBingo() {
  const { data } = await supabase.rpc('check_and_declare_bingo', {
    p_game_id: GAME_ID,
    p_player_id: state.player.id
  });

  if (!data) alert('❌ No valid bingo yet');
}

/*********************************************************
 * UI
 *********************************************************/
function render() {
  const app = qs('app');
  app.innerHTML = '';

  if (!state.user) {
    app.innerHTML = `
      <div class="flex h-screen justify-center items-center text-white">
        <a href="/auth" class="bg-white text-purple-600 px-6 py-3 rounded-xl">
          Login
        </a>
      </div>`;
    return;
  }

  if (!state.player) {
    app.innerHTML = `
      <div class="p-6 bg-white max-w-md mx-auto mt-20 rounded-xl">
        <h2 class="text-xl mb-4">Join Game</h2>
        <input id="name" class="border p-2 w-full mb-4" placeholder="Your name">
        <button id="join" class="bg-purple-600 text-white w-full py-2 rounded">
          Join
        </button>
      </div>`;
    qs('join').onclick = () =>
      joinGame(qs('name').value).then(render);
    return;
  }

  app.innerHTML = `
    <div class="text-white text-center p-4">
      <h1 class="text-4xl font-bold mb-4">BINGO</h1>

      <div class="bingo-grid">
        ${state.player.bingo_card.map((col,c)=>
          col.map((v,r)=>{
            const k=`${c}-${r}`;
            const m=state.marked.includes(k);
            return `
              <button class="bingo-cell ${m?'bg-green-500':'bg-white text-black'}"
                onclick="toggleCell(${c},${r})">${v}</button>`;
          }).join('')
        ).join('')}
      </div>

      <button onclick="declareBingo()"
        class="mt-6 bg-green-600 px-6 py-3 rounded-xl font-bold">
        BINGO!
      </button>
    </div>`;
}

/*********************************************************
 * INIT
 *********************************************************/
async function init() {
  await initAuth();
  await loadGame();
  await loadPlayers();
  await loadWinners();
  setupRealtime();
  render();
}

init();

