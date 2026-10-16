const { contextBridge, ipcRenderer, webUtils } = require('electron');

const argv = process?.argv ?? [];
const isDev = argv.includes('--dev');

function getAppVersion() {
  for (const arg of argv) {
    if (arg.startsWith('--app-version=')) {
      return arg.split('=')[1] ?? '4.0.4-rea';
    }
  }
  return '4.0.4-rea';
}

function createElectronEnv() {
  return {
    getFilePath(file) {
      return webUtils?.getPathForFile ? webUtils.getPathForFile(file) : '';
    },
    get WORKER_EXPORT_MODE() {
      for (const arg of argv) {
        if (arg.startsWith('--worker-export-mode=')) {
          return arg.split('=')[1];
        }
      }
      return null;
    },
    get APP_VERSION() {
      return getAppVersion();
    },
    get IS_RENDER_WORKER() {
      return argv.includes('--render-worker');
    },
    get IS_STAGE_BENCH() {
      return argv.includes('--stage-bench');
    },
    get START_HIDDEN() {
      return argv.includes('--start-hidden');
    },
    get IS_DEV() {
      return isDev;
    },
    get IS_BETA() {
      return getAppVersion().includes('beta');
    },
    sendProtocolPort() {},
  };
}

function createTypelectronBridge() {
  return {
    invoke(channel, payload) {
      return ipcRenderer.invoke(`$$typelectron:${channel}`, payload);
    },
    send(channel, payload) {
      ipcRenderer.send(`$$typelectron:${channel}`, payload);
    },
    on(channel, listener) {
      const wrapped = (_event, ...args) => listener(_event, ...args);
      ipcRenderer.on(`$$typelectron:${channel}`, wrapped);
      return () => {
        ipcRenderer.removeListener(`$$typelectron:${channel}`, wrapped);
      };
    },
  };
}

contextBridge.exposeInMainWorld('$$typelectron', createTypelectronBridge());
contextBridge.exposeInMainWorld('electronEnv', createElectronEnv());
