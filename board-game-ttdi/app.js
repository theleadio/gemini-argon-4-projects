/* ==========================================================================
   SPIELHAUS TTDI — Interactive Eurogame Vault, Spielberater & Table Concierge
   ========================================================================== */

const EUROGAMES = [
  {
    id: "burgundy-se",
    germanTitle: "Die Burgen von Burgund",
    title: "The Castles of Burgundy (Special Edition)",
    designer: "Stefan Feld",
    publisher: "Ravensburger / Alea",
    year: "2023 Deluxe",
    category: "kennerspiel",
    categoryLabel: "Kennerspiel",
    badgeClass: "crimson",
    language: "EN / DE",
    players: [2, 3, 4],
    playersText: "2–4P",
    timeText: "70–120m",
    weight: 3.0,
    priceRM: 540,
    tableStatus: "2 Table Copies · 3 Sealed Boxes",
    mood: "tile",
    durationBucket: "classic",
    photo: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80",
    description: "Stefan Feld's quintessential dice-driven duchy builder. Roll two dice and transform tactical hex tiles—pastures, river trade, silver mines, and cathedrals—into a thriving 15th-century French valley.",
    components: "Double-layered duchy boards, 180+ thick acrylic/cardboard hex tiles, wooden trade goods, and custom engraved dice.",
    spielmeisterTip: "Best at 2 or 3 players on Tisch 01. Our Spielmeister teaches the full iconography in 9 minutes flat."
  },
  {
    id: "agricola-rev",
    germanTitle: "Agricola · Kennerspiel",
    title: "Agricola (Revised Edition + Farmers of the Moor)",
    designer: "Uwe Rosenberg",
    publisher: "Lookout Games",
    year: "Spiel Sonderpreis",
    category: "schwergewicht",
    categoryLabel: "Schwergewicht",
    badgeClass: "pine",
    language: "DE / EN",
    players: [1, 2, 3, 4],
    playersText: "1–4P",
    timeText: "90–120m",
    weight: 3.64,
    priceRM: 265,
    tableStatus: "Animeeple Upgrade Copy Ready",
    mood: "worker",
    durationBucket: "classic",
    photo: "https://images.unsplash.com/photo-1632501641765-e568d28b0015?auto=format&fit=crop&w=900&q=80",
    description: "The gold standard of European worker-placement design. Plough fields, bake bread in clay ovens, fence pastures for wooden sheep and cattle, and feed your growing homestead before harvest.",
    components: "210+ custom sculpted wooden Animeeples, vegetable tokens, 120 Minor Improvement & Occupation cards.",
    spielmeisterTip: "We deal a curated beginner hand of 7 Occupations so first-timers can dive straight into farm building."
  },
  {
    id: "brass-birmingham",
    germanTitle: "Kohle & Eisen · Industrie",
    title: "Brass: Birmingham (Deluxe Iron Clays)",
    designer: "Gavan Brown, Matt Tolman, Martin Wallace",
    publisher: "Roxley",
    year: "BGG #1 Ranked",
    category: "schwergewicht",
    categoryLabel: "Schwergewicht",
    badgeClass: "pine",
    language: "EN (Language Indep.)",
    players: [2, 3, 4],
    playersText: "2–4P",
    timeText: "90–150m",
    weight: 3.89,
    priceRM: 395,
    tableStatus: "Iron Clays Deluxe on Tisch 03",
    mood: "economic",
    durationBucket: "epic",
    photo: "https://images.unsplash.com/photo-1606503153255-59d8b8b82176?auto=format&fit=crop&w=900&q=80",
    description: "Navigate the Canal and Rail eras of the Industrial Revolution. Build shared coal and iron networks, brew barrels of stout to grease market deals, and time your loan engine to perfection.",
    components: "Heavyweight 10g Iron Clay poker chips, dual-sided night/day board, linen-finish industrial era cards.",
    spielmeisterTip: "Friday Heavy Euro staple in TTDI. Always remember: beer barrels are more precious than gold in the Rail Era."
  },
  {
    id: "carcassonne-jubilee",
    germanTitle: "Spiel des Jahres 2001",
    title: "Carcassonne (20th Anniversary Jubilee Box)",
    designer: "Klaus-Jürgen Wrede",
    publisher: "Hans im Glück",
    year: "Essen Heritage",
    category: "familienspiel",
    categoryLabel: "Familienspiel",
    badgeClass: "ochre",
    language: "DE / EN Rules",
    players: [2, 3, 4, 5],
    playersText: "2–5P",
    timeText: "35–45m",
    weight: 1.9,
    priceRM: 185,
    tableStatus: "3 Table Copies · Kids Friendly",
    mood: "gateway",
    durationBucket: "quick",
    photo: "https://images.unsplash.com/photo-1585504198199-20277593b94f?auto=format&fit=crop&w=900&q=80",
    description: "The beloved tile-laying game that birthed the word 'Meeple'. Draw and place medieval French landscape tiles, deploy knights, monks, and highwaymen, and watch a tapestry grow across the table.",
    components: "104 UV-spot gloss landscape tiles, River & Abbot expansions, and classic birchwood Meeples with decal stickers.",
    spielmeisterTip: "Pair with a pot of TTDI Hainanese Kopi or Spezi—takes 2 minutes to learn and sparks friendly rivalry."
  },
  {
    id: "catan-3d-holz",
    germanTitle: "Die Siedler von Catan",
    title: "Catan: Base + Seafarers (Wooden Collector's Kit)",
    designer: "Klaus Teuber",
    publisher: "KOSMOS Verlag",
    year: "Spiel des Jahres 1995",
    category: "familienspiel",
    categoryLabel: "Familienspiel",
    badgeClass: "ochre",
    language: "EN / DE",
    players: [3, 4, 5, 6],
    playersText: "3–6P",
    timeText: "60–90m",
    weight: 2.31,
    priceRM: 240,
    tableStatus: "Bespoke Walnut Hex Frame Ready",
    mood: "gateway",
    durationBucket: "classic",
    photo: "https://images.unsplash.com/photo-1606733847546-db8546099013?auto=format&fit=crop&w=900&q=80",
    description: "Timber, brick, sheep, wheat, and ore. The pioneer that sparked the global German board game renaissance—elevated at Spielhaus TTDI with laser-cut wooden hex borders and solid beechwood settlements.",
    components: "19 terrain hexes, custom beechwood settlements & cathedrals, wooden robber figure, and sleeved resource cards.",
    spielmeisterTip: "Reserve Tisch 02 ('The Catan Hex Table') for the ultimate 4-to-6 player trading negotiation session."
  },
  {
    id: "wingspan-europe",
    germanTitle: "Flügelschlag · Kennerspiel",
    title: "Wingspan + European Birds Expansion",
    designer: "Elizabeth Hargrave",
    publisher: "Stonemaier / Feuerland",
    year: "Kennerspiel 2019",
    category: "kennerspiel",
    categoryLabel: "Kennerspiel",
    badgeClass: "crimson",
    language: "EN",
    players: [1, 2, 3, 4, 5],
    playersText: "1–5P",
    timeText: "50–75m",
    weight: 2.46,
    priceRM: 310,
    tableStatus: "Wooden Birdhouse Tower Included",
    mood: "gateway",
    durationBucket: "classic",
    photo: "https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=900&q=80",
    description: "An engine-building celebration of ornithology illustrated with museum-grade watercolors. Attract Eurasian Golden Orioles and European Bee-Eaters to your forest, grassland, and wetland habitats.",
    components: "250+ illustrated bird cards, pastel speckled miniature eggs, wooden dice tower birdhouse, and nectar tokens.",
    spielmeisterTip: "Our most requested Sunday afternoon game in TTDI—serene, tactile, and deeply satisfying."
  },
  {
    id: "targi-kosmos",
    germanTitle: "Kosmos Zwei-Spieler Reihe",
    title: "Targi + Die Erweiterung (2-Player Duel)",
    designer: "Andreas Steiger",
    publisher: "KOSMOS Verlag",
    year: "Kennerspiel Nominee",
    category: "zwei",
    categoryLabel: "Zwei-Spieler",
    badgeClass: "crimson",
    language: "EN / DE",
    players: [2],
    playersText: "2P Only",
    timeText: "45–60m",
    weight: 2.38,
    priceRM: 155,
    tableStatus: "Ready at Kosmos Nook (Tisch 04)",
    mood: "worker",
    durationBucket: "quick",
    photo: "https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&w=900&q=80",
    description: "A razor-sharp 2-player desert trading duel from Kosmos's legendary small-box line. Place your Tuareg figures on the border cards and claim the intersecting cross-coordinates in the center grid.",
    components: "Wooden Tuareg meeples, silver coin metal tokens, sand dune expansion cards, and tribe tableau tiles.",
    spielmeisterTip: "The ultimate date-night or coffee break duel—small box, massive tactical tension."
  },
  {
    id: "arnak-expedition",
    germanTitle: "Die Verlorenen Ruinen",
    title: "Lost Ruins of Arnak + Expedition Leaders",
    designer: "Mín & Elwen",
    publisher: "Czech Games Edition",
    year: "Deutscher Spiele Preis #1",
    category: "kennerspiel",
    categoryLabel: "Kennerspiel",
    badgeClass: "crimson",
    language: "EN / DE",
    players: [1, 2, 3, 4],
    playersText: "1–4P",
    timeText: "60–110m",
    weight: 2.92,
    priceRM: 290,
    tableStatus: "2 Table Copies · 4 Retail Boxes",
    mood: "worker",
    durationBucket: "classic",
    photo: "https://images.unsplash.com/photo-1528819622765-d6bcf132f793?auto=format&fit=crop&w=900&q=80",
    description: "A seamless fusion of deck-building and worker placement from Prague's CGE studio. Discover uncharted jungle shrines, decipher temple glyphs, and race your magnifying glass up the research track.",
    components: "Translucent ruby jewels, sculpted stone tablets, bone arrowheads, and 6 asymmetric Expedition Leader boards.",
    spielmeisterTip: "Featured at our Wednesday Kennerspiel nights—easy to grasp if you've ever played Dune: Imperium or Clank."
  },
  {
    id: "lisboa-lacerda",
    germanTitle: "Essen Spiel Import · Deluxe",
    title: "Lisboa (Vital Lacerda & Ian O'Toole Edition)",
    designer: "Vital Lacerda",
    publisher: "Eagle-Gryphon Games",
    year: "Essen Collector Vault",
    category: "schwergewicht",
    categoryLabel: "Schwergewicht",
    badgeClass: "pine",
    language: "EN",
    players: [1, 2, 3, 4],
    playersText: "1–4P",
    timeText: "120–180m",
    weight: 4.58,
    priceRM: 680,
    tableStatus: "Pre-Set Table Available on Request",
    mood: "economic",
    durationBucket: "epic",
    photo: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=900&q=80",
    description: "Rebuild 18th-century Lisbon after the great earthquake of 1755 alongside Marquis of Pombal. Framed in cobalt-and-white Portuguese Azulejo tile artwork by Ian O'Toole, every action triggers cascading rewards.",
    components: "Triple-layered player portfolios, wooden rubble cubes, clergy & noble wooden figures, and oversized Azulejo board.",
    spielmeisterTip: "Book Tisch 03 ('Rosenberg Workbench')—we set up all 300+ pieces before you walk through the door."
  }
];

