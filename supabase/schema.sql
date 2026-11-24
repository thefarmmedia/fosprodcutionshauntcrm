-- FoS Productions App — database schema for Supabase (Postgres).
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Every signed-in manager can read/write everything (both locations).
-- Website applications come in through the server using the service-role key.

create table if not exists locations (
  id text primary key,
  name text not null,
  full_name text not null default '',
  city text not null default '',
  color text not null default '#ff5a1f',
  sort int not null default 0
);

create table if not exists attractions (
  id text primary key,
  location_id text not null references locations(id) on delete cascade,
  name text not null,
  color text not null default '#ff5a1f',
  target int not null default 12,
  sort int not null default 0
);

create table if not exists groups (
  id text primary key,
  name text not null,
  color text not null default '#94a3b8',
  sort int not null default 0
);

create table if not exists staff (
  id text primary key,
  location_id text not null references locations(id),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  status text not null default 'applied'
    check (status in ('applied','interview','offered','active','inactive','declined','dnr')),
  position text not null default '',
  group_id text references groups(id) on delete set null,
  attraction_id text references attractions(id) on delete set null,
  is_minor boolean not null default false,
  guardian_name text not null default '',
  guardian_phone text not null default '',
  emergency_name text not null default '',
  emergency_phone text not null default '',
  availability text[] not null default '{}',
  shirt_size text not null default '',
  pay_rate numeric(6,2),
  seasons int not null default 1,
  docs text[] not null default '{}',
  application jsonb,
  source text not null default '',
  tags text[] not null default '{}',
  hired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_location_status on staff (location_id, status);

create table if not exists costumes (
  id text primary key,
  location_id text not null references locations(id),
  code text not null default '',
  name text not null,
  category text not null default '',
  size text not null default '',
  status text not null default 'ready' check (status in ('ready','in_use','cleaning','repair','retired')),
  attraction_id text references attractions(id) on delete set null,
  staff_id text references staff(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nights (
  id text primary key,
  location_id text not null references locations(id),
  date date not null,
  kind text not null default 'show' check (kind in ('show','rehearsal','training','build','event')),
  label text not null default '',
  call_time text not null default '18:00',
  open_time text not null default '19:30',
  close_time text not null default '00:00',
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists nights_location_date on nights (location_id, date);

create table if not exists shifts (
  id text primary key,
  night_id text not null references nights(id) on delete cascade,
  staff_id text not null references staff(id) on delete cascade,
  attraction_id text references attractions(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','declined')),
  created_at timestamptz not null default now()
);
create index if not exists shifts_night on shifts (night_id);

create table if not exists attendance (
  id text primary key,
  night_id text not null references nights(id) on delete cascade,
  staff_id text not null references staff(id) on delete cascade,
  location_id text not null references locations(id),
  status text not null check (status in ('in','out','called_in','no_show','sent_home')),
  check_in timestamptz,
  check_out timestamptz,
  late boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (night_id, staff_id)
);

create table if not exists messages (
  id text primary key,
  location_id text references locations(id),
  channel text not null check (channel in ('sms','email','both')),
  subject text not null default '',
  body text not null,
  recipient_ids text[] not null default '{}',
  audience text not null default '',
  sent_by text not null default '',
  result text not null default 'sent',
  stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id text primary key,
  staff_id text not null references staff(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','praise','writeup','status')),
  body text not null,
  author text not null default '',
  created_at timestamptz not null default now()
);

-- Row level security: signed-in managers get full access; anonymous visitors get nothing.
do $$
declare t text;
begin
  foreach t in array array['locations','attractions','groups','staff','costumes','nights','shifts','attendance','messages','notes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "managers full access" on %I', t);
    execute format('create policy "managers full access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Realtime so check-ins and changes show up instantly at both locations.
do $$
declare t text;
begin
  foreach t in array array['locations','attractions','groups','staff','costumes','nights','shifts','attendance','messages','notes'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Starting setup (edit names/colors any time in Settings)
insert into locations (id, name, full_name, city, color, sort) values
  ('loc-branson', 'Branson', 'Field of Screams Branson', 'Branson, MO', '#2fe05a', 1),
  ('loc-nixa', 'Nixa', 'Field of Screams Nixa', 'Nixa, MO', '#00c4cc', 2)
on conflict (id) do nothing;

insert into attractions (id, location_id, name, color, target, sort) values
  ('att-carnival', 'loc-branson', 'Carnival of Chaos', '#f43f5e', 18, 1),
  ('att-9th', 'loc-branson', '9th Inning Nightmare', '#22c55e', 16, 2),
  ('att-forest', 'loc-nixa', 'Haunted Forest', '#16a34a', 18, 1),
  ('att-coulro', 'loc-nixa', 'Coulrophobia', '#ff6a00', 16, 2)
on conflict (id) do nothing;

insert into groups (id, name, color, sort) values
  ('grp-actors', 'Scare Actors', '#ff5a1f', 1),
  ('grp-leads', 'Scene Leads', '#f59e0b', 2),
  ('grp-makeup', 'Makeup & FX', '#a855f7', 3),
  ('grp-wardrobe', 'Wardrobe', '#ec4899', 4),
  ('grp-admissions', 'Admissions', '#38bdf8', 5),
  ('grp-concessions', 'Concessions', '#facc15', 6),
  ('grp-parking', 'Parking', '#94a3b8', 7),
  ('grp-security', 'Security', '#ef4444', 8),
  ('grp-build', 'Build Crew', '#84cc16', 9)
on conflict (id) do nothing;
