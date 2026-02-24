-- Update grievance-photos bucket to allow all common image MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/bmp',
  'image/svg+xml'
]
WHERE id = 'grievance-photos';
