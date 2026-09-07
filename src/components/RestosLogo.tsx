import React from 'react';

interface RestosLogoProps {
  className?: string;
  variant?: 'color' | 'white';
}

export const RestosLogo: React.FC<RestosLogoProps> = ({ className = 'h-10 w-auto', variant = 'color' }) => {
  const brandColor = variant === 'white' ? '#FFFFFF' : '#FF3815';

  return (
    <svg
      viewBox="0 0 450 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="RESTOS Logo"
    >
      {/* RESTOS Wordmark */}
      <g fill={brandColor}>
        {/* R */}
        <path
          d="M10 12 H42 C54.5 12 62.5 19.5 62.5 32 C62.5 41.5 56 47.5 47 50.5 L65 78 H49 L33.5 53 H26 V78 H10 Z M26 25 V40 H40 C45 40 47.5 37 47.5 32.5 C47.5 28 45 25 40 25 Z"
        />

        {/* E */}
        <path
          d="M75 12 H118 V25 H91 V37 H114 V50 H91 V65 H118 V78 H75 Z"
        />

        {/* S */}
        <path
          d="M130 63 C132 72 140 78 152 78 C163.5 78 171 71.5 171 62 C171 52 163 48 150 44 C134 39.5 128 35 128 24.5 C128 14.5 137.5 7.5 149.5 7.5 C161 7.5 169.5 14 171 23 L157 26 C156 20 152 17.5 149 17.5 C144 17.5 140 20 140 24.5 C140 31 146 34 156 37 C170 41.5 177 47.5 177 59 C177 71 167 79 152 79 C136 79 127 70 125 60 Z"
        />

        {/* T */}
        <path
          d="M188 12 H238 V25 H221 V78 H205 V25 H188 Z"
        />

        {/* O */}
        <path
          d="M250 28 C250 17 259 9 273 9 C287 9 296 17 296 28 V62 C296 73 287 81 273 81 C259 81 250 73 250 62 Z M266 61 C266 67 269 70.5 273 70.5 C277 70.5 280 67 280 61 V29 C280 23 277 19.5 273 19.5 C269 19.5 266 23 266 29 Z"
        />

        {/* S */}
        <path
          d="M308 63 C310 72 318 78 330 78 C341.5 78 349 71.5 349 62 C349 52 341 48 328 44 C312 39.5 306 35 306 24.5 C306 14.5 315.5 7.5 327.5 7.5 C339 7.5 347.5 14 349 23 L335 26 C334 20 330 17.5 327 17.5 C322 17.5 318 20 318 24.5 C318 31 324 34 334 37 C348 41.5 355 47.5 355 59 C355 71 345 79 330 79 C314 79 305 70 303 60 Z"
        />
      </g>

      {/* Emblem Badge: Power Fork Circle */}
      <g transform="translate(372, 7)">
        {/* Outer Ring */}
        <circle cx="38" cy="38" r="33" stroke={brandColor} strokeWidth="9" fill="none" />
        {/* Outer U-prongs */}
        <path
          d="M26 23 V42 C26 49 31.5 54.5 38 54.5 C44.5 54.5 50 49 50 42 V23"
          stroke={brandColor}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Center Prong */}
        <line
          x1="38"
          y1="21"
          x2="38"
          y2="45"
          stroke={brandColor}
          strokeWidth="7.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};
