import React, { useMemo, useState } from "react";
import { ENGINEERING_PLATES, EngineeringPlateSpec } from "../data/proton-archive";
import {
  fitProjection,
  slabOf,
  cylinder,
  coil,
  knurl,
  radialTicks,
  sideRing,
  lineOnTop,
  segment,
  wireSvg,
  solidSvg,
  lineSvg,
  dotsSvg,
  faceTextSvg,
  topMatrix,
  iso,
  figureSvg,
  Point3,
} from "../lib/iso-kit";

interface EngineeringPlatesProps {
  theme?: "dark" | "light";
}

function renderPlateSvg(plateId: string, azimuth: number): string {
  const width = 560;
  const height = 340;
  const bounds: Point3[] = [
    [-18, -14, 0],
    [18, 14, 15],
    [-18, 14, 0],
    [18, -14, 15],
  ];
  const proj = fitProjection(bounds, width, height, {
    pad: 28,
    headroom: 16,
    azimuth,
    elevation: 29,
  });

  const parts: string[] = [];

  // Common precision base plate
  const base = slabOf({ x: -17, y: -12, w: 34, d: 24, r: 1.4 }, -0.8, 0.8, proj, 6);
  parts.push(solidSvg(base, { tone: "lo", crease: "faint", halo: true }));

  if (plateId === "campro-cps") {
    // CamPro CPS S4PH 4-Cylinder Block + DOHC Head + Tri-Lobe Cam + Variable Intake Manifold (VIM)
    const block = slabOf({ x: -11, y: -6, w: 18, d: 10, r: 0.9 }, 0, 5.2, proj, 5, 0.25);
    parts.push(solidSvg(block, { tone: "hi", crease: "lo" }));

    // 4 Cylinder Sleeves & Pistons
    for (let i = 0; i < 4; i++) {
      const cx = -8 + i * 4.2;
      const sleeve = cylinder(cx, -1, 1.55, 5.2, 1.8, proj, 24);
      parts.push(solidSvg(sleeve, { tone: "red", lit: true }));
      const pistonCrown = radialTicks(cx, -1, 1.35, 12, 3, 7.05, [0.25, 0.5], proj);
      parts.push(lineSvg(pistonCrown.major, { tone: "red" }));
    }

    // DOHC Valve Cover & Cam Pulleys (Elevated Cutaway)
    const headCover = slabOf({ x: -11, y: -5.4, w: 18, d: 8.8, r: 0.8 }, 8.6, 2.2, proj, 5, 0.3);
    parts.push(solidSvg(headCover, { tone: "red", lit: true, crease: "mid" }));

    // Timing belt pulleys on left end
    parts.push(lineSvg(sideRing([-11.5, -3.2, 9.6], 1.8, "x", proj, 24), { tone: "red" }));
    parts.push(lineSvg(sideRing([-11.5, 1.2, 9.6], 1.8, "x", proj, 24), { tone: "red" }));
    parts.push(lineSvg(sideRing([-11.5, -1.0, 2.6], 2.2, "x", proj, 24), { tone: "hi", dashed: true }));

    // Variable Intake Manifold (VIM) runners sweeping over front
    for (let i = 0; i < 4; i++) {
      const rx = -8 + i * 4.2;
      parts.push(
        lineSvg(
          segment([rx, 3.8, 6.2], [rx, 8.2, 4.2], proj),
          { tone: "hi" }
        )
      );
    }
    const vimPlenum = cylinder(-1.5, 8.2, 2.1, 2.5, 3.2, proj, 24);
    parts.push(solidSvg(vimPlenum, { tone: "mid", crease: "lo" }));

    // Callout wires
    parts.push(
      wireSvg([36, 48], iso([-3.8, -1, 9.8], proj), {
        via: [[95, 48]],
        tone: "red",
      })
    );
    parts.push(
      wireSvg([width - 38, height - 42], iso([-1.5, 8.2, 4.5], proj), {
        via: [[width - 105, height - 42]],
        tone: "hi",
      })
    );
    parts.push(
      faceTextSvg(
        topMatrix([-15, 9.8], 0.05, proj, "x"),
        "CAMPRO S4PH-CPS // TRI-LOBE + VIM",
        { size: 2.0, tone: "mid" }
      )
    );
  } else if (plateId === "lotus-multilink") {
    // Lotus Hethel Multi-Link Rear Subframe + Trailing Control Blade + Coilover Struts
    const subframe = slabOf({ x: -6, y: -9, w: 12, d: 18, r: 1.0 }, 2.2, 1.4, proj, 4);
    parts.push(solidSvg(subframe, { tone: "mid", crease: "lo" }));

    // Left & Right Wheel Hubs + Ventilated Discs + Coilovers
    for (const side of [-1, 1]) {
      const wy = side * 9.5;
      // Hub carrier
      const knuckle = cylinder(0, wy, 2.6, 1.8, 1.6, proj, 24);
      parts.push(solidSvg(knuckle, { tone: "hi", crease: "lo" }));

      // 3 Lateral Multi-Link Arms + Trailing Control Blade
      parts.push(
        lineSvg(segment([-2.5, side * 3.5, 2.9], [-1.8, wy, 2.8], proj), {
          tone: "green",
        })
      );
      parts.push(
        lineSvg(segment([2.5, side * 3.5, 2.9], [1.8, wy, 2.8], proj), {
          tone: "green",
        })
      );
      parts.push(
        lineSvg(segment([-11, side * 7.8, 3.2], [0, wy, 2.6], proj), {
          tone: "green",
        })
      );

      // Progressive Coil Spring & Damper Tower
      const spring = coil(3.4, 11.2, [0, side * 7.6], 1.4, 6.5, "y", proj);
      parts.push(lineSvg(spring.back, { tone: "faint" }));
      parts.push(lineSvg(spring.front, { tone: "green" }));

      const topMount = cylinder(0, side * 7.6, 1.9, 11.2, 0.9, proj, 20);
      parts.push(solidSvg(topMount, { tone: "green", lit: true }));
    }

    // Rear Strut Brace & Anti-Roll Bar
    parts.push(
      lineSvg(segment([0, -7.6, 11.8], [0, 7.6, 11.8], proj), {
        tone: "green",
      })
    );
    parts.push(
      lineSvg(segment([3.5, -8.5, 2.4], [3.5, 8.5, 2.4], proj), {
        tone: "hi",
        dashed: true,
      })
    );

    parts.push(
      faceTextSvg(
        topMatrix([-15, 9.8], 0.05, proj, "x"),
        "LOTUS HETHEL KINEMATICS // PASSIVE TOE CONTROL",
        { size: 2.0, tone: "mid" }
      )
    );
  } else if (plateId === "tgdi-7dct") {
    // 3G15TD 1.5L 3-Cyl Direct-Injection Turbo + 7-Speed Wet Dual-Clutch Transaxle
    const engineBlock = slabOf({ x: -13, y: -5.5, w: 13, d: 9.5, r: 0.9 }, 0.8, 6.4, proj, 5, 0.3);
    parts.push(solidSvg(engineBlock, { tone: "blue", lit: true, crease: "mid" }));

    // 3 Cylinder Direct-Injection 200-Bar Injectors
    for (let i = 0; i < 3; i++) {
      const cx = -10 + i * 3.8;
      const bore = cylinder(cx, -0.8, 1.65, 7.2, 1.4, proj, 24);
      parts.push(solidSvg(bore, { tone: "hi", lit: true }));
    }

    // Low-Inertia Turbocharger Turbine Housing & Compressor Scroll
    const turboTurbine = cylinder(-6.5, -7.2, 2.4, 3.2, 2.2, proj, 24);
    parts.push(solidSvg(turboTurbine, { tone: "red", lit: true }));
    const turboKnurl = knurl(-6.5, -7.2, 2.42, 3.2, 5.4, 18, proj);
    parts.push(lineSvg(turboKnurl, { tone: "red" }));

    // 7DCT330 Wet Dual-Clutch Transaxle Bellhousing & Concentric Clutches
    const dctHousing = cylinder(4.5, -0.8, 5.2, 1.2, 5.4, proj, 28, 0.3);
    parts.push(solidSvg(dctHousing, { tone: "mid", crease: "lo" }));
    const clutchBasket = cylinder(4.5, -0.8, 3.4, 6.6, 1.6, proj, 24);
    parts.push(solidSvg(clutchBasket, { tone: "blue", lit: true }));
    const clutchTicks = radialTicks(4.5, -0.8, 3.1, 24, 4, 8.25, [0.4, 0.9], proj);
    parts.push(lineSvg(clutchTicks.minor, { tone: "lo" }));
    parts.push(lineSvg(clutchTicks.major, { tone: "blue" }));

    parts.push(
      faceTextSvg(
        topMatrix([-15, 9.8], 0.05, proj, "x"),
        "3G15TD 1.5L TGDI + 7DCT330 WET DUAL-CLUTCH",
        { size: 2.0, tone: "mid" }
      )
    );
  } else {
    // GMA Cell-to-Body (CTB) Aegis Short-Blade LFP + 12-in-1 E-Drive Module
    const ctbTray = slabOf({ x: -14, y: -9, w: 21, d: 18, r: 1.0 }, 0.6, 2.4, proj, 5, 0.25);
    parts.push(solidSvg(ctbTray, { tone: "blue", lit: true, crease: "mid" }));

    // Individual Short-Blade LFP cells arrayed inside the CTB pack
    for (let bx = -12.2; bx <= 4.5; bx += 2.1) {
      const blade = slabOf({ x: bx, y: -7.6, w: 1.5, d: 15.2, r: 0.2 }, 3.0, 0.9, proj, 2);
      parts.push(solidSvg(blade, { tone: "hi", crease: "faint" }));
    }

    // Front 12-in-1 Integrated Electric Drive Unit (160 kW PMSM)
    const edrive = slabOf({ x: 8.2, y: -5.5, w: 6.4, d: 11, r: 0.9 }, 1.2, 4.8, proj, 5, 0.3);
    parts.push(solidSvg(edrive, { tone: "blue", lit: true, crease: "mid" }));

    // High-Voltage Busbars connecting CTB Pack to 12-in-1 Inverter
    parts.push(
      lineSvg(segment([6.5, -2.0, 2.8], [8.2, -2.0, 3.8], proj), {
        tone: "red",
        flow: true,
      })
    );
    parts.push(
      lineSvg(segment([6.5, 2.0, 2.8], [8.2, 2.0, 3.8], proj), {
        tone: "blue",
        flow: true,
      })
    );

    // Dot grid telemetry on inverter cover
    parts.push(
      dotsSvg(
        [
          iso([10.2, -3, 6.1], proj),
          iso([11.4, -3, 6.1], proj),
          iso([12.6, -3, 6.1], proj),
          iso([10.2, 0, 6.1], proj),
          iso([11.4, 0, 6.1], proj),
          iso([12.6, 0, 6.1], proj),
        ],
        { size: 0.8, tone: "hi" }
      )
    );

    parts.push(
      faceTextSvg(
        topMatrix([-15, 9.8], 0.05, proj, "x"),
        "GMA CELL-TO-BODY AEGIS LFP + 12-IN-1 E-DRIVE",
        { size: 2.0, tone: "mid" }
      )
    );
  }

  return figureSvg({
    width,
    height,
    label: `Isometric Engineering Cutaway ${plateId}`,
    body: parts,
  });
}

