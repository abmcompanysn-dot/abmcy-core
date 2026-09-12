-- ============================================================
-- CONTENU ÉDITORIAL (articles) — tenant média (ex: MAHU)
-- ============================================================
-- Service optionnel, indépendant des 5 flags catalogue e-commerce :
-- un tenant peut être un média pur (articles, pas de produits), un
-- commerce pur (produits, pas d'articles), ou en théorie les deux.
-- Voir internal/features.Flags.ContentEnabled.

ALTER TABLE tenant_features
    ADD COLUMN content_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- ARTICLES
--
-- Catégorie et région restent des colonnes texte libres plutôt que des
-- tables de référence séparées — même choix que products.category
-- (voir 0001_init.sql) : pas de table de référence tant qu'aucun besoin
-- de gestion fine (traduction, ordre d'affichage, etc.) ne le justifie.
-- ============================================================
CREATE TABLE articles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title            VARCHAR(200) NOT NULL,
    slug             VARCHAR(220) NOT NULL,
    excerpt          TEXT,
    body             TEXT NOT NULL,
    category         VARCHAR(100),           -- libre : ex "Politique", "Tech"
    region           VARCHAR(100),           -- libre : ex "Ouest", "Est", "Nord", "Centrale"
    cover_image_url  TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
    is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
    view_count       INT NOT NULL DEFAULT 0,
    author_staff_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT articles_status_check CHECK (status IN ('draft', 'published'))
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_articles ON articles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
ALTER TABLE articles FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_articles_tenant_slug ON articles(tenant_id, slug);
CREATE INDEX idx_articles_tenant_status_published ON articles(tenant_id, status, published_at DESC);
