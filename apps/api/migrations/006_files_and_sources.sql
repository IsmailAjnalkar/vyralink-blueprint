-- Uploaded files (product images, verification documents). Bytes live in the storage provider; this is the index.
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users,
  purpose text NOT NULL CHECK (purpose IN ('product_image', 'verification_document')),
  content_type text NOT NULL,
  size_bytes int NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_file_id uuid REFERENCES files;

-- Where each order row came from: the CSV report, the TikTok Shop API, or sandbox demo data.
ALTER TABLE session_orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'csv' CHECK (source IN ('csv', 'tiktok_shop', 'sandbox'));
