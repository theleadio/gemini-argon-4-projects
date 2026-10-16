import { pinyin } from 'pinyin-pro';
import { SEED_HANZI_CACHE } from '../data/anthology';
import type { CharacterSpecimen, HanziRawData, StrokeAnatomy, YongEightCode } from '../types/shufa';

const memoryCache = new Map<string, HanziRawData>(
  Object.entries(SEED_HANZI_CACHE)
);

/**
 * Transform hanzi-writer-data SVG path string from (x, y_up) to standard (x, 900 - y_up)
 * in a 1024x1024 coordinate system.
 */
export function transformSvgPathYDown(pathStr: string): string {
  const tokens = pathStr.trim().split(/\s+/);
  const out: string[] = [];
  let coordIndex = 0;

  for (const token of tokens) {
    if (/^[A-Za-z]$/.test(token)) {
      out.push(token);
      coordIndex = 0;
    } else {
      const val = parseFloat(token);
      if (!Number.isNaN(val)) {
        if (coordIndex % 2 === 1) {
          out.push(String(Math.round((900 - val) * 10) / 10));
        } else {
          out.push(String(Math.round(val * 10) / 10));
        }
        coordIndex++;
      } else {
        out.push(token);
      }
    }
  }
  return out.join(' ');
}

/**
 * Transform raw median points [[x, y_up], ...] into canvas Y-down [[x, 900 - y_up], ...]
 */
export function transformMedianYDown(median: number[][]): number[][] {
  return median.map(([x, y]) => [x, 900 - y]);
}

function normalizeAngleDeg(deg: number): number {
  let a = deg;
  while (a <= -180) a += 360;
  while (a > 180) a -= 360;
  return a;
}

/**
 * Classify a stroke's median trajectory (in Y-down 1024x1024 space) into
 * its traditional Chinese Shufa stroke anatomy & Eight Principles of Yong (永字八法).
 */
