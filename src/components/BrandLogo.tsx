import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md';
  className?: string;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'sm',
  className = '',
  showText = true,
}) => {
  const iconScale =
    size === 'sm'
      ? 'scale-[0.08] -translate-x-[210px] -translate-y-[220px]'
      : 'scale-[0.115] -translate-x-[185px] -translate-y-[195px]';
  const containerClass = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* New Pinpoint-Waveform SVG container with precise scaling */}
      <div
        className={`${containerClass} shrink-0 overflow-hidden relative rounded-xl bg-[#0B132B] shadow-2xs flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 512 512"
          className={`absolute transform ${iconScale} w-[512px] h-[512px]`}
        >
          <defs>
            <linearGradient id="pinGradH" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3AC9FD" />
              <stop offset="50%" stopColor="#0F73EE" />
              <stop offset="100%" stopColor="#0237C3" />
            </linearGradient>
            <linearGradient id="waveGradH" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3AC9FD" />
              <stop offset="100%" stopColor="#0D5AD3" />
            </linearGradient>
          </defs>
          <g transform="translate(100, 72)">
            <path
              d="M156,22 C236,22 296,82 296,162 C296,192 284,216 270,230 L270,230 C264,236 262,240 252,246 C240,254 232,258 206,284 L164,324 C160,328 152,328 148,324 L106,284 C80,258 72,254 60,246 C50,240 48,236 42,230 L42,230 C28,216 16,192 16,162 C16,82 76,22 156,22 Z"
              fill="none"
              stroke="url(#pinGradH)"
              strokeWidth="26"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="92"
              y1="138"
              x2="92"
              y2="186"
              stroke="url(#waveGradH)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="124"
              y1="116"
              x2="124"
              y2="208"
              stroke="url(#waveGradH)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="156"
              y1="92"
              x2="156"
              y2="232"
              stroke="url(#waveGradH)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="188"
              y1="116"
              x2="188"
              y2="208"
              stroke="url(#waveGradH)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1="220"
              y1="138"
              x2="220"
              y2="186"
              stroke="url(#waveGradH)"
              strokeWidth="20"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
      {showText && (
        <div>
          <span
            className={`${
              size === 'sm' ? 'text-sm' : 'text-base'
            } font-bold tracking-tight text-stone-900 dark:text-white leading-tight`}
          >
            Pinpoint Audio
          </span>
        </div>
      )}
    </div>
  );
};
