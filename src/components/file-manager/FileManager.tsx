import { useState, useEffect, useCallback, useRef } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Download,
  Trash2,
  Upload,
  X,
  File,
  Video,
  Image,
  Music,
  FileText,
  Loader2,
  CheckCircle,
  Search,
  SortAsc,
  SortDesc,
  Eye,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { FileCommentsPanel } from './FileCommentsPanel';

interface FileItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size?: number | null;
  is_video?: boolean;
  created_at: string;
  uploaded_by: string;
}

interface FileManagerProps {
  projectId: string;
  type: 'resources' | 'deliverables';
  onRefresh?: () => void;
}

export function FileManager({ projectId, type, onRefresh }: FileManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentTimecode, setCurrentTimecode] = useState<string | null>(null);

  const tableName = type === 'resources' ? 'project_attachments' : 'project_outputs';

  const fetchFiles = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error('Error fetching files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, tableName, sortOrder, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const channel = supabase
      .channel(`${tableName}-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, tableName, fetchFiles]);

  const handleDelete = async (file: FileItem) => {
    setDeleting(file.id);
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', file.id);
      if (error) throw error;

      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }
      toast({ title: 'File deleted' });
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete file.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const path = extractPathFromUrl(file.file_url);
      if (!path) {
        window.open(file.file_url, '_blank');
        return;
      }

      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(path, 60);

      if (error) {
        console.error('Error creating signed URL:', error);
        window.open(file.file_url, '_blank');
        return;
      }

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download file. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const extractPathFromUrl = (url: string): string | null => {
    try {
      if (!url.startsWith('http')) return url;
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/);
      if (match) return decodeURIComponent(match[1]);
      return null;
    } catch {
      return null;
    }
  };

  const getFileIcon = (file: FileItem) => {
    const fileType = file.file_type || '';
    if (file.is_video || fileType.startsWith('video/')) return Video;
    if (fileType.startsWith('image/')) return Image;
    if (fileType.startsWith('audio/')) return Music;
    if (fileType === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredFiles = files.filter((file) =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isMediaFile = (file: FileItem) => {
    const ft = file.file_type || '';
    return file.is_video || ft.startsWith('video/') || ft.startsWith('audio/');
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-[500px] rounded-lg border">
      {/* File List Panel */}
      <ResizablePanel defaultSize={35} minSize={25}>
        <div className="flex flex-col h-full">
          <div className="p-2 border-b">
            <FileUpload
              projectId={projectId}
              type={type === 'resources' ? 'attachment' : 'output'}
              onUploadComplete={() => fetchFiles()}
              compact
              buttonOnly
            />
          </div>

          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No matching files' : `No ${type} uploaded yet`}
                  </p>
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const Icon = getFileIcon(file);
                  const isSelected = selectedFile?.id === file.id;
                  return (
                    <div
                      key={file.id}
                      className={cn(
                        'p-3 rounded-md cursor-pointer transition-colors group',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.file_name}</p>
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className={isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                              {formatFileSize(file.file_size)}
                            </span>
                            <span className={isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}>•</span>
                            <span className={isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                              {new Date(file.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file);
                            }}
                            disabled={deleting === file.id}
                          >
                            {deleting === file.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t text-xs text-muted-foreground">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Preview Panel */}
      <ResizablePanel defaultSize={45}>
        {selectedFile ? (
          <FilePreviewPanel 
            file={selectedFile} 
            onDownload={() => handleDownload(selectedFile)}
            projectId={projectId}
            onTimecodeUpdate={(tc) => setCurrentTimecode(tc)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Eye className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No file selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a file from the list to preview
            </p>
          </div>
        )}
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Comments Panel */}
      <ResizablePanel defaultSize={20} minSize={15}>
        {selectedFile ? (
          <FileCommentsPanel
            projectId={projectId}
            outputId={selectedFile.id}
            currentTimecode={currentTimecode}
            onTimecodeClick={(tc) => {
              const event = new CustomEvent('seek-to-timecode', { detail: { timecode: tc } });
              window.dispatchEvent(event);
            }}
            hasMediaPlayer={isMediaFile(selectedFile)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-background border-l">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium mb-1">No file selected</h3>
            <p className="text-xs text-muted-foreground">
              Select a file to view comments
            </p>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

// Preview Panel Component - Capture Time buttons REMOVED from video/audio player
function FilePreviewPanel({ file, onDownload, projectId, onTimecodeUpdate }: { file: FileItem; onDownload: () => void; projectId: string; onTimecodeUpdate?: (tc: string) => void }) {
  const { signedUrl, isLoading, error } = useSignedUrl(file.file_url);
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const fileType = file.file_type || '';
  const isImage = fileType.startsWith('image/');
  const isVideo = file.is_video || fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');
  const isPdf = fileType === 'application/pdf';

  const previewUrl = signedUrl || file.file_url;

  const formatTimecode = (time: number): string => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = (time: number) => {
    const tc = formatTimecode(time);
    onTimecodeUpdate?.(tc);
  };

  // Listen for seek-to-timecode events
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.timecode) {
        const parts = detail.timecode.split(':').map(Number);
        let seconds = 0;
        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
        
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          videoRef.current.play();
        } else if (audioRef.current) {
          audioRef.current.currentTime = seconds;
          audioRef.current.play();
        }
      }
    };
    window.addEventListener('seek-to-timecode', handleSeek);
    return () => window.removeEventListener('seek-to-timecode', handleSeek);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <File className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">{file.file_name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download File
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium truncate">{file.file_name}</h3>
          <p className="text-xs text-muted-foreground">
            {new Date(file.created_at).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-4 bg-muted/30">
        <div className="h-full flex items-center justify-center">
          <div className="w-full max-w-[720px] mx-auto flex items-center justify-center">
            {isImage && !imageError ? (
              <img
                src={previewUrl}
                alt={file.file_name}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : isVideo ? (
              <div className="w-full">
                <video
                  ref={videoRef}
                  src={previewUrl}
                  controls
                  className="w-full h-auto max-h-[50vh] object-contain rounded-lg shadow-lg"
                  preload="metadata"
                  onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
                >
                  Your browser does not support the video element.
                </video>
              </div>
            ) : isAudio ? (
              <div className="w-full max-w-md text-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Music className="h-12 w-12 text-primary" />
                </div>
                <p className="font-medium mb-4">{file.file_name}</p>
                <audio 
                  ref={audioRef}
                  src={previewUrl} 
                  controls 
                  className="w-full"
                  onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            ) : isPdf ? (
              <iframe
                src={previewUrl}
                className="w-full h-[60vh] rounded-lg border shadow-lg"
                title={file.file_name}
              />
            ) : imageError ? (
              <div className="text-center">
                <File className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="font-medium mb-2">{file.file_name}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Preview not available
                </p>
                <Button onClick={onDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download to View
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <File className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="font-medium mb-2">{file.file_name}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                <Button onClick={onDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
