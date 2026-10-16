/**
 * Argon Atelier — Google Gemini 4 Argon Multimodal Coloring Engine
 *
 * Calls `google/gemini-4-argon` via OpenRouter with:
 * 1) Clean uploaded coloring photo
 * 2) Numbered Region Blueprint map (regions 1..N labeled at their interior Pole of Inaccessibility)
 * 3) Spatial metadata + user style direction / prompt
 *
 * Returns structured coloring assignments, scene palette, artistic notes, and reasoning trace.
 */

import { buildArgonVisionImages } from './segmentation.js';
import { deriveSecondaryHex } from './renderer.js';

export const DEFAULT_OPENROUTER_API_KEY =
  '';

export const ARGON_MODEL_ID = 'google/gemini-4-argon';

export const STYLE_PRESETS = [
  {
    id: 'ghibli-gouache',
    name: 'Ghibli Gouache',
    tag: 'Painterly & Lush',
    swatch: ['#3B7A57', '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B'],
    prompt:
      'Use a lush Studio Ghibli gouache & watercolor palette: sunlit botanical greens, warm terracotta, sky cerulean, creamy highlights, and grounded earthy shadows.',
  },
  {
    id: 'natural-vibrant',
    name: 'Natural Storybook',
    tag: 'Balanced & True',
    swatch: ['#2E86AB', '#F6AE2D', '#F26419', '#558B2F', '#8D5B4C'],
    prompt:
      'Use realistic, vibrant, harmonious natural colors appropriate to each object in the illustration with warm sunlight and rich contrast.',
  },
  {
    id: 'pastel-atelier',
    name: 'Pastel Dreamscape',
    tag: 'Soft & Airy',
    swatch: ['#FFCAD4', '#B8E0D2', '#D6EADF', '#EAC4D5', '#95B8D1'],
    prompt:
      'Use a curated soft pastel storybook palette: dusty rose, mint sage, buttercream yellow, periwinkle sky, and lavender accents.',
  },
  {
    id: 'risograph-pop',
    name: 'Risograph Print',
    tag: 'Bold Editorial',
    swatch: ['#FF4E50', '#FC913A', '#F9D423', '#007991', '#1B263B'],
    prompt:
      'Use a bold editorial Risograph & silkscreen print palette: punchy vermilion, cobalt blue, marigold yellow, teal, and warm cream.',
  },
  {
    id: 'midnight-celestial',
    name: 'Celestial Nocturne',
    tag: 'Luminous Night',
    swatch: ['#1D2D44', '#3E5C76', '#F0C808', '#D96B27', '#748CAB'],
    prompt:
      'Use an enchanting nocturnal celestial palette: deep indigo and twilight teal backgrounds contrasted with glowing amber gold, warm lantern orange, and silver moonlight.',
  },
  {
    id: 'autumn-botanical',
    name: 'Warm Botanical',
    tag: 'Earthy & Rich',
    swatch: ['#863A29', '#E4B357', '#3F593D', '#D98A6C', '#3051A8'],
    prompt:
      'Use an artisanal botanical print palette: deep forest green, harvest gold, terracotta clay, ochre, and indigo accents.',
  },
];

/**
 * Extract JSON object from model response string even if wrapped in markdown fences,
 * missing commas between array elements, or truncated mid-stream.
 */
