export interface HanziRawData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

export type YongEightCode =
  | 'dian'     // 点 · 侧 (Dot)
  | 'heng'     // 横 · 勒 (Horizontal)
  | 'shu'      // 竖 · 努 (Vertical)
  | 'pie'      // 撇 · 掠 (Left-falling sweep)
  | 'na'       // 捺 · 磔 (Right-falling wave)
  | 'ti'       // 提 · 策 (Rising flick)
  | 'zhe'      // 折 · 折笔 (Folded turn)
  | 'gou';     // 钩 · 趯 (Hooked release)

export interface StrokeAnatomy {
  index: number;
  code: YongEightCode;
  nameZh: string;          // e.g. "横折钩" or "長橫"
  yongPrinciple: string;   // e.g. "勒 (Lè)" from 永字八法
  pinyin: string;          // e.g. "héng"
  technique: string;       // e.g. "逆锋起笔，中锋行笔，回锋收笔"
  arcLength: number;       // in 1024-space units
  angleDeg: number;        // primary vector angle in degrees
  turnCount: number;       // number of sharp inflection points
  isRadical: boolean;      // belongs to character's radical
  startPoint: [number, number]; // canvas normalized [0..1024, 0..1024]
  endPoint: [number, number];
}

export interface CharacterSpecimen {
  char: string;
  indexInPhrase: number;
  pinyin: string;
  pinyinToneNum: string;
  strokeCount: number;
  strokes: string[];
  medians: number[][][];     // already transformed to canvas Y-down (x, 900 - y)
  radStrokes: number[];
  anatomies: StrokeAnatomy[];
  isFallback?: boolean;
}

export type BrushStyleMode =
  | 'kaiti'    // 兼毫正楷 · Standard Kai (Architectural + wet sumi depth)
  | 'xingshu'  // 兰亭行意 · Running Script (Connected qiansi threads + fluid rhythm)
  | 'feibai'   // 飞白枯笔 · Dry Bristle Feibai (Multi-hair separation streaks)
  | 'rubbing'; // 金石碑拓 · Stone Stele Rubbing (White intaglio on weathered charcoal stone)

export type GridType =
  | 'mizi'     // 米字格 · 8-way Cinnabar hairline guide
  | 'jiugong'  // 九宫格 · 3x3 Nine-Palace proportion grid
  | 'huigong'  // 回宫格 · Inner/Outer Zhonggong structural frame
  | 'wusi'     // 乌丝栏 · Traditional handscroll ruled columns
  | 'blank';   // 素笺 · Unruled archival Xuan paper

export type ScrollLayoutMode =
  | 'horizontal-rtl' // 古法横披 (右起) · Classic Horizontal Scroll (Right-to-Left)
  | 'horizontal-ltr' // 现代横幅 (左起) · Modern Horizontal Scroll (Left-to-Right)
  | 'vertical-rtl'   // 中堂条幅 (竖排) · Classic Vertical Scroll Columns
  | 'single-study';  // 单字精临 (八法) · Master Specimen & Interactive Brush Trace

export type SealStyle = 'zhuwen' | 'baiwen';

export interface BrushPhysicsConfig {
  style: BrushStyleMode;
  speed: number;            // 0.25x to 2.5x
  inkWetness: number;       // 0.1 (dry) to 1.0 (rich wet bleed)
  feibaiIntensity: number;  // 0.0 to 1.0 (flying white bristle texture)
  showQiansi: boolean;      // show gossamer connecting threads between strokes
  showGhostOutline: boolean;// show faint watermark of full character before strokes land
  showMedianSpine: boolean; // show red 永字八法 centerline vector & Qibi/Shoubi markers
  highlightRadical: boolean;// render radical strokes in Cinnabar Vermilion (#B8332A)
  showBrushCursor: boolean; // render live angled sumi brush tip during playback
  pauseBetweenChars: number;// ms pause between characters
}

export interface AnthologyEntry {
  id: string;
  phrase: string;
  titleZh: string;
  sourceZh: string;
  authorEra: string;
  pinyin: string;
  translationEn: string;
  calligraphyNote: string;
  recommendedStyle: BrushStyleMode;
  recommendedLayout: ScrollLayoutMode;
  sealText: string;
}
