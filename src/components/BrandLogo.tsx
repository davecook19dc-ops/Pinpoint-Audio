import React from 'react';

export const BrandLogo: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const containerClass = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11';
  return (
    <div className="flex items-center gap-2.5">
      {/* Native ViewBox scaling replaces fragile CSS transforms */}
      <div className={`${containerClass} shrink-0 flex items-center justify-center`}>
        <svg viewBox="100 80 310 330" className="w-full h-full drop-shadow-md">
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
          <g>
            <path
              d="M156,22 C236,22 296,82 296,162 C296,192 284,216 270,230 L270,230 C264,236 262,240 252,246 C240,254 232,258 206,284 L164,324 C160,328 152,328 148,324 L106,284 C80,258 72,254 60,246 C50,240 48,236 42,230 L42,230 C28,216 16,192 16,162 C16,82 76,22 156,22 Z"
              fill="none"
              stroke="url(#pinGradH)"
              strokeWidth="26"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(100, 72)"
            />
            <path
              d="M16,162 L48,162 C58,162 60,170 64,180 C70,198 84,212 108,212 C116,212 122,210 126,204"
              fill="none"
              stroke="url(#pinGradH)"
              strokeWidth="14"
              strokeLinecap="round"
              transform="translate(100, 72)"
            />
            <path
              d="M296,162 L264,162 C254,162 252,170 248,180 C242,198 228,212 204,212 C196,212 190,210 186,204"
              fill="none"
              stroke="url(#pinGradH)"
              strokeWidth="14"
              strokeLinecap="round"
              transform="translate(100, 72)"
            />
            <rect
              x="108"
              y="96"
              width="18"
              height="106"
              rx="9"
              fill="url(#waveGradH)"
              transform="translate(100, 72)"
            />
            <rect
              x="141"
              y="62"
              width="20"
              height="152"
              rx="10"
              fill="url(#waveGradH)"
              transform="translate(100, 72)"
            />
            <rect
              x="177"
              y="74"
              width="20"
              height="130"
              rx="10"
              fill="url(#waveGradH)"
              transform="translate(100, 72)"
            />
            <rect
              x="213"
              y="112"
              width="18"
              height="74"
              rx="9"
              fill="url(#waveGradH)"
              transform="translate(100, 72)"
            />
          </g>
        </svg>
      </div>
      <div className="flex flex-col select-none">
        <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none uppercase">
          PINPOINT
        </span>
        <span className="text-[11px] font-medium tracking-widest text-[#0F73EE] dark:text-[#3AC9FD] leading-tight uppercase -mt-0.5">
          AUDIO
        </span>
      </div>
    </div>
  );
};