function parseJsonSafely(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from Gemini 4 Argon');
  }
  const trimmed = text.trim();

  // Strip ```json ... ``` fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const firstBrace = candidate.indexOf('{');
  if (firstBrace !== -1) {
    candidate = candidate.slice(firstBrace);
  }

  // Normalize common LLM JSON quirks:
  // 1) Missing comma between objects in array: `}\s*{` -> `},{`
  // 2) Trailing commas before `]` or `}`
  const normalizeJson = (str) =>
    str
      .replace(/\}\s*\{/g, '},{')
      .replace(/\]\s*\[/g, '],[')
      .replace(/,\s*([}\]])/g, '$1');

  // Attempt 1: Direct parse
  try {
    return JSON.parse(candidate);
  } catch {
    // Attempt 2: Normalized slice to last '}'
    const lastBrace = candidate.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        return JSON.parse(normalizeJson(candidate.slice(0, lastBrace + 1)));
      } catch {
        // continue to Attempt 3
      }
    }
  }

  // Attempt 3: Auto-close truncated JSON array/object (e.g., if max_tokens cut off mid-array)
  try {
    const lastCompleteObj = candidate.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      const prefix = normalizeJson(candidate.slice(0, lastCompleteObj + 1));
      const repaired = `${prefix}]}`;
      return JSON.parse(repaired);
    }
  } catch {
    // continue to Attempt 4
  }

  // Attempt 4: Regex / Object-by-Object extraction fallback (never fails as long as at least 1 region exists)
  const sceneTitleMatch = candidate.match(/"sceneTitle"\s*:\s*"([^"]*)"/);
  const notesMatch = candidate.match(/"artisticNotes"\s*:\s*"([^"]*)"/);
  const paletteMatch = candidate.match(/"palette"\s*:\s*\[([\s\S]*?)\]/);

  const palette = [];
  if (paletteMatch) {
    const hexes = paletteMatch[1].match(/#[0-9a-fA-F]{3,6}/g);
    if (hexes) palette.push(...hexes);
  }

  const regions = [];
  // Match individual region objects `{ ... }` containing `"id"` and `"color"`
  const objRegex = /\{[^{}]*"id"\s*:\s*(\d+)[^{}]*\}/g;
  let match;
  while ((match = objRegex.exec(candidate)) !== null) {
    const rawObj = match[0];
    try {
      regions.push(JSON.parse(normalizeJson(rawObj)));
    } catch {
      const id = Number(match[1]);
      const nameMatch = rawObj.match(/"name"\s*:\s*"([^"]*)"/);
      const colorMatch = rawObj.match(/"color"\s*:\s*"(#[0-9a-fA-F]{3,6})"/);
      const secMatch = rawObj.match(/"secondaryColor"\s*:\s*"(#[0-9a-fA-F]{3,6})"/);
      if (id && colorMatch) {
        regions.push({
          id,
          name: nameMatch ? nameMatch[1] : `Region #${id}`,
          color: colorMatch[1],
          secondaryColor: secMatch ? secMatch[1] : undefined,
        });
      }
    }
  }

  if (regions.length > 0) {
    return {
      sceneTitle: sceneTitleMatch ? sceneTitleMatch[1] : 'Argon Colored Illustration',
      artisticNotes: notesMatch
        ? notesMatch[1]
        : `Colored ${regions.length} regions with Gemini 4 Argon.`,
      palette,
      regions,
    };
  }

  throw new Error('Could not parse JSON coloring plan from Gemini 4 Argon response.');
}

/**
 * Call Google Gemini 4 Argon to generate a full or targeted coloring plan for the segmented coloring page.
 */
