import React, { useState, useEffect } from 'react';
import { ANTHOLOGY_PRESETS } from '../data/anthology';
import type {
  AnthologyEntry,
  BrushPhysicsConfig,
  BrushStyleMode,
  GridType,
  SealStyle,
} from '../types/shufa';

interface StudioControlRailProps {
  currentPhrase: string;
  activePreset: AnthologyEntry | null;
  onSubmitPhrase: (phrase: string, preset?: AnthologyEntry) => void;
  config: BrushPhysicsConfig;
  onChangeConfig: (updater: (prev: BrushPhysicsConfig) => BrushPhysicsConfig) => void;
  gridType: GridType;
  onChangeGridType: (grid: GridType) => void;
  sealText: string;
  onChangeSealText: (text: string) => void;
  sealStyle: SealStyle;
  onChangeSealStyle: (style: SealStyle) => void;
  colophonText: string;
  onChangeColophonText: (text: string) => void;
  isLoading: boolean;
}

const STYLE_OPTIONS: { id: BrushStyleMode; title: string; subtitle: string }[] = [
  { id: 'kaiti', title: '兼毫正楷', subtitle: '提按分明 · 浓墨中锋' },
  { id: 'xingshu', title: '兰亭行意', subtitle: '牵丝映带 · 气脉流转' },
  { id: 'feibai', title: '飞白枯笔', subtitle: '万毫齐力 · 苍劲飞白' },
  { id: 'rubbing', title: '金石碑拓', subtitle: '乌金拓本 · 刀笔古意' },
];

const GRID_OPTIONS: { id: GridType; label: string }[] = [
  { id: 'mizi', label: '米字格' },
  { id: 'jiugong', label: '九宫格' },
  { id: 'huigong', label: '回宫格' },
  { id: 'wusi', label: '乌丝栏' },
  { id: 'blank', label: '素笺' },
];

