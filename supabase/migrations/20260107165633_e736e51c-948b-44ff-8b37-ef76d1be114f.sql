-- Add storage policies for authenticated users to access project files
-- These policies allow authenticated users to read files they have access to

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can read project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project files" ON storage.objects;

-- Policy: Authenticated users can read files in project-files bucket
-- This allows any authenticated user to read project files
CREATE POLICY "Authenticated users can read project files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

-- Policy: Authenticated users can upload files to project-files bucket
-- Files are organized by user_id/project_id/filename
CREATE POLICY "Users can upload project files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own project files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own project files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);