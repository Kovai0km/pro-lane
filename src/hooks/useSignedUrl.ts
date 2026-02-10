import { useState, useEffect, useCallback } from 'react';
import { getSignedUrl, checkUrlAccess } from '@/lib/storage';

interface UseSignedUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: string | null;
  urlInfo: {
    supportsRange?: boolean;
    contentType?: string;
  } | null;
  refresh: () => void;
}

/**
 * Hook to get a signed URL for a private storage file
 * Automatically refreshes the URL if it expires
 */
export function useSignedUrl(originalUrl: string | null): UseSignedUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<{
    supportsRange?: boolean;
    contentType?: string;
  } | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!originalUrl) {
      setSignedUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get a signed URL
      const result = await getSignedUrl(originalUrl);
      
      if (result.error) {
        // If signed URL fails, try the original URL (might be public)
        const accessCheck = await checkUrlAccess(originalUrl);
        
        if (accessCheck.accessible) {
          setSignedUrl(originalUrl);
          setUrlInfo({
            supportsRange: accessCheck.supportsRange,
            contentType: accessCheck.contentType,
          });
          setError(null);
        } else {
          setError(getErrorMessage(accessCheck.status, accessCheck.error));
          setSignedUrl(null);
        }
      } else if (result.url) {
        // Verify the signed URL works
        const accessCheck = await checkUrlAccess(result.url);
        
        if (accessCheck.accessible) {
          setSignedUrl(result.url);
          setUrlInfo({
            supportsRange: accessCheck.supportsRange,
            contentType: accessCheck.contentType,
          });
          setError(null);
        } else {
          setError(getErrorMessage(accessCheck.status, accessCheck.error));
          setSignedUrl(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load file');
      setSignedUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [originalUrl]);

  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // Set up automatic refresh before expiry (refresh at 45 minutes)
  useEffect(() => {
    if (!signedUrl) return;
    
    const refreshTimer = setTimeout(() => {
      fetchSignedUrl();
    }, 45 * 60 * 1000); // 45 minutes

    return () => clearTimeout(refreshTimer);
  }, [signedUrl, fetchSignedUrl]);

  return {
    signedUrl,
    isLoading,
    error,
    urlInfo,
    refresh: fetchSignedUrl,
  };
}

function getErrorMessage(status?: number, fallbackError?: string): string {
  switch (status) {
    case 403:
      return 'Permission denied - you may not have access to this file';
    case 404:
      return 'File not found - the file may have been deleted';
    case 0:
      return 'CORS blocked - the server is not allowing access from this origin';
    default:
      return fallbackError || `Failed to access file (status: ${status || 'unknown'})`;
  }
}
