import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  FileJson,
  Film,
  Camera,
  Copy,
  Trash2,
  RotateCcw,
  Plus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { SSStudioProject } from '../types/project';
import { createDefaultProject } from '../data/catalog';
import { invokeTrpc } from '../bridge/trpcBridge';

const STORAGE_KEY_PROJECTS = 'ssstudio_saved_projects_v1';

export function loadSavedProjectsFromStorage(): SSStudioProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectsToStorage(list: SSStudioProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(list.slice(0, 16)));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Samples dominant edge colors from a video element to reconstruct `media.getVideoBorderColors`
 * (`bin/video-border-colors`).
 */
export function extractDominantVideoBorderColors(
  videoEl: HTMLVideoElement
): [string, string, string] {
  try {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d');
    if (!ctx || videoEl.videoWidth === 0) {
      return ['#3b82f6', '#8b5cf6', '#ec4899'];
    }
    ctx.drawImage(videoEl, 0, 0, 48, 48);
    const sampleHex = (x: number, y: number): string => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const toHex = (v: number) => Math.max(40, v).toString(16).padStart(2, '0');
      return `#${toHex(d[0])}${toHex(d[1])}${toHex(d[2])}`;
    };
    return [sampleHex(4, 4), sampleHex(24, 4), sampleHex(44, 44)];
  } catch {
    return ['#3b82f6', '#8b5cf6', '#ec4899'];
  }
}

interface ProjectLibraryModalProps {
  isOpen: boolean;
  currentProject: SSStudioProject;
  onClose: () => void;
  onLoadProject: (proj: SSStudioProject) => void;
  onAttachVideoFile: (kind: 'screen' | 'webcam', file: File) => void;
}