export function analyzeStrokeAnatomy(
  pts: number[][],
  index: number,
  isRadical: boolean
): StrokeAnatomy {
  if (!pts || pts.length < 2) {
    return {
      index,
      code: 'dian',
      nameZh: '点',
      yongPrinciple: '侧 (Cè)',
      pinyin: 'diǎn',
      technique: '空中落笔，顿笔蓄势，回锋收笔',
      arcLength: 100,
      angleDeg: 45,
      turnCount: 0,
      isRadical,
      startPoint: [512, 512],
      endPoint: [540, 540],
    };
  }

  let totalLen = 0;
  const segLengths: number[] = [];
  const segAngles: number[] = [];

  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    totalLen += len;
    segAngles.push((Math.atan2(dy, dx) * 180) / Math.PI);
  }

  const startPt: [number, number] = [pts[0][0], pts[0][1]];
  const endPt: [number, number] = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  const overallDx = endPt[0] - startPt[0];
  const overallDy = endPt[1] - startPt[1];
  const overallAngle = (Math.atan2(overallDy, overallDx) * 180) / Math.PI;

  // Detect major mid-stroke turns & terminal hooks
  let turnCount = 0;
  let hasTerminalHook = false;
  let accumLen = 0;

  const firstAngle = segAngles[0] ?? overallAngle;
  const lastAngle = segAngles[segAngles.length - 1] ?? overallAngle;

  for (let i = 1; i < segAngles.length; i++) {
    accumLen += segLengths[i - 1];
    const diff = Math.abs(normalizeAngleDeg(segAngles[i] - segAngles[i - 1]));
    const progress = totalLen > 0 ? accumLen / totalLen : 0;

    if (diff > 44) {
      if (progress > 0.72 && totalLen - accumLen < 210) {
        hasTerminalHook = true;
      } else if (progress > 0.12 && progress <= 0.78) {
        turnCount++;
      }
    }
  }

  // Also check if the last segment sharply hooks upward or leftward compared to mid-stroke
  if (pts.length >= 3 && totalLen > 240) {
    const midIdx = Math.max(0, pts.length - 3);
    const preDx = pts[midIdx][0] - startPt[0];
    const preDy = pts[midIdx][1] - startPt[1];
    const tailDx = endPt[0] - pts[midIdx][0];
    const tailDy = endPt[1] - pts[midIdx][1];
    const tailLen = Math.hypot(tailDx, tailDy);
    if (tailLen > 18 && tailLen < 210) {
      const preAng = (Math.atan2(preDy, preDx) * 180) / Math.PI;
      const tailAng = (Math.atan2(tailDy, tailDx) * 180) / Math.PI;
      const hookDiff = Math.abs(normalizeAngleDeg(tailAng - preAng));
      if (hookDiff > 62 && tailDy < 25) {
        hasTerminalHook = true;
      }
    }
  }

  let code: YongEightCode = 'heng';
  let nameZh = '横';
  let yongPrinciple = '勒 (Lè)';
  let strokePinyin = 'héng';
  let technique = '逆锋起笔，中锋右行，顿笔回锋';

  if (hasTerminalHook) {
    code = 'gou';
    yongPrinciple = '趯 (Tì)';
    strokePinyin = 'gōu';
    if (firstAngle > -30 && firstAngle < 35 && turnCount >= 1) {
      nameZh = '横折钩';
      strokePinyin = 'héng zhé gōu';
      technique = '横画右行，折角顿笔下行，末锋蓄力左趯出钩';
    } else if (lastAngle > -115 && lastAngle < -40 && overallDx > 80) {
      nameZh = totalLen > 520 ? '竖弯钩 / 斜钩' : '弯钩';
      strokePinyin = 'wān gōu';
      technique = '中锋下行转圆弧舒展，至末顿笔向上猛趯出锋';
    } else {
      nameZh = '竖钩';
      strokePinyin = 'shù gōu';
      technique = '藏锋竖下，行至末端驻笔蓄势，向左上方趯出锋颖';
    }
  } else if (turnCount >= 1) {
    code = 'zhe';
    yongPrinciple = '折 (Zhé)';
    strokePinyin = 'zhé';
    if (firstAngle >= -35 && firstAngle <= 35) {
      if (lastAngle > 110 && lastAngle <= 175) {
        nameZh = '横撇';
        strokePinyin = 'héng piě';
        technique = '横画平稳右行，转折处提按换锋，向左下掠出';
      } else {
        nameZh = '横折';
        strokePinyin = 'héng zhé';
        technique = '横末提笔暗顿，折锋向下垂直中锋行笔';
      }
    } else if (firstAngle > 55 && firstAngle < 120) {
      nameZh = '竖折 / 竖提';
      strokePinyin = 'shù zhé';
      technique = '竖画下行至折处顿笔换向，转锋向右舒展';
    } else {
      nameZh = '撇折 / 撇点';
      strokePinyin = 'piě zhé';
      technique = '自右上向左下撇出，至转折处驻笔换锋再行';
    }
  } else {
    // Continuous single-direction stroke
    if (totalLen < 215 && overallDy > 10) {
      code = 'dian';
      nameZh = overallDx >= 0 ? '右点' : '左点';
      yongPrinciple = '侧 (Cè)';
      strokePinyin = 'diǎn';
      technique = '凌空取势侧锋落笔，向右下顿笔铺毫，回锋收聚';
    } else if (overallAngle >= -78 && overallAngle < -14) {
      code = 'ti';
      nameZh = '提';
      yongPrinciple = '策 (Cè)';
      strokePinyin = 'tí';
      technique = '重按起笔，随即向右上疾策渐提，锋从中出';
    } else if (overallAngle >= -14 && overallAngle <= 20) {
      code = 'heng';
      nameZh = totalLen > 460 ? '长横' : '短横';
      yongPrinciple = '勒 (Lè)';
      strokePinyin = 'héng';
      technique = '逆锋起笔，略向右上取抗肩之势，末端顿笔回锋';
    } else if (overallAngle > 70 && overallAngle <= 108) {
      code = 'shu';
      nameZh = totalLen > 450 ? '垂露竖' : '短竖';
      yongPrinciple = '努 (Nǔ)';
      strokePinyin = 'shù';
      technique = '藏锋起笔，中锋劲挺下行如引弓蓄力，垂露收笔';
    } else if (overallAngle > 108 || overallAngle < -145) {
      code = 'pie';
      nameZh = totalLen > 310 ? '长撇' : '短撇';
      yongPrinciple = totalLen > 310 ? '掠 (Lüè)' : '啄 (Zhuó)';
      strokePinyin = 'piě';
      technique = '顿笔起势，中锋向左下匀畅撇出，末锋轻灵送出';
    } else if (overallAngle > 20 && overallAngle <= 70) {
      if (totalLen > 235) {
        code = 'na';
        nameZh = overallDx > overallDy * 1.45 ? '平捺' : '斜捺';
        yongPrinciple = '磔 (Zhé)';
        strokePinyin = 'nà';
        technique = '轻落渐按，向右下徐行至捺脚驻笔铺毫，平出捺锋';
      } else {
        code = 'dian';
        nameZh = '长点';
        yongPrinciple = '侧 (Cè)';
        strokePinyin = 'diǎn';
        technique = '轻入重按，向右下沉稳顿笔，藏锋敛颖而收';
      }
    }
  }

  return {
    index,
    code,
    nameZh,
    yongPrinciple,
    pinyin: strokePinyin,
    technique,
    arcLength: Math.round(totalLen),
    angleDeg: Math.round(overallAngle),
    turnCount,
    isRadical,
    startPoint: startPt,
    endPoint: endPt,
  };
}

