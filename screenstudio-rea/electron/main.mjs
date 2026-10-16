import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  desktopCapturer,
  screen,
  shell,
  session,
  systemPreferences,
} from 'electron';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_VERSION = '4.0.4-4926-rea';

// Mirror Screen Studio's Chromium flags from dist-electron/index.js
app.commandLine.appendSwitch('js-flags', '--expose_gc');
app.commandLine.appendSwitch('enable-features', 'DirectMetalGeneration');

// Custom privileged schemes reconstructed from yse() in dist-electron/index.js
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sentry-ipc',
    privileges: { bypassCSP: true, corsEnabled: true, supportFetchAPI: true },
  },
  {
    scheme: 'screen-studio-file',
    privileges: {
      corsEnabled: true,
      bypassCSP: true,
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: 'screen-studio-asset',
    privileges: {
      corsEnabled: true,
      bypassCSP: true,
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: 'screen-studio-app-icon',
    privileges: {
      corsEnabled: true,
      bypassCSP: true,
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: 'screen-studio-image-thumbnail',
    privileges: {
      corsEnabled: true,
      bypassCSP: true,
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let selectedCaptureSourceId = null;
let selectedCaptureMode = 'display';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function getDesktopSourcesSafe() {
  // Note: Never pass thumbnailSize: { width: 0, height: 0 } on macOS 15+/26+/27+
  // because 0x0 dimensions stall SCStreamConfiguration in Chromium's capturer.
  try {
    const screenSources = await withTimeout(
      desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 160, height: 90 },
        fetchWindowIcons: false,
      }),
      900
    );
    if (screenSources && screenSources.length > 0) return screenSources;
  } catch (err) {
    console.warn('[SSStudio] desktopCapturer (screen+window) fallback:', err?.message || err);
  }
  try {
    const onlyScreens = await withTimeout(
      desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 160, height: 90 },
      }),
      700
    );
    if (onlyScreens && onlyScreens.length > 0) return onlyScreens;
  } catch (err) {
    console.warn('[SSStudio] desktopCapturer (screen-only) fallback:', err?.message || err);
  }
  return [];
}

async function listCapturableTargets() {
  const sources = await getDesktopSourcesSafe();
  if (sources.length > 0) {
    return sources
      .filter((src) => src.name && src.name.trim() !== '')
      .slice(0, 24)
      .map((src, idx) => {
        const isScreen = src.id.startsWith('screen:');
        return {
          id: idx + 100,
          sourceId: src.id,
          kind: isScreen ? 'display' : 'window',
          name:
            isScreen && (src.name === 'Entire Screen' || src.name === 'Screen 1')
              ? 'Built-in Liquid Retina XDR Display'
              : src.name,
          bundleId: isScreen ? 'com.apple.display' : 'com.macos.window',
          bounds: {
            x: 0,
            y: 0,
            width: isScreen ? 2560 : 1440,
            height: isScreen ? 1600 : 900,
          },
          isOnScreen: true,
          thumbnailDataUrl:
            src.thumbnail && !src.thumbnail.isEmpty()
              ? src.thumbnail.toDataURL()
              : undefined,
        };
      });
  }

  return screen.getAllDisplays().map((d, i) => ({
    id: 100 + i,
    kind: 'display',
    name:
      i === 0
        ? 'Built-in Liquid Retina XDR Display'
        : `External Display ${i + 1}`,
    bundleId: 'com.apple.display',
    bounds: d.bounds,
    isOnScreen: true,
  }));
}

function registerDisplayMediaHandler(targetSession, useSystemPicker = false) {
  targetSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await getDesktopSourcesSafe();
        if (!sources || sources.length === 0) {
          console.warn(
            '[SSStudio] No desktopCapturer sources available. Grant Screen Recording permission in macOS System Settings.'
          );
          callback({});
          return;
        }

        let chosen = null;
        if (selectedCaptureSourceId) {
          chosen = sources.find((s) => s.id === selectedCaptureSourceId) ?? null;
        }
        if (!chosen) {
          if (selectedCaptureMode === 'display') {
            chosen =
              sources.find((s) => s.id.startsWith('screen:')) ?? sources[0];
          } else {
            chosen =
              sources.find(
                (s) =>
                  s.id.startsWith('window:') && !s.name.includes('SSStudio')
              ) ?? sources[0];
          }
        }

        callback({ video: chosen });
      } catch (err) {
        console.error('[SSStudio] setDisplayMediaRequestHandler error:', err);
        callback({});
      }
    },
    { useSystemPicker }
  );
}