export const ProjectLibraryModal: React.FC<ProjectLibraryModalProps> = ({
  isOpen,
  currentProject,
  onClose,
  onLoadProject,
  onAttachVideoFile,
}) => {
  const [savedProjects, setSavedProjects] = useState<SSStudioProject[]>(() =>
    loadSavedProjectsFromStorage()
  );
  const [notice, setNotice] = useState<string | null>(null);

  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const screenVideoInputRef = useRef<HTMLInputElement | null>(null);
  const webcamVideoInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSaveCurrentToLibrary = () => {
    invokeTrpc('project.updateProject', 'mutation', {
      id: currentProject.id,
      title: currentProject.title,
    });
    const copy: SSStudioProject = {
      ...currentProject,
      id:
        currentProject.id === 'proj_ssstudio_404_rea'
          ? `proj_${Date.now()}`
          : currentProject.id,
    };
    const nextList = [
      copy,
      ...savedProjects.filter((p) => p.id !== copy.id),
    ];
    setSavedProjects(nextList);
    saveProjectsToStorage(nextList);
    setNotice(`Saved "${copy.title}" to local Project Library.`);
  };

  const handleDuplicateProject = (proj: SSStudioProject) => {
    invokeTrpc('project.copyProject', 'mutation', { sourceId: proj.id });
    const dup: SSStudioProject = {
      ...proj,
      id: `proj_${Date.now()}`,
      title: `${proj.title.replace(/\.screenstudio$/, '')} (Copy).screenstudio`,
    };
    const nextList = [dup, ...savedProjects];
    setSavedProjects(nextList);
    saveProjectsToStorage(nextList);
    setNotice(`Duplicated project as "${dup.title}".`);
  };

  const handleDeleteProject = (id: string) => {
    invokeTrpc('project.removeProject', 'mutation', { id });
    const nextList = savedProjects.filter((p) => p.id !== id);
    setSavedProjects(nextList);
    saveProjectsToStorage(nextList);
  };

  const handleImportBundleJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as SSStudioProject;
        if (parsed && parsed.stageConfig && parsed.cursorConfig) {
          invokeTrpc('project.openProject', 'query', { title: parsed.title });
          onLoadProject(parsed);
          onClose();
        } else {
          setNotice('Invalid .screenstudio JSON bundle schema.');
        }
      } catch {
        setNotice('Failed to parse JSON project bundle.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="recorder-hud-card"
        style={{ width: 680 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-header">
          <div className="hud-title-row">
            <FolderOpen size={18} className="accent-icon" />
            <div>
              <div className="hud-title">
                Project Library & Media Importer (`project.*` Router)
              </div>
              <div className="hud-subtitle">
                Manage `.screenstudio` bundles or attach local MP4 / WebM / MOV recordings
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,.screenstudio"
          style={{ display: 'none' }}
          onChange={handleImportBundleJson}
        />
        <input
          ref={screenVideoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onAttachVideoFile('screen', file);
              setNotice(`Loaded screen recording video "${file.name}".`);
            }
            e.target.value = '';
          }}
        />
        <input
          ref={webcamVideoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onAttachVideoFile('webcam', file);
              setNotice(`Loaded webcam PiP video "${file.name}".`);
            }
            e.target.value = '';
          }}
        />

        {/* Quick Actions Grid */}
        <div className="hud-mode-grid">
          <button
            className="hud-mode-btn"
            onClick={() => screenVideoInputRef.current?.click()}
          >
            <Film size={18} className="accent-icon" />
            <span>Import Screen Video</span>
            <small>MP4 / WebM / MOV</small>
          </button>
          <button
            className="hud-mode-btn"
            onClick={() => webcamVideoInputRef.current?.click()}
          >
            <Camera size={18} className="emerald-icon" />
            <span>Import Webcam Video</span>
            <small>PiP Overlay Track</small>
          </button>
          <button
            className="hud-mode-btn"
            onClick={() => jsonInputRef.current?.click()}
          >
            <FileJson size={18} />
            <span>Open .screenstudio</span>
            <small>Load JSON Bundle</small>
          </button>
          <button
            className="hud-mode-btn"
            onClick={handleSaveCurrentToLibrary}
          >
            <Plus size={18} />
            <span>Save to Library</span>
            <small>Persist Snapshot</small>
          </button>
        </div>

        {notice && (
          <div className="hud-status-banner">
            <Sparkles size={13} />
            <span style={{ marginLeft: 6 }}>{notice}</span>
          </div>
        )}

        {/* Saved & Built-in Projects List */}
        <div className="hud-section">
          <div className="hud-section-label">
            <span>Recent & Saved `.screenstudio` Projects</span>
            <span className="mono-badge">{savedProjects.length + 1} Projects</span>
          </div>

          <div className="hud-window-list" style={{ maxHeight: 220 }}>
            {/* Built-in REA Demo Project */}
            <div className="hud-window-item">
              <div className="hud-window-meta">
                <span className="hud-window-name">
                  REA Reverse Engineering Walkthrough.screenstudio (Built-In Demo)
                </span>
                <span className="hud-window-bundle">
                  16.0s · 3 Zooms · 5 Captions · 1 Privacy Mask · 16:9
                </span>
              </div>
              <div className="timeline-actions-right">
                <button
                  className="tl-action-btn accent"
                  onClick={() => {
                    invokeTrpc('project.loadProject', 'query', {
                      id: 'proj_ssstudio_404_rea',
                    });
                    onLoadProject(createDefaultProject());
                    onClose();
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Load Demo</span>
                </button>
              </div>
            </div>

            {savedProjects.map((proj) => (
              <div key={proj.id} className="hud-window-item">
                <div className="hud-window-meta">
                  <span className="hud-window-name">{proj.title}</span>
                  <span className="hud-window-bundle">
                    {(proj.durationMs / 1000).toFixed(1)}s · {proj.zooms.length} Zooms ·{' '}
                    {proj.captions.length} Captions · {proj.stageConfig.aspectRatio}
                  </span>
                </div>
                <div className="timeline-actions-right">
                  <button
                    className="tl-action-btn accent"
                    onClick={() => {
                      invokeTrpc('project.loadProject', 'query', { id: proj.id });
                      onLoadProject(proj);
                      onClose();
                    }}
                  >
                    <Check size={12} />
                    <span>Open</span>
                  </button>
                  <button
                    className="tl-action-btn"
                    onClick={() => handleDuplicateProject(proj)}
                    title="Duplicate Project (`project.copyProject`)"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    className="tl-action-btn danger"
                    onClick={() => handleDeleteProject(proj.id)}
                    title="Remove Project (`project.removeProject`)"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hud-footer">
          <div className="hud-footer-hint">
            <Sparkles size={13} />
            <span>
              Importing a local video automatically extracts <code>videoBorderColors</code> for Adaptive Stage Glow
            </span>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
