-- EXTENSIONS
create extension if not exists "uuid-ossp";

------------------------------------------------
-- TABLES
------------------------------------------------
create table games (
  id uuid primary key,
  game_state text default 'lobby',
  game_modes text[] default '{normal}',
  called_numbers int[],
  voice_enabled boolean default true
);

create table players (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid default auth.uid(),
  game_id uuid references games(id),
  name text,
  bingo_card jsonb,
  marked_cells text[],
  is_winner boolean default false
);

create table winners (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references games(id),
  player_id uuid references players(id),
  player_name text,
  win_mode text,
  created_at timestamptz default now(),
  unique (game_id, player_id)
);

------------------------------------------------
-- RLS
------------------------------------------------
alter table games enable row level security;
alter table players enable row level security;
alter table winners enable row level security;

-- READ
create policy "read games" on games for select using (true);
create policy "read players" on players for select using (true);
create policy "read winners" on winners for select using (true);

-- PLAYER INSERT / UPDATE
create policy "join game" on players
for insert with check (auth.uid() is not null);

create policy "update self" on players
for update using (auth.uid() = user_id);

-- ADMIN ONLY GAME UPDATE
create policy "admin game control" on games
for update using (auth.jwt() ->> 'role' = 'admin');

-- NO DIRECT WINNER INSERTS
create policy "block winner insert" on winners
for insert with check (false);

------------------------------------------------
-- RPC: MULTI-MODE BINGO VALIDATION
------------------------------------------------
create or replace function check_and_declare_bingo(
  p_game_id uuid,
  p_player_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  marks text[];
  modes text[];
  win text := null;
begin
  select marked_cells into marks from players where id=p_player_id;
  select game_modes into modes from games where id=p_game_id;

  -- NORMAL
  if 'normal'=any(modes) then
    for i in 0..4 loop
      if marks @> array[i||'-0',i||'-1',i||'-2',i||'-3',i||'-4'] then win:='normal'; end if;
      if marks @> array['0-'||i,'1-'||i,'2-'||i,'3-'||i,'4-'||i'] then win:='normal'; end if;
    end loop;
    if marks @> array['0-0','1-1','2-2','3-3','4-4'] then win:='normal'; end if;
    if marks @> array['4-0','3-1','2-2','1-3','0-4'] then win:='normal'; end if;
  end if;

  -- 4 CORNERS
  if win is null and '4_corners'=any(modes)
     and marks @> array['0-0','4-0','0-4','4-4'] then
    win := '4_corners';
  end if;

  -- CROSS
  if win is null and 'cross'=any(modes)
     and (
       marks @> array['0-0','1-1','2-2','3-3','4-4'] or
       marks @> array['4-0','3-1','2-2','1-3','0-4'] or
       marks @> array['2-0','2-1','2-2','2-3','2-4'] or
       marks @> array['0-2','1-2','2-2','3-2','4-2']
     ) then
    win := 'cross';
  end if;

  -- BLACKOUT
  if win is null and 'blackout'=any(modes) then
    if array_length(marks,1) >= 25 then win := 'blackout'; end if;
  end if;

  if win is not null then
    insert into winners(game_id,player_id,player_name,win_mode)
    select p_game_id,id,name,win from players where id=p_player_id
    on conflict do nothing;

    update players set is_winner=true where id=p_player_id;
  end if;

  return win;
end;
$$;
