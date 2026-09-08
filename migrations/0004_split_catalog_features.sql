-- ============================================================
-- DÉCOUPLAGE DU CATALOGUE EN SERVICES INDÉPENDANTS
-- ============================================================
-- catalog_enabled activait d'un bloc produits/tissus/panier/galerie/avis —
-- un tenant qui ne fait que de la couture sur-mesure n'a par exemple pas
-- besoin d'un panier e-commerce classique, mais voulait quand même une
-- galerie de réalisations. Remplacé par 5 interrupteurs indépendants,
-- activables séparément par tenant depuis le dashboard admin.

ALTER TABLE tenant_features
    ADD COLUMN products_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN fabrics_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN cart_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN gallery_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN reviews_enabled  BOOLEAN NOT NULL DEFAULT FALSE;

-- Un tenant qui avait catalog_enabled=true garde tout activé — pas de
-- régression pour un compte déjà en prod (ex: HANI'S).
UPDATE tenant_features
SET products_enabled = TRUE,
    fabrics_enabled  = TRUE,
    cart_enabled     = TRUE,
    gallery_enabled  = TRUE,
    reviews_enabled  = TRUE
WHERE catalog_enabled = TRUE;

ALTER TABLE tenant_features DROP COLUMN catalog_enabled;
