import React from 'react';
import { Minimize2 } from 'lucide-react';

interface ZenModeBannerProps {
  onExit: () => void;
}

export const ZenModeBanner: React.FC<ZenModeBannerProps> = ({ onExit }) => {
  return (
    <div
      className="zen-banner"
      onClick={onExit}
      title="Exit Zen Mode (Esc)"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onExit();
        }
      }}
    >
      <Minimize2 size={14} />
      <span>Press</span>
      <kbd>Esc</kbd>
      <span>to exit Zen Mode</span>
    </div>
  );
};
