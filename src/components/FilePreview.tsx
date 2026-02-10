import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Download, ExternalLink, FileText, Image, Video, File, Music, Loader2 } from 'lucide-react';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
}

export function FilePreview({ isOpen, onClose, fileName, fileUrl, fileType }: FilePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const { signedUrl, isLoading, error: urlError } = useSignedUrl(isOpen ? fileUrl : null);
  
  // Use signed URL if available, fallback to original
  const previewUrl = signedUrl || fileUrl;

  // Reset error when URL changes
  useEffect(() => {
    setImageError(false);
  }, [fileUrl]);

  const getFileCategory = () => {
    if (!fileType) return 'other';
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    if (fileType === 'application/pdf') return 'pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'document';
    if (fileType.includes('sheet') || fileType.includes('excel')) return 'spreadsheet';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return 'presentation';
    return 'other';
  };

  const category = getFileCategory();

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  const renderPreview = () => {
    // Show loading state
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      );
    }

    // Show error state
    if (urlError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <File className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">{fileName}</p>
          <p className="text-sm mb-6">{urlError}</p>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Try Download
          </Button>
        </div>
      );
    }
    switch (category) {
      case 'image':
        if (imageError) {
          return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Image className="h-16 w-16 mb-4" />
              <p>Unable to load image preview</p>
              <Button variant="outline" onClick={handleOpenInNewTab} className="mt-4">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4">
            <img
              src={previewUrl}
              alt={fileName}
              className="max-w-full max-h-[60vh] object-contain rounded"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </div>
        );

      case 'video':
        return (
          <div className="bg-muted/30 rounded-lg overflow-hidden">
            <video
              src={previewUrl}
              controls
              className="w-full max-h-[60vh]"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg">
            <Music className="h-20 w-20 text-muted-foreground mb-6" />
            <p className="text-lg font-medium text-foreground mb-4">{fileName}</p>
            <audio
              src={previewUrl}
              controls
              className="w-full max-w-md"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        );

      case 'pdf':
        return (
          <div className="bg-muted/30 rounded-lg overflow-hidden">
            <iframe
              src={`${previewUrl}#toolbar=0`}
              className="w-full h-[60vh] border-0"
              title={fileName}
            />
          </div>
        );

      default:
        // For documents, spreadsheets, and other files, show a download prompt
        return (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <File className="h-20 w-20 mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">{fileName}</p>
            <p className="text-sm mb-6">Preview not available for this file type</p>
            <div className="flex gap-3">
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={handleOpenInNewTab}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {category === 'image' && <Image className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
            {category === 'video' && <Video className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
            {category === 'audio' && <Music className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
            {category === 'pdf' && <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
            {!['image', 'video', 'audio', 'pdf'].includes(category) && <File className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
            <DialogTitle className="truncate">{fileName}</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleOpenInNewTab} title="Open in new tab">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-4">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
