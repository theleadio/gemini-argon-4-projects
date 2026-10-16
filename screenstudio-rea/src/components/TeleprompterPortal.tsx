import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  FileText,
  ExternalLink,
  Minimize2,
  Play,
  Pause,
  Plus,
  Minus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { invokeTrpc } from '../bridge/trpcBridge';

interface TeleprompterPortalProps {
  isOpen: boolean;
  notes: string;
  onChangeNotes: (nextNotes: string) => void;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
}

/**
 * Reconstructs Screen Studio's `$Oe()` React Portal child BrowserWindow pattern:
 * Can float as a draggable PiP HUD or pop out into an actual `about:blank` child
 * BrowserWindow (`setContentProtection(true)`, `alwaysOnTop: true`) via `ReactDOM.createPortal`.
 */
export const TeleprompterPortal: React.FC<TeleprompterPortalProps> = ({
  isOpen,
  notes,
  onChangeNotes,
  currentTimeMs,
  durationMs,
  isPlaying,
  onTogglePlay,
  onClose,
}) => {
  const [fontSizePx, setFontSizePx] = useState<number>(15);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const childWinRef = useRef<Window | null>(null);
  const scrollAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync teleprompter scroll position with timeline progress when autoScroll is enabled
  useEffect(() => {
    if (!autoScroll || !scrollAreaRef.current) return;
    const el = scrollAreaRef.current;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const ratio = Math.max(0, Math.min(1, currentTimeMs / Math.max(1, durationMs)));
    el.scrollTop = maxScroll * ratio;
  }, [currentTimeMs, durationMs, autoScroll]);

  // Clean up child window on unmount or close
  useEffect(() => {
    if (!isOpen && childWinRef.current) {
      childWinRef.current.close();
      childWinRef.current = null;
      setPortalContainer(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (childWinRef.current) {
        childWinRef.current.close();
        childWinRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handlePopOutChildWindow = () => {
    if (childWinRef.current && !childWinRef.current.closed) {
      childWinRef.current.focus();
      return;
    }

    invokeTrpc('window.updateChildWindow', 'mutation', {
      frameName: 'ssstudio-teleprompter-portal',
      contentProtection: true,
      alwaysOnTop: true,
    });

    const child = window.open(
      'about:blank',
      'ssstudio-teleprompter-portal',
      'width=460,height=340,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!child) return;
    childWinRef.current = child;
    child.document.title = 'SSStudio Teleprompter · ContentProtected Portal';

    // Clone parent stylesheets into the `about:blank` child window so all variables & classes render identically
    const head = child.document.head;
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      head.appendChild(node.cloneNode(true));
    });

    child.document.body.style.margin = '0';
    child.document.body.style.background = '#0b0c0e';
    child.document.body.style.color = '#f8fafc';
    child.document.body.style.overflow = 'hidden';

    const mountNode = child.document.createElement('div');
    mountNode.style.width = '100vw';
    mountNode.style.height = '100vh';
    child.document.body.appendChild(mountNode);

    child.addEventListener('beforeunload', () => {
      childWinRef.current = null;
      setPortalContainer(null);
    });

    invokeTrpc('window.markContentReady', 'mutation', {
      frameName: 'ssstudio-teleprompter-portal',
    });
    setPortalContainer(mountNode);
  };

  const handleDockBack = () => {
    if (childWinRef.current) {
      invokeTrpc('window.closeChildWindow', 'mutation', {
        frameName: 'ssstudio-teleprompter-portal',
      });
      childWinRef.current.close();
      childWinRef.current = null;
    }
    setPortalContainer(null);
  };

  const teleprompterBody = (
    <div
      className={`teleprompter-card ${
        portalContainer ? 'in-portal-window' : 'floating-in-stage'
      }`}
    >
      <div className="teleprompter-header">
        <div className="teleprompter-title">
          <FileText size={13} className="accent-icon" />
          <span>Speaker Notes & Teleprompter</span>
          <span className="teleprompter-shield" title="Excluded from macOS ScreenCaptureKit via setContentProtection(true)">
            <ShieldCheck size={11} />
            <span>SCStream Hidden</span>
          </span>
        </div>

        <div className="teleprompter-controls">
          <button
            className="icon-btn"
            onClick={() => setFontSizePx((s) => Math.max(11, s - 2))}
            title="Decrease Font Size"
          >
            <Minus size={12} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setFontSizePx((s) => Math.min(26, s + 2))}
            title="Increase Font Size"
          >
            <Plus size={12} />
          </button>
          {portalContainer ? (
            <button
              className="icon-btn"
              onClick={handleDockBack}
              title="Dock Back into Main Window"
            >
              <Minimize2 size={13} />
            </button>
          ) : (
            <button
              className="icon-btn"
              onClick={handlePopOutChildWindow}
              title="Pop Out into Detached React Portal Window (`about:blank`)"
            >
              <ExternalLink size={13} />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => {
              handleDockBack();
              onClose();
            }}
            title="Close Teleprompter"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <textarea
        ref={scrollAreaRef}
        className="teleprompter-textarea"
        style={{ fontSize: `${fontSizePx}px` }}
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        placeholder="Type your recording script or speaker notes here..."
      />

      <div className="teleprompter-footer">
        <button
          className="mini-chip active"
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause size={11} /> : <Play size={11} />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <label className="checkbox-row" style={{ fontSize: 11 }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          <span>Sync scroll with playhead</span>
        </label>

        <span className="mono-badge">
          {(currentTimeMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );

  if (portalContainer) {
    return ReactDOM.createPortal(teleprompterBody, portalContainer);
  }

  return teleprompterBody;
};
