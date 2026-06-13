import { Star } from "lucide-react";

interface StarRatingProps {
  /** The numeric rating value (e.g. 1.0, 1.5, 2.0 to 5.0) */
  rating: number;
  /** Maximum rating value (default: 5) */
  maxRating?: number;
  /** Custom wrapper CSS class */
  className?: string;
  /** Sizes: 'sm' (16px), 'md' (20px), 'lg' (24px) */
  size?: "sm" | "md" | "lg";
  /** Whether to show the numeric rating badge alongside the stars */
  showNumber?: boolean;
}

export function StarRating({
  rating,
  maxRating = 5,
  className = "",
  size = "sm",
  showNumber = true,
}: StarRatingProps) {
  const sizeClasses = {
    sm: { star: "w-4 h-4", spacing: "gap-0.5" },
    md: { star: "w-5 h-5", spacing: "gap-1" },
    lg: { star: "w-6 h-6", spacing: "gap-1.5" },
  };

  const currentSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className={`flex items-center ${currentSize.spacing}`}>
        {Array.from({ length: maxRating }).map((_, index) => {
          const starValue = index + 1;
          let fillType: "full" | "half" | "empty" = "empty";

          if (rating >= starValue) {
            fillType = "full";
          } else if (rating >= starValue - 0.5) {
            fillType = "half";
          }

          return (
            <div
              key={index}
              className={`relative ${currentSize.star} select-none`}
            >
              {/* Background empty star */}
              <Star className={`${currentSize.star} text-muted-foreground/30 fill-none`} />

              {/* Full star overlay */}
              {fillType === "full" && (
                <Star className={`absolute top-0 left-0 ${currentSize.star} text-[#E17100] fill-[#FFB900]`} />
              )}

              {/* Half star overlay */}
              {fillType === "half" && (
                <Star
                  className={`absolute top-0 left-0 ${currentSize.star} text-[#E17100] fill-[#FFB900]`}
                  style={{ clipPath: "inset(0 50% 0 0)" }}
                />
              )}
            </div>
          );
        })}
      </div>
      {showNumber && (
        <span className="px-1.5 py-0.5 rounded-md bg-[#F9EBE1] text-[#E17100] text-[10px] font-bold min-w-[28px] text-center leading-none">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
