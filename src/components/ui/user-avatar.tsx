import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  className?: string;
  fallbackClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-32 w-32",
};

const textSizeClasses = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-4xl",
};

/**
 * Resolves an avatar URL - if it's a private Supabase storage URL,
 * creates a signed URL. Otherwise returns as-is.
 */
function useResolvedAvatarUrl(src: string | null | undefined) {
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!src) {
      setResolvedUrl(null);
      return;
    }

    // Check if this is a Supabase storage URL that needs signing
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && src.includes(supabaseUrl) && src.includes('/storage/v1/object/public/')) {
      // Extract the path from the public URL
      const pathMatch = src.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      if (pathMatch) {
        const bucket = pathMatch[1];
        const filePath = decodeURIComponent(pathMatch[2]);
        
        supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600)
          .then(({ data, error }) => {
            if (data?.signedUrl) {
              setResolvedUrl(data.signedUrl);
            } else {
              // Fallback to original URL
              setResolvedUrl(src);
            }
          });
        return;
      }
    }

    // Not a Supabase URL or doesn't need signing
    setResolvedUrl(src);
  }, [src]);

  return resolvedUrl;
}

export function UserAvatar({
  src,
  name,
  email,
  className,
  fallbackClassName,
  size = "md",
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const resolvedUrl = useResolvedAvatarUrl(src);
  const displayName = name || email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  
  // Reset error state when src changes
  React.useEffect(() => {
    setImageError(false);
  }, [src, resolvedUrl]);

  const showImage = resolvedUrl && !imageError;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {showImage && (
        <AvatarImage
          src={resolvedUrl}
          alt={displayName}
          className="object-cover"
          onError={() => setImageError(true)}
        />
      )}
      <AvatarFallback
        className={cn(
          textSizeClasses[size],
          "bg-primary text-primary-foreground font-medium",
          fallbackClassName
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