const HERO_HOTSPOTS = [
  {
    id: "hs-1",
    code: "COMP. A — HOLZFIGUREN",
    title: "Turned Birch & Beechwood Meeples",
    desc: "Sustainably harvested German hardwood pieces finished in non-toxic water-based lacquers."
  },
  {
    id: "hs-2",
    code: "COMP. B — SPIELBRETT",
    title: "2.5mm Linen-Embossed Punchboard",
    desc: "Glare-free matte linen texture designed to sit flat under warm TTDI shophouse pendant lamps."
  },
  {
    id: "hs-3",
    code: "COMP. C — SPIELMEISTER",
    title: "15-Minute Live Rules Concierge",
    desc: "Never read a 32-page German manual at the table—our hosts teach every game turn-by-turn."
  }
];

// Application State
const state = {
  category: "all",
  players: "any",
  maxWeight: 5.0,
  search: "",
  heldGames: ["Die Burgen von Burgund"],
  berater: {
    group: "3-4",
    mood: "worker",
    time: "classic"
  },
  selectedTable: {
    id: "Tisch 01",
    name: "Tisch 01 · Essen Window Booth",
    capacity: "2–4 Pax · Recessed Green Baize"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initNavbarScroll();
  initHeroHotspots();
  initCatalogFilters();
  renderCatalog();
  initSpielberater();
  initFloorplanPicker();
  initReservationForm();
  initModalHandlers();
  renderHeldGamesUI();
});

