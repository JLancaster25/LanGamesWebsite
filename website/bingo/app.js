(() => {
  'use strict';

  /*************************************************
   * NAMESPACE (nothing leaks globally)
   *************************************************/
  const BingoApp = {};

  /*************************************************
   * CONFIG
   *************************************************/
  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
  const GAME_ID = '00000000-0000-0000-0000-000000000001';

  BingoApp.supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const synth = window.speechSynthesis;

  /*************************************************
   * STATE (scoped safely)
   *************************************************/
  BingoApp.state = {
    user: null,
    game: null,
    player: null,
    players: [],
    winners: [],
    marked: ['2-2']
  };

  /*************************************************
   * HELPERS
   *************************************************/
  BingoApp.qs = id => document.getElementById(id);

  BingoApp.speak = text => {
    if (!BingoApp.state.game?.voice_enabled) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(text));
  };

  /*************************************************
   * AUTH
   *************************************************/
  BingoApp.initAuth = async () => {
    const { data } = await BingoApp.supabase.auth.getUser();
    BingoApp.state.user = data.user;
  };

  /*************************************************
   * GAME LOADERS
   *************************************************/
  BingoApp.loadGame = async () => {
    const { data } = await BingoApp.supabase
      .from('games')
      .select('*')
      .eq('id', GAME_ID)
      .single();
    BingoApp.state.game = data;
  };

  BingoApp.loadPlayers = async () => {
    const { data } = await BingoApp.supabase
      .from('players')
      .select('*')
      .eq('game_id', GAME_ID);
    BingoApp.state.players = data || [];
  };

  BingoApp.loadWinners = async () => {
    const { data } = await BingoApp.supabase
      .from('winners')
      .select('*')
      .eq('game_id', GAME_ID);
    BingoApp.state.winners = data || [];
  };

  /*************************************************
   * PLAYER ACTIONS
   *************************************************/
  BingoApp.joinGame = async name => {
    const { data } = await BingoApp.supabase
      .from('players')
      .insert({
        game_id: GAME_ID,
        name,
        bingo_card: BingoApp.generateCard(),
        marked_cells: ['2-2']
      })
      .select()
      .single();

    BingoApp.state.player = data;
    BingoApp.state.marked = data.marked_cells;
    BingoApp.render();
  };

  BingoApp.toggleCell = async (c, r) => {
    const key = `${c}-${r}`;
    if (!BingoApp.state.marked.includes(key)) {
      BingoApp.state.marked.push(key);
    }

    await BingoApp.supabase
      .from('players')
      .update({ marked_cells: BingoApp.state.marked })
      .eq('id', BingoApp.state.player.id);
  };

  BingoApp.declareBingo = async () => {
    const { data } = await BingoApp.supabase.rpc('check_and_declare_bingo', {
      p_game_id: GAME_ID,
      p_player_id: BingoApp.state.player.id
    });

    if (!data) {
      alert('❌ No valid bingo yet');
    }
  };

  /*************************************************
   * CARD
   *************************************************/
  BingoApp.generateCard = () => {
    const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
    const card = ranges.map(([min,max]) => {
      const s = new Set();
      while (s.size < 5)
        s.add(Math.floor(Math.random()*(max-min+1))+min);
      return [...s];
    });
    card[2][2] = 'FREE';
    return card;
  };

  /*************************************************
   * REALTIME
   *************************************************/
  BingoApp.realtime = () => {
    BingoApp.supabase.channel('game')
      .on('postgres_changes',
        { table: 'games', event: '*', filter: `id=eq.${GAME_ID}` },
        p => { BingoApp.state.game = p.new; BingoApp.render(); }
      ).subscribe();

    BingoApp.supabase.channel('players')
      .on('postgres_changes',
        { table: 'players', event: '*', filter: `game_id=eq.${GAME_ID}` },
        () => BingoApp.loadPlayers().then(BingoApp.render)
      ).subscribe();

    BingoApp.supabase.channel('winners')
      .on('postgres_changes',
        { table: 'winners', event: 'INSERT', filter: `game_id=eq.${GAME_ID}` },
        p => {
          BingoApp.speak(`Bingo! ${p.new.player_name} wins`);
          BingoApp.loadWinners().then(BingoApp.render);
        }
      ).subscribe();
  };

  /*************************************************
   * UI
   *************************************************/
  BingoApp.render = () => {
    const app = BingoApp.qs('app');
    app.innerHTML = '<div class="text-white text-center">Bingo App Loaded</div>';
  };

  /*************************************************
   * INIT
   *************************************************/
  BingoApp.init = async () => {
    await BingoApp.initAuth();
    await BingoApp.loadGame();
    await BingoApp.loadPlayers();
    await BingoApp.loadWinners();
    BingoApp.realtime();
    BingoApp.render();
  };

  BingoApp.init();

})();
