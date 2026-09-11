-- ============================================================
-- ISOLATION RLS RÉELLE (correctif de sécurité critique)
-- ============================================================
-- FAILLE DÉCOUVERTE (2026-09-11) : le rôle applicatif abmcy_app était à
-- la fois SUPERUSER et propriétaire de toutes les tables. Postgres
-- exempte TOUJOURS le propriétaire d'une table (et tout superuser) des
-- policies RLS, quelle que soit la policy définie — y compris avec
-- FORCE ROW LEVEL SECURITY. Concrètement, la clé API d'un tenant pouvait
-- lire (et potentiellement écrire) les données de n'importe quel autre
-- tenant : l'isolation RLS documentée dans CLAUDE.md n'a jamais été
-- réellement appliquée, seulement supposée.
--
-- Cause racine : abmcy_app était aussi l'utilisateur bootstrap de
-- l'image Docker postgres:16-alpine (POSTGRES_USER au démarrage du
-- conteneur). Postgres refuse structurellement de retirer SUPERUSER au
-- rôle bootstrap ("The bootstrap user must have the SUPERUSER
-- attribute") — il n'y a donc pas de correctif possible sans recréer le
-- cluster avec un autre bootstrap user. C'est ce qui a été fait :
-- nouveau cluster Postgres où POSTGRES_USER=postgres (jamais utilisé par
-- l'application), abmcy_app recréé comme rôle applicatif normal.
--
-- Cette migration documente l'état attendu pour un déploiement FRAIS.
-- Sur le déploiement existant, l'opération a été faite manuellement
-- (nouveau cluster + pg_restore + recréation des rôles) car elle
-- implique une bascule de cluster, pas une simple requête SQL — voir le
-- commit qui introduit ce fichier pour le détail des commandes.

-- ------------------------------------------------------------
-- 1. Rôle applicatif (utilisé par internal/db.Pool.WithTenant, via
--    DATABASE_URL) : LOGIN seulement, aucun bypass RLS, pas propriétaire
--    des tables au sens où ça compterait (voir point 3).
-- ------------------------------------------------------------
-- CREATE ROLE abmcy_app LOGIN PASSWORD '...';

-- ------------------------------------------------------------
-- 2. Rôle système (utilisé par internal/db.Pool.WithSystem, via
--    SYSTEM_DATABASE_URL) : BYPASSRLS, PAS superuser — un compromis
--    applicatif ne doit jamais pouvoir aller plus loin que "voit toutes
--    les lignes", jamais "peut tout faire sur la base".
-- ------------------------------------------------------------
-- CREATE ROLE abmcy_system LOGIN PASSWORD '...' BYPASSRLS;
-- GRANT CONNECT ON DATABASE abmcy TO abmcy_system;
-- GRANT USAGE ON SCHEMA public TO abmcy_system;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO abmcy_system;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO abmcy_system;

-- ------------------------------------------------------------
-- 3. FORCE ROW LEVEL SECURITY sur toutes les tables tenant-scopées —
--    sans ça, même un rôle non-superuser mais PROPRIÉTAIRE de la table
--    reste exempté de RLS par défaut. abmcy_app reste propriétaire
--    (nécessaire pour que les migrations appliquées en son nom
--    fonctionnent), donc FORCE est indispensable, pas optionnel.
-- ------------------------------------------------------------
ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_password_resets FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE fabrics FORCE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE measurements FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE product_files FORCE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_socials FORCE ROW LEVEL SECURITY;

-- request_logs et tenant_features n'ont délibérément pas de RLS : ce sont
-- des tables système consultées uniquement via WithSystem (traçage
-- global, préréglages de features), jamais via WithTenant.
