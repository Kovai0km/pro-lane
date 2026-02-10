import { forwardRef, useState, useRef, useImperativeHandle, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, AlertCircle, RefreshCw, Loader2, Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { getMimeType } from '@/lib/storage';
import { VideoDrawingOverlay } from './VideoDrawingOverlay';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CommentMarker {
  id: string;
  timecode: string;
  content: string;
  userName?: string;
}

interface VideoPlayerProps {
  src: string;
  type?: string;
  poster?: string;
  commentMarkers?: CommentMarker[];
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onLoadedMetadata?: () => void;
  onError?: (error: string) => void;
  onDrawingSave?: (dataUrl: string) => void;
}

export interface VideoPlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoError {
  type: 'permission' | 'not_found' | 'cors' | 'format' | 'network' | 'unknown';
  message: string;
  details?: string;
}

const parseTimecode = (timecode: string): number => {
  const parts = timecode.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, type = 'video/mp4', poster, commentMarkers = [], onTimeUpdate, onPlay, onPause, onEnded, onLoadedMetadata, onError, onDrawingSave }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [videoError, setVideoError] = useState<VideoError | null>(null);
    const [isDrawingMode, setIsDrawingMode] = useState(false);

    // Get signed URL for private storage
    const { signedUrl, isLoading: urlLoading, error: urlError, urlInfo, refresh: refreshUrl } = useSignedUrl(src);

    // Determine the actual MIME type
    const actualMimeType = urlInfo?.contentType || type || getMimeType(src);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    // Handle URL loading error
    useEffect(() => {
      if (urlError) {
        const errorType = urlError.includes('Permission') ? 'permission' 
          : urlError.includes('not found') ? 'not_found'
          : urlError.includes('CORS') ? 'cors'
          : 'network';
        
        setVideoError({
          type: errorType,
          message: urlError,
        });
        setIsLoading(false);
        onError?.(urlError);
      } else if (signedUrl) {
        setVideoError(null);
      }
    }, [urlError, signedUrl, onError]);

    const formatTime = (time: number) => {
      if (!isFinite(time)) return '00:00';
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    };

    const handleVideoClick = () => {
      if (!videoError && !isDrawingMode) {
        handlePlayPause();
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        onTimeUpdate?.(videoRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
        setIsLoading(false);
        setVideoError(null);
        onLoadedMetadata?.();
      }
    };

    const handleSeek = (value: number[]) => {
      if (videoRef.current && isFinite(value[0])) {
        videoRef.current.currentTime = value[0];
        setCurrentTime(value[0]);
      }
    };

    const handleVolumeChange = (value: number[]) => {
      if (videoRef.current) {
        const newVolume = value[0];
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        if (isMuted) {
          videoRef.current.volume = volume || 1;
          setIsMuted(false);
        } else {
          videoRef.current.volume = 0;
          setIsMuted(true);
        }
      }
    };

    const handleFullscreen = () => {
      if (containerRef.current) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          containerRef.current.requestFullscreen();
        }
      }
    };

    const skipBack = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      }
    };

    const skipForward = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      const video = e.currentTarget;
      const error = video.error;
      
      let errorInfo: VideoError = {
        type: 'unknown',
        message: 'An error occurred while loading the video',
      };

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorInfo = {
              type: 'network',
              message: 'Video loading was aborted',
              details: 'The video download was cancelled.',
            };
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorInfo = {
              type: 'network',
              message: 'Network error while loading video',
              details: 'Check your internet connection and try again.',
            };
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorInfo = {
              type: 'format',
              message: 'Video format not supported',
              details: `The video format "${actualMimeType}" could not be decoded. Try converting to MP4 (H.264).`,
            };
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorInfo = {
              type: 'format',
              message: 'Video source not supported',
              details: 'The video format is not supported by your browser.',
            };
            break;
        }
      }

      setVideoError(errorInfo);
      setIsLoading(false);
      onError?.(errorInfo.message);
    };

    const handleRetry = () => {
      setVideoError(null);
      setIsLoading(true);
      refreshUrl();
    };

    const handleDrawingToggle = () => {
      if (isPlaying && videoRef.current) {
        videoRef.current.pause();
      }
      setIsDrawingMode(true);
    };

    const handleDrawingSave = (dataUrl: string) => {
      setIsDrawingMode(false);
      onDrawingSave?.(dataUrl);
    };



    // Calculate marker positions
    const markerPositions = commentMarkers.map((marker) => ({
      ...marker,
      position: duration > 0 ? (parseTimecode(marker.timecode) / duration) * 100 : 0,
    }));

    // Render error state
    if (videoError || urlError) {
      const error = videoError || { type: 'unknown' as const, message: urlError || 'Unknown error' };
      
      return (
        <div
          ref={containerRef}
          className="relative w-full bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center"
        >
          <div className="text-center p-6 max-w-md">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">{error.message}</h3>
            {error.details && (
              <p className="text-white/70 text-sm mb-4">{error.details}</p>
            )}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
            <p className="text-white/50 text-xs mt-4 font-mono">
              Error type: {error.type}
            </p>
          </div>
        </div>
      );
    }

    // Render loading state while getting signed URL
    if (urlLoading && !signedUrl) {
      return (
        <div
          ref={containerRef}
          className="relative w-full bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center"
        >
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
            <p className="text-white/70 text-sm">Loading video...</p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-lg overflow-hidden group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(!isPlaying)}
      >
        {/* Video Element */}
        {signedUrl && (
          <video
            ref={videoRef}
            className="w-full aspect-video cursor-pointer"
            preload="metadata"
            playsInline
            poster={poster}
            onClick={handleVideoClick}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleVideoError}
            onCanPlay={() => setIsLoading(false)}
            onWaiting={() => setIsLoading(true)}
            crossOrigin="anonymous"
          >
            <source src={signedUrl} type={actualMimeType} />
            {actualMimeType !== 'video/mp4' && <source src={signedUrl} type="video/mp4" />}
            {actualMimeType !== 'video/webm' && <source src={signedUrl} type="video/webm" />}
            Your browser does not support the video tag.
          </video>
        )}

        {/* Drawing Overlay */}
        <VideoDrawingOverlay
          isActive={isDrawingMode}
          onClose={() => setIsDrawingMode(false)}
          onSave={handleDrawingSave}
          containerRef={containerRef}
        />

        {/* Loading Spinner */}
        {isLoading && signedUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Play Button Overlay */}
        {!isPlaying && !isLoading && signedUrl && !isDrawingMode && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors">
              <Play className="h-8 w-8 text-black ml-1" />
            </div>
          </div>
        )}

        {/* Custom Controls */}
        {signedUrl && !isDrawingMode && (
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Progress Bar with Markers */}
            <div className="mb-3 relative">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
              {/* Comment Markers */}
              <TooltipProvider>
                {markerPositions.map((marker) => (
                  <Tooltip key={marker.id}>
                    <TooltipTrigger asChild>
                      <button
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-lg hover:scale-125 transition-transform z-10"
                        style={{ left: `${marker.position}%`, marginLeft: '-6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const time = parseTimecode(marker.timecode);
                          handleSeek([time]);
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-mono text-xs text-muted-foreground mb-1">{marker.timecode}</p>
                      {marker.userName && <p className="text-xs font-medium">{marker.userName}</p>}
                      <p className="text-sm">{marker.content}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>

                {/* Skip Buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBack}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipForward}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-20 cursor-pointer"
                  />
                </div>

                {/* Time Display */}
                <span className="text-sm text-white font-mono ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
              {/* Timecode removed from video player - exists only in file comments */}

                {/* Drawing Tool */}
                {onDrawingSave && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDrawingToggle}
                    className="h-8 w-8 text-white hover:bg-white/20"
                    title="Draw on video"
                  >
                    <Pen className="h-4 w-4" />
                  </Button>
                )}

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFullscreen}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
