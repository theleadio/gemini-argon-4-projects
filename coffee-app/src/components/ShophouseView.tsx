import React, { useState } from 'react';
import { ShophouseTable } from '../types';
import { TTDI_PARKING_STATUS, TTDI_SHOPHOUSE_INFO } from '../data/ttdiData';
import {
  Check,
  Copy,
  Dog,
  Footprints,
  MapPin,
  Navigation,
  Plug,
  Sun,
  Train,
  Users,
  Wifi,
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface ShophouseViewProps {
  tables: ShophouseTable[];
  selectedTableId: string;
  onSelectAndHoldTable: (tableId: string) => void;
  onShowToast: (msg: string) => void;
}

export const ShophouseView: React.FC<ShophouseViewProps> = ({
  tables,
  selectedTableId,
  onSelectAndHoldTable,
  onShowToast,
}) => {
  const [activeZone, setActiveZone] = useState<ShophouseTable['zone']>('upstairs-loft');
  const [inspectedTableId, setInspectedTableId] = useState<string>('L-01');
  const [wifiCopied, setWifiCopied] = useState(false);
  const [runClubJoined, setRunClubJoined] = useState(false);

  const zoneTables = tables.filter((t) => t.zone === activeZone);
  const inspectedTable =
    tables.find((t) => t.id === inspectedTableId) || zoneTables[0] || tables[0];

  const availableCount = tables.filter((t) => t.status !== 'occupied').length;

  const handleCopyWifi = () => {
    haptics.impactMedium();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(TTDI_SHOPHOUSE_INFO.wifiPass).catch(() => {});
    }
    setWifiCopied(true);
    onShowToast('Copied Wi-Fi key "lorong14kopi"');
    setTimeout(() => setWifiCopied(false), 2500);
  };

  return (
    <div className="tab-view-scroll">
      {/* Shophouse Header */}
      <div className="shophouse-hero-card">
        <div className="shophouse-hero-top">
          <div>
            <span className="eyebrow-tag">
              <MapPin size={11} /> TAMAN TUN DR ISMAIL · KL
            </span>
            <h1>34 Lorong Rahim Kajai 14</h1>
            <p>Converted 1978 Two-Storey Terraced Shophouse</p>
          </div>
          <div className="occupancy-pill">
            <span className="live-dot dot-ready" />
            <span>{availableCount} Tables Open</span>
          </div>
        </div>

        <div className="shophouse-quick-stats">
          <div className="s-stat">
            <span>Ambient Sound</span>
            <strong>58 dB (Vinyl Jazz)</strong>
          </div>
          <div className="s-stat">
            <span>Loft Temp</span>
            <strong>22.5°C</strong>
          </div>
          <div className="s-stat">
            <span>MRT Walk</span>
            <strong>4m Gate B</strong>
          </div>
        </div>
      </div>

      {/* Interactive Architectural Floorplan & Table Check-In */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>Live Floorplan & Seat Hold</h2>
          <span className="stage-counter-pill">Tap table to inspect</span>
        </div>

        {/* Zone Segmented Control */}
        <div className="zone-tabs-row">
          {(
            [
              { id: 'ground-bar', label: 'Ground Bar' },
              { id: 'upstairs-loft', label: 'Skylight Loft' },
              { id: 'back-courtyard', label: 'Pet Courtyard' },
            ] as const
          ).map((z) => (
            <button
              key={z.id}
              type="button"
              className={`zone-tab-btn ${activeZone === z.id ? 'active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setActiveZone(z.id);
                const firstInZone = tables.find((t) => t.zone === z.id);
                if (firstInZone) setInspectedTableId(firstInZone.id);
              }}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Interactive Blueprint Canvas */}
        <div className="floorplan-canvas">
          {/* Architectural Blueprint features */}
          <div className="blueprint-label-top">
            {activeZone === 'ground-bar' && 'FRONT FACADE · LORONG RAHIM KAJAI 14'}
            {activeZone === 'upstairs-loft' && 'CENTRAL ATRIUM SKYLIGHT · TIMBER LOUVERS'}
            {activeZone === 'back-courtyard' && 'BACK LANE · BUKIT KIARA CYCLIST RACK'}
          </div>

          {activeZone === 'ground-bar' && (
            <div className="blueprint-fixture">LA MARZOCCO KB90 + POUR-OVER STAGE</div>
          )}
          {activeZone === 'upstairs-loft' && (
            <div className="blueprint-fixture">CENTRAL SKYLIGHT VOID & VINYL LISTENING BAR</div>
          )}
          {activeZone === 'back-courtyard' && (
            <div className="blueprint-fixture">MONSTERA GARDEN & GRAVEL BIKE RACK (12 BIKES)</div>
          )}

          {/* Table Nodes */}
          {zoneTables.map((t) => {
            const isSelected = inspectedTable.id === t.id;
            const isReservedByYou = t.status === 'reserved-you' || selectedTableId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                style={{ left: `${t.xPercent}%`, top: `${t.yPercent}%` }}
                className={`table-node ${t.status} ${isSelected ? 'node-inspected' : ''} ${
                  isReservedByYou ? 'node-yours' : ''
                }`}
                onClick={() => {
                  haptics.impactLight();
                  setInspectedTableId(t.id);
                }}
              >
                <span className="node-id">{t.id}</span>
                <span className="node-seats">{t.seats}p</span>
              </button>
            );
          })}

          <div className="floorplan-legend">
            <span>
              <i className="f-dot open" /> Open
            </span>
            <span>
              <i className="f-dot busy" /> Occupied
            </span>
            <span>
              <i className="f-dot yours" /> Held for You
            </span>
          </div>
        </div>

        {/* Selected Table Inspector Card */}
        <div className="table-inspector-card">
          <div className="ti-top">
            <div>
              <span className="ti-code">{inspectedTable.id}</span>
              <h4>{inspectedTable.label}</h4>
            </div>
            <span className={`ti-status-badge ${inspectedTable.status}`}>
              {selectedTableId === inspectedTable.id || inspectedTable.status === 'reserved-you'
                ? 'Held for You'
                : inspectedTable.status === 'available'
                ? 'Available Now'
                : 'Currently Occupied'}
            </span>
          </div>

          <div className="ti-specs-row">
            <span className="ti-spec">
              <Users size={12} /> Up to {inspectedTable.seats} guests
            </span>
            {inspectedTable.hasPowerOutlet && (
              <span className="ti-spec">
                <Plug size={12} /> 240V + USB-C PD
              </span>
            )}
            {inspectedTable.isPetFriendly && (
              <span className="ti-spec">
                <Dog size={12} /> Pet Friendly
              </span>
            )}
            <span className="ti-spec">
              <Sun size={12} /> {inspectedTable.sunlightLevel}
            </span>
          </div>

          <button
            type="button"
            className="hold-table-btn"
            disabled={inspectedTable.status === 'occupied'}
            onClick={() => {
              haptics.impactMedium();
              onSelectAndHoldTable(inspectedTable.id);
            }}
          >
            {selectedTableId === inspectedTable.id || inspectedTable.status === 'reserved-you'
              ? `Checked In at ${inspectedTable.id} (Active for Dine-In Orders)`
              : inspectedTable.status === 'occupied'
              ? 'Table Occupied · Est. Free in 20m'
              : `Hold ${inspectedTable.id} for 15 Mins & Set Dine-In`}
          </button>
        </div>
      </div>

      {/* One-Tap Shophouse Wi-Fi Card */}
      <div className="wifi-pass-card">
        <div className="wifi-left">
          <div className="wifi-icon-box">
            <Wifi size={18} />
          </div>
          <div>
            <div className="wifi-label">SHOPHOUSE HIGH-SPEED FIBER (800 Mbps)</div>
            <div className="wifi-ssid">{TTDI_SHOPHOUSE_INFO.wifiSsid}</div>
            <div className="wifi-pw">
              Password: <code>{TTDI_SHOPHOUSE_INFO.wifiPass}</code>
            </div>
          </div>
        </div>
        <button type="button" className="wifi-copy-btn" onClick={handleCopyWifi}>
          {wifiCopied ? <Check size={14} /> : <Copy size={14} />}
          <span>{wifiCopied ? 'Copied' : 'Copy Key'}</span>
        </button>
      </div>

      {/* TTDI Parking & MRT Intelligence */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>TTDI Parking & Access</h2>
          <span className="stage-counter-pill">
            <Train size={11} /> 4m to MRT
          </span>
        </div>

        <div className="parking-list">
          {TTDI_PARKING_STATUS.map((p) => (
            <div key={p.name} className="parking-item-card">
              <div className="parking-top">
                <h4>{p.name}</h4>
                <span className="parking-status-tag">{p.status}</span>
              </div>
              <div className="parking-dist">
                <Navigation size={11} /> {p.distance}
              </div>
              <p className="parking-note">{p.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bukit Kiara Trail & Cold Brew Run Club */}
      <div className="run-club-card">
        <div className="run-club-top">
          <span className="run-badge">
            <Footprints size={12} /> BUKIT KIARA RUN CLUB · SAT 7:00 AM
          </span>
          <span className="run-spots">18 / 25 Runners</span>
        </div>
        <h3>7km Bukit Kiara Twin Peaks + Cold Brew</h3>
        <p>
          Bag drop at 34 Lorong Rahim Kajai 14 at 6:45 AM. Two pace groups (5:40/km & 6:30/km
          social). Every finisher gets a complimentary{' '}
          <strong>Asam Boi Cascara Espresso Tonic</strong> on the back patio.
        </p>
        <button
          type="button"
          className={`run-rsvp-btn ${runClubJoined ? 'joined' : ''}`}
          onClick={() => {
            haptics.applePaySuccess();
            setRunClubJoined(!runClubJoined);
            onShowToast(
              !runClubJoined
                ? 'RSVP Confirmed! Added Sat 7:00 AM Run to Calendar'
                : 'Run Club RSVP Cancelled'
            );
          }}
        >
          {runClubJoined
            ? '✓ You’re on the Saturday 7:00 AM Start List'
            : 'RSVP Free Spot + Claim Post-Run Tonic'}
        </button>
      </div>
    </div>
  );
};
