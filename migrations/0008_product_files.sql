-- ============================================================
-- PRODUCT FILES (fichiers livrables — ebooks, templates, etc.)
-- ============================================================
-- Distincte de product_images : une image de présentation est publique
-- (servie via le domaine public R2), un fichier livrable ne doit JAMAIS
-- être accessible directement — object_key pointe vers un objet R2 sous
-- le préfixe "private/" (voir internal/storage.R2Client.UploadPrivate),
-- et le seul moyen d'y accéder est une URL signée à durée limitée
-- générée par GET /orders/{id}/delivery, uniquement si la commande est
-- "paid" et référence ce produit via order_items.
--
-- Un produit peut avoir plusieurs fichiers (ex: le fichier + un bonus).

CREATE TABLE product_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    object_key  TEXT NOT NULL,      -- clé R2 privée, jamais exposée telle quelle
    filename    VARCHAR(255) NOT NULL,
    size_bytes  BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_product_files ON product_files
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_product_files_product ON product_files(product_id);

-- ============================================================
-- PAYOUTS (versements demandés par un tenant vers son propre numéro,
-- via ABMCY Core Payment POST /v1/payouts)
-- ============================================================
-- Trace ce que ce backend a demandé — le solde réel et la commission
-- restent gérés côté ABMCY Core Payment ; cette table sert uniquement à
-- l'historique affiché dans le dashboard tenant et à retrouver un
-- versement par son app_ref lors du webhook.

CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_ref             VARCHAR(255) NOT NULL,
    amount_cfa          INT NOT NULL,
    recipient_phone     VARCHAR(20) NOT NULL,
    recipient_operator  VARCHAR(30) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'requested', -- requested|processing|paid|failed
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, app_ref)
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payouts ON payouts
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_payouts_tenant ON payouts(tenant_id, created_at DESC);
