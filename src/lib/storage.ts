import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'project-files';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

export interface SignedUrlResult {
  url: string | null;
  error: string | null;
}

/**
 * Get a signed URL for a file in private storage
 * This allows authenticated users to access private files
 */
export async function getSignedUrl(filePath: string): Promise<SignedUrlResult> {
  try {
    // Extract the path from a full URL if needed
    const path = extractPathFromUrl(filePath);
    
    if (!path) {
      return { url: null, error: 'Invalid file path' };
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (err: any) {
    console.error('Error in getSignedUrl:', err);
    return { url: null, error: err.message || 'Failed to get signed URL' };
  }
}

/**
 * Extract the storage path from a Supabase storage URL
 */
function extractPathFromUrl(url: string): string | null {
  try {
    // If it's already a path (not a URL), return as-is
    if (!url.startsWith('http')) {
      return url;
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Pattern: /storage/v1/object/public/bucket-name/path
    // or: /storage/v1/object/sign/bucket-name/path
    const publicMatch = pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (publicMatch) {
      return decodeURIComponent(publicMatch[1]);
    }

    // Pattern for render/image URLs
    const renderMatch = pathname.match(/\/storage\/v1\/render\/image\/(?:public|sign)\/[^/]+\/(.+)/);
    if (renderMatch) {
      return decodeURIComponent(renderMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the correct MIME type for a file based on extension
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'm4v': 'video/x-m4v',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Check if a URL is accessible (returns status and headers)
 */
export async function checkUrlAccess(url: string): Promise<{
  accessible: boolean;
  status?: number;
  statusText?: string;
  supportsRange?: boolean;
  contentType?: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    return {
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      supportsRange: response.headers.get('accept-ranges') === 'bytes',
      contentType: response.headers.get('content-type') || undefined,
    };
  } catch (err: any) {
    return {
      accessible: false,
      error: err.message || 'Network error',
    };
  }
}
