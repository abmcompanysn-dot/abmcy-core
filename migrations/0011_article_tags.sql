-- ============================================================
-- TAGS D'ARTICLE (texte libre, séparés par virgules)
-- ============================================================
-- Même choix que category/region (voir 0010_content.sql) : pas de table
-- de référence, un simple champ texte suffisant pour le moment.
ALTER TABLE articles ADD COLUMN tags TEXT;
