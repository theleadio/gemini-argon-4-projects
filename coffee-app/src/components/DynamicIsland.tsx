import React from 'react';
import { ActiveOrder } from '../types';
import { Coffee, Car, CheckCircle2, Sparkles, ChevronRight, Play } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface DynamicIslandProps {
  activeOrder: ActiveOrder;
  expanded: boolean;
  onToggleExpand: () => void;
  onAdvanceStage: () => void;
  onJumpToBrewTab: () => void;
  toastMessage: string | null;
}

const STAGE_LABELS = [
  'Order Queued at Bar',
  'Grinding on Mythos MY75',
  'Pulling 9.0 Bar Shot',
  'Plating & Warming',
  'Ready at Lorong 14!',
];

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  activeOrder,
  expanded,
  onToggleExpand,
  onAdvanceStage,
  onJumpToBrewTab,
  toastMessage,
}) => {
  const isReady = activeOrder.stage === 4;

  return (
    <div className="ios-status-bar-zone">
      {/* Left Time */}
      <div className="ios-status-time">9:41</div>

      {/* Center Dynamic Island */}
      <div
        className={`dynamic-island ${expanded ? 'island-expanded' : 'island-compact'} ${
          toastMessage ? 'island-toast' : ''
        }`}
        onClick={() => {
          haptics.impactLight();
          onToggleExpand();
        }}
        role="button"
        tabIndex={0}
        aria-label="iOS Dynamic Island Live Activity"
      >
        {toastMessage && !expanded ? (
          <div className="island-toast-row">
            <Sparkles size={13} className="text-amber" />
            <span className="island-toast-text">{toastMessage}</span>
          </div>
        ) : !expanded ? (
          <div className="island-compact-row">
            <div className="island-left-pill">
              <span className={`live-dot ${isReady ? 'dot-ready' : 'dot-brewing'}`} />
              <Coffee size={12} className="text-amber" />
            </div>
            <div className="island-camera-cutout" />
            <div className="island-right-pill">
              {isReady ? (
                <span className="island-ready-tag">READY</span>
              ) : (
                <span className="island-eta-tag">#{activeOrder.orderNumber.split('-')[1]} · {activeOrder.estimatedMinutesLeft}m</span>
              )}
            </div>
          </div>
        ) : (
          <div className="island-expanded-body" onClick={(e) => e.stopPropagation()}>
            <div className="island-exp-header">
              <div className="island-exp-brand">
                <span className={`live-dot ${isReady ? 'dot-ready' : 'dot-brewing'}`} />
                <span className="island-exp-title">SATU LORONG LIVE ACTIVITY</span>
              </div>
              <button
                className="island-close-btn"
                onClick={() => {
                  haptics.impactLight();
                  onToggleExpand();
                }}
              >
                Collapse
              </button>
            </div>

            <div className="island-exp-main">
              <div>
                <div className="island-order-Headline">
                  Order #{activeOrder.orderNumber} · {STAGE_LABELS[activeOrder.stage]}
                </div>
                <div className="island-order-sub">
                  {activeOrder.fulfillment === 'curbside' ? (
                    <>
                      <Car size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Curbside Plate <strong>{activeOrder.carPlate}</strong> · Barista {activeOrder.baristaName}
                    </>
                  ) : activeOrder.fulfillment === 'dine-in' ? (
                    <>Table {activeOrder.tableId || 'T-01'} · Barista {activeOrder.baristaName}</>
                  ) : (
                    <>Lorong 14 Express Window · Barista {activeOrder.baristaName}</>
                  )}
                </div>
              </div>
              <div className="island-eta-badge">
                {isReady ? (
                  <span className="eta-ready">
                    <CheckCircle2 size={14} /> Ready
                  </span>
                ) : (
                  <span>{activeOrder.estimatedMinutesLeft} min</span>
                )}
              </div>
            </div>

            {/* 5-step Live Activity Bar */}
            <div className="island-stage-track">
              {[0, 1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`island-stage-segment ${
                    step <= activeOrder.stage ? 'seg-active' : ''
                  } ${step === activeOrder.stage ? 'seg-current' : ''}`}
                />
              ))}
            </div>

            <div className="island-exp-actions">
              <button
                className="island-action-secondary"
                onClick={() => {
                  haptics.impactMedium();
                  onAdvanceStage();
                }}
              >
                <Play size={11} />
                {isReady ? 'Reset Demo Cycle' : 'Simulate Next Brew Step'}
              </button>
              <button
                className="island-action-primary"
                onClick={() => {
                  haptics.impactLight();
                  onToggleExpand();
                  onJumpToBrewTab();
                }}
              >
                Live Telemetry <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right iOS System Icons (5G, Wi-Fi, Battery) */}
      <div className="ios-status-icons">
        <span className="ios-5g">5G</span>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 2.2C9.8 2.2 11.9 3.1 13.5 4.6L14.8 3.2C12.9 1.4 10.3 0.3 7.5 0.3C4.7 0.3 2.1 1.4 0.2 3.2L1.5 4.6C3.1 3.1 5.2 2.2 7.5 2.2ZM7.5 5.6C8.9 5.6 10.2 6.2 11.2 7.1L12.5 5.7C11.2 4.5 9.4 3.7 7.5 3.7C5.6 3.7 3.8 4.5 2.5 5.7L3.8 7.1C4.8 6.2 6.1 5.6 7.5 5.6ZM7.5 9C8.2 9 8.9 9.3 9.4 9.8L7.5 11.7L5.6 9.8C6.1 9.3 6.8 9 7.5 9Z" />
        </svg>
        <div className="ios-battery">
          <div className="ios-battery-fill" />
        </div>
      </div>
    </div>
  );
};
