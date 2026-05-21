-- Add recommended_quantity to signal table
ALTER TABLE "signal" ADD COLUMN "recommended_quantity" INTEGER NOT NULL DEFAULT 1;
