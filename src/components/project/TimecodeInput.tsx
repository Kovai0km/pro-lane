import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimecodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onCaptureTimecode?: () => void;
  timecodeEnabled?: boolean;
  onTimecodeEnabledChange?: (enabled: boolean) => void;
  capturedTimecode?: string | null;
  onClearTimecode?: () => void;
  className?: string;
  compact?: boolean;
}

export function TimecodeInput({
  value,
  onChange,
  onCaptureTimecode,
  timecodeEnabled = true,
  onTimecodeEnabledChange,
  capturedTimecode,
  onClearTimecode,
  className,
  compact = false,
}: TimecodeInputProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Timecode Toggle */}
      {onTimecodeEnabledChange && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="timecode-toggle" className="text-sm text-muted-foreground">
              Capture Timecode
            </Label>
          </div>
          <Switch
            id="timecode-toggle"
            checked={timecodeEnabled}
            onCheckedChange={onTimecodeEnabledChange}
          />
        </div>
      )}

      {/* Captured Timecode Display */}
      {timecodeEnabled && capturedTimecode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm text-primary">{capturedTimecode}</span>
          {onClearTimecode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto"
              onClick={onClearTimecode}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Capture Button */}
      {timecodeEnabled && onCaptureTimecode && !capturedTimecode && !compact && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCaptureTimecode}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Capture Current Time
        </Button>
      )}
    </div>
  );
}
