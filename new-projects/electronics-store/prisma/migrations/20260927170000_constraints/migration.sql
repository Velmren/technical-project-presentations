ALTER TABLE "Variant" ADD CONSTRAINT "variant_nonnegative_stock" CHECK ("stock" >= 0), ADD CONSTRAINT "variant_positive_price" CHECK ("price" > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "cart_quantity_range" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_positive_quantity" CHECK ("quantity" > 0), ADD CONSTRAINT "order_item_positive_price" CHECK ("price" > 0);
ALTER TABLE "User" ADD CONSTRAINT "user_nonnegative_bonuses" CHECK ("bonuses" >= 0), ADD CONSTRAINT "user_valid_role" CHECK ("role" IN ('CUSTOMER', 'STAFF', 'ADMIN'));
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Promo" ADD CONSTRAINT "promo_valid_discount" CHECK ("value" > 0 AND "maxDiscount" >= 0 AND "minSubtotal" >= 0 AND "type" IN ('PERCENT','FIXED') AND ("type" <> 'PERCENT' OR "value" <= 100));
ALTER TABLE "Order" ADD CONSTRAINT "order_valid_total" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "shipping" >= 0 AND "total" = "subtotal" - "discount" + "shipping" AND "total" >= 0);
