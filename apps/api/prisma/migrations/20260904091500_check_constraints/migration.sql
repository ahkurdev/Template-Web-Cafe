-- CHECK constraint tidak ada di schema.prisma, jadi ditulis manual di sini.
-- Ini pengaman terakhir: kalau ada bug di kode yang lolos validasi Zod,
-- DB yang menolak. Harga negatif atau qty nol tidak boleh pernah tersimpan.

ALTER TABLE `menu_items`  ADD CONSTRAINT `chk_menu_price`      CHECK (`price` >= 0);

ALTER TABLE `order_items` ADD CONSTRAINT `chk_item_qty`        CHECK (`qty` > 0);
ALTER TABLE `order_items` ADD CONSTRAINT `chk_item_price`      CHECK (`priceSnapshot` >= 0);
ALTER TABLE `order_items` ADD CONSTRAINT `chk_item_subtotal`   CHECK (`subtotal` >= 0);

ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_subtotal`  CHECK (`subtotal` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_tax`       CHECK (`taxAmount` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_service`   CHECK (`serviceAmount` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_discount`  CHECK (`discountAmount` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_total`     CHECK (`total` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_order_paid`      CHECK (`paidAmount` IS NULL OR `paidAmount` >= 0);

ALTER TABLE `settings`    ADD CONSTRAINT `chk_tax_percent`     CHECK (`taxPercent` BETWEEN 0 AND 100);
ALTER TABLE `settings`    ADD CONSTRAINT `chk_service_percent` CHECK (`servicePercent` BETWEEN 0 AND 100);
