-- Migración 003: Añadir campos de facturación a tabla owners
-- Fecha: 2026-02-04
-- Descripción: Se agregan invoiceSeries y lastInvoiceNumber para control de numeración de facturas

ALTER TABLE owners 
  ADD COLUMN invoiceSeries VARCHAR(20) DEFAULT 'INV' AFTER name,
  ADD COLUMN lastInvoiceNumber INT DEFAULT 0 AFTER invoiceSeries,
  ADD INDEX idx_invoice_series (invoiceSeries);
