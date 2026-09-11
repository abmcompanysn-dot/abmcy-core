-- ============================================================
-- CONFIG PAIEMENT PAR TENANT (ABMCY Core Payment)
-- ============================================================
-- Le paiement passait par CinetPay avec des clés UNIQUES pour toute la
-- plateforme (platform_config : CINETPAY_API_KEY / CINETPAY_SITE_ID) —
-- l'argent de tous les tenants transitait donc par un même compte.
--
-- On bascule sur ABMCY Core Payment (orchestrateur, base
-- https://core.diarra.app) avec un couple de clés PAR TENANT : chaque
-- tenant crée sa propre application dans la console ABMCY Core Payment et
-- encaisse sur son propre compte. Les deux valeurs sont chiffrées
-- AES-GCM au repos avec CONFIG_ENCRYPTION_KEY, exactement comme
-- platform_config (voir internal/platformconfig/crypto.go).
--
-- app_key      : identifie l'app du tenant (en-tête X-App-Key)
-- hmac_secret  : signe les requêtes /v1/* — la clé HMAC effective est
--                SHA-256(hmac_secret), pas le secret brut (cf. doc
--                ABMCY Core Payment §2)
--
-- Table système (pas de RLS) : gérée uniquement via WithSystem depuis le
-- dashboard admin, comme tenants et platform_config.

CREATE TABLE tenant_payment_config (
    tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    app_key_encrypted    BYTEA NOT NULL,
    hmac_secret_encrypted BYTEA NOT NULL,
    updated_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
