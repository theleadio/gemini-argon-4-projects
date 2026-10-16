import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Volume2, VolumeX, Download, Sparkles } from 'lucide-react';
import { ANTHOLOGY_PRESETS } from './data/anthology';
import { loadPhraseSpecimens } from './utils/hanziLoader';
import { soundEngine } from './utils/soundEngine';
import { StudioControlRail } from './components/StudioControlRail';
import { ScrollCanvasStage, type ActivePlaybackPosition } from './components/ScrollCanvasStage';
import { StrokeAnatomyInspector } from './components/StrokeAnatomyInspector';
import { TimelineScrubberBar, type TimelineSegment } from './components/TimelineScrubberBar';
import type {
  AnthologyEntry,
  BrushPhysicsConfig,
  CharacterSpecimen,
  GridType,
  ScrollLayoutMode,
  SealStyle,
} from './types/shufa';
import './App.css';

export function App() {
  const defaultPreset = ANTHOLOGY_PRESETS[0]; // 永和九年
  const [currentPhrase, setCurrentPhrase] = useState<string>(defaultPreset.phrase);
  const [activePreset, setActivePreset] = useState<AnthologyEntry | null>(defaultPreset);
  const [specimens, setSpecimens] = useState<CharacterSpecimen[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [config, setConfig] = useState<BrushPhysicsConfig>({
    style: 'xingshu',
    speed: 1.0,
    inkWetness: 0.75,
    feibaiIntensity: 0.45,
    showQiansi: true,
    showGhostOutline: true,
    showMedianSpine: false,
    highlightRadical: false,
    showBrushCursor: true,
    pauseBetweenChars: 140,
  });

  const [gridType, setGridType] = useState<GridType>('mizi');
  const [layoutMode, setLayoutMode] = useState<ScrollLayoutMode>('horizontal-rtl');
  const [sealText, setSealText] = useState<string>(defaultPreset.sealText);
  const [sealStyle, setSealStyle] = useState<SealStyle>('baiwen');
  const [colophonText, setColophonText] = useState<string>('丙午年春月墨韵书');

  const [selectedCharIdx, setSelectedCharIdx] = useState<number>(0);
  const [hoveredStrokeIdx, setHoveredStrokeIdx] = useState<number | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);

  // Playback state
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const canvasExportRef = useRef<HTMLCanvasElement | null>(null);
  const lastSoundStrokeRef = useRef<number>(-1);
  const lastSoundCharDoneRef = useRef<number>(-1);

  // Load phrase characters whenever currentPhrase changes
  const handleLoadPhrase = useCallback(async (phrase: string, preset?: AnthologyEntry) => {
    setIsLoading(true);
    try {
      const loaded = await loadPhraseSpecimens(phrase);
      if (loaded.length > 0) {
        setSpecimens(loaded);
        setCurrentPhrase(loaded.map((c) => c.char).join(''));
        setActivePreset(preset || null);
        if (preset) {
          setSealText(preset.sealText);
          setLayoutMode(preset.recommendedLayout);
          setConfig((prev) => ({
            ...prev,
            style: preset.recommendedStyle,
            showQiansi: preset.recommendedStyle === 'xingshu',
          }));
        }
        setSelectedCharIdx(0);
        setCurrentTimeMs(0);
        setIsPracticeMode(false);
        setIsPlaying(true);
        lastSoundStrokeRef.current = -1;
        lastSoundCharDoneRef.current = -1;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPhrase = params.get('phrase');
    const qStyle = params.get('style') as BrushPhysicsConfig['style'] | null;
    const qLayout = params.get('layout') as ScrollLayoutMode | null;
    const qVectors = params.get('vectors');

    if (qPhrase) {
      const matched = ANTHOLOGY_PRESETS.find((p) => p.phrase === qPhrase);
      handleLoadPhrase(qPhrase, matched).then(() => {
        if (qStyle && ['kaiti', 'xingshu', 'feibai', 'rubbing'].includes(qStyle)) {
          setConfig((prev) => ({ ...prev, style: qStyle }));
        }
        if (
          qLayout &&
          ['horizontal-rtl', 'horizontal-ltr', 'vertical-rtl', 'single-study'].includes(qLayout)
        ) {
          setLayoutMode(qLayout);
        }
        if (qVectors === '1') {
          setConfig((prev) => ({ ...prev, showMedianSpine: true }));
        }
      });
    } else {
      handleLoadPhrase(defaultPreset.phrase, defaultPreset);
    }
  }, [defaultPreset, handleLoadPhrase]);

  // Build synchronized timeline segments across all characters & strokes
  const { segments, totalDurationMs } = useMemo(() => {
    const segs: TimelineSegment[] = [];
    let cursorMs = 0;
    let gIdx = 0;

    specimens.forEach((sp, cIdx) => {
      sp.anatomies.forEach((anat, sIdx) => {
        const dur = Math.round(Math.max(280, Math.min(780, 190 + anat.arcLength * 0.56)));
        segs.push({
          globalStrokeIdx: gIdx,
          charIdx: cIdx,
          strokeIdx: sIdx,
          char: sp.char,
          strokeNameZh: anat.nameZh,
          startTimeMs: cursorMs,
          durationMs: dur,
        });
        cursorMs += dur;
        gIdx++;
      });
      // Subtle breathing pause between characters
      if (cIdx < specimens.length - 1 && segs.length > 0) {
        segs[segs.length - 1].durationMs += 110;
        cursorMs += 110;
      }
    });

    return { segments: segs, totalDurationMs: Math.max(1, cursorMs) };
  }, [specimens]);

  // Compute current active character, stroke, and fractional progress from currentTimeMs
  const playbackPos: ActivePlaybackPosition = useMemo(() => {
    if (segments.length === 0) {
      return { charIdx: 0, strokeIdx: 0, strokeProgress: 0, isFinished: false };
    }
    if (currentTimeMs >= totalDurationMs) {
      const last = segments[segments.length - 1];
      return {
        charIdx: last.charIdx,
        strokeIdx: last.strokeIdx,
        strokeProgress: 1,
        isFinished: true,
      };
    }

    for (const seg of segments) {
      const end = seg.startTimeMs + seg.durationMs;
      if (currentTimeMs >= seg.startTimeMs && currentTimeMs < end) {
        const prog = Math.max(0, Math.min(1, (currentTimeMs - seg.startTimeMs) / seg.durationMs));
        return {
          charIdx: seg.charIdx,
          strokeIdx: seg.strokeIdx,
          strokeProgress: prog,
          isFinished: false,
        };
      }
    }

    const first = segments[0];
    return {
      charIdx: first.charIdx,
      strokeIdx: first.strokeIdx,
      strokeProgress: 0,
      isFinished: false,
    };
  }, [segments, currentTimeMs, totalDurationMs]);

  // Keep selectedCharIdx synced with playback when playing in multi-character scroll mode
  useEffect(() => {
    if (isPlaying && !playbackPos.isFinished && layoutMode !== 'single-study' && !isPracticeMode) {
      setSelectedCharIdx(playbackPos.charIdx);
    }
  }, [isPlaying, playbackPos.charIdx, playbackPos.isFinished, layoutMode, isPracticeMode]);

  // Trigger optional brush & Guqin sounds during playback
  useEffect(() => {
    if (!isPlaying || !soundEnabled || segments.length === 0) return;

    const activeSeg = segments.find(
      (s) => s.charIdx === playbackPos.charIdx && s.strokeIdx === playbackPos.strokeIdx
    );

    if (activeSeg && activeSeg.globalStrokeIdx !== lastSoundStrokeRef.current && !playbackPos.isFinished) {
      lastSoundStrokeRef.current = activeSeg.globalStrokeIdx;
      soundEngine.playStrokeBrush(activeSeg.durationMs / config.speed, 0.9 + (activeSeg.strokeIdx % 4) * 0.08);
    }

    if (playbackPos.isFinished && lastSoundCharDoneRef.current !== 9999) {
      lastSoundCharDoneRef.current = 9999;
      soundEngine.playCharacterComplete(specimens.length - 1);
      soundEngine.playSealStamp();
    }
  }, [isPlaying, soundEnabled, playbackPos, segments, config.speed, specimens.length]);

  // 60fps requestAnimationFrame Loop
  useEffect(() => {
    if (!isPlaying || isPracticeMode || segments.length === 0) return;

    let rafId = 0;
    let lastTs: number | null = null;

    const tick = (now: number) => {
      if (lastTs === null) {
        lastTs = now;
      }
      const dt = Math.max(0, Math.min(64, now - lastTs));
      lastTs = now;

      setCurrentTimeMs((prev) => {
        const next = prev + dt * config.speed;
        if (next >= totalDurationMs) {
          if (isLooping) {
            lastSoundStrokeRef.current = -1;
            lastSoundCharDoneRef.current = -1;
            return 0;
          }
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isPracticeMode, segments.length, config.speed, totalDurationMs, isLooping]);

  // Jump to specific character & stroke
  const handleJumpToStroke = useCallback(
    (charIdx: number, strokeIdx: number) => {
      setSelectedCharIdx(charIdx);
      const targetSeg = segments.find(
        (s) => s.charIdx === charIdx && s.strokeIdx === strokeIdx
      );
      if (targetSeg) {
        setCurrentTimeMs(targetSeg.startTimeMs + 1);
        setIsPracticeMode(false);
        setIsPlaying(true);
      }
    },
    [segments]
  );

  // Step forward/backward by 1 stroke
  const handleStepStroke = useCallback(
    (delta: number) => {
      if (segments.length === 0) return;
      setIsPlaying(false);
      const currIdx = segments.findIndex(
        (s) => s.charIdx === playbackPos.charIdx && s.strokeIdx === playbackPos.strokeIdx
      );
      const targetIdx = Math.max(0, Math.min(segments.length - 1, (currIdx === -1 ? 0 : currIdx) + delta));
      const targetSeg = segments[targetIdx];
      if (targetSeg) {
        setSelectedCharIdx(targetSeg.charIdx);
        setCurrentTimeMs(targetSeg.startTimeMs + targetSeg.durationMs * 0.99);
      }
    },
    [segments, playbackPos.charIdx, playbackPos.strokeIdx]
  );

  const handleTogglePlay = useCallback(() => {
    setIsPracticeMode(false);
    if (currentTimeMs >= totalDurationMs - 20) {
      lastSoundStrokeRef.current = -1;
      lastSoundCharDoneRef.current = -1;
      setCurrentTimeMs(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [currentTimeMs, totalDurationMs]);

  const handleRestart = useCallback(() => {
    setIsPracticeMode(false);
    lastSoundStrokeRef.current = -1;
    lastSoundCharDoneRef.current = -1;
    setCurrentTimeMs(0);
    setSelectedCharIdx(0);
    setIsPlaying(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '[') {
        e.preventDefault();
        handleStepStroke(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        handleStepStroke(1);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleStepStroke, handleRestart]);

  // Export PNG Scroll
  const handleExportPng = () => {
    const canvas = canvasExportRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `moyun-shufa-${currentPhrase}.png`;
    a.click();
  };

  return (
    <div className="shufa-studio-shell">
      {/* Top Architectural Monograph Header */}
      <header className="studio-top-header">
        <div className="brand-identity">
          <div className="brand-seal-mark" aria-hidden="true">
            墨韵
          </div>
          <div className="brand-title-stack">
            <div className="brand-title-row">
              <h1>墨韵 · MOYUN SHUFA</h1>
              <span className="edition-tag">文房笔意与永字八法研习馆</span>
            </div>
            <p className="brand-subtitle">
              CHINESE CALLIGRAPHY STROKE &amp; BRUSH DYNAMICS STUDIO · ARCHIVAL EDITION
            </p>
          </div>
        </div>

        {/* Active Phrase Specimen Banner in Center Header */}
        <div className="header-phrase-readout">
          <span className="readout-label">当前命题 PHRASE</span>
          <span className="readout-chars">{currentPhrase}</span>
          <span className="readout-pinyin">
            {specimens.map((s) => s.pinyin).join(' ')}
          </span>
        </div>

        {/* Right Utility Actions */}
        <div className="header-utility-actions">
          <button
            type="button"
            className={`utility-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundEngine.setEnabled(next);
            }}
            title="开启/关闭古琴与宣纸运笔音效"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? '琴韵开启' : '静音研习'}</span>
          </button>

          <button
            type="button"
            className="utility-btn"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                showMedianSpine: !prev.showMedianSpine,
              }))
            }
            title="切换永字八法中锋运笔轨迹线"
          >
            <Sparkles size={14} />
            <span>{config.showMedianSpine ? '隐藏笔路' : '八法笔路'}</span>
          </button>

          <button
            type="button"
            className="utility-btn primary-action"
            onClick={handleExportPng}
            title="导出高清宣纸书法作品 PNG"
          >
            <Download size={14} />
            <span>导出作品</span>
          </button>
        </div>
      </header>

      {/* Main Three-Column Architectural Studio Grid */}
      <main className="studio-main-grid">
        <StudioControlRail
          currentPhrase={currentPhrase}
          activePreset={activePreset}
          onSubmitPhrase={handleLoadPhrase}
          config={config}
          onChangeConfig={setConfig}
          gridType={gridType}
          onChangeGridType={setGridType}
          sealText={sealText}
          onChangeSealText={setSealText}
          sealStyle={sealStyle}
          onChangeSealStyle={setSealStyle}
          colophonText={colophonText}
          onChangeColophonText={setColophonText}
          isLoading={isLoading}
        />

        <ScrollCanvasStage
          specimens={specimens}
          playbackPos={playbackPos}
          selectedCharIdx={selectedCharIdx}
          hoveredStrokeIdx={hoveredStrokeIdx}
          onSelectChar={(idx) => {
            setSelectedCharIdx(idx);
          }}
          config={config}
          gridType={gridType}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
          sealText={sealText}
          sealStyle={sealStyle}
          colophonText={colophonText}
          isPracticeMode={isPracticeMode}
          onTogglePracticeMode={(val) => {
            setIsPracticeMode(val);
            if (val) setIsPlaying(false);
          }}
          canvasRefOut={canvasExportRef}
        />

        <StrokeAnatomyInspector
          specimens={specimens}
          selectedCharIdx={selectedCharIdx}
          activeCharIdx={playbackPos.charIdx}
          activeStrokeIdx={playbackPos.strokeIdx}
          isFinished={playbackPos.isFinished}
          hoveredStrokeIdx={hoveredStrokeIdx}
          onSelectChar={(idx) => {
            setSelectedCharIdx(idx);
          }}
          onJumpToStroke={handleJumpToStroke}
          onHoverStroke={setHoveredStrokeIdx}
        />
      </main>

      {/* Bottom Synchronized Multi-Character & Stroke Timeline Scrubber */}
      <TimelineScrubberBar
        specimens={specimens}
        segments={segments}
        totalDurationMs={totalDurationMs}
        currentTimeMs={currentTimeMs}
        isPlaying={isPlaying}
        isLooping={isLooping}
        activeCharIdx={playbackPos.charIdx}
        activeStrokeIdx={playbackPos.strokeIdx}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        onStepStroke={handleStepStroke}
        onScrubTime={(timeMs) => {
          setIsPracticeMode(false);
          setIsPlaying(false);
          setCurrentTimeMs(timeMs);
        }}
        onToggleLoop={() => setIsLooping((l) => !l)}
        onJumpToStroke={handleJumpToStroke}
      />
    </div>
  );
}

export default App;
