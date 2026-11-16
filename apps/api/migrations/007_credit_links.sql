-- A credit note names the invoice it credits, so the total credited can be capped at the invoice amount.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credits_invoice_id uuid REFERENCES invoices;
