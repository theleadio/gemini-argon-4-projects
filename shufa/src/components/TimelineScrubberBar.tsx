import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Repeat,
} from 'lucide-react';
import type { CharacterSpecimen } from '../types/shufa';

export interface TimelineSegment {
  globalStrokeIdx: number;
  charIdx: number;
  strokeIdx: number;
  char: string;
  strokeNameZh: string;
  startTimeMs: number;
  durationMs: number;
}

interface TimelineScrubberBarProps {
  specimens: CharacterSpecimen[];
  segments: TimelineSegment[];
  totalDurationMs: number;
  currentTimeMs: number;
  isPlaying: boolean;
  isLooping: boolean;
  activeCharIdx: number;
  activeStrokeIdx: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepStroke: (delta: number) => void;
  onScrubTime: (timeMs: number) => void;
  onToggleLoop: () => void;
  onJumpToStroke: (charIdx: number, strokeIdx: number) => void;
}

export const TimelineScrubberBar: React.FC<TimelineScrubberBarProps> = ({
  specimens,
  segments,
  totalDurationMs,
  currentTimeMs,
  isPlaying,
  isLooping,
  activeCharIdx,
  activeStrokeIdx,
  onTogglePlay,
  onRestart,
  onStepStroke,
  onScrubTime,
  onToggleLoop,
  onJumpToStroke,
}) => {
  const totalStrokes = segments.length;
  const activeGlobalStroke = segments.findIndex(
    (s) => s.charIdx === activeCharIdx && s.strokeIdx === activeStrokeIdx
  );
  const currentStrokeDisplay =
    currentTimeMs >= totalDurationMs && totalStrokes > 0
      ? totalStrokes
      : Math.max(1, activeGlobalStroke + 1);

  const progressPercent =
    totalDurationMs > 0 ? Math.min(100, (currentTimeMs / totalDurationMs) * 100) : 0;

  return (
    <footer className="timeline-scrubber-bar">
      {/* Left Transport Controls */}
      <div className="transport-controls">
        <button
          type="button"
          className="transport-btn primary-play"
          onClick={onTogglePlay}
          title={isPlaying ? '暂停 (Space)' : '挥毫播放 (Space)'}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          <span>{isPlaying ? '驻笔暂停' : currentTimeMs >= totalDurationMs ? '重新挥毫' : '挥毫演练'}</span>
        </button>

        <button
          type="button"
          className="transport-btn icon-only"
          onClick={onRestart}
          title="重置回起笔"
        >
          <RotateCcw size={14} />
        </button>

        <button
          type="button"
          className="transport-btn icon-only"
          onClick={() => onStepStroke(-1)}
          title="上一笔 ([)"
        >
          <SkipBack size={14} />
        </button>

        <button
          type="button"
          className="transport-btn icon-only"
          onClick={() => onStepStroke(1)}
          title="下一笔 (])"
        >
          <SkipForward size={14} />
        </button>

        <button
          type="button"
          className={`transport-btn icon-only ${isLooping ? 'active' : ''}`}
          onClick={onToggleLoop}
          title="循环往复演练"
        >
          <Repeat size={14} />
        </button>
      </div>

      {/* Center Multi-Character & Stroke Segmented Timeline Track */}
      <div className="timeline-track-area">
        <div className="timeline-char-blocks">
          {specimens.map((sp, cIdx) => {
            const charSegments = segments.filter((s) => s.charIdx === cIdx);
            const charDuration = charSegments.reduce((acc, s) => acc + s.durationMs, 0);
            const weightFlex = Math.max(1, charDuration);
            const isCharActive = cIdx === activeCharIdx;

            return (
              <div
                key={`tl-${sp.char}-${cIdx}`}
                className={`timeline-char-group ${isCharActive ? 'active' : ''}`}
                style={{ flex: weightFlex }}
              >
                <div className="timeline-char-header">
                  <span className="tl-char-glyph">{sp.char}</span>
                  <span className="tl-char-meta">
                    {sp.pinyin} · {sp.strokeCount}画
                  </span>
                </div>

                <div className="timeline-stroke-pills">
                  {charSegments.map((seg) => {
                    const segEnd = seg.startTimeMs + seg.durationMs;
                    const isDone = currentTimeMs >= segEnd;
                    const isCurrent =
                      currentTimeMs >= seg.startTimeMs && currentTimeMs < segEnd;
                    return (
                      <button
                        key={seg.globalStrokeIdx}
                        type="button"
                        className={`tl-stroke-tick ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                        style={{ flex: Math.max(1, seg.durationMs) }}
                        onClick={() => onJumpToStroke(seg.charIdx, seg.strokeIdx)}
                        title={`${sp.char} · 第${seg.strokeIdx + 1}画 (${seg.strokeNameZh})`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Continuous Precision Scrubber Input */}
        <div className="timeline-range-overlay">
          <div
            className="timeline-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(1, totalDurationMs)}
            step={10}
            value={Math.min(totalDurationMs, currentTimeMs)}
            onChange={(e) => onScrubTime(parseFloat(e.target.value))}
            className="timeline-scrub-input"
            aria-label="全篇笔顺时间轴拖动"
          />
        </div>
      </div>

      {/* Right Telemetry Readout */}
      <div className="timeline-telemetry">
        <div className="telemetry-cell">
          <span className="tel-label">总笔序 PROGRESS</span>
          <span className="tel-value">
            {String(currentStrokeDisplay).padStart(2, '0')} / {String(totalStrokes).padStart(2, '0')} 画
          </span>
        </div>
        <div className="telemetry-cell">
          <span className="tel-label">历时 TIME</span>
          <span className="tel-value">
            {(currentTimeMs / 1000).toFixed(1)}s / {(totalDurationMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </footer>
  );
};
