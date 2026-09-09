-- ============================================================
-- GESTION D'ÉQUIPE COMME SIXIÈME SERVICE OPTIONNEL
-- ============================================================
-- GET/POST /staff et PUT /staff/{id}/active étaient accessibles dès
-- qu'un compte JWT staff existait pour le tenant, sans interrupteur
-- dédié — contrairement aux cinq services catalogue déjà opt-in
-- (products/fabrics/cart/gallery/reviews). Aligné sur le même modèle :
-- désactivé par défaut, activé par ABMCY tenant par tenant.

ALTER TABLE tenant_features
    ADD COLUMN staff_enabled BOOLEAN NOT NULL DEFAULT FALSE;
