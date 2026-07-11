ALTER TABLE "menu_items"
ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_stock_quantity_nonnegative"
CHECK ("stock_quantity" >= 0);
