import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizableLayoutProps {
  isZenMode: boolean;
  leftPane: React.ReactNode;
  editorPane: React.ReactNode;
  consolePane: React.ReactNode;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  isZenMode,
  leftPane,
  editorPane,
  consolePane,
}) => {
  // Horizontal split: percentage width for left pane (Problem)
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(42);
  // Vertical split: percentage height for editor pane (Top of right area)
  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(60);

  const containerRef = useRef<HTMLDivElement>(null);
  const rightAreaRef = useRef<HTMLDivElement>(null);

  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isDraggingV, setIsDraggingV] = useState(false);

  // Drag handler for horizontal splitter
  const handleMouseDownH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingH(true);
  }, []);

  // Drag handler for vertical splitter
  const handleMouseDownV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingV(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingH && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
        // Clamp between 25% and 65%
        if (newLeftWidth >= 25 && newLeftWidth <= 65) {
          setLeftWidthPercent(newLeftWidth);
        }
      }

      if (isDraggingV && rightAreaRef.current) {
        const rect = rightAreaRef.current.getBoundingClientRect();
        const newEditorHeight = ((e.clientY - rect.top) / rect.height) * 100;
        // Clamp between 25% and 80%
        if (newEditorHeight >= 25 && newEditorHeight <= 80) {
          setEditorHeightPercent(newEditorHeight);
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingH) setIsDraggingH(false);
      if (isDraggingV) setIsDraggingV(false);
    };

    if (isDraggingH || isDraggingV) {
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingH, isDraggingV]);

  return (
    <div
      ref={containerRef}
      className={`layout-workspace ${isZenMode ? 'zen-mode' : ''}`}
    >
      {/* Left Pane: Problem Description */}
      <div
        className="pane pane-problem"
        style={{
          width: isZenMode ? '0%' : `${leftWidthPercent}%`,
          flexShrink: 0,
        }}
      >
        {leftPane}
      </div>

      {/* Horizontal Resizer */}
      {!isZenMode && (
        <div
          className={`resizer-horizontal ${isDraggingH ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDownH}
          title="Drag to resize panes"
        />
      )}

      {/* Right Area: Code Editor + Test Console */}
      <div
        ref={rightAreaRef}
        className="pane-code-area"
        style={{
          width: isZenMode ? '100%' : `${100 - leftWidthPercent}%`,
        }}
      >
        {/* Editor Pane (Top) */}
        <div
          className="pane pane-editor"
          style={{
            height: isZenMode ? '100%' : `${editorHeightPercent}%`,
            flexShrink: 0,
          }}
        >
          {editorPane}
        </div>

        {/* Vertical Resizer */}
        {!isZenMode && (
          <div
            className={`resizer-vertical ${isDraggingV ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDownV}
            title="Drag to resize editor and console"
          />
        )}

        {/* Console Pane (Bottom) */}
        {!isZenMode && (
          <div
            className="pane pane-console"
            style={{
              height: `${100 - editorHeightPercent}%`,
              flexGrow: 1,
            }}
          >
            {consolePane}
          </div>
        )}
      </div>
    </div>
  );
};
