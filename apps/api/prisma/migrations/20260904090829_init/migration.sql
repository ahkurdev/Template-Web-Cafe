-- CreateTable
CREATE TABLE `outlets` (
    `id` VARCHAR(21) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(30) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `role` ENUM('admin', 'kasir', 'dapur') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_outletId_role_idx`(`outletId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `categories_outletId_isActive_sortOrder_idx`(`outletId`, `isActive`, `sortOrder`),
    UNIQUE INDEX `categories_outletId_slug_key`(`outletId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `categoryId` VARCHAR(21) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `imageUrl` VARCHAR(255) NULL,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `menu_items_categoryId_isActive_sortOrder_idx`(`categoryId`, `isActive`, `sortOrder`),
    INDEX `menu_items_outletId_isAvailable_idx`(`outletId`, `isAvailable`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cafe_tables` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `capacity` INTEGER NULL,
    `location` VARCHAR(80) NULL,
    `qrToken` VARCHAR(32) NOT NULL,
    `status` ENUM('tersedia', 'terisi', 'nonaktif') NOT NULL DEFAULT 'tersedia',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cafe_tables_qrToken_key`(`qrToken`),
    UNIQUE INDEX `cafe_tables_outletId_number_key`(`outletId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `orderCode` VARCHAR(20) NOT NULL,
    `tableId` VARCHAR(21) NULL,
    `type` ENUM('dine_in', 'takeaway') NOT NULL DEFAULT 'dine_in',
    `status` ENUM('baru', 'dikonfirmasi', 'diproses', 'selesai', 'diambil', 'dibatalkan') NOT NULL DEFAULT 'baru',
    `customerName` VARCHAR(80) NULL,
    `note` TEXT NULL,
    `subtotal` INTEGER NOT NULL,
    `taxAmount` INTEGER NOT NULL DEFAULT 0,
    `serviceAmount` INTEGER NOT NULL DEFAULT 0,
    `discountAmount` INTEGER NOT NULL DEFAULT 0,
    `total` INTEGER NOT NULL,
    `paymentStatus` ENUM('belum_bayar', 'lunas', 'dibatalkan') NOT NULL DEFAULT 'belum_bayar',
    `paymentMethod` ENUM('cash', 'transfer', 'qris_manual') NULL,
    `paidAmount` INTEGER NULL,
    `changeAmount` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `createdById` VARCHAR(21) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderCode_key`(`orderCode`),
    INDEX `orders_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `orders_paidAt_idx`(`paidAt`),
    INDEX `orders_paymentStatus_createdAt_idx`(`paymentStatus`, `createdAt`),
    INDEX `orders_tableId_createdAt_idx`(`tableId`, `createdAt`),
    INDEX `orders_outletId_createdAt_idx`(`outletId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(21) NOT NULL,
    `orderId` VARCHAR(21) NOT NULL,
    `menuItemId` VARCHAR(21) NULL,
    `nameSnapshot` VARCHAR(150) NOT NULL,
    `priceSnapshot` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `note` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_menuItemId_idx`(`menuItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_events` (
    `id` VARCHAR(21) NOT NULL,
    `orderId` VARCHAR(21) NOT NULL,
    `status` ENUM('baru', 'dikonfirmasi', 'diproses', 'selesai', 'diambil', 'dibatalkan') NOT NULL,
    `note` VARCHAR(200) NULL,
    `actorId` VARCHAR(21) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_events_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(21) NOT NULL,
    `outletId` VARCHAR(21) NOT NULL,
    `taxPercent` INTEGER NOT NULL DEFAULT 0,
    `servicePercent` INTEGER NOT NULL DEFAULT 0,
    `receiptFooter` TEXT NULL,
    `currencySymbol` VARCHAR(5) NOT NULL DEFAULT 'Rp',
    `autoConfirmOrder` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_outletId_key`(`outletId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cafe_tables` ADD CONSTRAINT `cafe_tables_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `cafe_tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
