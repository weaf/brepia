-- P04G: Add mode column to prompt_profiles for overlay/fork distinction.
-- overlay = inherits future built-in updates (base_revision is recomputed)
-- fork    = frozen copy at creation time (base_revision tracks original fingerprint)
-- Defaults to 'overlay' for all existing profiles (they are already forked copies
-- implicitly, but for simplicity we mark them overlay — user can fork later).
-- base_revision is NULL for overlay profiles until first fork operation.

ALTER TABLE public.prompt_profiles
    ADD COLUMN mode text NOT NULL DEFAULT 'overlay'
    CHECK (mode IN ('overlay', 'fork'));
