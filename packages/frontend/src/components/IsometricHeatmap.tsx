import React, { useState, useMemo } from 'react';
import { Layers, Calendar, Sparkles, TrendingUp } from 'lucide-react';
import { ActivityDay } from '../types';

interface IsometricHeatmapProps {
  history?: ActivityDay[];
  totalSubmissions?: number;
  acceptedCount?: number;
  streakDays?: number;
}

// Generate realistic seeded history if not passed from server
function generateMockHistory(daysCount: number = 140): ActivityDay[] {
  const result: ActivityDay[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Pseudo-random realistic activity distribution with streaks
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const seed = (d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate()) % 100;

    let count = 0;
    let accepted = 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;

    if (seed > 25) {
      if (seed > 85) {
        count = isWeekend ? 9 : 8;
        accepted = isWeekend ? 7 : 6;
        level = 4;
      } else if (seed > 65) {
        count = isWeekend ? 6 : 5;
        accepted = isWeekend ? 5 : 4;
        level = 3;
      } else if (seed > 45) {
        count = 3;
        accepted = 2;
        level = 2;
      } else {
        count = 1;
        accepted = 1;
        level = 1;
      }
    }

    result.push({
      date: dateStr,
      count,
      accepted,
      level,
    });
  }

  return result;
}

export const IsometricHeatmap: React.FC<IsometricHeatmapProps> = ({
  history,
  totalSubmissions = 248,
  acceptedCount = 186,
  streakDays = 14,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | 'flat'>('3d');
  const [hoveredDay, setHoveredDay] = useState<{
    day: ActivityDay;
    x: number;
    y: number;
  } | null>(null);

  const activities = useMemo(() => {
    return history && history.length > 0 ? history : generateMockHistory(140);
  }, [history]);

  // Group into weeks (columns of 7 days: Sun=0 to Sat=6)
  const weeks = useMemo(() => {
    const cols: ActivityDay[][] = [];
    let currentWeek: ActivityDay[] = [];

    activities.forEach((day, idx) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === activities.length - 1) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    });

    return cols;
  }, [activities]);

  const getPillarStyles = (level: 0 | 1 | 2 | 3 | 4) => {
    switch (level) {
      case 4:
        return {
          height: 38,
          top: '#c084fc',
          left: '#a855f7',
          right: '#9333ea',
          glow: '0 0 10px rgba(192, 132, 252, 0.65)',
        };
      case 3:
        return {
          height: 26,
          top: '#818cf8',
          left: '#6366f1',
          right: '#4f46e5',
          glow: '0 0 8px rgba(129, 140, 248, 0.45)',
        };
      case 2:
        return {
          height: 18,
          top: '#34d399',
          left: '#10b981',
          right: '#059669',
          glow: '0 0 6px rgba(52, 211, 153, 0.3)',
        };
      case 1:
        return {
          height: 10,
          top: '#059669',
          left: '#047857',
          right: '#064e3b',
          glow: 'none',
        };
      case 0:
      default:
        return {
          height: 4,
          top: '#27272a',
          left: '#1f1f23',
          right: '#18181b',
          glow: 'none',
        };
    }
  };

  return (
    <div className="iso-heatmap-wrapper">
      {/* Header & View Controls */}
      <div className="iso-heatmap-header">
        <div className="iso-header-title">
          <TrendingUp size={16} className="accent-icon" />
          <span>Activity & Practice Journey</span>
          <span className="iso-badge">{activities.length} Days Visualized</span>
        </div>

        <div className="iso-controls">
          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
              title="Render 3D Isometric Extruded Pillars"
            >
              <Layers size={13} />
              <span>3D Isometric</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'flat' ? 'active' : ''}`}
              onClick={() => setViewMode('flat')}
              title="Render 2D Linear Grid"
            >
              <Calendar size={13} />
              <span>Flat 2D</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Isometric Visualization Stage */}
      <div className={`iso-stage-container ${viewMode === '3d' ? 'stage-3d' : 'stage-flat'}`}>
        {viewMode === '3d' ? (
          <div className="iso-svg-scroll">
            <svg
              className="iso-grid-svg"
              viewBox="0 0 920 320"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Render Weeks left-to-right, days top-to-bottom in isometric layout */}
              {weeks.map((week, colIdx) => {
                return week.map((day, rowIdx) => {
                  const style = getPillarStyles(day.level);
                  // Isometric projection math:
                  // origin X: 120 + colIdx * 38 - rowIdx * 18
                  // origin Y: 60 + colIdx * 12 + rowIdx * 16
                  const baseX = 80 + colIdx * 38 - rowIdx * 18;
                  const baseY = 80 + colIdx * 8 + rowIdx * 20;
                  const h = style.height;

                  // Rhombus top coordinates
                  const topP1 = `${baseX},${baseY - h}`;
                  const topP2 = `${baseX + 18},${baseY + 9 - h}`;
                  const topP3 = `${baseX},${baseY + 18 - h}`;
                  const topP4 = `${baseX - 18},${baseY + 9 - h}`;

                  // Left face coordinates
                  const leftP1 = `${baseX - 18},${baseY + 9 - h}`;
                  const leftP2 = `${baseX},${baseY + 18 - h}`;
                  const leftP3 = `${baseX},${baseY + 18}`;
                  const leftP4 = `${baseX - 18},${baseY + 9}`;

                  // Right face coordinates
                  const rightP1 = `${baseX},${baseY + 18 - h}`;
                  const rightP2 = `${baseX + 18},${baseY + 9 - h}`;
                  const rightP3 = `${baseX + 18},${baseY + 9}`;
                  const rightP4 = `${baseX},${baseY + 18}`;

                  const isHovered = hoveredDay?.day.date === day.date;

                  return (
                    <g
                      key={day.date}
                      className={`iso-pillar-group ${isHovered ? 'hovered' : ''}`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay({
                          day,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10,
                        });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Left Face */}
                      <polygon
                        points={`${leftP1} ${leftP2} ${leftP3} ${leftP4}`}
                        fill={isHovered ? '#6366f1' : style.left}
                        stroke="#18181b"
                        strokeWidth="0.75"
                      />
                      {/* Right Face */}
                      <polygon
                        points={`${rightP1} ${rightP2} ${rightP3} ${rightP4}`}
                        fill={isHovered ? '#4f46e5' : style.right}
                        stroke="#18181b"
                        strokeWidth="0.75"
                      />
                      {/* Top Face */}
                      <polygon
                        points={`${topP1} ${topP2} ${topP3} ${topP4}`}
                        fill={isHovered ? '#a5b4fc' : style.top}
                        stroke={isHovered ? '#ffffff' : '#27272a'}
                        strokeWidth="1"
                        filter={day.level === 4 ? 'url(#neon-glow)' : undefined}
                      />
                    </g>
                  );
                });
              })}
            </svg>
          </div>
        ) : (
          /* Classic 2D Grid Representation */
          <div className="flat-grid-wrapper">
            <div className="flat-grid-cols">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="flat-col">
                  {week.map((day) => {
                    const style = getPillarStyles(day.level);
                    return (
                      <div
                        key={day.date}
                        className="flat-cell"
                        style={{
                          backgroundColor: style.top,
                          boxShadow: style.glow,
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay({
                            day,
                            x: rect.left + rect.width / 2,
                            y: rect.top - 10,
                          });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hover Tooltip Portal */}
        {hoveredDay && (
          <div
            className="iso-tooltip"
            style={{
              position: 'fixed',
              left: `${hoveredDay.x}px`,
              top: `${hoveredDay.y}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div className="tooltip-date">{hoveredDay.day.date}</div>
            <div className="tooltip-stats">
              <span className="tooltip-count">
                {hoveredDay.day.count} {hoveredDay.day.count === 1 ? 'submission' : 'submissions'}
              </span>
              <span className="tooltip-accepted">
                ({hoveredDay.day.accepted} Accepted)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend & Summary */}
      <div className="iso-heatmap-footer">
        <div className="iso-summary-stats">
          <span><strong>{totalSubmissions}</strong> total submissions</span>
          <span className="divider">•</span>
          <span><strong>{acceptedCount}</strong> accepted</span>
          <span className="divider">•</span>
          <span className="streak-badge">
            <Sparkles size={12} />
            {streakDays} day streak
          </span>
        </div>

        <div className="iso-legend">
          <span className="legend-label">Less</span>
          <div className="legend-box" style={{ background: '#27272a' }} title="Level 0: 0 submissions" />
          <div className="legend-box" style={{ background: '#059669' }} title="Level 1: 1-2 submissions" />
          <div className="legend-box" style={{ background: '#34d399' }} title="Level 2: 3-4 submissions" />
          <div className="legend-box" style={{ background: '#818cf8' }} title="Level 3: 5-7 submissions" />
          <div className="legend-box" style={{ background: '#c084fc', boxShadow: '0 0 6px rgba(192, 132, 252, 0.7)' }} title="Level 4: 8+ submissions" />
          <span className="legend-label">More</span>
        </div>
      </div>
    </div>
  );
};
