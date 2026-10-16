import React from 'react';
import { ActiveOrder } from '../types';
import { MenuArtwork } from './MenuArtwork';
import {
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  Flame,
  Gauge,
  MapPin,
  Play,
  Radio,
  Sparkles,
  Thermometer,
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface BrewTrackerViewProps {
  activeOrder: ActiveOrder;
  onAdvanceStage: () => void;
  onToggleHazardBeacon: () => void;
}

const STAGES = [
  {
    title: 'Ticket Queued at Espresso Bar',
    detail: 'Assigned to Head Barista Aiman R. · Station #2',
    timeTag: '0:00',
  },
  {
    title: 'Grinding 18.0g on Mythos MY75',
    detail: 'Clump-crusher burrs heated to 42°C for zero static retention',
    timeTag: '0:45',
  },
  {
    title: 'La Marzocco KB90 9.0 Bar Extraction',
    detail: '3s pre-infusion @ 2.5 bar → 25s ramp @ 9.0 bar (93.2°C BWT water)',
    timeTag: '1:30',
  },
  {
    title: 'Finishing & Deck Hearth Torch',
    detail: 'Chilled glass layering & Gula Melaka pastry caramelization',
    timeTag: '2:45',
  },
  {
    title: 'Ready at 34 Lorong Rahim Kajai 14',
    detail: 'Waiting at Express Window / Runner dispatched to curbside',
    timeTag: 'Now',
  },
];

export const BrewTrackerView: React.FC<BrewTrackerViewProps> = ({
  activeOrder,
  onAdvanceStage,
  onToggleHazardBeacon,
}) => {
  const isReady = activeOrder.stage === 4;

  return (
    <div className="tab-view-scroll">
      {/* Top Hero Banner */}
      <div className="brew-hero-card">
        <div className="brew-hero-top">
          <div>
            <span className="eyebrow-tag">
              <span className={`live-dot ${isReady ? 'dot-ready' : 'dot-brewing'}`} />
              LIVE SHOPHOUSE TELEMETRY
            </span>
            <h1 className="brew-order-number">Order #{activeOrder.orderNumber}</h1>
            <p className="brew-order-meta">
              Placed {activeOrder.placedAt} · {activeOrder.paymentMethod}
            </p>
          </div>

          <div className="brew-eta-circle">
            {isReady ? (
              <>
                <CheckCircle2 size={22} className="text-green" />
                <span className="eta-ready-label">READY</span>
              </>
            ) : (
              <>
                <span className="eta-num">{activeOrder.estimatedMinutesLeft}</span>
                <span className="eta-unit">MIN LEFT</span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Demo Controls */}
        <div className="brew-demo-bar">
          <button
            type="button"
            className="simulate-step-btn"
            onClick={() => {
              haptics.impactMedium();
              onAdvanceStage();
            }}
          >
            <Play size={13} />
            <span>
              {isReady ? 'Restart Brew Cycle (Stage 1)' : 'Advance Barista Stage (Demo)'}
            </span>
          </button>
        </div>
      </div>

      {/* Curbside Double-Park Express Beacon (Signature TTDI Feature) */}
      <div className={`curbside-beacon-card ${activeOrder.curbsideHazardActive ? 'beacon-active' : ''}`}>
        <div className="beacon-header">
          <div className="beacon-title-row">
            <Car size={17} className="text-amber" />
            <div>
              <h3>Lorong Rahim Kajai 14 Curbside Express</h3>
              <p>
                {activeOrder.carPlate || 'WYY 4821'} · {activeOrder.carDescription || 'Slate Grey Civic'}
              </p>
            </div>
          </div>
          <span className="plate-badge">{activeOrder.carPlate || 'WYY 4821'}</span>
        </div>

        <p className="beacon-explainer">
          Double-parked outside <strong>No. 34 Lorong Rahim Kajai 14</strong>? Tap below when your
          hazard lights are on—our runner brings your tray straight to your driver window.
        </p>

        <button
          type="button"
          className={`hazard-trigger-btn ${activeOrder.curbsideHazardActive ? 'active' : ''}`}
          onClick={() => {
            haptics.impactMedium();
            onToggleHazardBeacon();
          }}
        >
          <Radio size={15} />
          <span>
            {activeOrder.curbsideHazardActive
              ? 'Hazard Beacon Active · Runner Syafiq Notified!'
              : 'I’m Outside on Lorong 14 (Flash Hazards)'}
          </span>
        </button>
      </div>

      {/* La Marzocco KB90 Live Extraction Telemetry Graph */}
      <div className="kb90-telemetry-card">
        <div className="kb90-header">
          <div>
            <span className="kb90-tag">LA MARZOCCO KB90 · GROUPHEAD #2</span>
            <h3>Live Extraction Curve</h3>
          </div>
          <span className="kb90-barista-pill">Barista: {activeOrder.baristaName}</span>
        </div>

        <div className="kb90-metrics-row">
          <div className="kb90-metric">
            <Gauge size={13} className="text-amber" />
            <span className="m-label">Pressure</span>
            <strong className="m-val">
              {activeOrder.stage === 2 ? '9.0 BAR' : activeOrder.stage > 2 ? 'Completed' : '2.4 BAR'}
            </strong>
          </div>
          <div className="kb90-metric">
            <Thermometer size={13} className="text-amber" />
            <span className="m-label">Boiler Temp</span>
            <strong className="m-val">93.2°C</strong>
          </div>
          <div className="kb90-metric">
            <Clock size={13} className="text-amber" />
            <span className="m-label">Shot Time</span>
            <strong className="m-val">28.4 s</strong>
          </div>
          <div className="kb90-metric">
            <Flame size={13} className="text-amber" />
            <span className="m-label">Ratio</span>
            <strong className="m-val">18g → 38g</strong>
          </div>
        </div>

        {/* SVG Pressure & Flow Curve */}
        <div className="kb90-chart-box">
          <svg viewBox="0 0 320 90" className="kb90-svg">
            <defs>
              <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97736" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#D97736" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="0" y1="20" x2="320" y2="20" stroke="#ffffff14" strokeDasharray="3 3" />
            <line x1="0" y1="50" x2="320" y2="50" stroke="#ffffff14" strokeDasharray="3 3" />
            <line x1="0" y1="78" x2="320" y2="78" stroke="#ffffff14" />
            {/* 9 Bar Pressure Area */}
            <path
              d="M10 78 C30 76, 42 62, 58 60 C75 58, 82 22, 105 20 L255 20 C275 20, 290 52, 310 76 L310 78 Z"
              fill="url(#pressureGrad)"
            />
            {/* 9 Bar Pressure Stroke */}
            <path
              d="M10 78 C30 76, 42 62, 58 60 C75 58, 82 22, 105 20 L255 20 C275 20, 290 52, 310 76"
              fill="none"
              stroke="#D97736"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Flow Rate Dashed Line */}
            <path
              d="M10 76 C50 70, 95 55, 160 44 C220 35, 270 32, 310 30"
              fill="none"
              stroke="#FDE68A"
              strokeWidth="1.6"
              strokeDasharray="4 4"
            />
            {/* Active Stage Marker */}
            <circle
              cx={40 + activeOrder.stage * 62}
              cy={activeOrder.stage === 2 || activeOrder.stage === 3 ? 20 : 60}
              r="5"
              fill="#FEF3C7"
              stroke="#D97736"
              strokeWidth="2.5"
            />
          </svg>
          <div className="kb90-chart-legend">
            <span>
              <i className="legend-dot amber" /> 9.0 Bar Pressure Profile
            </span>
            <span>
              <i className="legend-dot gold" /> Gravimetric Yield (g/s)
            </span>
          </div>
        </div>
      </div>

      {/* 5-Stage Step-by-Step Progress Timeline */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>Barista Progress</h2>
          <span className="stage-counter-pill">Step {activeOrder.stage + 1} of 5</span>
        </div>

        <div className="timeline-stack">
          {STAGES.map((st, idx) => {
            const done = idx < activeOrder.stage;
            const current = idx === activeOrder.stage;
            return (
              <div
                key={st.title}
                className={`timeline-step ${done ? 'step-done' : ''} ${
                  current ? 'step-current' : ''
                }`}
              >
                <div className="timeline-node-col">
                  <div className="timeline-dot">
                    {done ? <CheckCircle2 size={14} /> : <span>{idx + 1}</span>}
                  </div>
                  {idx < STAGES.length - 1 && <div className="timeline-connector" />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-top-row">
                    <h4>{st.title}</h4>
                    <span className="timeline-time">{st.timeTag}</span>
                  </div>
                  <p>{st.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items in Active Order */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>Items in Tray</h2>
          <span className="stage-counter-pill">RM {activeOrder.totalRm.toFixed(2)}</span>
        </div>

        <div className="order-tray-list">
          {activeOrder.items.map((it, i) => (
            <div key={`${it.name}-${i}`} className="order-tray-item">
              <MenuArtwork type={it.artworkType} size="sm" />
              <div className="tray-item-text">
                <div className="tray-item-title">
                  <span className="tray-qty">{it.qty}x</span> {it.name}
                </div>
                <div className="tray-item-sub">{it.summary}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
