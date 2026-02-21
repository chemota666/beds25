-- Migration: Add fields for contract generation
-- Owner: iban, email
-- Property: sqm

ALTER TABLE `owners` ADD COLUMN `email` VARCHAR(255) NULL AFTER `phone`;
ALTER TABLE `owners` ADD COLUMN `iban` VARCHAR(34) NULL AFTER `email`;
ALTER TABLE `properties` ADD COLUMN `sqm` INT NULL AFTER `numRooms`;