/* --------------------------------------------------------------------------
   1. Sticky Navbar Scroll Effect
   -------------------------------------------------------------------------- */
function initNavbarScroll() {
  const header = document.getElementById("siteHeader");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 24) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

/* --------------------------------------------------------------------------
   2. Hero Photo Interactive Hotspots
   -------------------------------------------------------------------------- */
function initHeroHotspots() {
  const buttons = document.querySelectorAll(".photo-hotspot");
  const codeEl = document.getElementById("hotspotCode");
  const textEl = document.getElementById("hotspotText");

  buttons.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const data = HERO_HOTSPOTS[idx];
      if (data && codeEl && textEl) {
        codeEl.textContent = data.code;
        textEl.textContent = `${data.title} — ${data.desc}`;
      }
    });
  });
}

/* --------------------------------------------------------------------------
   3. Catalog Filtering & Rendering
   -------------------------------------------------------------------------- */
function initCatalogFilters() {
  // Category Tabs
  document.querySelectorAll(".cat-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.category = tab.dataset.cat;
      renderCatalog();
    });
  });

  // Player Count Pills
  document.querySelectorAll(".player-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".player-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.players = pill.dataset.players;
      renderCatalog();
    });
  });

  // Weight Slider
  const slider = document.getElementById("weightSlider");
  const weightVal = document.getElementById("weightReadout");
  if (slider && weightVal) {
    slider.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      state.maxWeight = val;
      weightVal.textContent = val >= 4.8 ? "All Weights (≤ 5.0)" : `≤ ${val.toFixed(1)} / 5.0`;
      renderCatalog();
    });
  }

  // Search Input
  const searchInput = document.getElementById("gameSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      state.search = e.target.value.trim().toLowerCase();
      renderCatalog();
    });
  }
}

