import React, { useMemo, useState } from "react";
import {
  ProtonCar,
} from "../data/proton-archive";
import {
  fitProjection,
  slabOf,
  cylinder,
  extrude,
  coil,
  sideRing,
  lineOnTop,
  segment,
  topTicks,
  wireSvg,
  solidSvg,
  lineSvg,
  dotsSvg,
  faceTextSvg,
  topMatrix,
  iso,
  figureSvg,
  Point3,
  Plane,
} from "../lib/iso-kit";

interface IsoCarBlueprintProps {
  car: ProtonCar;
  theme?: "dark" | "light";
  compact?: boolean;
}

export type BlueprintLayer = "all" | "powertrain" | "suspension" | "body";

export const IsoCarBlueprint: React.FC<IsoCarBlueprintProps> = ({
  car,
  theme = "dark",
  compact = false,
}) => {
  const [exploded, setExploded] = useState<boolean>(false);
  const [azimuth, setAzimuth] = useState<number>(42);
  const [elevation, setElevation] = useState<number>(28);
  const [activeLayer, setActiveLayer] = useState<BlueprintLayer>("all");

  const svgMarkup = useMemo(() => {
    const p = car.isoProfile;
    const L = p.lengthUnits;
    const W = p.widthUnits;
    const halfL = L / 2;
    const halfW = W / 2;
    const zLift = exploded ? 9.5 : 0;

    const width = compact ? 540 : 760;
    const height = compact ? 310 : 430;

    const bounds: Point3[] = [
      [-halfL - 6, -halfW - 6, 0],
      [halfL + 6, halfW + 6, p.roofZ + (exploded ? 12 : 4)],
      [-halfL - 6, halfW + 6, 0],
      [halfL + 6, -halfW - 6, p.roofZ + (exploded ? 12 : 4)],
    ];

    const proj = fitProjection(bounds, width, height, {
      pad: compact ? 22 : 38,
      headroom: compact ? 12 : 24,
      azimuth,
      elevation,
    });

    const parts: string[] = [];

    // 1. Datum Base Grid & Measurement Plinth
    const plinthPlan = {
      x: -halfL - 4,
      y: -halfW - 3.5,
      w: L + 8,
      d: W + 7,
      r: 1.5,
    };
    const plinth = slabOf(plinthPlan, -0.8, 0.8, proj, 6);
    parts.push(
      solidSvg(plinth, {
        tone: "lo",
        crease: "faint",
        halo: true,
      })
    );

    // Grid dots on plinth surface
    parts.push(
      dotsSvg(
        (() => {
          const pts: [number, number][] = [];
          for (let gx = -Math.floor(halfL); gx <= Math.floor(halfL); gx += 4) {
            for (let gy = -Math.floor(halfW); gy <= Math.floor(halfW); gy += 3) {
              pts.push(iso([gx, gy, 0.02], proj));
            }
          }
          return pts;
        })(),
        { size: 0.55, tone: "lo" }
      )
    );

    // Scale ruler ticks along front edge of datum plinth
    const rulerTicks = topTicks(
      -halfL,
      halfL,
      2,
      5,
      halfW + 1.8,
      0.05,
      [0.6, 1.3],
      proj,
      "x"
    );
    parts.push(lineSvg(rulerTicks.minor, { tone: "faint" }));
    parts.push(lineSvg(rulerTicks.major, { tone: "mid" }));

    // Centerline axis
    parts.push(
      lineSvg(
        lineOnTop([-halfL - 3.5, 0], [halfL + 3.5, 0], 0.05, proj),
        { tone: "faint", dashed: true }
      )
    );

    // Wheel X positions (front is -X, rear is +X)
    const frontAxleX = -p.wheelbaseUnits / 2;
    const rearAxleX = p.wheelbaseUnits / 2;
    const wheelZ = p.wheelRadius;

    // 2. Structural Floorpan / Chassis Rails / Battery Pack (on EV)
    const chassisTone =
      activeLayer === "body"
        ? p.tone
        : activeLayer === "all"
          ? "mid"
          : "lo";

    if (p.powertrainType === "ev-ctb") {
      // Cell-to-Body Aegis Short-Blade LFP structural battery floor
      const ctbPlan = {
        x: frontAxleX + 2.5,
        y: -halfW + 1.6,
        w: p.wheelbaseUnits - 5,
        d: W - 3.2,
        r: 0.8,
      };
      const ctbSlab = slabOf(ctbPlan, p.groundClearanceZ, 1.6, proj, 4, 0.2);
      parts.push(
        solidSvg(ctbSlab, {
          tone: activeLayer === "powertrain" || activeLayer === "all" ? "blue" : "mid",
          crease: "lo",
          lit: activeLayer === "powertrain",
        })
      );
      // Short-blade cell array lines on top of CTB pack
      for (let cx = ctbPlan.x + 1.2; cx < ctbPlan.x + ctbPlan.w - 1; cx += 1.4) {
        parts.push(
          lineSvg(
            lineOnTop(
              [cx, ctbPlan.y + 0.6],
              [cx, ctbPlan.y + ctbPlan.d - 0.6],
              p.groundClearanceZ + 1.62,
              proj
            ),
            { tone: "blue" }
          )
        );
      }
    } else {
      // Longitudinal chassis rails + central exhaust/transmission tunnel
      const railLeft = slabOf(
        { x: -halfL + 2, y: -halfW + 2.2, w: L - 4, d: 1.4, r: 0.3 },
        p.groundClearanceZ,
        1.1,
        proj,
        2
      );
      const railRight = slabOf(
        { x: -halfL + 2, y: halfW - 3.6, w: L - 4, d: 1.4, r: 0.3 },
        p.groundClearanceZ,
        1.1,
        proj,
        2
      );
      const centerTunnel = slabOf(
        { x: frontAxleX + 1, y: -1.1, w: p.wheelbaseUnits + 3, d: 2.2, r: 0.4 },
        p.groundClearanceZ,
        1.5,
        proj,
        2
      );
      parts.push(solidSvg(railLeft, { tone: chassisTone, crease: "faint" }));
      parts.push(solidSvg(railRight, { tone: chassisTone, crease: "faint" }));
      parts.push(solidSvg(centerTunnel, { tone: chassisTone, crease: "faint" }));
    }

    // 3. Suspension & Wheel Assemblies (4 Corners)
    const suspHighlight =
      activeLayer === "suspension" || activeLayer === "all";
    const suspTone = activeLayer === "suspension" ? "green" : "mid";

    const wheelCorners: [number, number][] = [
      [frontAxleX, -halfW + 0.9],
      [frontAxleX, halfW - 0.9],
      [rearAxleX, -halfW + 0.9],
      [rearAxleX, halfW - 0.9],
    ];

    for (const [wx, wy] of wheelCorners) {
      // Brake disc + hub ring
      parts.push(
        lineSvg(
          sideRing([wx, wy, wheelZ], p.wheelRadius * 0.95, "x", proj, 24),
          { tone: suspHighlight ? "hi" : "lo" }
        )
      );
      parts.push(
        lineSvg(
          sideRing([wx, wy * 0.92, wheelZ], p.wheelRadius * 0.62, "x", proj, 18),
          { tone: suspTone, dashed: true }
        )
      );
      // Coilover spring rising from hub to strut tower
      const strutCoil = coil(
        wheelZ + 0.5,
        p.beltlineZ - 0.3,
        [wx, wy * 0.78],
        0.75,
        4.5,
        "y",
        proj
      );
      parts.push(lineSvg(strutCoil.back, { tone: "faint" }));
      parts.push(
        lineSvg(strutCoil.front, {
          tone: activeLayer === "suspension" ? "green" : "hi",
        })
      );
    }

    // Front & Rear Anti-Roll Bars + Multi-Link / Torsion Beam Crossmembers
    parts.push(
      lineSvg(
        segment(
          [frontAxleX, -halfW + 1.5, wheelZ],
          [frontAxleX, halfW - 1.5, wheelZ],
          proj
        ),
        { tone: suspTone }
      )
    );
    parts.push(
      lineSvg(
        segment(
          [rearAxleX, -halfW + 1.5, wheelZ],
          [rearAxleX, halfW - 1.5, wheelZ],
          proj
        ),
        { tone: suspTone }
      )
    );
    // Front strut tower brace
    parts.push(
      lineSvg(
        segment(
          [frontAxleX, -halfW + 2.2, p.beltlineZ - 0.2],
          [frontAxleX, halfW - 2.2, p.beltlineZ - 0.2],
          proj
        ),
        { tone: activeLayer === "suspension" ? "green" : p.tone }
      )
    );

    // 4. Transverse Front Powertrain Module (Engine / 12-in-1 E-Drive + Transaxle)
    const pwrTone =
      activeLayer === "powertrain"
        ? p.tone
        : activeLayer === "all"
          ? p.tone
          : "lo";
    const engineX = frontAxleX - 1.5;
    if (p.powertrainType === "ev-ctb") {
      // 12-in-1 Compact E-Drive Unit
      const edrive = slabOf(
        { x: engineX - 2.2, y: -3.6, w: 4.6, d: 7.2, r: 0.8 },
        p.groundClearanceZ + 0.8,
        3.0,
        proj,
        4,
        0.25
      );
      parts.push(
        solidSvg(edrive, {
          tone: pwrTone,
          lit: activeLayer === "powertrain" || activeLayer === "all",
          crease: "mid",
        })
      );
      // High-voltage orange/blue busbar lines to CTB pack
      parts.push(
        lineSvg(
          segment(
            [engineX + 2.4, -0.8, p.groundClearanceZ + 2.2],
            [frontAxleX + 3.5, -0.8, p.groundClearanceZ + 1.6],
            proj
          ),
          { tone: "blue", flow: true }
        )
      );
      parts.push(
        lineSvg(
          segment(
            [engineX + 2.4, 0.8, p.groundClearanceZ + 2.2],
            [frontAxleX + 3.5, 0.8, p.groundClearanceZ + 1.6],
            proj
          ),
          { tone: "blue", flow: true }
        )
      );
    } else {
      // Transverse IC Engine Block + Cylinder Head + Transaxle
      const cylCount =
        p.powertrainType === "tgdi-i3"
          ? 3
          : p.powertrainType === "v6"
            ? 6
            : 4;
      const engineBlock = slabOf(
        { x: engineX - 2.4, y: -4.2, w: 4.8, d: 6.2, r: 0.5 },
        p.groundClearanceZ + 0.8,
        3.6,
        proj,
        4,
        0.2
      );
      const transaxle = slabOf(
        { x: engineX - 1.8, y: 2.0, w: 3.6, d: 3.0, r: 0.5 },
        p.groundClearanceZ + 0.6,
        2.6,
        proj,
        4
      );
      parts.push(
        solidSvg(transaxle, {
          tone: "mid",
          crease: "lo",
        })
      );
      parts.push(
        solidSvg(engineBlock, {
          tone: pwrTone,
          lit: activeLayer === "powertrain" || activeLayer === "all",
          crease: "mid",
        })
      );
      // Cylinder bores / coil packs on top of valve cover
      const boreSpan = 4.6;
      const boreCount = cylCount === 6 ? 3 : cylCount;
      for (let i = 0; i < boreCount; i++) {
        const cy = -3.4 + (i + 0.5) * (boreSpan / boreCount);
        const cap = cylinder(
          engineX,
          cy,
          0.62,
          p.groundClearanceZ + 4.4,
          0.55,
          proj,
          16
        );
        parts.push(solidSvg(cap, { tone: pwrTone, lit: true }));
      }
    }

    // 5. Exploded Drop-Lines (when Exploded mode is active)
    if (exploded) {
      const dropCorners: Plane[] = [
        [-halfL + 3, -halfW + 2],
        [-halfL + 3, halfW - 2],
        [halfL - 3, -halfW + 2],
        [halfL - 3, halfW - 2],
      ];
      for (const [dx, dy] of dropCorners) {
        parts.push(
          lineSvg(
            segment(
              [dx, dy, p.groundClearanceZ + 1.2],
              [dx, dy, p.groundClearanceZ + zLift],
              proj
            ),
            { tone: p.tone, dotted: true }
          )
        );
      }
    }

    // 6. Upper Body Shell (Lower Monocoque Beltline + Upper Greenhouse Cabin)
    const bodyZ = p.groundClearanceZ + zLift;
    const beltHeight = p.beltlineZ - p.groundClearanceZ;
    const bodyTone =
      activeLayer === "body"
        ? p.tone
        : activeLayer === "all"
          ? "hi"
          : "lo";

    // Lower body waist slab
    const lowerBodyPlan = {
      x: -halfL,
      y: -halfW,
      w: L,
      d: W,
      r: 2.2,
    };
    const lowerBody = slabOf(lowerBodyPlan, bodyZ, beltHeight, proj, 6, 0.35);
    parts.push(
      solidSvg(lowerBody, {
        tone: bodyTone,
        crease: "lo",
        lit: activeLayer === "body",
      })
    );

    // Front radiator grille / Infinite Weave / EV aero nose detail
    const grilleY0 = -halfW + 2.8;
    const grilleY1 = halfW - 2.8;
    for (let gz = bodyZ + 1.0; gz < bodyZ + beltHeight - 0.6; gz += 0.85) {
      parts.push(
        lineSvg(
          segment([-halfL - 0.05, grilleY0, gz], [-halfL - 0.05, grilleY1, gz], proj),
          { tone: p.tone }
        )
      );
    }

    // Greenhouse / Cabin Roof Extrusion
    const cabinStartX = -halfL + p.hoodLen;
    const cabinEndX = cabinStartX + p.cabinLen;
    const greenhouseHeight = p.roofZ - p.beltlineZ;

    if (p.bodyStyle === "ute") {
      // Arena / Jumbuck Coupé Utility: short cab + open cargo bed with sports bar
      const cabPlan = {
        x: cabinStartX,
        y: -halfW + 1.3,
        w: p.cabinLen,
        d: W - 2.6,
        r: 1.4,
      };
      const cab = slabOf(
        cabPlan,
        bodyZ + beltHeight,
        greenhouseHeight,
        proj,
        5,
        0.3
      );
      parts.push(
        solidSvg(cab, {
          tone: bodyTone,
          crease: "mid",
        })
      );
      // Cargo bed inner floor & longitudinal corrugations
      const bedX = cabinEndX + 0.8;
      const bedW = halfL - bedX - 1.2;
      for (let by = -halfW + 2.2; by <= halfW - 2.2; by += 1.6) {
        parts.push(
          lineSvg(
            lineOnTop([bedX, by], [bedX + bedW, by], bodyZ + beltHeight + 0.05, proj),
            { tone: "mid" }
          )
        );
      }
    } else {
      const cabinPlan = {
        x: cabinStartX,
        y: -halfW + 1.3,
        w: p.cabinLen,
        d: W - 2.6,
        r: 1.6,
      };
      const greenhouse = extrude(
        [
          [cabinPlan.x, cabinPlan.y],
          [cabinPlan.x + cabinPlan.w, cabinPlan.y],
          [cabinPlan.x + cabinPlan.w, cabinPlan.y + cabinPlan.d],
          [cabinPlan.x, cabinPlan.y + cabinPlan.d],
        ],
        bodyZ + beltHeight,
        greenhouseHeight,
        proj,
        { convex: true, bevel: 0.45 }
      );
      parts.push(
        solidSvg(greenhouse, {
          tone: bodyTone,
          crease: "mid",
          lit: activeLayer === "body",
        })
      );
    }

    // Rear Spoiler / Aero Wing (Satria GTi, Putra, Satria Neo, Prevé, S70, X50, etc.)
    if (p.spoiler) {
      const spoilerX =
        p.bodyStyle === "hatch" || p.bodyStyle === "suv" || p.bodyStyle === "ev-suv"
          ? cabinEndX - 1.8
          : halfL - 2.2;
      const spoilerZ =
        p.bodyStyle === "hatch" || p.bodyStyle === "suv" || p.bodyStyle === "ev-suv"
          ? bodyZ + beltHeight + greenhouseHeight + 0.2
          : bodyZ + beltHeight + 0.45;
      const wing = slabOf(
        { x: spoilerX, y: -halfW + 1.6, w: 1.9, d: W - 3.2, r: 0.3 },
        spoilerZ,
        0.45,
        proj,
        2
      );
      parts.push(solidSvg(wing, { tone: p.tone, lit: true }));
    }

    // 7. Isometric Face Stamp on Plinth
    const labelTransform = topMatrix(
      [-halfL + 1, halfW + 4.2],
      0.08,
      proj,
      "x"
    );
    parts.push(
      faceTextSvg(
        labelTransform,
        `${car.catalogNo} // ${car.chassisCode} // WB ${car.wheelbaseMm}MM`,
        { size: 2.1, tone: "mid" }
      )
    );

    // 8. Technical Wire Callouts (on full view)
    if (!compact) {
      const frontTarget = iso([frontAxleX - 1, -2, p.groundClearanceZ + 2.5], proj);
      const frontAnchor: [number, number] = [34, 46];
      parts.push(
        wireSvg(frontAnchor, frontTarget, {
          via: [[frontAnchor[0] + 55, frontAnchor[1]]],
          tone: p.tone,
          size: 1.5,
        })
      );

      const midTarget = iso([0, 0, bodyZ + beltHeight + 1.5], proj);
      const midAnchor: [number, number] = [width - 34, 48];
      parts.push(
        wireSvg(midAnchor, midTarget, {
          via: [[midAnchor[0] - 55, midAnchor[1]]],
          tone: "hi",
          size: 1.5,
        })
      );

      const rearTarget = iso([rearAxleX, halfW - 1, wheelZ + 1], proj);
      const rearAnchor: [number, number] = [width - 34, height - 38];
      parts.push(
        wireSvg(rearAnchor, rearTarget, {
          via: [[rearAnchor[0] - 60, rearAnchor[1]]],
          tone: activeLayer === "suspension" ? "green" : "mid",
          size: 1.5,
        })
      );
    }

    return figureSvg({
      width,
      height,
      label: `${car.name} (${car.year}) Isometric Technical CAD Blueprint`,
      body: parts,
    });
  }, [car, exploded, azimuth, elevation, activeLayer, compact]);

  return (
    <div className={`iso-blueprint-wrap iso`} data-theme={theme}>
      <div className="iso-plate">
        <div className="iso-plate-corners" aria-hidden="true">
          <span className="iso-plate-corner" data-corner="fig">
            {car.catalogNo} // CAD-ISO
          </span>
          <span className="iso-plate-corner" data-corner="title">
            {car.chassisCode} ARCHITECTURE // {car.drivetrain}
          </span>
          {!compact && (
            <>
              <span className="iso-plate-corner" data-corner="hint">
                AZIMUTH {azimuth}° // ELEV {elevation}°{" "}
                {exploded ? "// EXPLODED Z-AXIS" : "// ASSEMBLED"}
              </span>
              <span
                className="iso-plate-corner"
                data-corner="readout"
                data-readout=""
              >
                {car.isoProfile.callouts.chassisNote}
              </span>
            </>
          )}
        </div>

        {/* Callout Overlay Badges on Full View */}
        {!compact && (
          <div className="iso-callout-hud">
            <div className="iso-hud-tag iso-hud-tl">
              <span className="iso-hud-kicker">01 // POWERTRAIN MODULE</span>
              <strong>{car.isoProfile.callouts.frontLabel}</strong>
            </div>
            <div className="iso-hud-tag iso-hud-tr">
              <span className="iso-hud-kicker">02 // BODY & MONOCOQUE</span>
              <strong>{car.isoProfile.callouts.midLabel}</strong>
            </div>
            <div className="iso-hud-tag iso-hud-br">
              <span className="iso-hud-kicker">03 // REAR KINEMATICS</span>
              <strong>{car.isoProfile.callouts.rearLabel}</strong>
            </div>
          </div>
        )}

        <div
          className="iso-canvas-holder"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        {!compact && (
          <div className="iso-controls-bar">
            <div className="iso-layer-pills">
              {(
                [
                  ["all", "ALL SYSTEMS"],
                  ["powertrain", "POWERTRAIN"],
                  ["suspension", "LOTUS / R&D SUSPENSION"],
                  ["body", "MONOCOQUE SHELL"],
                ] as [BlueprintLayer, string][]
              ).map(([layerKey, label]) => (
                <button
                  key={layerKey}
                  type="button"
                  onClick={() => setActiveLayer(layerKey)}
                  className={`iso-pill-btn ${activeLayer === layerKey ? "active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="iso-cam-controls">
              <button
                type="button"
                onClick={() => setExploded((prev) => !prev)}
                className={`iso-pill-btn iso-explode-btn ${exploded ? "active" : ""}`}
              >
                {exploded ? "COLLAPSE SHELL" : "EXPLODE Z-AXIS"}
              </button>

              <label className="iso-slider-label">
                <span>ROTATE {azimuth}°</span>
                <input
                  type="range"
                  min={20}
                  max={155}
                  value={azimuth}
                  onChange={(e) => setAzimuth(Number(e.target.value))}
                />
              </label>

              <label className="iso-slider-label">
                <span>PITCH {elevation}°</span>
                <input
                  type="range"
                  min={15}
                  max={45}
                  value={elevation}
                  onChange={(e) => setElevation(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