export const EngineeringPlates: React.FC<EngineeringPlatesProps> = ({
  theme = "dark",
}) => {
  const [selectedId, setSelectedId] = useState<string>(ENGINEERING_PLATES[0]!.id);
  const [azimuth, setAzimuth] = useState<number>(44);

  const activePlate: EngineeringPlateSpec =
    ENGINEERING_PLATES.find((p) => p.id === selectedId) ?? ENGINEERING_PLATES[0]!;

  const svgHtml = useMemo(
    () => renderPlateSvg(activePlate.id, azimuth),
    [activePlate.id, azimuth]
  );

  return (
    <section className="eng-lab-section" id="engineering-lab">
      <div className="section-header-bar">
        <div>
          <span className="section-kicker">
            TECHNICAL ARCHIVE // ISOMETRIC POWERTRAIN &amp; CHASSIS ANATOMY
          </span>
          <h2 className="section-title">
            Four Decades of Malaysian Powertrain &amp; Dynamics Engineering
          </h2>
        </div>
        <div className="eng-lab-tabs" role="tablist">
          {ENGINEERING_PLATES.map((plate) => (
            <button
              key={plate.id}
              type="button"
              role="tab"
              aria-selected={plate.id === selectedId}
              className={`eng-tab-btn ${plate.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(plate.id)}
            >
              <span className="eng-tab-fig">{plate.fig}</span>
              <span className="eng-tab-name">{plate.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="eng-lab-grid">
        <div className="eng-plate-viewer iso" data-theme={theme}>
          <div className="iso-plate">
            <div className="iso-plate-corners" aria-hidden="true">
              <span className="iso-plate-corner" data-corner="fig">
                {activePlate.fig}
              </span>
              <span className="iso-plate-corner" data-corner="title">
                {activePlate.code}
              </span>
              <span className="iso-plate-corner" data-corner="hint">
                AZIMUTH {azimuth}°
              </span>
              <span
                className="iso-plate-corner"
                data-corner="readout"
                data-readout=""
              >
                {activePlate.readout}
              </span>
            </div>
            <div
              className="iso-canvas-holder"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
            <div className="iso-controls-bar">
              <div className="iso-layer-pills">
                {[30, 44, 65, 125].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    className={`iso-pill-btn ${azimuth === ang ? "active" : ""}`}
                    onClick={() => setAzimuth(ang)}
                  >
                    CAM {ang}°
                  </button>
                ))}
              </div>
              <label className="iso-slider-label">
                <span>ORBIT {azimuth}°</span>
                <input
                  type="range"
                  min={20}
                  max={160}
                  value={azimuth}
                  onChange={(e) => setAzimuth(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="eng-plate-dossier">
          <div className="dossier-badge">{activePlate.era}</div>
          <h3 className="dossier-title">{activePlate.title}</h3>
          <p className="dossier-summary">{activePlate.summary}</p>

          <div className="dossier-specs-grid">
            {activePlate.specs.map((s) => (
              <div key={s.label} className="dossier-spec-cell">
                <span className="spec-cell-label">{s.label}</span>
                <strong className="spec-cell-value">{s.value}</strong>
              </div>
            ))}
          </div>

          <div className="dossier-footnote">
            <span>ARCHIVE provenance:</span> Proton R&amp;D Shah Alam / Lotus
            Engineering Hethel / Tanjung Malim Powertrain Division
          </div>
        </div>
      </div>
    </section>
  );
};