function renderCatalog() {
  const grid = document.getElementById("gamesBentoGrid");
  const countEl = document.getElementById("catalogCountReadout");
  if (!grid) return;

  const filtered = EUROGAMES.filter(game => {
    if (state.category !== "all" && game.category !== state.category) return false;
    if (game.weight > state.maxWeight) return false;

    if (state.players !== "any") {
      const pNum = parseInt(state.players, 10);
      if (pNum === 5) {
        if (!game.players.includes(5) && !game.players.includes(6)) return false;
      } else if (!game.players.includes(pNum)) {
        return false;
      }
    }

    if (state.search) {
      const hay = `${game.title} ${game.germanTitle} ${game.designer} ${game.publisher} ${game.description}`.toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  });

  if (countEl) {
    countEl.textContent = `SHOWING ${filtered.length} OF ${EUROGAMES.length} FEATURED VAULT TITLES (485 TOTAL IN TTDI ARCHIVE)`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; background: var(--bg-card); border: 1.5px dashed var(--border-strong); border-radius: 8px; padding: 3rem; text-align: center;">
        <p class="mono-tag" style="color: var(--accent-crimson); margin-bottom: 0.5rem;">KEINE ERGEBNISSE · NO ARCHIVE MATCH</p>
        <h3 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 0.5rem;">No Eurogames match that exact filter combination</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.25rem;">Try raising the maximum BGG complexity slider or resetting the category filter.</p>
        <button class="btn btn-secondary btn-sm" id="resetFiltersBtn">Reset Archive Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.category = "all";
        state.players = "any";
        state.maxWeight = 5.0;
        state.search = "";
        document.querySelectorAll(".cat-tab").forEach(t => t.classList.toggle("active", t.dataset.cat === "all"));
        document.querySelectorAll(".player-pill").forEach(p => p.classList.toggle("active", p.dataset.players === "any"));
        const slider = document.getElementById("weightSlider");
        if (slider) slider.value = "5.0";
        const weightVal = document.getElementById("weightReadout");
        if (weightVal) weightVal.textContent = "All Weights (≤ 5.0)";
        const searchInput = document.getElementById("gameSearchInput");
        if (searchInput) searchInput.value = "";
        renderCatalog();
      });
    }
    return;
  }

  grid.innerHTML = filtered.map(game => {
    const isHeld = state.heldGames.includes(game.germanTitle);
    return `
      <article class="game-card" data-id="${game.id}">
        <div class="game-card-photo">
          <img src="${game.photo}" alt="${game.title}" loading="lazy"
               onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80';" />
          <div class="game-badges-top">
            <span class="spiel-class-badge ${game.badgeClass}">${game.categoryLabel}</span>
            <span class="language-pill">${game.language}</span>
          </div>
        </div>
        <div class="game-card-body">
          <div class="game-german-sub">${game.germanTitle} · ${game.year}</div>
          <h3 class="game-title">${game.title}</h3>
          <p class="game-designer">Autor: <strong>${game.designer}</strong> · ${game.publisher}</p>
          <p class="game-desc">${game.description}</p>

          <div class="game-telemetry-grid">
            <div class="telemetry-stat">
              <span class="stat-k">Players</span>
              <span class="stat-v">${game.playersText}</span>
            </div>
            <div class="telemetry-stat">
              <span class="stat-k">Playtime</span>
              <span class="stat-v">${game.timeText}</span>
            </div>
            <div class="telemetry-stat">
              <span class="stat-k">BGG Weight</span>
              <span class="stat-v">${game.weight.toFixed(2)} / 5</span>
            </div>
          </div>

          <div class="game-card-footer">
            <div class="price-lockup">
              <span class="retail-price">RM ${game.priceRM} <span style="font-weight:400;font-size:0.72rem;color:var(--text-muted);">Retail</span></span>
              <span class="table-copy-status">● ${game.tableStatus}</span>
            </div>
            <div class="card-action-btns">
              <button class="btn-icon-only inspect-game-btn" data-id="${game.id}" title="Inspect Rulebook & Components" aria-label="Inspect ${game.title}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
              <button class="hold-game-btn ${isHeld ? 'in-tray' : ''}" data-title="${game.germanTitle}">
                ${isHeld ? '✓ On Table Tray' : '+ Hold for Table'}
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Attach listeners for Hold & Inspect buttons
  grid.querySelectorAll(".hold-game-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleHeldGame(btn.dataset.title);
    });
  });

  grid.querySelectorAll(".inspect-game-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openGameModal(btn.dataset.id);
    });
  });
}

/* --------------------------------------------------------------------------
   4. Table Game Tray (Hold Games for Reservation)
   -------------------------------------------------------------------------- */
function toggleHeldGame(germanTitle) {
  const idx = state.heldGames.indexOf(germanTitle);
  if (idx >= 0) {
    state.heldGames.splice(idx, 1);
  } else {
    if (state.heldGames.length >= 4) {
      state.heldGames.shift();
    }
    state.heldGames.push(germanTitle);
  }
  renderCatalog();
  renderHeldGamesUI();
}

function renderHeldGamesUI() {
  const countBadge = document.getElementById("navTrayCount");
  const heldContainer = document.getElementById("heldGamesList");

  if (countBadge) {
    countBadge.textContent = state.heldGames.length;
  }

  if (heldContainer) {
    if (state.heldGames.length === 0) {
      heldContainer.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">No games selected yet — click "+ Hold for Table" on any title above, or our Spielmeister will curate at your table.</span>`;
    } else {
      heldContainer.innerHTML = state.heldGames.map(title => `
        <span class="held-chip">
          ${title}
          <button type="button" class="remove-held-btn" data-title="${title}" aria-label="Remove ${title}">×</button>
        </span>
      `).join("");

      heldContainer.querySelectorAll(".remove-held-btn").forEach(btn => {
        btn.addEventListener("click", () => toggleHeldGame(btn.dataset.title));
      });
    }
  }
}

