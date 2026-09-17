-- ============================================================
-- ABONNEMENT PAR TENANT (prix libre, facturé mensuellement)
-- ============================================================
-- Chaque tenant paie ABMCY Core selon un prix fixé au cas par cas par
-- l'admin (pas de plans figés) — un accord commercial différent par
-- client. Le paiement se fait via ABMCY Core Payment (même orchestrateur
-- que les commandes des tenants), avec relance et blocage automatique
-- en cas d'impayé prolongé.

ALTER TABLE tenants
    ADD COLUMN subscription_price_fcfa INT,             -- NULL tant que l'admin n'a pas fixé de prix (pas encore facturé)
    ADD COLUMN subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
        -- inactive (pas de prix fixé) | active | past_due | cancelled
    ADD COLUMN next_billing_at TIMESTAMPTZ,              -- prochaine date d'échéance
    ADD COLUMN past_due_since TIMESTAMPTZ,               -- date du premier impayé de la période en cours, NULL si à jour
    ADD COLUMN cgu_accepted_at TIMESTAMPTZ;               -- date d'acceptation des CGU par le owner, NULL si pas encore acceptées

-- ============================================================
-- SUBSCRIPTION_PAYMENTS — historique des échéances d'abonnement
-- ============================================================
-- Distinct de `payments` (qui couvre les commandes des CLIENTS d'un
-- tenant) : ici il s'agit du tenant qui paie ABMCY Core elle-même.
CREATE TABLE subscription_payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount_fcfa    INT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid | failed
    period_start   TIMESTAMPTZ NOT NULL,
    period_end     TIMESTAMPTZ NOT NULL,
    payment_url    TEXT,                 -- lien ABMCY Core Payment pour régler cette échéance
    external_ref   VARCHAR(255),         -- référence du paiement chez ABMCY Core Payment
    paid_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_payments_tenant ON subscription_payments(tenant_id, created_at DESC);

-- Table système comme `tenants` : consultée/écrite uniquement via
-- WithSystem (l'admin ABMCY et le job de facturation, jamais un tenant
-- directement). Pas de RLS nécessaire pour la même raison que `tenants`.
