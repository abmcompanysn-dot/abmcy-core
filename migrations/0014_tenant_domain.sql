-- ============================================================
-- NOM DE DOMAINE DU TENANT (existant OU acheté via ABMCY)
-- ============================================================
-- Un tenant peut soit renseigner un domaine qu'il possède déjà, soit en
-- acheter un nouveau via ABMCY (qui l'achète pour son compte auprès de
-- Porkbun, et facture le tenant avec une marge). Distinct de
-- storefront_url (migration 0012) : storefront_url est l'URL affichée/
-- partagée (peut être un sous-domaine ABMCY), tandis que ceci trace la
-- démarche d'acquisition d'un domaine personnalisé, qu'elle soit
-- terminée ou en cours.

CREATE TABLE tenant_domains (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain         VARCHAR(255) NOT NULL,
    source         VARCHAR(20) NOT NULL,   -- existing | purchased
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending (achat initié, paiement pas encore confirmé) |
        -- active (domaine utilisable — existant confirmé, ou achat payé) |
        -- failed (paiement échoué ou achat refusé par le registrar)
    price_fcfa     INT,               -- prix facturé au tenant (avec marge ABMCY), NULL si source=existing
    registrar_cost_fcfa INT,          -- coût réel payé à Porkbun, NULL si source=existing — pour la comptabilité ABMCY, jamais montré au tenant
    payment_url    TEXT,
    external_ref   VARCHAR(255),      -- app_ref ABMCY Core Payment de cet achat
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_domains_tenant ON tenant_domains(tenant_id, created_at DESC);

-- Table système comme tenants/subscription_payments : consultée/écrite
-- uniquement via WithSystem (l'admin et le tenant lui-même, jamais un
-- accès cross-tenant réel puisque toujours filtré par tenant_id
-- applicativement) — pas de RLS, cohérent avec le reste des tables
-- système du projet.