/* --------------------------------------------------------------------------
   5. "Der Spielberater" — Interactive 3-Step Table Recommender
   -------------------------------------------------------------------------- */
function initSpielberater() {
  document.querySelectorAll(".berater-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const step = chip.dataset.step;
      const val = chip.dataset.val;
      document.querySelectorAll(`.berater-chip[data-step="${step}"]`).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.berater[step] = val;
      renderSpielberaterResult();
    });
  });

  const holdFlightBtn = document.getElementById("holdFlightBtn");
  if (holdFlightBtn) {
    holdFlightBtn.addEventListener("click", () => {
      const flight = getRecommendedFlight();
      flight.forEach(g => {
        if (!state.heldGames.includes(g.germanTitle) && state.heldGames.length < 4) {
          state.heldGames.push(g.germanTitle);
        }
      });
      renderCatalog();
      renderHeldGamesUI();
      document.getElementById("reservierung")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  renderSpielberaterResult();
}

function getRecommendedFlight() {
  const { group, mood, time } = state.berater;
  const scored = EUROGAMES.map(game => {
    let score = 0;
    if (game.mood === mood) score += 4;
    if (game.durationBucket === time) score += 3;
    if (group === "2" && game.players.includes(2)) score += (game.players.length === 1 ? 5 : 2);
    if (group === "3-4" && game.players.includes(3) && game.players.includes(4)) score += 3;
    if (group === "5+" && (game.players.includes(5) || game.players.includes(6))) score += 5;
    return { game, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.game);
}

function renderSpielberaterResult() {
  const container = document.getElementById("beraterFlightList");
  const pairingNote = document.getElementById("beraterPairingNote");
  if (!container) return;

  const flight = getRecommendedFlight();
  container.innerHTML = flight.map((g, i) => `
    <div class="flight-item">
      <img src="${g.photo}" alt="${g.title}" />
      <div>
        <div class="flight-item-meta">GANG 0${i + 1} · ${g.categoryLabel.toUpperCase()} · WEIGHT ${g.weight.toFixed(1)}</div>
        <div class="flight-item-title">${g.germanTitle} <span style="font-weight:400;font-size:0.84rem;color:var(--text-secondary);">(${g.title.split('(')[0].trim()})</span></div>
        <div class="flight-item-meta">${g.playersText} · ${g.timeText} · ${g.designer}</div>
      </div>
      <button type="button" class="hold-game-btn ${state.heldGames.includes(g.germanTitle) ? 'in-tray' : ''}" data-flight-title="${g.germanTitle}">
        ${state.heldGames.includes(g.germanTitle) ? '✓ Held' : '+ Hold'}
      </button>
    </div>
  `).join("");

  container.querySelectorAll("button[data-flight-title]").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleHeldGame(btn.dataset.flightTitle);
      renderSpielberaterResult();
    });
  });

  if (pairingNote) {
    const pairings = {
      worker: "Recommended Pairing: Tisch 03 ('Rosenberg Workbench') + Iced Black Forest Spezi & Warm Bretzel.",
      tile: "Recommended Pairing: Tisch 01 ('Essen Window Booth') + Single-Origin Pour-Over & Sourdough Tartine.",
      economic: "Recommended Pairing: Tisch 03 ('Rosenberg Workbench') + Artisanal Roasted Oolong Pot for the table.",
      gateway: "Recommended Pairing: Tisch 02 ('Catan Hex Table') + TTDI Hainanese Iced Kopi & Obatzda Pretzel Bites."
    };
    pairingNote.textContent = pairings[state.berater.mood] || pairings.worker;
  }
}

