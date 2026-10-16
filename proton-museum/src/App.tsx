import React, { useState, useMemo, useEffect } from "react";
import {
  ERAS,
  PROTON_CARS,
  ProtonCar,
  EraId,
  BodyCategory,
} from "./data/proton-archive";
import { IsoCarBlueprint } from "./components/IsoCarBlueprint";
import { EngineeringPlates } from "./components/EngineeringPlates";
import { DynoChart } from "./components/DynoChart";
import {
  Compass,
  Cpu,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Factory,
  CheckCircle2,
  Eye,
} from "lucide-react";

const BODY_CATEGORIES: ("All" | BodyCategory)[] = [
  "All",
  "Saloon",
  "Aeroback / Hatch",
  "Coupé / Utility",
  "MPV",
  "SUV / EV",
];

export const App: React.FC = () => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedCarId, setSelectedCarId] = useState<string>("satria-gti-1998");
  const [compareCarId, setCompareCarId] = useState<string | null>("emas7-2024");
  const [activeEra, setActiveEra] = useState<"all" | EraId>("all");
  const [activeCategory, setActiveCategory] = useState<"All" | BodyCategory>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [catalogMode, setCatalogMode] = useState<"photo" | "cad">("photo");
  const [stageTab, setStageTab] = useState<"cad" | "photo" | "split">("split");
  const [selectedSwatchIdx, setSelectedSwatchIdx] = useState<number>(0);

  const selectedCar: ProtonCar = useMemo(
    () =>
      PROTON_CARS.find((c) => c.id === selectedCarId) ?? PROTON_CARS[0]!,
    [selectedCarId]
  );

  const selectedCarIndex = useMemo(
    () => PROTON_CARS.findIndex((c) => c.id === selectedCar.id),
    [selectedCar.id]
  );

  const selectedEraInfo = useMemo(
    () => ERAS.find((e) => e.id === selectedCar.eraId) ?? ERAS[0]!,
    [selectedCar.eraId]
  );

  useEffect(() => {
    setSelectedSwatchIdx(0);
  }, [selectedCarId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        const nextIdx = (selectedCarIndex + 1) % PROTON_CARS.length;
        setSelectedCarId(PROTON_CARS[nextIdx]!.id);
      } else if (e.key === "ArrowLeft") {
        const prevIdx =
          (selectedCarIndex - 1 + PROTON_CARS.length) % PROTON_CARS.length;
        setSelectedCarId(PROTON_CARS[prevIdx]!.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCarIndex]);

  const filteredCars = useMemo(() => {
    return PROTON_CARS.filter((car) => {
      if (activeEra !== "all" && car.eraId !== activeEra) return false;
      if (activeCategory !== "All" && car.category !== activeCategory)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          car.name,
          car.localSubtitle,
          car.chassisCode,
          car.engine.code,
          car.year.toString(),
          car.plant,
          car.tagline,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeEra, activeCategory, searchQuery]);

  const handleSelectCar = (carId: string, scrollToStage = false) => {
    setSelectedCarId(carId);
    if (scrollToStage) {
      const el = document.getElementById("primary-exhibit-stage");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeSwatch =
    selectedCar.factoryColors[selectedSwatchIdx] ??
    selectedCar.factoryColors[0]!;

  return (
    <div className={`museum-shell theme-${theme}`} data-theme={theme}>
      {/* Top Archival Telemetry Bar */}
      <header className="museum-topbar">
        <div className="topbar-brand">
          <div className="brand-emblem" aria-hidden="true">
            <span className="emblem-ring" />
            <span className="emblem-core">P</span>
          </div>
          <div>
            <div className="brand-title-row">
              <span className="brand-code">GALERI PROTON</span>
              <span className="brand-divider">//</span>
              <span className="brand-sub">
                ARKIB KEJURUTERAAN OTOMOBIL NASIONAL (1983–2025)
              </span>
            </div>
            <p className="brand-meta">
              SHAH ALAM SEKSYEN 26 • TANJUNG MALIM PROTON CITY • HETHEL NORFOLK
            </p>
          </div>
        </div>

        <nav className="topbar-nav" aria-label="Museum Sections">
          <a href="#primary-exhibit-stage" className="nav-link">
            01 // EXHIBIT STAGE
          </a>
          <a href="#chronological-timeline" className="nav-link">
            02 // ERA TIMELINE
          </a>
          <a href="#archive-vault" className="nav-link">
            03 // 18-VEHICLE VAULT
          </a>
          <a href="#engineering-lab" className="nav-link">
            04 // POWERTRAIN LAB
          </a>
        </nav>

        <div className="topbar-actions">
          <div className="archive-counter">
            <span>EXHIBITS</span>
            <strong>18 / 18 VERIFIED</strong>
          </div>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Switch Archive Lighting Mode"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === "dark" ? "BLUEPRINT LIGHT" : "ARCHIVE DARK"}</span>
          </button>
        </div>
      </header>

      <main className="museum-main">
        {/* Hero Banner + Interactive Chronological Ribbon */}
        <section className="hero-ribbon-section" id="chronological-timeline">
          <div className="hero-intro-grid">
            <div className="hero-headline-col">
              <div className="hero-kicker">
                <Sparkles size={13} />
                <span>
                  PERUSAHAAN OTOMOBIL NASIONAL // 42 YEARS OF MALAYSIAN AUTOMOTIVE
                  ENGINEERING
                </span>
              </div>
              <h1 className="hero-main-title">
                From the 1985 Shah Alam <em>Saga</em> to the Cell-to-Body{" "}
                <em>e.MAS 7</em>.
              </h1>
              <p className="hero-lead">
                An interactive curatorial archive and 3D isometric CAD engineering
                study of 18 milestone vehicles that shaped Malaysia&apos;s industrial
                landscape—spanning the Mitsubishi technology transfer, Lotus Hethel
                chassis dynamics, indigenous CamPro powertrains, and the Geely global
                electrification alliance.
              </p>
            </div>

            <div className="hero-stats-matrix">
              <div className="hero-stat-card">
                <span className="stat-kicker">INCORPORATED</span>
                <strong className="stat-big">07.05.1983</strong>
                <span className="stat-foot">
                  HICOM Heavy Industries Initiative
                </span>
              </div>
              <div className="hero-stat-card">
                <span className="stat-kicker">CUMULATIVE PRODUCTION</span>
                <strong className="stat-big">&gt; 5.0M</strong>
                <span className="stat-foot">
                  Shah Alam &amp; Tanjung Malim Plants
                </span>
              </div>
              <div className="hero-stat-card">
                <span className="stat-kicker">LOTUS ACQUISITION</span>
                <strong className="stat-big">1996</strong>
                <span className="stat-foot">
                  Group Lotus plc (Hethel, Norfolk)
                </span>
              </div>
              <div className="hero-stat-card">
                <span className="stat-kicker">PEAK RIGIDITY</span>
                <strong className="stat-big">29,000</strong>
                <span className="stat-foot">
                  Nm/deg (e.MAS 7 CTB Structure)
                </span>
              </div>
            </div>
          </div>

          {/* Interactive 18-Car Chronological Scrubber Strip */}
          <div className="timeline-scrubber-bar" role="region" aria-label="1985 to 2024 Vehicle Timeline">
            <div className="scrubber-header">
              <span className="scrubber-label">
                CHRONOLOGICAL ARCHIVE SCRUBBER (1985–2024) // USE ← → KEYS OR CLICK TO INSPECT
              </span>
              <span className="scrubber-active-indicator">
                ACTIVE: {selectedCar.year} {selectedCar.name} ({selectedCar.catalogNo})
              </span>
            </div>
            <div className="scrubber-track">
              {PROTON_CARS.map((car) => {
                const isSelected = car.id === selectedCar.id;
                return (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => handleSelectCar(car.id)}
                    className={`scrubber-node ${isSelected ? "active" : ""}`}
                    data-era={car.eraId}
                  >
                    <span className="node-year">{car.year}</span>
                    <span className="node-dot" />
                    <span className="node-model">
                      {car.name.replace("Proton ", "").split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRIMARY INTERACTIVE EXHIBIT STAGE */}
        <section className="primary-stage-section" id="primary-exhibit-stage">
          <div className="stage-top-UtilityBar">
            <div className="stage-breadcrumb">
              <span className="era-pill" data-era={selectedCar.eraId}>
                ERA {selectedEraInfo.roman} // {selectedEraInfo.years}
              </span>
              <span className="catalog-id">{selectedCar.catalogNo}</span>
              <span className="chassis-badge">
                CHASSIS: {selectedCar.chassisCode}
              </span>
              <span className="plant-badge">
                <Factory size={13} /> {selectedCar.plant}
              </span>
            </div>

            <div className="stage-view-Controls">
              <div className="stage-mode-switcher">
                <button
                  type="button"
                  className={`mode-btn ${stageTab === "split" ? "active" : ""}`}
                  onClick={() => setStageTab("split")}
                >
                  <Layers size={14} /> SPLIT STUDIO
                </button>
                <button
                  type="button"
                  className={`mode-btn ${stageTab === "cad" ? "active" : ""}`}
                  onClick={() => setStageTab("cad")}
                >
                  <Compass size={14} /> FULL 3D CAD
                </button>
                <button
                  type="button"
                  className={`mode-btn ${stageTab === "photo" ? "active" : ""}`}
                  onClick={() => setStageTab("photo")}
                >
                  <Eye size={14} /> ARCHIVE PHOTO
                </button>
              </div>

              <div className="stage-step-buttons">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => {
                    const prev =
                      (selectedCarIndex - 1 + PROTON_CARS.length) %
                      PROTON_CARS.length;
                    setSelectedCarId(PROTON_CARS[prev]!.id);
                  }}
                  title="Previous Vehicle (Left Arrow)"
                >
                  <ChevronLeft size={16} /> PREV
                </button>
                <span className="step-index">
                  {String(selectedCarIndex + 1).padStart(2, "0")} /{" "}
                  {PROTON_CARS.length}
                </span>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => {
                    const next = (selectedCarIndex + 1) % PROTON_CARS.length;
                    setSelectedCarId(PROTON_CARS[next]!.id);
                  }}
                  title="Next Vehicle (Right Arrow)"
                >
                  NEXT <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Vehicle Title & Tagline Header */}
          <div className="stage-title-banner">
            <div>
              <div className="stage-subtitle-line">
                {selectedCar.year} • {selectedCar.localSubtitle} •{" "}
                {selectedCar.category}
              </div>
              <h2 className="stage-car-name">{selectedCar.name}</h2>
              <p className="stage-car-tagline">{selectedCar.tagline}</p>
            </div>

            <div className="stage-quick-kpis">
              <div className="kpi-box">
                <span className="kpi-label">PEAK OUTPUT</span>
                <strong className="kpi-val">
                  {selectedCar.engine.powerHp} <small>BHP</small>
                </strong>
                <span className="kpi-sub">@ {selectedCar.engine.powerRpm}</span>
              </div>
              <div className="kpi-box">
                <span className="kpi-label">PEAK TORQUE</span>
                <strong className="kpi-val">
                  {selectedCar.engine.torqueNm} <small>NM</small>
                </strong>
                <span className="kpi-sub">@ {selectedCar.engine.torqueRpm}</span>
              </div>
              <div className="kpi-box">
                <span className="kpi-label">0–100 KM/H</span>
                <strong className="kpi-val">
                  {selectedCar.performance.zeroToHundredSec} <small>SEC</small>
                </strong>
                <span className="kpi-sub">
                  VMAX {selectedCar.performance.topSpeedKmh} KM/H
                </span>
              </div>
              <div className="kpi-box">
                <span className="kpi-label">CURB MASS</span>
                <strong className="kpi-val">
                  {selectedCar.curbWeightKg} <small>KG</small>
                </strong>
                <span className="kpi-sub">
                  {selectedCar.performance.powerToWeightHpPerTon} BHP/TON
                </span>
              </div>
            </div>
          </div>

          {/* Split / Full Stage Visual Viewport */}
          <div className={`stage-visual-grid mode-${stageTab}`}>
            {(stageTab === "split" || stageTab === "photo") && (
              <div className="stage-photo-card">
                <div className="photo-frame">
                  <img
                    src={selectedCar.image}
                    alt={`${selectedCar.year} ${selectedCar.name}`}
                    className="stage-car-img"
                  />
                  <div className="photo-overlay-badges">
                    <span className="overlay-chip">
                      LAUNCH PRICE: {selectedCar.launchPriceMYR}
                    </span>
                    <span className="overlay-chip">
                      VOLUME: {selectedCar.productionVolume}
                    </span>
                    <span className="overlay-chip">
                      DRAG Cd: {selectedCar.dragCd}
                    </span>
                  </div>
                </div>

                {/* Factory OEM Paint Swatch Selector */}
                <div className="paint-swatch-bar">
                  <div className="swatch-info">
                    <span className="swatch-kicker">
                      FACTORY OEM FINISH // CODE {activeSwatch.code}
                    </span>
                    <strong className="swatch-name">{activeSwatch.name}</strong>
                  </div>
                  <div className="swatch-buttons">
                    {selectedCar.factoryColors.map((sw, idx) => (
                      <button
                        key={sw.code}
                        type="button"
                        onClick={() => setSelectedSwatchIdx(idx)}
                        className={`swatch-circle-btn ${idx === selectedSwatchIdx ? "active" : ""}`}
                        style={{ backgroundColor: sw.hex }}
                        title={`${sw.name} (${sw.code})`}
                        aria-label={`${sw.name} (${sw.code})`}
                      />
                    ))}
                  </div>
                </div>

                {/* Curatorial Essay */}
                <div className="curatorial-essay-box">
                  <div className="essay-kicker">
                    CURATORIAL MONOGRAPH // PRODUCTION SPAN{" "}
                    {selectedCar.productionSpan}
                  </div>
                  <p className="essay-text">{selectedCar.curatorialEssay}</p>
                  <div className="milestones-list">
                    {selectedCar.historicalMilestones.map((m, idx) => (
                      <div key={idx} className="milestone-item">
                        <CheckCircle2 size={14} className="milestone-icon" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(stageTab === "split" || stageTab === "cad") && (
              <div className="stage-cad-column">
                <IsoCarBlueprint car={selectedCar} theme={theme} />
                <DynoChart
                  primaryCar={selectedCar}
                  compareCarId={compareCarId}
                  onSelectCompare={setCompareCarId}
                />
              </div>
            )}
          </div>

          {/* Deep Engineering Specifications & Highlights Matrix */}
          <div className="stage-engineering-bottom">
            <div className="eng-highlights-col">
              <div className="subpanel-header">
                <Cpu size={15} />
                <span>KEY ENGINEERING &amp; METALLURGIC HIGHLIGHTS</span>
              </div>
              <div className="highlights-cards">
                {selectedCar.engineeringHighlights.map((hl, i) => (
                  <div key={i} className="highlight-card">
                    <div className="hl-num">0{i + 1}</div>
                    <div>
                      <h4 className="hl-title">{hl.component}</h4>
                      <div className="hl-spec-badge">{hl.spec}</div>
                      <p className="hl-detail">{hl.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="full-spec-table-col">
              <div className="subpanel-header">
                <SlidersHorizontal size={15} />
                <span>HOMOLOGATION &amp; TECHNICAL SPECIFICATION SHEET</span>
              </div>
              <dl className="spec-sheet-dl">
                <div className="spec-row">
                  <dt>Engine / Motor Code</dt>
                  <dd>{selectedCar.engine.code}</dd>
                </div>
                <div className="spec-row">
                  <dt>Architecture</dt>
                  <dd>{selectedCar.engine.type}</dd>
                </div>
                <div className="spec-row">
                  <dt>Displacement / Bore × Stroke</dt>
                  <dd>
                    {selectedCar.engine.displacementCc > 0
                      ? `${selectedCar.engine.displacementCc.toLocaleString()} cc — ${selectedCar.engine.cylinders}`
                      : `Pure Electric — ${selectedCar.engine.cylinders}`}
                  </dd>
                </div>
                <div className="spec-row">
                  <dt>Valvetrain / Efficiency</dt>
                  <dd>{selectedCar.engine.valvetrain}</dd>
                </div>
                <div className="spec-row">
                  <dt>Induction / Battery System</dt>
                  <dd>{selectedCar.engine.aspiration}</dd>
                </div>
                <div className="spec-row">
                  <dt>Transmission &amp; Final Drive</dt>
                  <dd>
                    {selectedCar.engine.transmission} ({selectedCar.drivetrain})
                  </dd>
                </div>
                <div className="spec-row">
                  <dt>Front Suspension</dt>
                  <dd>{selectedCar.suspensionFront}</dd>
                </div>
                <div className="spec-row">
                  <dt>Rear Suspension</dt>
                  <dd>{selectedCar.suspensionRear}</dd>
                </div>
                <div className="spec-row">
                  <dt>Braking System</dt>
                  <dd>{selectedCar.brakes}</dd>
                </div>
                <div className="spec-row">
                  <dt>Dimensions (L × W × H)</dt>
                  <dd>
                    {selectedCar.dimensionsMm[0]} ×{" "}
                    {selectedCar.dimensionsMm[1]} ×{" "}
                    {selectedCar.dimensionsMm[2]} mm (WB{" "}
                    {selectedCar.wheelbaseMm} mm)
                  </dd>
                </div>
                <div className="spec-row">
                  <dt>Efficiency / Consumption</dt>
                  <dd>{selectedCar.performance.efficiencyMetric}</dd>
                </div>
                <div className="spec-row">
                  <dt>Lead Styling &amp; Engineering</dt>
                  <dd>{selectedCar.designer}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* FOUR HISTORICAL ERAS CURATORIAL OVERVIEW */}
        <section className="eras-overview-section">
          <div className="section-header-bar">
            <div>
              <span className="section-kicker">
                HISTORICAL PERIODIZATION // FOUR INDUSTRIAL EPOCHS
              </span>
              <h2 className="section-title">
                The Four Eras of Proton Engineering (1983–2025)
              </h2>
            </div>
            {activeEra !== "all" && (
              <button
                type="button"
                className="reset-era-btn"
                onClick={() => setActiveEra("all")}
              >
                SHOW ALL 4 ERAS (18 VEHICLES)
              </button>
            )}
          </div>

          <div className="eras-grid">
            {ERAS.map((era) => {
              const count = PROTON_CARS.filter((c) => c.eraId === era.id).length;
              const isSelected = activeEra === era.id;
              return (
                <article
                  key={era.id}
                  className={`era-card ${isSelected ? "active" : ""}`}
                  data-era={era.id}
                  onClick={() => {
                    setActiveEra(isSelected ? "all" : era.id);
                    const vault = document.getElementById("archive-vault");
                    vault?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <div className="era-card-top">
                    <span className="era-roman">ERA {era.roman}</span>
                    <span className="era-years">{era.years}</span>
                  </div>
                  <h3 className="era-card-title">{era.title}</h3>
                  <p className="era-card-sub">{era.subtitle}</p>
                  <p className="era-card-note">{era.leadCuratorNote}</p>
                  <div className="era-card-footer">
                    <span className="era-milestone">{era.keyMilestone}</span>
                    <span className="era-count-badge">
                      {count} EXHIBITS →
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 18-VEHICLE ARCHIVE VAULT (FILTERABLE BY ERA, BODY, SEARCH, PHOTO vs CAD MODE) */}
        <section className="vault-section" id="archive-vault">
          <div className="section-header-bar">
            <div>
              <span className="section-kicker">
                COMPLETE COLLECTION // 18 ARCHIVAL VEHICLES (1985–2024)
              </span>
              <h2 className="section-title">
                National Automotive Collection Vault
              </h2>
            </div>

            <div className="vault-view-toggle">
              <button
                type="button"
                className={`mode-btn ${catalogMode === "photo" ? "active" : ""}`}
                onClick={() => setCatalogMode("photo")}
              >
                PHOTOGRAPHIC ARCHIVE
              </button>
              <button
                type="button"
                className={`mode-btn ${catalogMode === "cad" ? "active" : ""}`}
                onClick={() => setCatalogMode("cad")}
              >
                ISOMETRIC CAD MATRIX
              </button>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="vault-filter-bar">
            <div className="era-filter-pills">
              <button
                type="button"
                className={`filter-pill ${activeEra === "all" ? "active" : ""}`}
                onClick={() => setActiveEra("all")}
              >
                ALL ERAS ({PROTON_CARS.length})
              </button>
              {ERAS.map((era) => (
                <button
                  key={era.id}
                  type="button"
                  className={`filter-pill ${activeEra === era.id ? "active" : ""}`}
                  onClick={() => setActiveEra(era.id)}
                >
                  ERA {era.roman}: {era.years}
                </button>
              ))}
            </div>

            <div className="category-and-search">
              <div className="cat-pills">
                {BODY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill ${activeCategory === cat ? "active" : ""}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="search-input-wrap">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search model, chassis (C99S), engine (4G93P, CamPro)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Vehicle Grid */}
          <div className="vault-cards-grid">
            {filteredCars.map((car) => {
              const isCurrent = car.id === selectedCar.id;
              return (
                <article
                  key={car.id}
                  className={`vault-card ${isCurrent ? "selected" : ""}`}
                  onClick={() => handleSelectCar(car.id, true)}
                >
                  <div className="vault-card-top">
                    <span className="vault-cat-no">{car.catalogNo}</span>
                    <span className="vault-year-badge">{car.year}</span>
                  </div>

                  {catalogMode === "photo" ? (
                    <div className="vault-img-wrap">
                      <img
                        src={car.image}
                        alt={car.name}
                        loading="lazy"
                        className="vault-img"
                      />
                      <span className="vault-chassis-tag">
                        {car.chassisCode}
                      </span>
                    </div>
                  ) : (
                    <div className="vault-cad-wrap">
                      <IsoCarBlueprint car={car} theme={theme} compact />
                    </div>
                  )}

                  <div className="vault-card-body">
                    <div className="vault-subtitle">{car.localSubtitle}</div>
                    <h3 className="vault-car-title">{car.name}</h3>
                    <p className="vault-car-tagline">{car.tagline}</p>

                    <div className="vault-specs-strip">
                      <div>
                        <span>ENGINE</span>
                        <strong>{car.engine.code.split(" ")[0]}</strong>
                      </div>
                      <div>
                        <span>OUTPUT</span>
                        <strong>
                          {car.engine.powerHp} bhp / {car.engine.torqueNm} Nm
                        </strong>
                      </div>
                      <div>
                        <span>0–100</span>
                        <strong>{car.performance.zeroToHundredSec}s</strong>
                      </div>
                      <div>
                        <span>MASS</span>
                        <strong>{car.curbWeightKg} kg</strong>
                      </div>
                    </div>

                    <div className="vault-card-foot">
                      <div className="mini-swatches">
                        {car.factoryColors.map((sw) => (
                          <span
                            key={sw.code}
                            className="mini-swatch"
                            style={{ backgroundColor: sw.hex }}
                            title={sw.name}
                          />
                        ))}
                      </div>
                      <span className="inspect-cta">
                        {isCurrent ? "ACTIVE ON STAGE" : "LOAD INTO 3D STAGE →"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* INTERACTIVE 3D ISOMETRIC POWERTRAIN & CHASSIS ANATOMY LAB */}
        <EngineeringPlates theme={theme} />
      </main>

      {/* Archival Colophon Footer */}
      <footer className="museum-footer">
        <div className="footer-inner">
          <div>
            <strong>
              GALERI PROTON // NATIONAL AUTOMOTIVE ARCHIVE &amp; ENGINEERING
              MUSEUM
            </strong>
            <p>
              Rendered with custom 3D Isometric Technical Vector Projection
              (`iso-kit.ts`) &amp; Archival Vehicle Telemetry (1983–2025).
            </p>
          </div>
          <div className="footer-right">
            <span>SHAH ALAM (1985)</span>
            <span>•</span>
            <span>HETHEL (1996)</span>
            <span>•</span>
            <span>TANJUNG MALIM (2004)</span>
            <span>•</span>
            <span>AHTV EV (2024)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
