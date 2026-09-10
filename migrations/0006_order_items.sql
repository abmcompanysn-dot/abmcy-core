-- ============================================================
-- ORDER ITEMS (lignes de commande rattachées à des produits catalogue)
-- ============================================================
-- Jusqu'ici une commande était un blob {nom, téléphone, montant, notes} :
-- `total_amount` arrivait tel quel du client, sans lien avec les produits
-- ni recalcul serveur. Impossible de savoir quels produits une commande
-- concerne (donc, pour une boutique numérique, quels fichiers livrer),
-- et un acheteur pouvait payer le prix qu'il voulait.
--
-- Cette table lie une commande à un ou plusieurs produits. Le handler
-- POST /orders, quand il reçoit `items`, recalcule `orders.total_amount`
-- depuis `products.price` — le montant envoyé par le client est ignoré.
-- Les commandes sur-mesure (couture) qui ne référencent aucun produit
-- catalogue continuent de fonctionner sans ligne ici : `items` est
-- optionnel côté API, obligatoire seulement dès qu'un produit est en jeu.
--
-- `product_name` et `unit_price` sont des SNAPSHOTS au moment de la
-- commande : si le produit change de prix ou de nom plus tard, la
-- commande passée garde ses valeurs d'origine. La FK vers products est
-- ON DELETE RESTRICT : on refuse de supprimer un produit qui a des
-- commandes (à désactiver via is_active = false à la place).

CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(150) NOT NULL,   -- snapshot du nom au moment de la commande
    unit_price   INT NOT NULL,            -- snapshot du prix unitaire (FCFA)
    quantity     INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_order_items ON order_items
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
