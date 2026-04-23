CREATE TABLE public.tle_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name TEXT NOT NULL,
  norad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_name, norad_id)
);

ALTER TABLE public.tle_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TLE cache is publicly readable"
ON public.tle_cache FOR SELECT
USING (true);

CREATE INDEX idx_tle_cache_group ON public.tle_cache(group_name);
CREATE INDEX idx_tle_cache_fetched ON public.tle_cache(fetched_at);