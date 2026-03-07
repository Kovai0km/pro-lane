import { useState, useCallback } from 'react';
import { Upload, X, File, Video, Image, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  projectId: string;
  type: 'attachment' | 'output';
  onUploadComplete?: (file: UploadedFile) => void;
  compact?: boolean;
  buttonOnly?: boolean;
}

interface UploadedFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_video?: boolean;
}

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export function FileUpload({ projectId, type, onUploadComplete, compact = false }: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const filesWithProgress: FileWithProgress[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...filesWithProgress]);
    filesWithProgress.forEach((f) => uploadFile(f));
  };

  const uploadFile = async (fileWithProgress: FileWithProgress) => {
    if (!user) return;

    const { file } = fileWithProgress;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
    const isVideo = file.type.startsWith('video/');

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.file === file ? { ...f, status: 'uploading' as const } : f
      )
    );

    try {
      // Simulate progress (Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file && f.progress < 90
              ? { ...f, progress: f.progress + 10 }
              : f
          )
        );
      }, 200);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
        });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      // Get a signed URL for the uploaded file (works with private buckets)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('project-files')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      // Also get the public URL as a reference (for storage path extraction)
      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      // Use signed URL if available, fall back to public URL
      const fileUrl = signedUrlData?.signedUrl || urlData.publicUrl;

      // Insert into appropriate table
      const table = type === 'attachment' ? 'project_attachments' : 'project_outputs';
      const insertData = {
        project_id: projectId,
        file_name: file.name,
        file_url: urlData.publicUrl, // Store the public URL format (will be converted to signed URL when needed)
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
        ...(type === 'output' && { is_video: isVideo }),
      };

      const { data: dbData, error: dbError } = await supabase
        .from(table)
        .insert(insertData)
        .select()
        .single();

      if (dbError) throw dbError;

      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 100, status: 'complete' as const } : f
        )
      );

      if (onUploadComplete) {
        onUploadComplete(dbData);
      }

      toast({
        title: 'File uploaded',
        description: `${file.name} uploaded successfully.`,
      });
    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, status: 'error' as const, error: error.message }
            : f
        )
      );

      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) return Video;
    if (file.type.startsWith('image/')) return Image;
    return File;
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed text-center transition-colors ${
          compact ? 'p-4' : 'p-8'
        } ${
          isDragging
            ? 'border-foreground bg-secondary'
            : 'border-foreground/50 hover:border-foreground'
        }`}
      >
        <Upload className={`${compact ? 'h-5 w-5 mb-2' : 'h-8 w-8 mb-4'} mx-auto text-muted-foreground`} />
        <p className={`text-muted-foreground ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>
          {compact ? 'Drop files or' : 'Drag and drop files here, or'}
        </p>
        <label>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" size="sm" asChild>
            <span className="cursor-pointer">{compact ? 'Browse' : 'Browse Files'}</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, index) => {
            const Icon = getFileIcon(f.file);
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 border-2 border-foreground/20"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{f.file.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {(f.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {f.status === 'uploading' && (
                    <Progress value={f.progress} className="h-1 mt-2" />
                  )}
                  {f.status === 'error' && (
                    <p className="text-xs text-destructive mt-1">{f.error}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {f.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {f.status === 'complete' && (
                    <CheckCircle className="h-4 w-4 text-foreground" />
                  )}
                  {(f.status === 'pending' || f.status === 'error') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(f.file)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
