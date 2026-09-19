-- The evolution record.
--
-- The exhibit does not need this. It runs from a committed JSON archive and a
-- static host, which is deliberate: the public page should not be able to break
-- because a database is down. What a database adds is HISTORY — every genome
-- ever evaluated rather than only the ones currently holding a cell, so
-- lineages can be traced and old runs compared.
--
-- Policy style is lifted from JellyTech's 002_admin_and_content.sql, including
-- the SECURITY DEFINER is_admin() function, which exists to avoid the recursive
-- policy trap where the table that decides who may read a table is itself the
-- table being read.

-- ---------------------------------------------------------------- admins

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Deliberately no INSERT policy. Admins are minted by a human in the dashboard
-- with the service key; if the application could grant admin, a bug in the
-- application could grant admin.
CREATE POLICY admins_read_own ON admins FOR SELECT USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION is_admin()
  RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE
  SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()); $$;

-- ---------------------------------------------------------------- runs

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  -- The entire run is a pure function of this seed plus the code. Store it and
  -- any generation can be replayed exactly.
  seed TEXT NOT NULL,
  spec_version INT NOT NULL,
  -- Hash of the economy and episode config. Fitness numbers are only
  -- comparable within one config, and without this it is impossible to tell
  -- later whether two runs can be put on the same axis.
  config_hash TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'running'
);

-- ---------------------------------------------------------------- genomes

CREATE TABLE IF NOT EXISTS genomes (
  -- Content hash of the genes. The same animal discovered twice is one row.
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  generation INT NOT NULL,
  -- The genes themselves, comma-separated to six places. Compact, exact, and
  -- readable in a psql window, which a bytea blob is not.
  genes TEXT NOT NULL,
  spec_version INT NOT NULL,
  parent_a TEXT,
  parent_b TEXT,
  -- Denormalised so a lineage tree can be laid out without a recursive walk.
  lineage_depth INT NOT NULL DEFAULT 0,
  -- Denormalised for filtering and sorting ONLY; the genes are authoritative.
  d_bell_radius REAL,
  d_tentacles INT,
  d_pulse_freq REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS genomes_run_gen ON genomes (run_id, generation);
CREATE INDEX IF NOT EXISTS genomes_parents ON genomes (parent_a);

-- ---------------------------------------------------------------- evaluations

-- Fitness is a property of (genome, episode seed), NOT of a genome. Re-running
-- the same animal against a different food field is a new measurement and gets
-- a new row; keeping both is what makes evaluation noise measurable instead of
-- invisible. Append-only: rows are never updated.
CREATE TABLE IF NOT EXISTS evaluations (
  id BIGSERIAL PRIMARY KEY,
  genome_id TEXT NOT NULL REFERENCES genomes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  episode_seed TEXT NOT NULL,
  fitness REAL NOT NULL,
  net_energy REAL NOT NULL,
  captures INT NOT NULL,
  ticks_survived INT NOT NULL,
  body_lengths_per_second REAL NOT NULL,
  behaviour JSONB NOT NULL,
  abort_reason TEXT,
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evaluations_genome ON evaluations (genome_id);
CREATE INDEX IF NOT EXISTS evaluations_best ON evaluations (run_id, fitness DESC);

-- ---------------------------------------------------------------- generations

CREATE TABLE IF NOT EXISTS generations (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  index INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  evaluated INT NOT NULL DEFAULT 0,
  discovered INT NOT NULL DEFAULT 0,
  improved INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  archive_fill INT NOT NULL DEFAULT 0,
  best_fitness REAL,
  -- An hourly cron will occasionally run twice for the same generation after a
  -- retry. This makes that a no-op rather than a duplicate.
  UNIQUE (run_id, index)
);

-- ---------------------------------------------------------------- archive

CREATE TABLE IF NOT EXISTS archive_cells (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  cell_key TEXT NOT NULL,
  genome_id TEXT NOT NULL REFERENCES genomes(id) ON DELETE CASCADE,
  fitness REAL NOT NULL,
  behaviour JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, cell_key)
);

-- ---------------------------------------------------------------- policies

-- A public exhibit: everything is readable by anyone, and writable only by the
-- runner, which authenticates as an admin. There is no per-user data here at
-- all, so none of the ownership machinery is needed.
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE genomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_public_read ON runs FOR SELECT USING (true);
CREATE POLICY runs_admin_all ON runs FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY genomes_public_read ON genomes FOR SELECT USING (true);
CREATE POLICY genomes_admin_all ON genomes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY evaluations_public_read ON evaluations FOR SELECT USING (true);
CREATE POLICY evaluations_admin_all ON evaluations FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY generations_public_read ON generations FOR SELECT USING (true);
CREATE POLICY generations_admin_all ON generations FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY archive_public_read ON archive_cells FOR SELECT USING (true);
CREATE POLICY archive_admin_all ON archive_cells FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------------------------------------------------------------- lineage

-- Walk a genome back to its founders. Depth-limited because a long run can
-- produce chains of hundreds and a tree that deep is not worth rendering.
CREATE OR REPLACE FUNCTION lineage_of(target TEXT, max_depth INT DEFAULT 40)
  RETURNS TABLE (id TEXT, generation INT, depth INT)
  LANGUAGE SQL STABLE
AS $$
  WITH RECURSIVE up AS (
    SELECT g.id, g.generation, g.parent_a, 0 AS depth
      FROM genomes g WHERE g.id = target
    UNION ALL
    SELECT g.id, g.generation, g.parent_a, up.depth + 1
      FROM genomes g JOIN up ON g.id = up.parent_a
     WHERE up.depth < max_depth
  )
  SELECT up.id, up.generation, up.depth FROM up ORDER BY up.depth;
$$;