/**
 * Fallback procedural stroke generator if a rare character is outside the 9,574 dictionary.
 */
function buildFallbackCharacterData(): HanziRawData {
  return {
    strokes: [
      'M 220 720 Q 512 745 804 730 Q 825 725 815 705 Q 512 695 220 695 Z',
      'M 495 720 Q 495 450 495 160 Q 512 140 530 160 Q 530 450 530 720 Z',
      'M 280 480 Q 512 505 744 490 Q 765 485 755 465 Q 512 455 280 455 Z',
      'M 160 170 Q 512 195 864 180 Q 885 175 875 155 Q 512 145 160 145 Z',
    ],
    medians: [
      [[225, 710], [512, 718], [805, 715]],
      [[512, 710], [512, 450], [512, 160]],
      [[285, 470], [512, 478], [745, 475]],
      [[165, 160], [512, 168], [865, 165]],
    ],
    radStrokes: [0],
  };
}

export async function loadRawHanziData(char: string): Promise<{ data: HanziRawData; isFallback: boolean }> {
  const cached = memoryCache.get(char);
  if (cached) {
    return { data: cached, isFallback: false };
  }

  // 1. Try local Vite middleware endpoint (/hanzi-data/<char>.json)
  try {
    const localRes = await fetch(`/hanzi-data/${encodeURIComponent(char)}.json`);
    if (localRes.ok) {
      const json = (await localRes.json()) as HanziRawData;
      if (json && Array.isArray(json.strokes) && Array.isArray(json.medians)) {
        memoryCache.set(char, json);
        return { data: json, isFallback: false };
      }
    }
  } catch {
    // Fall through to CDN
  }

  // 2. Try jsDelivr CDN fallback
  try {
    const cdnRes = await fetch(
      `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`
    );
    if (cdnRes.ok) {
      const json = (await cdnRes.json()) as HanziRawData;
      if (json && Array.isArray(json.strokes) && Array.isArray(json.medians)) {
        memoryCache.set(char, json);
        return { data: json, isFallback: false };
      }
    }
  } catch {
    // Fall through to procedural fallback
  }

  return { data: buildFallbackCharacterData(), isFallback: true };
}

export async function loadPhraseSpecimens(phrase: string): Promise<CharacterSpecimen[]> {
  // Filter to keep meaningful characters (prefer CJK unified ideographs, max 16 chars)
  const cleanChars = Array.from(phrase.trim())
    .filter((ch) => /\S/.test(ch) && !/[，。！？、；：“”‘’（）《》,.!?;:"'()\[\]]/.test(ch))
    .slice(0, 16);

  if (cleanChars.length === 0) {
    return [];
  }

  const pyWithTone = pinyin(cleanChars.join(''), { type: 'array' });
  const pyToneNum = pinyin(cleanChars.join(''), { toneType: 'num', type: 'array' });

  const results = await Promise.all(
    cleanChars.map(async (char, idx) => {
      const { data, isFallback } = await loadRawHanziData(char);
      const strokesYDown = data.strokes.map(transformSvgPathYDown);
      const mediansYDown = data.medians.map(transformMedianYDown);
      const radSet = new Set(data.radStrokes ?? []);

      const anatomies = mediansYDown.map((med, sIdx) =>
        analyzeStrokeAnatomy(med, sIdx, radSet.has(sIdx))
      );

      return {
        char,
        indexInPhrase: idx,
        pinyin: pyWithTone[idx] || char,
        pinyinToneNum: pyToneNum[idx] || '',
        strokeCount: strokesYDown.length,
        strokes: strokesYDown,
        medians: mediansYDown,
        radStrokes: data.radStrokes ?? [],
        anatomies,
        isFallback,
      } satisfies CharacterSpecimen;
    })
  );

  return results;
}