/* --------------------------------------------------------------------------
   6. Interactive Upstairs TTDI Shophouse Floorplan Table Picker
   -------------------------------------------------------------------------- */
function initFloorplanPicker() {
  const nodes = document.querySelectorAll(".table-node");
  const tableInput = document.getElementById("selectedTableInput");

  nodes.forEach(node => {
    node.addEventListener("click", () => {
      nodes.forEach(n => n.classList.remove("selected"));
      node.classList.add("selected");
      const tName = node.dataset.tableName;
      state.selectedTable.name = tName;
      if (tableInput) {
        tableInput.value = tName;
      }
    });
  });

  // Also wire schedule RSVP buttons to preselect event + scroll to reservation
  document.querySelectorAll(".rsvp-event-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const eventName = btn.dataset.event;
      const sessionSelect = document.getElementById("bookingSessionSelect");
      if (sessionSelect && eventName) {
        sessionSelect.value = eventName;
      }
      document.getElementById("reservierung")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* --------------------------------------------------------------------------
   7. Reservation Ticket Generator
   -------------------------------------------------------------------------- */
function initReservationForm() {
  const form = document.getElementById("ttdiBookingForm");
  const ticketBox = document.getElementById("ticketConfirmation");
  if (!form || !ticketBox) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    const guestName = document.getElementById("guestNameInput")?.value || "Gast";
    const guestPhone = document.getElementById("guestPhoneInput")?.value || "+60 12-xxx xxxx";
    const partySize = document.getElementById("partySizeSelect")?.value || "4 Players";
    const session = document.getElementById("bookingSessionSelect")?.value || "Tonight · 20:00 (Abendspiel)";
    const table = document.getElementById("selectedTableInput")?.value || state.selectedTable.name;

    const refCode = "TTDI-" + Math.floor(1000 + Math.random() * 9000);
    const gamesStr = state.heldGames.length > 0
      ? state.heldGames.join(" · ")
      : "Spielmeister Table Curated Flight";

    ticketBox.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem;">
        <span class="mono-tag" style="color:var(--accent-pine);font-weight:700;">✓ TISCHRESERVIERUNG BESTÄTIGT · REF ${refCode}</span>
        <span class="mono-tag" style="background:var(--accent-pine);color:#fff;padding:0.15rem 0.5rem;border-radius:3px;">CONFIRMED</span>
      </div>
      <p style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;margin-bottom:0.35rem;">
        ${guestName} (${partySize}) — ${table}
      </p>
      <p style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:0.35rem;">
        <strong>Session:</strong> ${session} · <strong>Contact:</strong> ${guestPhone}
      </p>
      <p style="font-size:0.82rem;color:var(--text-primary);margin-bottom:0.65rem;">
        <strong>Pre-Set Games on Your Baize Table:</strong> ${gamesStr}
      </p>
      <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--accent-pine);">
        📍 18A, First Floor, Lorong Rahim Kajai 14, TTDI (Above Heritage Kopitiam · 4 min from MRT TTDI Exit A)
      </p>
    `;
    ticketBox.classList.add("visible");
  });
}

/* --------------------------------------------------------------------------
   8. Rulebook & Component Inspection Modal
   -------------------------------------------------------------------------- */
function initModalHandlers() {
  const backdrop = document.getElementById("gameModalBackdrop");
  const closeBtn = document.getElementById("closeModalBtn");
  if (!backdrop) return;

  closeBtn?.addEventListener("click", () => backdrop.classList.remove("open"));
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop) backdrop.classList.remove("open");
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") backdrop.classList.remove("open");
  });
}

function openGameModal(gameId) {
  const game = EUROGAMES.find(g => g.id === gameId);
  const backdrop = document.getElementById("gameModalBackdrop");
  const content = document.getElementById("gameModalBody");
  const codeEl = document.getElementById("modalRefCode");
  if (!game || !backdrop || !content) return;

  if (codeEl) {
    codeEl.textContent = `ARCHIVE DOSSIER · ${game.germanTitle.toUpperCase()} (${game.year.toUpperCase()})`;
  }

  const isHeld = state.heldGames.includes(game.germanTitle);

  content.innerHTML = `
    <div class="modal-photo-col">
      <img src="${game.photo}" alt="${game.title}" />
      <div class="modal-components-box">
        <div class="mono-tag" style="color:var(--accent-crimson);margin-bottom:0.3rem;">IN DER SCHACHTEL · COMPONENTS</div>
        <p>${game.components}</p>
      </div>
    </div>
    <div class="modal-info-col">
      <div class="mono-tag" style="color:var(--accent-pine);margin-bottom:0.25rem;">${game.categoryLabel} · ${game.publisher}</div>
      <h3 style="font-family:var(--font-display);font-size:1.65rem;line-height:1.15;margin-bottom:0.3rem;">${game.title}</h3>
      <p style="font-size:0.86rem;color:var(--text-muted);margin-bottom:1rem;">Designed by <strong>${game.designer}</strong> · Edition: ${game.language}</p>
      <p style="font-size:0.94rem;color:var(--text-secondary);line-height:1.6;margin-bottom:1.15rem;">${game.description}</p>

      <div class="game-telemetry-grid" style="margin-bottom:1.15rem;">
        <div class="telemetry-stat">
          <span class="stat-k">Players</span>
          <span class="stat-v">${game.playersText}</span>
        </div>
        <div class="telemetry-stat">
          <span class="stat-k">Duration</span>
          <span class="stat-v">${game.timeText}</span>
        </div>
        <div class="telemetry-stat">
          <span class="stat-k">BGG Weight</span>
          <span class="stat-v">${game.weight.toFixed(2)} / 5.0</span>
        </div>
      </div>

      <div style="background:#F4E9D8;border-left:3px solid var(--accent-crimson);padding:0.75rem 0.95rem;border-radius:4px;font-size:0.84rem;margin-bottom:1.25rem;">
        <strong style="font-family:var(--font-mono);font-size:0.72rem;text-transform:uppercase;color:var(--accent-crimson);display:block;margin-bottom:0.2rem;">TTDI Spielmeister Note</strong>
        ${game.spielmeisterTip}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-top:0.85rem;border-top:1px solid var(--border-rule);">
        <div>
          <span style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;">RM ${game.priceRM}</span>
          <span style="display:block;font-family:var(--font-mono);font-size:0.7rem;color:var(--accent-pine);">${game.tableStatus}</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="modalHoldBtn">
          ${isHeld ? '✓ Held on Your Table Tray' : '+ Hold Copy for My Table'}
        </button>
      </div>
    </div>
  `;

  document.getElementById("modalHoldBtn")?.addEventListener("click", () => {
    toggleHeldGame(game.germanTitle);
    openGameModal(gameId);
  });

  backdrop.classList.add("open");
}
