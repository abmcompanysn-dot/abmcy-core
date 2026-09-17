-- ============================================================
-- LIEN DU SITE PUBLIC DU TENANT (storefront_url)
-- ============================================================
-- Un tenant peut avoir son propre site public (ex: le storefront de
-- Nathan, ou HANNIFA pour HANI'S) hébergé en dehors d'ABMCY (Vercel,
-- domaine propre...). Ce champ stocke simplement l'URL à afficher/
-- partager (QR code, lien "voir ma boutique" dans le dashboard) —
-- ABMCY n'héberge pas forcément ce site, il se contente de le référencer.
-- NULL tant qu'un tenant n'en a pas renseigné un.

ALTER TABLE tenants
    ADD COLUMN storefront_url TEXT;
