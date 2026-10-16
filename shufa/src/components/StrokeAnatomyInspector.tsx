import React from 'react';
import type { CharacterSpecimen } from '../types/shufa';

interface StrokeAnatomyInspectorProps {
  specimens: CharacterSpecimen[];
  selectedCharIdx: number;
  activeCharIdx: number;
  activeStrokeIdx: number;
  isFinished: boolean;
  hoveredStrokeIdx: number | null;
  onSelectChar: (charIdx: number) => void;
  onJumpToStroke: (charIdx: number, strokeIdx: number) => void;
  onHoverStroke: (strokeIdx: number | null) => void;
}

export const StrokeAnatomyInspector: React.FC<StrokeAnatomyInspectorProps> = ({
  specimens,
  selectedCharIdx,
  activeCharIdx,
  activeStrokeIdx,
  isFinished,
  hoveredStrokeIdx,
  onSelectChar,
  onJumpToStroke,
  onHoverStroke,
}) => {
  const specimen = specimens[selectedCharIdx] || specimens[0];

  if (!specimen) {
    return (
      <aside className="inspector-panel">
        <div className="panel-section-header">
          <span className="section-index">III</span>
          <h2>字理与笔法解析 · SPECIMEN</h2>
        </div>
      </aside>
    );
  }

  const radSet = new Set(specimen.radStrokes);

  return (
    <aside className="inspector-panel">
      {/* Header */}
      <div className="panel-section-header">
        <span className="section-index">III</span>
        <h2>字理与八法解析 · ANATOMY</h2>
      </div>

      {/* Phrase Character Selector Strip */}
      <div className="char-selector-strip" role="tablist" aria-label="词句单字切换">
        {specimens.map((sp, idx) => {
          const isSelected = idx === selectedCharIdx;
          const isCurrentlyWriting = !isFinished && idx === activeCharIdx;
          return (
            <button
              key={`${sp.char}-${idx}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`char-tab-tile ${isSelected ? 'selected' : ''} ${isCurrentlyWriting ? 'writing' : ''}`}
              onClick={() => onSelectChar(idx)}
            >
              <span className="char-tab-num">0{idx + 1}</span>
              <span className="char-tab-glyph">{sp.char}</span>
              <span className="char-tab-py">{sp.pinyin}</span>
            </button>
          );
        })}
      </div>

      {/* Focused Character Specimen Plate + Architectural Metadata */}
      <div className="specimen-overview-card">
        <div className="specimen-svg-plate" title="点击下方笔画可单独演练该笔">
          <svg viewBox="0 0 1024 1024" className="specimen-mini-svg">
            {/* Mi-Zi Grid Hairlines */}
            <line x1="512" y1="0" x2="512" y2="1024" stroke="rgba(184,51,42,0.22)" strokeWidth="6" strokeDasharray="18 18" />
            <line x1="0" y1="512" x2="1024" y2="512" stroke="rgba(184,51,42,0.22)" strokeWidth="6" strokeDasharray="18 18" />
            <line x1="0" y1="0" x2="1024" y2="1024" stroke="rgba(184,51,42,0.12)" strokeWidth="5" strokeDasharray="18 18" />
            <line x1="1024" y1="0" x2="0" y2="1024" stroke="rgba(184,51,42,0.12)" strokeWidth="5" strokeDasharray="18 18" />

            {specimen.strokes.map((pathStr, sIdx) => {
              const isRad = radSet.has(sIdx);
              const isHovered = hoveredStrokeIdx === sIdx;
              const isCurrent =
                !isFinished &&
                selectedCharIdx === activeCharIdx &&
                activeStrokeIdx === sIdx;

              let fill = '#161618';
              if (isHovered || isCurrent) {
                fill = '#B8332A';
              } else if (isRad) {
                fill = 'rgba(184, 51, 42, 0.72)';
              }

              return (
                <path
                  key={sIdx}
                  d={pathStr}
                  fill={fill}
                  opacity={hoveredStrokeIdx !== null && !isHovered ? 0.22 : 0.95}
                  style={{ cursor: 'pointer', transition: 'opacity 140ms ease' }}
                  onClick={() => onJumpToStroke(selectedCharIdx, sIdx)}
                  onMouseEnter={() => onHoverStroke(sIdx)}
                  onMouseLeave={() => onHoverStroke(null)}
                />
              );
            })}
          </svg>
          <span className="plate-corner-label">朱批：部首笔画</span>
        </div>

        <div className="specimen-meta-table">
          <div className="meta-row">
            <span className="meta-key">字头 / 音读</span>
            <span className="meta-val strong">
              {specimen.char} · {specimen.pinyin}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-key">总笔画数</span>
            <span className="meta-val mono">{specimen.strokeCount} 画</span>
          </div>
          <div className="meta-row">
            <span className="meta-key">部首构成</span>
            <span className="meta-val mono">
              {specimen.radStrokes.length > 0
                ? `含 ${specimen.radStrokes.length} 画部首`
                : '独体结构'}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-key">主笔八法</span>
            <span className="meta-val">
              {Array.from(new Set(specimen.anatomies.map((a) => a.yongPrinciple.split(' ')[0])))
                .slice(0, 4)
                .join(' · ')}
            </span>
          </div>
        </div>
      </div>

      {/* Progressive Copybook Strip (笔顺分步字帖) */}
      <div className="copybook-strip-header">
        <span>笔顺分步字帖 · STEPWISE PROGRESSION</span>
        <span className="mono-hint">点击任意步演练</span>
      </div>
      <div className="copybook-progression-row">
        {specimen.strokes.map((_, stepIdx) => {
          const isStepActive =
            !isFinished &&
            selectedCharIdx === activeCharIdx &&
            activeStrokeIdx === stepIdx;
          return (
            <button
              key={stepIdx}
              type="button"
              className={`copybook-step-cell ${isStepActive ? 'active' : ''}`}
              onClick={() => onJumpToStroke(selectedCharIdx, stepIdx)}
              onMouseEnter={() => onHoverStroke(stepIdx)}
              onMouseLeave={() => onHoverStroke(null)}
              title={`第 ${stepIdx + 1} 步：${specimen.anatomies[stepIdx]?.nameZh}`}
            >
              <svg viewBox="0 0 1024 1024" className="copybook-step-svg">
                {/* Faint ghost of all strokes */}
                {specimen.strokes.map((p, allIdx) => (
                  <path
                    key={allIdx}
                    d={p}
                    fill={
                      allIdx < stepIdx
                        ? '#28282A'
                        : allIdx === stepIdx
                          ? '#B8332A'
                          : 'rgba(40,40,42,0.09)'
                    }
                  />
                ))}
              </svg>
              <span className="step-num">{stepIdx + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Detailed Stroke-by-Stroke Calligraphic Ledger */}
      <div className="stroke-ledger-header">
        <span>笔画与用笔法要 · STROKE LEDGER ({specimen.strokeCount})</span>
      </div>

      <div className="stroke-ledger-list">
        {specimen.anatomies.map((anat, sIdx) => {
          const isCurrent =
            !isFinished &&
            selectedCharIdx === activeCharIdx &&
            activeStrokeIdx === sIdx;
          const isHovered = hoveredStrokeIdx === sIdx;

          return (
            <div
              key={sIdx}
              className={`stroke-ledger-item ${isCurrent ? 'current' : ''} ${isHovered ? 'hovered' : ''}`}
              onClick={() => onJumpToStroke(selectedCharIdx, sIdx)}
              onMouseEnter={() => onHoverStroke(sIdx)}
              onMouseLeave={() => onHoverStroke(null)}
            >
              <div className="stroke-item-top">
                <div className="stroke-item-title">
                  <span className="stroke-idx-num">
                    {String(sIdx + 1).padStart(2, '0')}
                  </span>
                  <span className="stroke-name-zh">{anat.nameZh}</span>
                  <span className="stroke-yong-tag">{anat.yongPrinciple}</span>
                  {anat.isRadical && <span className="stroke-rad-tag">部首</span>}
                </div>
                <span className="stroke-metrics-mono">
                  {anat.arcLength}u · {anat.angleDeg}°
                </span>
              </div>
              <p className="stroke-technique-desc">{anat.technique}</p>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
