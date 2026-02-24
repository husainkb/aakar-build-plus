-- Add photo_urls column to grievance_tickets
ALTER TABLE public.grievance_tickets
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Create the storage bucket for grievance photos (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grievance-photos',
  'grievance-photos',
  true,
  5242880, -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
DROP POLICY IF EXISTS "Authenticated users can upload grievance photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload grievance photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'grievance-photos');

-- Allow public read access (bucket is public)
DROP POLICY IF EXISTS "Public read access for grievance photos" ON storage.objects;
CREATE POLICY "Public read access for grievance photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'grievance-photos');

-- Allow authenticated users to delete their own uploads
DROP POLICY IF EXISTS "Authenticated users can delete grievance photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete grievance photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'grievance-photos');
