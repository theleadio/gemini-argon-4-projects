import { SSStudioProject } from '../types/project';
import { renderStageFrame } from './stageRenderer';
import { invokeTrpc } from '../bridge/trpcBridge';

export interface ExportProgressState {
  phase: 'idle' | 'initializing' | 'exporting' | 'compiling' | 'completed' | 'cancelled';
  progress: number; // 0..1
  renderedFrames: number;
  totalFrames: number;
  outputUrl: string | null;
  outputFilename: string | null;
}

function formatSrtTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const millis = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/**
 * Reconstructs `captions.exportTranscriptAsSRT` from `dist-electron/index.js`.
 */
export async function exportCaptionsAsSRT(project: SSStudioProject): Promise<void> {
  await invokeTrpc('captions.exportTranscriptAsSRT', 'mutation', {
    projectId: project.id,
    count: project.captions.length,
  });

  const srtBody = project.captions
    .map(
      (cap, idx) =>
        `${idx + 1}\n${formatSrtTimestamp(cap.startMs)} --> ${formatSrtTimestamp(
          cap.endMs
        )}\n${cap.text}\n`
    )
    .join('\n');

  const blob = new Blob([srtBody], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.replace(/\.screenstudio$/, '')}.srt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Exports `.screenstudio` project bundle JSON (`project.updateProject`).
 */
export async function exportScreenStudioBundle(project: SSStudioProject): Promise<void> {
  await invokeTrpc('project.updateProject', 'mutation', {
    id: project.id,
    title: project.title,
  });

  const bundleJson = JSON.stringify(project, null, 2);
  const blob = new Blob([bundleJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = project.title.endsWith('.screenstudio.json')
    ? project.title
    : `${project.title}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Pure TypeScript GIF89a LZW encoder for Screen Studio's GIF export mode.
 * Uses a 256-color RGB 6x6x6 + grayscale hybrid palette and 8-bit LZW stream.
 */
function encodeGif89a(
  frames: ImageData[],
  width: number,
  height: number,
  delayCs: number
): Blob {
  const bytes: number[] = [];
  const writeByte = (b: number) => bytes.push(b & 0xff);
  const writeShort = (v: number) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };
  const writeAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  };

  // Build 256-color global color table (6x6x6 web cube = 216 + 40 grayscale)
  const palette: [number, number, number][] = [];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette.push([
          Math.round((r * 255) / 5),
          Math.round((g * 255) / 5),
          Math.round((b * 255) / 5),
        ]);
      }
    }
  }
  while (palette.length < 256) {
    const g = Math.round(((palette.length - 216) * 255) / 39);
    palette.push([g, g, g]);
  }

  // Header: GIF89a
  writeAscii('GIF89a');
  writeShort(width);
  writeShort(height);
  writeByte(0xf7); // Global Color Table Flag (1), Color Res (7), Sort (0), Size (7 -> 256)
  writeByte(0); // Background color index
  writeByte(0); // Pixel aspect ratio

  for (let i = 0; i < 256; i++) {
    writeByte(palette[i][0]);
    writeByte(palette[i][1]);
    writeByte(palette[i][2]);
  }

  // Netscape 2.0 Application Extension for infinite looping
  writeByte(0x21);
  writeByte(0xff);
  writeByte(11);
  writeAscii('NETSCAPE2.0');
  writeByte(3);
  writeByte(1);
  writeShort(0); // Loop forever
  writeByte(0);

  // LZW compressor for 8-bit indexed pixels
  const lzwEncode = (indexed: Uint8Array): number[] => {
    const minCodeSize = 8;
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    const out: number[] = [];

    let bitBuf = 0;
    let bitCnt = 0;
    const emitCode = (code: number, size: number) => {
      bitBuf |= code << bitCnt;
      bitCnt += size;
      while (bitCnt >= 8) {
        out.push(bitBuf & 0xff);
        bitBuf >>= 8;
        bitCnt -= 8;
      }
    };

    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = new Map<number, number>();

    emitCode(clearCode, codeSize);

    let prefix = indexed[0];
    for (let i = 1; i < indexed.length; i++) {
      const k = indexed[i];
      const key = (prefix << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
      } else {
        emitCode(prefix, codeSize);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          emitCode(clearCode, codeSize);
          dict = new Map();
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
        }
        prefix = k;
      }
    }

    emitCode(prefix, codeSize);
    emitCode(eoiCode, codeSize);
    if (bitCnt > 0) out.push(bitBuf & 0xff);
    return out;
  };

  for (const img of frames) {
    // Graphic Control Extension
    writeByte(0x21);
    writeByte(0xf9);
    writeByte(4);
    writeByte(0x04); // Do not dispose
    writeShort(delayCs);
    writeByte(0);
    writeByte(0);

    // Image Descriptor
    writeByte(0x2c);
    writeShort(0);
    writeShort(0);
    writeShort(width);
    writeShort(height);
    writeByte(0); // Use global color table

    const data = img.data;
    const indexed = new Uint8Array(width * height);
    for (let p = 0, idx = 0; p < data.length; p += 4, idx++) {
      const r = Math.round((data[p] * 5) / 255);
      const g = Math.round((data[p + 1] * 5) / 255);
      const b = Math.round((data[p + 2] * 5) / 255);
      indexed[idx] = r * 36 + g * 6 + b;
    }

    writeByte(8); // LZW minimum code size
    const compressed = lzwEncode(indexed);
    let offset = 0;
    while (offset < compressed.length) {
      const chunkLen = Math.min(255, compressed.length - offset);
      writeByte(chunkLen);
      for (let i = 0; i < chunkLen; i++) {
        writeByte(compressed[offset + i]);
      }
      offset += chunkLen;
    }
    writeByte(0); // Block terminator
  }

  writeByte(0x3b); // GIF Trailer
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

/**
 * Reconstructs `ActiveExportController` (`hke` in `dist-electron/index.js`):
 * Renders the scene across `framesRange` and encodes a downloadable video or GIF89a file.
 */
export async function runStageVideoExport(
  project: SSStudioProject,
  onProgress: (state: ExportProgressState) => void,
  abortSignal: AbortSignal,
  screenVideoEl?: HTMLVideoElement | null,
  webcamVideoEl?: HTMLVideoElement | null
): Promise<void> {
  const isGif = project.exportConfig.format === 'gif';
  await invokeTrpc('export.start', 'mutation', {
    format: project.exportConfig.format,
    codec: project.exportConfig.mp4Codec,
    resolution: project.exportConfig.resolution,
    fps: project.exportConfig.fps,
  });

  const fps = isGif ? 12 : Math.min(60, project.exportConfig.fps || 30);
  const maxFrames = isGif ? 72 : 360;
  const totalFrames = Math.max(
    1,
    Math.min(maxFrames, Math.floor((project.durationMs / 1000) * fps))
  );

  const baseH = isGif
    ? 480
    : project.exportConfig.resolution === '4k'
    ? 1080
    : project.exportConfig.resolution === '1080p'
    ? 900
    : 720;

  const ratioMap: Record<string, number> = {
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '1:1': 1,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
  };
  const aspect = ratioMap[project.stageConfig.aspectRatio] ?? 16 / 9;
  const width = Math.round(baseH * aspect);
  const height = baseH;

  onProgress({
    phase: 'initializing',
    progress: 0.02,
    renderedFrames: 0,
    totalFrames,
    outputUrl: null,
    outputFilename: null,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: isGif });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Branch 1: Studio GIF89a Export
  if (isGif) {
    const gifFrames: ImageData[] = [];
    for (let frame = 0; frame < totalFrames; frame++) {
      if (abortSignal.aborted) {
        onProgress({
          phase: 'cancelled',
          progress: frame / totalFrames,
          renderedFrames: frame,
          totalFrames,
          outputUrl: null,
          outputFilename: null,
        });
        return;
      }

      const timeMs = (frame / totalFrames) * project.durationMs;
      if (screenVideoEl && !screenVideoEl.srcObject && screenVideoEl.src) {
        screenVideoEl.currentTime = timeMs / 1000;
      }
      if (webcamVideoEl && !webcamVideoEl.srcObject && webcamVideoEl.src) {
        webcamVideoEl.currentTime = timeMs / 1000;
      }

      renderStageFrame({
        ctx,
        width,
        height,
        project,
        timeMs,
        screenVideoEl,
        webcamVideoEl,
        showGizmos: false,
      });

      gifFrames.push(ctx.getImageData(0, 0, width, height));

      if (frame % 2 === 0 || frame === totalFrames - 1) {
        onProgress({
          phase: 'exporting',
          progress: ((frame + 1) / totalFrames) * 0.88,
          renderedFrames: frame + 1,
          totalFrames,
          outputUrl: null,
          outputFilename: null,
        });
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    onProgress({
      phase: 'compiling',
      progress: 0.94,
      renderedFrames: totalFrames,
      totalFrames,
      outputUrl: null,
      outputFilename: null,
    });
    await new Promise((r) => setTimeout(r, 16));

    const gifBlob = encodeGif89a(
      gifFrames,
      width,
      height,
      Math.max(4, Math.round(100 / fps))
    );
    const outputUrl = URL.createObjectURL(gifBlob);
    const cleanName = project.title.replace(/\.screenstudio$/, '');
    const outputFilename = `${cleanName}-studio.gif`;

    onProgress({
      phase: 'completed',
      progress: 1,
      renderedFrames: totalFrames,
      totalFrames,
      outputUrl,
      outputFilename,
    });
    return;
  }

  // Branch 2: MP4 / WebM Video Export
  const wantsMp4 = project.exportConfig.format === 'mp4';
  const mp4Supported =
    wantsMp4 && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1');
  const mimeType = mp4Supported
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond:
      project.exportConfig.quality === 'studio'
        ? 14_000_000
        : project.exportConfig.quality === 'web'
        ? 8_000_000
        : 4_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start(100);

  for (let frame = 0; frame < totalFrames; frame++) {
    if (abortSignal.aborted) {
      recorder.stop();
      onProgress({
        phase: 'cancelled',
        progress: frame / totalFrames,
        renderedFrames: frame,
        totalFrames,
        outputUrl: null,
        outputFilename: null,
      });
      return;
    }

    const timeMs = (frame / totalFrames) * project.durationMs;
    if (screenVideoEl && !screenVideoEl.srcObject && screenVideoEl.src) {
      screenVideoEl.currentTime = timeMs / 1000;
    }
    if (webcamVideoEl && !webcamVideoEl.srcObject && webcamVideoEl.src) {
      webcamVideoEl.currentTime = timeMs / 1000;
    }
    renderStageFrame({
      ctx,
      width,
      height,
      project,
      timeMs,
      screenVideoEl,
      webcamVideoEl,
      showGizmos: false,
    });

    if (frame % 4 === 0 || frame === totalFrames - 1) {
      onProgress({
        phase: 'exporting',
        progress: ((frame + 1) / totalFrames) * 0.92,
        renderedFrames: frame + 1,
        totalFrames,
        outputUrl: null,
        outputFilename: null,
      });
      await new Promise((r) => setTimeout(r, 8));
    }
  }

  onProgress({
    phase: 'compiling',
    progress: 0.96,
    renderedFrames: totalFrames,
    totalFrames,
    outputUrl: null,
    outputFilename: null,
  });

  recorder.stop();
  const blob = await stopPromise;
  const outputUrl = URL.createObjectURL(blob);
  const cleanName = project.title.replace(/\.screenstudio$/, '');
  const ext = mp4Supported ? 'mp4' : 'webm';
  const outputFilename = `${cleanName}-${project.exportConfig.resolution}.${ext}`;

  onProgress({
    phase: 'completed',
    progress: 1,
    renderedFrames: totalFrames,
    totalFrames,
    outputUrl,
    outputFilename,
  });
}
