import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  lazy?: boolean;
  aspectRatio?: string;
  containerClassName?: string;
}

/**
 * Optimized image component with lazy loading and error handling.
 * - Uses native lazy loading via `loading="lazy"`
 * - Shows a placeholder while loading
 * - Falls back gracefully on error
 */
export function OptimizedImage({
  src,
  alt,
  fallback,
  lazy = true,
  aspectRatio,
  containerClassName,
  className,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If image is already cached, mark as loaded immediately
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    setLoaded(true);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Placeholder shimmer */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {error && fallback ? (
        <img
          src={fallback}
          alt={alt}
          className={cn('w-full h-full object-cover', className)}
          {...props}
        />
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      )}
    </div>
  );
}

/**
 * Optimized video component with lazy loading.
 */
interface OptimizedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  lazy?: boolean;
  containerClassName?: string;
}

export function OptimizedVideo({
  src,
  lazy = true,
  containerClassName,
  className,
  ...props
}: OptimizedVideoProps) {
  const [inView, setInView] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [lazy]);

  return (
    <div ref={containerRef} className={cn('relative', containerClassName)}>
      {inView ? (
        <video
          src={src}
          preload="metadata"
          className={cn('w-full', className)}
          {...props}
        />
      ) : (
        <div className="w-full aspect-video bg-muted animate-pulse rounded" />
      )}
    </div>
  );
}
