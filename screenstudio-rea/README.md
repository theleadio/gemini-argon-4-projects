# SSStudio (`ssstudio`)

A functional reconstruction of **Screen Studio 4.0.4-4926 (`com.timpler.screenstudio`)** built from **REA (`mcp__rea`)** reverse-engineering evidence.

## How to Run

### 1. Web / Development Mode (Vite)
```bash
npm install
npm run dev
```
Then open `http://localhost:5173`.

### 2. Native Desktop Mode (Electron)
```bash
# Build production bundle and launch Electron
npm run electron
```

---

## Reconstructed Architecture Mapping

| Original `/Applications/Screen Studio.app` Component | Reconstructed `ssstudio` Module | Description |
| :--- | :--- | :--- |
| `dist-electron/index.js` (`LLe` root tRPC router, `ytt`, `yse`, `$Oe`) | `electron/main.mjs` & `src/bridge/trpcBridge.ts` | Registers custom schemes (`screen-studio-file://`, `screen-studio-asset://`, `screen-studio-app-icon://`, `screen-studio-image-thumbnail://`), `--enable-features=DirectMetalGeneration`, `setWindowOpenHandler` for `about:blank` portal windows, and the 48-router `$$typelectron` tRPC IPC bus. |
| `dist-electron/preload.js` (`$$typelectron`, `electronEnv`) | `electron/preload.mjs` | Exposes `window.$$typelectron` and `window.electronEnv` (`APP_VERSION`, `IS_RENDER_WORKER`, `IS_STAGE_BENCH`, `START_HIDDEN`, `WORKER_EXPORT_MODE`). |
| `dist-electron/index.js` (`Lme`, `Rme`, `Bme` spring physics) | `src/engine/springPhysics.ts` | Exact damped harmonic oscillator solver (`stiffness: 125`, `damping: 12`, `mass: 1.5`, `clamp: true`, `precision: 0.002`) with `rapid`, `quick`, `default`, `mellow`, and `slow` presets for cursor smoothing and camera zoom (`containInZoomArea`). |
| `dist/BEy_VAkj.js` & `dist/D8qyO3i92.js` (Stage & Editor UI) | `src/engine/stageRenderer.ts`, `src/components/InspectorPanel.tsx`, `src/components/TimelineDock.tsx` | High-DPI Canvas 2D compositor with wallpapers (`ChmuunRT2.js`), adaptive border glow (`videoBorderColors`), Glass Loupe zoom, directional motion blur, privacy redaction masks (`blur` / `pixelate` / `solid`), ONNX PP-MattingV2 webcam PiP, and word-level karaoke captions. |
| `bin/prod/polyrecorder-prod` (`RecordKit` + `SCStream`) | `src/components/RecorderHudModal.tsx` | Capture HUD supporting Display, Window (`bin/list-windows`), Area, and iOS/iPadOS USB Device modes, with live browser `getDisplayMedia` / `getUserMedia` capture and 120 Hz click-to-zoom telemetry recording. |
| `bin/arm64/native-audio.node` (`MossFormer2_SE_48K`, `tf-restormer.safetensors`, `aufx/*`) | `src/data/catalog.ts` & `src/bridge/trpcBridge.ts` | Models CoreML `MossFormer2` 48kHz speech enhancement, Apple MLX `TF-Restormer`, 8 Apple `aufx` AudioUnits, 17 `SoundAnalysis` vocal classes, 17 built-in background audio tracks, and WebAudio click transients (`apple-magic-mouse` & `logitech-mx-master`). |
| `ActiveExportController` (`hke` in `dist-electron/index.js`) | `src/engine/exporter.ts` | Offscreen frame renderer & `MediaRecorder` WebM/VP9 video encoder, `.srt` subtitle exporter (`captions.exportTranscriptAsSRT`), and `.screenstudio` JSON bundle exporter. |
