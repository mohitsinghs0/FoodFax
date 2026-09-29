import React from 'react';

interface VegBadgeProps {
  isVeg?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

/**
 * Accessible Dietary Indicator conforming to FSSAI standards and WCAG a11y:
 * Uses distinct geometric symbols (Circle vs Triangle), contrast borders,
 * role="img", aria-label, and optional readable text label so colorblind users
 * are never left guessing.
 */
export const VegBadge: React.FC<VegBadgeProps> = ({ 
  isVeg = true, 
  size = 'sm',
  showText = false 
}) => {
  const outerSize = 
    size === 'sm' ? 'w-3.5 h-3.5' : 
    size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  const dotSize = 
    size === 'sm' ? 'w-1.5 h-1.5' : 
    size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  if (isVeg) {
    return (
      <span
        role="img"
        aria-label="Pure Vegetarian dish"
        title="Pure Vegetarian"
        className="inline-flex items-center gap-1 flex-shrink-0"
      >
        <span
          className={`inline-flex items-center justify-center border-2 border-emerald-700 rounded-[3px] bg-white p-[2px] ${outerSize} flex-shrink-0 shadow-2xs`}
        >
          {/* Green circular dot */}
          <span className={`rounded-full bg-emerald-700 ${dotSize}`} />
        </span>
        {showText && (
          <span className="text-[10px] font-extrabold uppercase tracking-tight text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
            Veg
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Non-Vegetarian dish"
      title="Non-Vegetarian"
      className="inline-flex items-center gap-1 flex-shrink-0"
    >
      <span
        className={`inline-flex items-center justify-center border-2 border-rose-800 rounded-[3px] bg-white p-[2px] ${outerSize} flex-shrink-0 shadow-2xs`}
      >
        {/* Distinctive Red triangle for colorblind distinction */}
        <span
          className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-rose-800"
          style={{ transform: size === 'lg' ? 'scale(1.3)' : size === 'sm' ? 'scale(0.85)' : 'scale(1)' }}
        />
      </span>
      {showText && (
        <span className="text-[10px] font-extrabold uppercase tracking-tight text-rose-800 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
          Non-Veg
        </span>
      )}
    </span>
  );
};