export const StudioControlRail: React.FC<StudioControlRailProps> = ({
  currentPhrase,
  activePreset,
  onSubmitPhrase,
  config,
  onChangeConfig,
  gridType,
  onChangeGridType,
  sealText,
  onChangeSealText,
  sealStyle,
  onChangeSealStyle,
  colophonText,
  onChangeColophonText,
  isLoading,
}) => {
  const [inputVal, setInputVal] = useState(currentPhrase);

  useEffect(() => {
    setInputVal(currentPhrase);
  }, [currentPhrase]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputVal.trim();
    if (!cleaned) return;
    const matchedPreset = ANTHOLOGY_PRESETS.find((p) => p.phrase === cleaned);
    onSubmitPhrase(cleaned, matchedPreset);
  };

  return (
    <aside className="control-rail-panel">
      {/* Section I: Phrase Input & Classical Anthology */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="section-index">I</span>
          <h2>命题挥毫 · PHRASE COMPOSER</h2>
        </div>

        <form onSubmit={handleFormSubmit} className="phrase-input-form">
          <label htmlFor="shufa-phrase-input" className="field-label">
            输入任意汉字词句（支持简繁 9,500+ 字库）
          </label>
          <div className="sharp-input-group">
            <input
              id="shufa-phrase-input"
              type="text"
              value={inputVal}
              maxLength={16}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="输入词句，如：永和九年、道法自然..."
              className="sharp-line-input"
            />
            <button type="submit" className="sharp-submit-btn" disabled={isLoading}>
              {isLoading ? '研墨中...' : '挥毫演练'}
            </button>
          </div>
        </form>

        {/* Classical Anthology Presets */}
        <div className="anthology-subhead">
          <span>传世名帖与雅言 · ANTHOLOGY</span>
        </div>
        <div className="anthology-grid">
          {ANTHOLOGY_PRESETS.map((preset) => {
            const isActive = currentPhrase === preset.phrase;
            return (
              <button
                key={preset.id}
                type="button"
                className={`anthology-chip ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setInputVal(preset.phrase);
                  onSubmitPhrase(preset.phrase, preset);
                }}
              >
                <span className="chip-phrase">{preset.phrase}</span>
                <span className="chip-source">{preset.titleZh.split('·')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Historical & Calligraphic Note for Current Preset */}
        {activePreset && (
          <div className="anthology-context-box">
            <div className="context-header">
              <span className="context-source">{activePreset.sourceZh}</span>
              <span className="context-era">{activePreset.authorEra}</span>
            </div>
            <p className="context-note">{activePreset.calligraphyNote}</p>
            <p className="context-en">{activePreset.translationEn}</p>
          </div>
        )}
      </div>

      {/* Section II: Brush & Ink Physics */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="section-index">II</span>
          <h2>书体与笔墨物理 · BRUSH & INK</h2>
        </div>

        {/* 4 Script Modes */}
        <div className="script-mode-grid" role="radiogroup" aria-label="书体与笔意模式">
          {STYLE_OPTIONS.map((opt) => {
            const isSelected = config.style === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`script-mode-card ${isSelected ? 'active' : ''}`}
                onClick={() =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    style: opt.id,
                    showQiansi: opt.id === 'xingshu' ? true : prev.showQiansi,
                  }))
                }
              >
                <span className="mode-title">{opt.title}</span>
                <span className="mode-sub">{opt.subtitle}</span>
              </button>
            );
          })}
        </div>

        {/* Sliders: Speed, Ink Wetness, Feibai */}
        <div className="slider-stack">
          <div className="slider-row">
            <div className="slider-label-line">
              <span>运笔疾徐 · VELOCITY</span>
              <span className="mono-val">{config.speed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.05"
              value={config.speed}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, speed: parseFloat(e.target.value) }))
              }
              className="sharp-slider"
            />
          </div>

          <div className="slider-row">
            <div className="slider-label-line">
              <span>墨色浓润 · INK WETNESS</span>
              <span className="mono-val">{Math.round(config.inkWetness * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={config.inkWetness}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  inkWetness: parseFloat(e.target.value),
                }))
              }
              className="sharp-slider"
            />
          </div>

          <div className="slider-row">
            <div className="slider-label-line">
              <span>飞白枯涩 · FEIBAI BRISTLE</span>
              <span className="mono-val">{Math.round(config.feibaiIntensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={config.feibaiIntensity}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  feibaiIntensity: parseFloat(e.target.value),
                }))
              }
              className="sharp-slider"
            />
          </div>
        </div>

        {/* Traditional Grid Selector */}
        <div className="sub-control-block">
          <span className="field-label">格线制式 · PAPER GRID</span>
          <div className="grid-type-row">
            {GRID_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`grid-type-btn ${gridType === g.id ? 'active' : ''}`}
                onClick={() => onChangeGridType(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calligraphic Layer Toggles */}
        <div className="sub-control-block">
          <span className="field-label">笔意剖析图层 · STUDY OVERLAYS</span>
          <div className="toggle-matrix">
            <label className="sharp-checkbox">
              <input
                type="checkbox"
                checked={config.showMedianSpine}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, showMedianSpine: e.target.checked }))
                }
              />
              <span>八法中锋线 (起收笔径)</span>
            </label>

            <label className="sharp-checkbox">
              <input
                type="checkbox"
                checked={config.showQiansi}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, showQiansi: e.target.checked }))
                }
              />
              <span>行书游丝牵丝 (气脉)</span>
            </label>

            <label className="sharp-checkbox">
              <input
                type="checkbox"
                checked={config.highlightRadical}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, highlightRadical: e.target.checked }))
                }
              />
              <span>部首朱砂批注 (字源)</span>
            </label>

            <label className="sharp-checkbox">
              <input
                type="checkbox"
                checked={config.showGhostOutline}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, showGhostOutline: e.target.checked }))
                }
              />
              <span>底字双钩淡影 (间架)</span>
            </label>

            <label className="sharp-checkbox">
              <input
                type="checkbox"
                checked={config.showBrushCursor}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, showBrushCursor: e.target.checked }))
                }
              />
              <span>实时湘妃竹笔锋投影</span>
            </label>
          </div>
        </div>

        {/* Seal & Colophon Customizer */}
        <div className="sub-control-block seal-customizer">
          <span className="field-label">铃印与落款 · SEAL & COLOPHON</span>
          <div className="seal-config-row">
            <input
              type="text"
              maxLength={4}
              value={sealText}
              onChange={(e) => onChangeSealText(e.target.value)}
              placeholder="印文(2-4字)"
              className="seal-input"
              aria-label="印章文字"
            />
            <div className="seal-style-switch">
              <button
                type="button"
                className={sealStyle === 'baiwen' ? 'active' : ''}
                onClick={() => onChangeSealStyle('baiwen')}
              >
                白文阴刻
              </button>
              <button
                type="button"
                className={sealStyle === 'zhuwen' ? 'active' : ''}
                onClick={() => onChangeSealStyle('zhuwen')}
              >
                朱文阳刻
              </button>
            </div>
          </div>
          <input
            type="text"
            maxLength={14}
            value={colophonText}
            onChange={(e) => onChangeColophonText(e.target.value)}
            placeholder="落款，如：丙午年墨韵书"
            className="colophon-input"
            aria-label="落款题字"
          />
        </div>
      </div>
    </aside>
  );
};
