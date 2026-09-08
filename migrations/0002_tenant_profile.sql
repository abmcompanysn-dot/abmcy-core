-- ============================================================
-- PROFIL PUBLIC DU TENANT (logo, contact, marque, réseaux sociaux)
-- ============================================================
-- Jusqu'ici tenants ne portait que ce qui sert le fonctionnement interne
-- de la plateforme (clés API, quotas, plan). Ces colonnes couvrent ce
-- qu'un tenant affiche sur son propre site/dashboard : identité visuelle
-- et contact du gérant. Toutes nullable — un tenant existant (ex: HANI'S
-- avant cette migration) continue de fonctionner sans profil rempli.

ALTER TABLE tenants
    ADD COLUMN contact_name  VARCHAR(150),           -- ex: "Hanifah Afsata Jahida KONE"
    ADD COLUMN contact_phone VARCHAR(30),             -- ex: "22675544742"
    ADD COLUMN contact_role  VARCHAR(80),             -- ex: "PDG"
    ADD COLUMN logo_url      TEXT,                    -- URL R2, cf. internal/storage
    ADD COLUMN brand_color   VARCHAR(7),               -- hex, ex: "#4da6ff"
    ADD COLUMN tagline       VARCHAR(200),             -- ex: "Vêtements modestes"
    ADD COLUMN language      VARCHAR(10) NOT NULL DEFAULT 'fr'; -- code langue du dashboard/site tenant

-- ============================================================
-- RÉSEAUX SOCIAUX DU TENANT
-- ============================================================
-- Table séparée plutôt qu'un JSONB : un tenant peut avoir plusieurs liens
-- du même type (ex: deux numéros WhatsApp différents pour HANI'S), et la
-- liste affichée (site vitrine, footer HANNIFA) veut un ordre stable.
CREATE TABLE tenant_socials (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type       VARCHAR(30) NOT NULL,  -- instagram | tiktok | snapchat | whatsapp | website | facebook | ...
    url        TEXT NOT NULL,
    position   INT NOT NULL DEFAULT 0, -- ordre d'affichage
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_socials_tenant_id ON tenant_socials (tenant_id);

ALTER TABLE tenant_socials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_socials ON tenant_socials
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
