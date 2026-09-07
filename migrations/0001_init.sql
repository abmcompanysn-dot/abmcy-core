-- ABMCY Core Multi-Tenant — schema initial + Row Level Security
-- Toutes les tables "métier" portent tenant_id et sont protégées par RLS :
-- même si une requête applicative oublie un WHERE tenant_id = ..., Postgres
-- refuse de renvoyer/modifier les lignes d'un autre tenant.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TENANTS (table système, pas de RLS : gérée uniquement via WithSystem)
-- ============================================================
CREATE TABLE tenants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(100) NOT NULL,          -- ex: "HANI'S"
    slug                 VARCHAR(100) UNIQUE NOT NULL,    -- ex: "hanis" -> hanis.dash.abmcy.com
    api_key_public       VARCHAR(255) UNIQUE NOT NULL,
    api_key_secret_hash  VARCHAR(255) NOT NULL,           -- bcrypt hash, jamais la clé en clair
    plan                 VARCHAR(30) NOT NULL DEFAULT 'free', -- free | starter | pro | enterprise
    storage_limit_bytes  BIGINT NOT NULL DEFAULT 5368709120,  -- 5 Go
    storage_used_bytes   BIGINT NOT NULL DEFAULT 0,
    email_quota_per_day  INT NOT NULL DEFAULT 100,
    email_sent_today     INT NOT NULL DEFAULT 0,
    email_quota_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS (comptes humains : super-admin ABMCY + utilisateurs d'un tenant)
-- ============================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL pour un super-admin ABMCY
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(30) NOT NULL DEFAULT 'owner', -- owner | staff | super_admin
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ============================================================
-- PRODUCTS / CATALOG
-- ============================================================
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    price       INT NOT NULL,           -- en FCFA
    category    VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_products ON products
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_products_tenant ON products(tenant_id);

-- ============================================================
-- PRODUCT IMAGES (uploadées sur imgbb, on garde juste l'URL + le poids)
-- ============================================================
CREATE TABLE product_images (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
    imgbb_url    TEXT NOT NULL,
    imgbb_delete_url TEXT,
    size_bytes   BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_product_images ON product_images
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_product_images_tenant ON product_images(tenant_id);

-- ============================================================
-- ORDERS (commandes + mesures sur-mesure)
-- ============================================================
CREATE TABLE orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number   VARCHAR(50) NOT NULL,
    customer_name  VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    total_amount   INT NOT NULL,          -- FCFA
    status         VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending|paid|in_progress|shipped|cancelled
    measurements   JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, order_number)
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_orders ON orders
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);

-- ============================================================
-- PAYMENTS (traces des transactions CinetPay / Stripe)
-- ============================================================
CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider       VARCHAR(30) NOT NULL,   -- cinetpay | stripe
    provider_ref   VARCHAR(255) NOT NULL,
    amount         INT NOT NULL,
    status         VARCHAR(30) NOT NULL DEFAULT 'initiated', -- initiated|success|failed
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payments ON payments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);

-- ============================================================
-- EMAIL LOG (traçabilité des envois Resend + quota de 100/jour)
-- ============================================================
CREATE TABLE email_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    to_address  VARCHAR(255) NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    template    VARCHAR(100),
    status      VARCHAR(30) NOT NULL DEFAULT 'sent', -- sent|failed
    resend_id   VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_email_logs ON email_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_email_logs_tenant_date ON email_logs(tenant_id, created_at);

-- ============================================================
-- Rôle applicatif : la connexion pool utilise ce rôle, jamais le
-- superuser Postgres, pour que les policies RLS s'appliquent vraiment
-- (un superuser/owner de table BYPASS RLS par défaut).
-- ============================================================
-- CREATE ROLE abmcy_app LOGIN PASSWORD '...';
-- GRANT CONNECT ON DATABASE abmcy TO abmcy_app;
-- GRANT USAGE ON SCHEMA public TO abmcy_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO abmcy_app;