function registerTrpcIpcHandlers() {
  ipcMain.handle('$$typelectron:trpc-op', async (_event, op) => {
    const { path: procPath, input, type } = op ?? {};
    switch (procPath) {
      case 'app.version':
        return { id: null, result: { type: 'data', data: APP_VERSION } };
      case 'app.recorderVersion':
        return {
          id: null,
          result: { type: 'data', data: 'polyrecorder-prod (RecordKit 4.0)' },
        };
      case 'system.osVersion':
        return {
          id: null,
          result: {
            type: 'data',
            data: `${os.platform()} ${os.release()} (${os.arch()})`,
          },
        };
      case 'system.memoryInfo':
        return {
          id: null,
          result: {
            type: 'data',
            data: {
              totalBytes: os.totalmem(),
              freeBytes: os.freemem(),
              cpuModel: os.cpus()[0]?.model ?? 'Apple M-Series',
              cores: os.cpus().length,
            },
          },
        };
      case 'windows.capturableWindows': {
        const wins = await listCapturableTargets();
        return { id: null, result: { type: 'data', data: wins } };
      }
      case 'capture.preRecordingCheck': {
        selectedCaptureSourceId = input?.sourceId ?? null;
        if (input?.mode) selectedCaptureMode = input.mode;
        const screenAccess =
          process.platform === 'darwin'
            ? systemPreferences.getMediaAccessStatus('screen')
            : 'granted';
        const useNativePicker = !selectedCaptureSourceId || screenAccess !== 'granted';
        registerDisplayMediaHandler(session.defaultSession, useNativePicker);
        if (mainWindow?.webContents?.session) {
          registerDisplayMediaHandler(mainWindow.webContents.session, useNativePicker);
        }
        return {
          id: null,
          result: {
            type: 'data',
            data: {
              ok: true,
              screenAccess,
              useNativePicker,
              selectedSourceId: selectedCaptureSourceId,
            },
          },
        };
      }
      case 'capture.start': {
        if (input?.sourceId) selectedCaptureSourceId = input.sourceId;
        if (input?.mode) selectedCaptureMode = input.mode;
        return {
          id: null,
          result: {
            type: 'data',
            data: { started: true, sourceId: selectedCaptureSourceId },
          },
        };
      }
      case 'permissions.check':
        return {
          id: null,
          result: {
            type: 'data',
            data: {
              screen:
                process.platform === 'darwin'
                  ? systemPreferences.getMediaAccessStatus('screen')
                  : 'granted',
              camera:
                process.platform === 'darwin'
                  ? systemPreferences.getMediaAccessStatus('camera')
                  : 'granted',
              microphone:
                process.platform === 'darwin'
                  ? systemPreferences.getMediaAccessStatus('microphone')
                  : 'granted',
            },
          },
        };
      case 'permissions.request':
        if (process.platform === 'darwin') {
          await shell.openExternal(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
          );
        }
        return { id: null, result: { type: 'data', data: true } };
      case 'displays.allDisplays': {
        const displays = screen.getAllDisplays().map((d, i) => ({
          id: d.id,
          name:
            i === 0
              ? 'Built-in Liquid Retina XDR Display'
              : `External Display ${i + 1}`,
          bounds: d.bounds,
          scaleFactor: d.scaleFactor,
          refreshRate: d.displayFrequency || 120,
        }));
        return { id: null, result: { type: 'data', data: displays } };
      }
      case 'media.isImproveAudioSupported':
        return { id: null, result: { type: 'data', data: process.arch === 'arm64' } };
      case 'system.openUrl':
        if (input?.url) await shell.openExternal(input.url);
        return { id: null, result: { type: 'data', data: true } };
      default:
        return {
          id: null,
          result: {
            type: 'data',
            data: {
              handledBy: 'electron-main-trpc',
              path: procPath,
              type,
              input,
              timestamp: Date.now(),
            },
          },
        };
    }
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'SSStudio — Screen Studio 4.0 Architecture',
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    darkTheme: true,
    backgroundColor: '#0B0C0E',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      additionalArguments: [
        app.isPackaged ? '--prod' : '--dev',
        `--app-version=${APP_VERSION}`,
      ],
    },
  });

  registerDisplayMediaHandler(mainWindow.webContents.session);

  // Child window portal handler reconstructed from $Oe() in dist-electron/index.js
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url !== 'about:blank') return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        darkTheme: true,
        backgroundColor: '#0B0C0E',
        width: 480,
        height: 360,
        alwaysOnTop: true,
        titleBarStyle: 'hiddenInset',
      },
    };
  });

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    try {
      // Exclude Portal child window from macOS ScreenCaptureKit / WindowServer capture
      childWindow.setContentProtection(true);
      childWindow.setAlwaysOnTop(true, 'floating');
    } catch {}
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  registerDisplayMediaHandler(session.defaultSession);
  registerTrpcIpcHandlers();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
