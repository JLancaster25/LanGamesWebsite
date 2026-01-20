(() => {
  'use strict';

  /**************** CONFIG ****************/
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';

  const GAME_ID = '00000000-0000-0000-0000-000000000001';

  const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const synth = window.speechSynthesis;

  /**************** STATE ****************/
  const App = {
    user: null,
    game: null,
    player: null,
    marked: ['2-2']
  };

  /**************** HELPERS ****************/
  const qs = id => document.getElementById(id);

  const speak = text => {
    if (!App.game?.voice_enabled) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(text));
  };

  /**************** AUTH ****************/
  async function loadUser() {
    const { data } = await sb.auth.getUser();
    App.user = data.user;
  }

  /**************** GAME BOOTSTRAP (FIX) ****************/
  async function ensureGameExists() {
    const { data } = await sb
      .from('games')
      .select('*')
      .eq('id', GAME_ID)
      .maybeSingle();

    if (data) {
      App.game = data;
      return;
    }

    // 🔥 FIX: auto-create game row
    const { data: created } = await sb
      .from('games')
      .insert({
        id: GAME_ID,
        game_state: 'lobby',
        game_modes: ['normal']
      })
      .select()
      .single();

    App.game = created;
  }

  /**************** CARD ****************/
  function generateCard() {
    const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
    const card = ranges.map(([min,max]) => {
      const s = new Set();
      while (s.size < 5)
        s.add(Math.floor(Math.random()*(max-min+1))+min);
      return [...s];
    });
    card[2][2] = 'FREE';
    return card;
  }

  /**************** PLAYER ****************/
  async function joinGame(name) {
    const { data } = await sb
      .from('players')
      .insert({
        game_id: GAME_ID,
        name,
        bingo_card: generateCard(),
        marked_cells: ['2-2']
      })
      .select()
      .single();

    App.player = data;
    App.marked = data.marked_cells;
    render();
  }

  async function toggleCell(c, r) {
    const key = `${c}-${r}`;
    if (!App.marked.includes(key)) App.marked.push(key);

    await sb
      .from('players')
      .update({ marked_cells: App.marked })
      .eq('id', App.player.id);
  }

  async function declareBingo() {
    const { data } = await sb.rpc('check_and_declare_bingo', {
      p_game_id: GAME_ID,
      p_player_id: App.player.id
    });

    if (!data) alert('❌ No valid bingo');
  }

  /**************** UI ****************/
  function render() {
    const el = qs('app');
    el.innerHTML = '';

    if (!App.user) {
      el.innerHTML = `
        <div class="flex h-screen justify-center items-center text-white">
          <a href="/login" class="bg-white text-purple-600 px-6 py-3 rounded-xl">
            Login to Play
          </a>
        </div>`;
      return;
    }

    if (!App.player) {
      el.innerHTML = `
        <div class="p-6 bg-white rounded-xl max-w-md mx-auto mt-20">
          <h2 class="text-xl mb-4">Join Bingo</h2>
          <input id="name" class="border p-2 w-full mb-4" placeholder="Your name">
          <button id="join" class="bg-purple-600 text-white w-full py-2 rounded">
            Join Game
          </button>
        </div>`;
      qs('join').onclick = () =>
        joinGame(qs('name').value);
      return;
    }

    el.innerHTML = `
      <div class="text-white text-center p-4">
        <h1 class="text-4xl font-bold mb-4">BINGO</h1>

        <div class="bingo-grid">
          ${App.player.bingo_card.map((col,c)=>
            col.map((v,r)=>{
              const k=`${c}-${r}`;
              const m=App.marked.includes(k);
              return `
                <button class="bingo-cell ${m?'bg-green-500':'bg-white text-black'}"
                  onclick="(${toggleCell})(${c},${r})">
                  ${v}
                </button>`;
            }).join('')
          ).join('')}
        </div>

        <button onclick="(${declareBingo})()"
          class="mt-6 bg-green-600 px-6 py-3 rounded-xl font-bold">
          BINGO!
        </button>
      </div>`;
  }

  /**************** INIT ****************/
  async function init() {
    await loadUser();
    await ensureGameExists(); // 🔥 critical fix
    render();
  }

  init();
})();
