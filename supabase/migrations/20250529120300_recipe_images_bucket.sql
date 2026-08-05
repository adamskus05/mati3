-- Public recipe image uploads for photo import (path: {user_id}/...)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "recipe_images_select_public" ON storage.objects;
CREATE POLICY "recipe_images_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recipe-images');

DROP POLICY IF EXISTS "recipe_images_insert_own" ON storage.objects;
CREATE POLICY "recipe_images_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "recipe_images_update_own" ON storage.objects;
CREATE POLICY "recipe_images_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "recipe_images_delete_own" ON storage.objects;
CREATE POLICY "recipe_images_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