export async function generateArgonColoringPlan({
  segmentation,
  stylePresetId = 'ghibli-gouache',
  customPrompt = '',
  targetRegionIds = null,
  existingColorsMap = null,
  apiKey = DEFAULT_OPENROUTER_API_KEY,
  reasoningEffort = 'low',
  completeMicroRegions = true,
  onStatus = () => {},
}) {
  onStatus('Generating numbered region blueprint for Gemini 4 Argon...');
  const { cleanDataUrl, annotatedDataUrl } = buildArgonVisionImages(segmentation);

  const preset =
    STYLE_PRESETS.find((p) => p.id === stylePresetId) || STYLE_PRESETS[0];

  const labeledRegions = segmentation.regions.filter((r) => r.isLabeled);
  const targetSet =
    Array.isArray(targetRegionIds) && targetRegionIds.length > 0
      ? new Set(targetRegionIds)
      : null;

  const regionsToDescribe = targetSet
    ? labeledRegions.filter((r) => targetSet.has(r.id))
    : labeledRegions;

  const regionCatalogLines = regionsToDescribe.map(
    (r) =>
      `#${r.id}: pos=(${r.nx},${r.ny}), area=${r.areaPct}%${
        r.touchesBorder ? ', border/bg' : ''
      }`
  );

  let existingContext = '';
  if (targetSet && existingColorsMap && existingColorsMap.size > 0) {
    const sampleExisting = [];
    for (const [rid, val] of existingColorsMap.entries()) {
      if (!targetSet.has(rid) && sampleExisting.length < 20) {
        sampleExisting.push(`#${rid}=${val.color} (${val.name || 'colored'})`);
      }
    }
    if (sampleExisting.length > 0) {
      existingContext = `\nAlready colored regions for context: ${sampleExisting.join(', ')}`;
    }
  }

  const promptText = `You are Google Gemini 4 Argon, an expert visual artist and illustration colorist.
You are given TWO images of a coloring book page:
- Image 1: The clean black-and-white empty coloring photo.
- Image 2: The same coloring photo with numbered badges [1] to [${labeledRegions.length}] marking each enclosed colorable region at its interior center.

Spatial Region Catalog (normalized x,y in 0..1000):
${regionCatalogLines.join('\n')}${existingContext}

Artistic Direction:
- Style Preset: ${preset.name} — ${preset.prompt}
${customPrompt ? `- User Custom Instruction: "${customPrompt}" (Prioritize this instruction!)` : ''}

Task:
1. Visually inspect Image 1 and Image 2 to identify what every numbered region represents in the drawing (e.g., sky, sun, water, leaves, petals, fur, clothing, roof, background, etc.).
2. Assign a rich, harmonious primary hex color ("color": "#RRGGBB") and a secondary highlight/gradient hex color ("secondaryColor": "#RRGGBB") to EVERY listed region ID (${regionsToDescribe.map((r) => r.id).join(', ')}).
3. Make sure adjacent distinct objects have clear color contrast, symmetric parts (like left/right wings, petals, eyes, ears) share matching or harmonious colors, and no region is left white (#FFFFFF) unless it is intentionally snow, clouds, eyes, or white fur.
4. Return ONLY valid compact JSON matching this exact schema (keep region objects concise on single lines, no markdown explanation outside JSON):
{
  "sceneTitle": "Short evocative title",
  "artisticNotes": "1-2 sentences describing your color harmony",
  "palette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5", "#HEX6"],
  "regions": [
    {"id": 1, "name": "Short part name", "color": "#RRGGBB", "secondaryColor": "#RRGGBB"}
  ]
}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: cleanDataUrl } },
        { type: 'image_url', image_url: { url: annotatedDataUrl } },
      ],
    },
  ];

  onStatus('Gemini 4 Argon is analyzing line art & composing color harmony...');
  const startTime = performance.now();

  let responseData = null;
  const requestBody = {
    model: ARGON_MODEL_ID,
    apiKey: apiKey || DEFAULT_OPENROUTER_API_KEY,
    reasoningEffort,
    messages,
    max_tokens: 16384,
    temperature: 0.3,
  };

  // Try Vite local server middleware first, fallback to direct OpenRouter call
  try {
    const proxyRes = await fetch('/api/argon-color', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (proxyRes.ok) {
      responseData = await proxyRes.json();
    } else {
      throw new Error(`Proxy status ${proxyRes.status}`);
    }
  } catch {
    const directRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(apiKey || DEFAULT_OPENROUTER_API_KEY).trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Argon Atelier Coloring Studio',
      },
      body: JSON.stringify({
        model: ARGON_MODEL_ID,
        reasoning: { effort: reasoningEffort },
        messages,
        max_tokens: 16384,
        temperature: 0.3,
      }),
    });

    if (!directRes.ok) {
      const errText = await directRes.text();
      throw new Error(`OpenRouter API Error (${directRes.status}): ${errText}`);
    }
    responseData = await directRes.json();
  }

  if (responseData?.error) {
    throw new Error(
      responseData.error.message || JSON.stringify(responseData.error)
    );
  }

  const latencyMs = Math.round(performance.now() - startTime);
  const message = responseData?.choices?.[0]?.message || {};
  const rawContent = message.content || '';
  const reasoningText =
    message.reasoning ||
    message.reasoning_details?.map((d) => d.text).filter(Boolean).join('\n') ||
    '';

  const parsed = parseJsonSafely(rawContent);
  const rawRegions = Array.isArray(parsed.regions) ? parsed.regions : [];
  const palette =
    Array.isArray(parsed.palette) && parsed.palette.length > 0
      ? parsed.palette
      : preset.swatch;

  // Map returned region assignments
  const assignedMap = new Map();
  for (const item of rawRegions) {
    const id = Number(item.id);
    if (!Number.isInteger(id) || id < 1 || id > segmentation.regions.length) continue;
    if (targetSet && !targetSet.has(id)) continue;

    const color =
      typeof item.color === 'string' && item.color.startsWith('#')
        ? item.color.toUpperCase()
        : palette[id % palette.length];
    const secondaryColor =
      typeof item.secondaryColor === 'string' && item.secondaryColor.startsWith('#')
        ? item.secondaryColor.toUpperCase()
        : deriveSecondaryHex(color);

    assignedMap.set(id, {
      id,
      name: item.name || `Region #${id}`,
      color,
      secondaryColor,
      source: 'gemini-4-argon',
    });
  }

  // Also support any extraPoints {x, y, color, name} if returned by model
  if (Array.isArray(parsed.extraPoints)) {
    for (const pt of parsed.extraPoints) {
      const px = Math.min(
        segmentation.width - 1,
        Math.max(0, Math.round(((pt.x || 0) / 1000) * segmentation.width))
      );
      const py = Math.min(
        segmentation.height - 1,
        Math.max(0, Math.round(((pt.y || 0) / 1000) * segmentation.height))
      );
      const rid = segmentation.regionMap[py * segmentation.width + px];
      if (rid > 0 && !assignedMap.has(rid) && (!targetSet || targetSet.has(rid))) {
        const color =
          typeof pt.color === 'string' && pt.color.startsWith('#')
            ? pt.color.toUpperCase()
            : palette[rid % palette.length];
        assignedMap.set(rid, {
          id: rid,
          name: pt.name || `Detail #${rid}`,
          color,
          secondaryColor: deriveSecondaryHex(color),
          source: 'gemini-4-argon-point',
        });
      }
    }
  }

  // Ensure all target / micro regions get a harmonious color if completeMicroRegions is true
  if (completeMicroRegions && !targetSet) {
    for (const reg of segmentation.regions) {
      if (assignedMap.has(reg.id)) continue;

      // 1. Check if a horizontal symmetric twin or close neighbor of similar size was colored by Argon
      let bestMatch = null;
      let bestDist = Infinity;

      for (const nId of reg.neighbors) {
        if (assignedMap.has(nId)) {
          const nReg = segmentation.regions[nId - 1];
          // Prefer non-border & non-huge-background neighbor for small interior details
          const borderPenalty = nReg.touchesBorder && !reg.touchesBorder ? 600 : 0;
          const bgPenalty = nReg.areaPct > 10 && reg.areaPct < 1.2 ? 450 : 0;
          const dist =
            Math.hypot(reg.nx - nReg.nx, reg.ny - nReg.ny) +
            borderPenalty +
            bgPenalty;
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = assignedMap.get(nId);
          }
        }
      }

      if (bestMatch) {
        assignedMap.set(reg.id, {
          id: reg.id,
          name: `${bestMatch.name} (Detail)`,
          color: bestMatch.color,
          secondaryColor: bestMatch.secondaryColor,
          source: 'argon-harmony',
        });
      } else {
        const fallbackColor = palette[reg.id % palette.length];
        assignedMap.set(reg.id, {
          id: reg.id,
          name: `Detail Region #${reg.id}`,
          color: fallbackColor,
          secondaryColor: deriveSecondaryHex(fallbackColor),
          source: 'argon-palette',
        });
      }
    }
  }

  // Order regions for aesthetically pleasing animated painting:
  // Large background/sky regions first, then top-to-bottom / center-outward details
  const orderedSteps = Array.from(assignedMap.values()).sort((a, b) => {
    const regA = segmentation.regions[a.id - 1];
    const regB = segmentation.regions[b.id - 1];
    if (regA.touchesBorder !== regB.touchesBorder) {
      return regA.touchesBorder ? -1 : 1;
    }
    return a.id - b.id;
  });

  return {
    model: responseData?.model || ARGON_MODEL_ID,
    sceneTitle: parsed.sceneTitle || 'Argon Colored Illustration',
    artisticNotes:
      parsed.artisticNotes ||
      `Colored ${orderedSteps.length} regions using ${preset.name} harmony.`,
    palette,
    orderedSteps,
    assignedMap,
    reasoningText,
    latencyMs,
    usage: responseData?.usage || null,
    annotatedDataUrl,
  };
}
