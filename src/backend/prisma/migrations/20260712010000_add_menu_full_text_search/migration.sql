CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION immutable_unaccent(input TEXT)
RETURNS TEXT AS $$ SELECT unaccent('unaccent', lower(coalesce(input, ''))) $$
LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

ALTER TABLE menu_items
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(name)), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(slug)), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(item_type)), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(description)), 'C')
  ) STORED;

ALTER TABLE categories
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(name)), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(slug)), 'B')
  ) STORED;

ALTER TABLE conversation_sessions ADD COLUMN draft_state JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX menu_items_search_vector_idx ON menu_items USING GIN (search_vector);
CREATE INDEX categories_search_vector_idx ON categories USING GIN (search_vector);
CREATE INDEX menu_items_name_trgm_idx ON menu_items USING GIN (immutable_unaccent(name) gin_trgm_ops);
CREATE INDEX menu_items_slug_trgm_idx ON menu_items USING GIN (immutable_unaccent(slug) gin_trgm_ops);
