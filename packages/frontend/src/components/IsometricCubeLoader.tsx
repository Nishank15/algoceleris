import React from 'react';

interface IsometricCubeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const IsometricCubeLoader: React.FC<IsometricCubeLoaderProps> = ({
  size = 'md',
  label,
  className = '',
}) => {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { width: 28, height: 32, fontSize: '0.75rem', cubeScale: 0.65 };
      case 'lg':
        return { width: 68, height: 76, fontSize: '0.95rem', cubeScale: 1.4 };
      case 'md':
      default:
        return { width: 44, height: 50, fontSize: '0.85rem', cubeScale: 1.0 };
    }
  };

  const dim = getDimensions();

  return (
    <div
      className={`iso-loader-container ${className}`}
      role="status"
      aria-label={label || 'Loading sandboxed execution'}
    >
      <div
        className="iso-cube-wrapper"
        style={{
          width: dim.width,
          height: dim.height,
        }}
      >
        {/* SVG Isometric 3D Cube with Neon Facets */}
        <svg
          viewBox="0 0 100 110"
          className="iso-cube-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pulsing Floor Shadow */}
          <ellipse
            cx="50"
            cy="98"
            rx="32"
            ry="10"
            className="iso-cube-shadow"
            fill="rgba(99, 102, 241, 0.28)"
          />

          {/* Group with float/tumbling animation */}
          <g className="iso-cube-body">
            {/* Top Face (Rhombus) */}
            <polygon
              points="50,12 85,32 50,52 15,32"
              className="iso-face-top"
              fill="url(#iso-top-gradient)"
            />
            {/* Left Face */}
            <polygon
              points="15,32 50,52 50,92 15,72"
              className="iso-face-left"
              fill="url(#iso-left-gradient)"
            />
            {/* Right Face */}
            <polygon
              points="50,52 85,32 85,72 50,92"
              className="iso-face-right"
              fill="url(#iso-right-gradient)"
            />

            {/* Glowing Accent Edges */}
            <polyline
              points="15,32 50,52 85,32"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line
              x1="50"
              y1="52"
              x2="50"
              y2="92"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1.5"
            />
          </g>

          {/* Gradients */}
          <defs>
            <linearGradient id="iso-top-gradient" x1="15" y1="12" x2="85" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="iso-left-gradient" x1="15" y1="32" x2="50" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="iso-right-gradient" x1="50" y1="32" x2="85" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#3730a3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {label && (
        <span
          className="iso-loader-label"
          style={{ fontSize: dim.fontSize }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
