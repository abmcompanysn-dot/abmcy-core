-- Ajoute updated_at à fabrics et gallery_photos, sur le même modèle que
-- products/orders — nécessaire pour PATCH /fabrics/{id} et
-- PATCH /gallery/{id} (édition ajoutée au dashboard tenant, voir
-- internal/catalog/fabrics.go Update() et internal/catalog/gallery.go
-- Update()). Les deux tables n'avaient jusqu'ici que created_at.

ALTER TABLE fabrics ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE gallery_photos ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
