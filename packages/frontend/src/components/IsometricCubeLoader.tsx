import type React from 'react';

export interface IsometricCubeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const IsometricCubeLoader: React.FC<IsometricCubeLoaderProps> = ({
  size = 'md',
  label,
  className = '',
}) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <div
      className={`iso-loader-container ${isSm ? 'iso-loader-inline' : 'iso-loader-stacked'} ${className}`}
      role="status"
      aria-label={label || 'Loading sandboxed execution'}
    >
      <div
        className={`relative iso-loader-stage ${isSm ? 'iso-scale-sm' : isLg ? 'iso-scale-lg' : 'iso-scale-md'}`}
      >
        <div className="boxes">
          <div className="box box-1">
            <div className="face face-front" />
            <div className="face face-right" />
            <div className="face face-top" />
            <div className="face face-back" />
          </div>
          <div className="box box-2">
            <div className="face face-front" />
            <div className="face face-right" />
            <div className="face face-top" />
            <div className="face face-back" />
          </div>
          <div className="box box-3">
            <div className="face face-front" />
            <div className="face face-right" />
            <div className="face face-top" />
            <div className="face face-back" />
          </div>
          <div className="box box-4">
            <div className="face face-front" />
            <div className="face face-right" />
            <div className="face face-top" />
            <div className="face face-back" />
          </div>
        </div>
      </div>
      {label && (
        <span
          className="iso-loader-label"
          style={{
            fontSize: isSm ? '0.78rem' : isLg ? '0.9rem' : '0.85rem',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default IsometricCubeLoader;
