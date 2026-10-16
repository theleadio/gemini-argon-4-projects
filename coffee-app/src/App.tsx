import React, { useState, useMemo, useCallback } from 'react';
import {
  ActiveOrder,
  CartItem,
  CartItemCustomization,
  FulfillmentMode,
  MenuCategory,
  MenuItem,
  OrderStage,
  RewardVoucher,
  ShophouseTable,
} from './types';
import {
  INITIAL_ACTIVE_ORDER,
  MENU_ITEMS,
  REWARD_VOUCHERS,
  SHOPHOUSE_TABLES,
  TTDI_SHOPHOUSE_INFO,
} from './data/ttdiData';
import { DynamicIsland } from './components/DynamicIsland';
import { MenuArtwork } from './components/MenuArtwork';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { CheckoutSheet } from './components/CheckoutSheet';
import { BrewTrackerView } from './components/BrewTrackerView';
import { ShophouseView } from './components/ShophouseView';
import { LoyaltyView } from './components/LoyaltyView';
import { SwiftCodeModal } from './components/SwiftCodeModal';
import { haptics } from './utils/haptics';
import {
  Car,
  Code2,
  Coffee,
  Compass,
  Flame,
  Gauge,
  MapPin,
  Maximize2,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Moon,
  Utensils,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import './App.css';

type AppTab = 'order' | 'brew' | 'shophouse' | 'loyalty';

const CATEGORY_TABS: { id: MenuCategory; label: string }[] = [
  { id: 'all', label: 'All Menu' },
  { id: 'signature', label: 'TTDI Signatures' },
  { id: 'espresso', label: 'Espresso Bar' },
  { id: 'filter', label: 'V60 Hand Brew' },
  { id: 'bakehouse', label: '6AM Sourdough' },
  { id: 'roastery', label: 'Roastery Beans' },
];

export function App() {
  // Navigation & UI Modes
  const [activeTab, setActiveTab] = useState<AppTab>('order');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [viewportMode, setViewportMode] = useState<'device' | 'fullscreen'>('device');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSwiftModal, setShowSwiftModal] = useState(false);

  // Dynamic Island & Toast State
  const [islandExpanded, setIslandExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fulfillment & Shophouse State
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>('curbside');
  const [carPlate, setCarPlate] = useState('WYY 4821');
  const [carDesc, setCarDesc] = useState('Slate Grey Civic FE');
  const [selectedTableId, setSelectedTableId] = useState('L-01');
  const [tables, setTables] = useState<ShophouseTable[]>(SHOPHOUSE_TABLES);

  // Cart & Customizer Sheet
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([
    {
      cartItemId: 'init-kajai-dirty',
      item: MENU_ITEMS[0],
      quantity: 1,
      unitPrice: 16,
      customization: {
        milk: 'Hokkaido Milk (+RM3)',
        beanHopper: 'Bukit Kiara Blend',
        sweetness: '50% TTDI Standard',
      },
    },
  ]);

  // Active Order & Loyalty State
  const [activeOrder, setActiveOrder] = useState<ActiveOrder>(INITIAL_ACTIVE_ORDER);
  const [stamps, setStamps] = useState(6);
  const [walletBalance, setWalletBalance] = useState(64.5);
  const [activeVoucher, setActiveVoucher] = useState<RewardVoucher | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const filteredMenu = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.malaySubtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tastingProfile.notes.some((n) => n.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const totalBagCount = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const totalBagRm = useMemo(
    () => cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0),
    [cart]
  );

  // Handlers
  const handleAddToBag = (
    item: MenuItem,
    quantity: number,
    unitPrice: number,
    customization: CartItemCustomization
  ) => {
    const newEntry: CartItem = {
      cartItemId: `${item.id}-${Date.now()}`,
      item,
      quantity,
      unitPrice,
      customization,
    };
    setCart((prev) => [...prev, newEntry]);
    setCustomizingItem(null);
    showToast(`Added ${quantity}x ${item.name} to Bag`);
  };

  const handleQuickAdd = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.impactMedium();
    const defaultCust: CartItemCustomization = {};
    if (item.supportsTemp) defaultCust.temperature = 'Iced';
    if (item.supportsMilk)
      defaultCust.milk = item.id === 'kajai-dirty' ? 'Hokkaido Milk (+RM3)' : 'Full Cream Dairy';
    if (item.supportsBeanHopper) defaultCust.beanHopper = 'Bukit Kiara Blend';
    if (item.supportsSweetness) defaultCust.sweetness = '50% TTDI Standard';
    if (item.supportsWarming) defaultCust.warming = 'Torched Warm (65°C)';
    if (item.supportsGrind) defaultCust.grindSize = 'Whole Bean';

    setCart((prev) => [
      ...prev,
      {
        cartItemId: `${item.id}-${Date.now()}`,
        item,
        quantity: 1,
        unitPrice: item.price,
        customization: defaultCust,
      },
    ]);
    showToast(`Added ${item.name} · RM ${item.price}`);
  };

  const handleQuickCombo = () => {
    haptics.applePaySuccess();
    const dirty = MENU_ITEMS.find((m) => m.id === 'kajai-dirty')!;
    const ka = MENU_ITEMS.find((m) => m.id === 'kouign-amann')!;
    setCart((prev) => [
      ...prev,
      {
        cartItemId: `combo-dirty-${Date.now()}`,
        item: dirty,
        quantity: 1,
        unitPrice: 15, // RM 1 off
        customization: {
          milk: 'Hokkaido Milk (+RM3)',
          beanHopper: 'Bukit Kiara Blend',
          sweetness: '50% TTDI Standard',
        },
      },
      {
        cartItemId: `combo-ka-${Date.now() + 1}`,
        item: ka,
        quantity: 1,
        unitPrice: 12, // RM 1 off
        customization: {
          warming: 'Torched Warm (65°C)',
        },
      },
    ]);
    showToast('Added TTDI Morning Ritual Pair (Saved RM 2)');
  };

  const handleUpdateBagQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const handleAdvanceOrderStage = () => {
    setActiveOrder((prev) => {
      const nextStage = ((prev.stage + 1) % 5) as OrderStage;
      const minsLeft = [4, 3, 2, 1, 0][nextStage];
      if (nextStage === 4) {
        haptics.notifyReady();
        showToast(`Order #${prev.orderNumber} is READY at Lorong 14!`);
      } else {
        showToast(`Brew #${prev.orderNumber} → Step ${nextStage + 1}/5`);
      }
      return {
        ...prev,
        stage: nextStage,
        estimatedMinutesLeft: minsLeft,
      };
    });
  };

  const handleToggleHazardBeacon = () => {
    setActiveOrder((prev) => {
      const nextState = !prev.curbsideHazardActive;
      showToast(
        nextState
          ? `Runner Syafiq alerted for ${prev.carPlate || carPlate}!`
          : 'Curbside hazard beacon turned off'
      );
      return {
        ...prev,
        curbsideHazardActive: nextState,
      };
    });
  };

  const handleSelectAndHoldTable = (tableId: string) => {
    setSelectedTableId(tableId);
    setFulfillment('dine-in');
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        status:
          t.id === tableId
            ? 'reserved-you'
            : t.status === 'reserved-you'
            ? 'available'
            : t.status,
      }))
    );
    showToast(`Table ${tableId} held for 15 mins · Switched to Dine-In`);
  };

  const handleCompleteOrder = (
    paymentMethod: 'Apple Pay' | 'DuitNow QR' | 'Lorong Credit',
    finalTotalRm: number
  ) => {
    const newOrderNum = `TTDI-${Math.floor(410 + Math.random() * 89)}`;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newOrder: ActiveOrder = {
      orderNumber: newOrderNum,
      placedAt: nowStr,
      fulfillment,
      stage: 1,
      estimatedMinutesLeft: 4,
      baristaName: 'Aiman R.',
      machineGroup: 'KB90 Group 1 · 9.0 bar @ 93.2°C',
      carPlate: fulfillment === 'curbside' ? carPlate : undefined,
      carDescription: fulfillment === 'curbside' ? carDesc : undefined,
      curbsideHazardActive: false,
      tableId: fulfillment === 'dine-in' ? selectedTableId : undefined,
      items: cart.map((c) => ({
        name: c.item.name,
        qty: c.quantity,
        summary: Object.values(c.customization).filter(Boolean).join(' · ') || 'Standard Spec',
        artworkType: c.item.artworkType,
      })),
      totalRm: finalTotalRm,
      paymentMethod,
    };

    if (paymentMethod === 'Lorong Credit') {
      setWalletBalance((b) => Math.max(0, +(b - finalTotalRm).toFixed(2)));
    }
    if (activeVoucher) {
      setStamps((s) => Math.max(0, s - activeVoucher.stampsCost));
      setActiveVoucher(null);
    }

    setStamps((s) => s + 1);
    setActiveOrder(newOrder);
    setCart([]);
    setCheckoutOpen(false);
    setActiveTab('brew');
    setIslandExpanded(true);
    showToast(`Order #${newOrderNum} sent to KB90 Bar! (+1 Stamp)`);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    haptics.enabled = next;
    if (next) haptics.impactLight();
  };

  return (
    <div className={`app-stage-wrapper ${themeMode} ${viewportMode === 'fullscreen' ? 'mode-fullscreen' : 'mode-device'}`}>
      {/* Desktop Studio Companion Bar (Hidden on mobile viewports or fullscreen mode) */}
      {viewportMode === 'device' && (
        <aside className="desktop-companion-panel">
          <div className="companion-brand-badge">
            <span className="live-dot dot-ready" />
            <span>TTDI iOS FLAGSHIP APP</span>
          </div>
          <h2 className="companion-title">Satu Lorong</h2>
          <p className="companion-sub">
            34, Lorong Rahim Kajai 14, Taman Tun Dr Ismail, 60000 Kuala Lumpur
          </p>

          <div className="companion-feature-cards">
            <div className="c-card">
              <div className="c-card-head">
                <Car size={14} className="text-amber" />
                <strong>Lorong 14 Double-Park Express</strong>
              </div>
              <p>
                Built for TTDI’s notorious street parking—enter your plate (<code>{carPlate}</code>)
                and trigger the curbside hazard beacon so the runner brings your coffee out in 45s.
              </p>
            </div>

            <div className="c-card">
              <div className="c-card-head">
                <Gauge size={14} className="text-amber" />
                <strong>Dynamic Island & KB90 Telemetry</strong>
              </div>
              <p>
                Tap the iPhone Dynamic Island at the top to expand live La Marzocco KB90 extraction
                stages, or simulate barista progress below.
              </p>
            </div>
          </div>

          <div className="companion-actions-stack">
            <button
              type="button"
              className="comp-btn primary"
              onClick={() => {
                haptics.impactMedium();
                handleAdvanceOrderStage();
              }}
            >
              <Sparkles size={14} />
              <span>Simulate Next Barista Step (#{activeOrder.orderNumber})</span>
            </button>

            <div className="comp-btn-row">
              <button
                type="button"
                className="comp-btn"
                onClick={() => {
                  haptics.impactLight();
                  setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
                }}
              >
                {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{themeMode === 'dark' ? 'Daylight Espresso' : 'Dark Roastery'}</span>
              </button>

              <button
                type="button"
                className="comp-btn"
                onClick={toggleSound}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundEnabled ? 'Haptics On' : 'Muted'}</span>
              </button>
            </div>

            <div className="comp-btn-row">
              <button
                type="button"
                className="comp-btn"
                onClick={() => {
                  haptics.impactLight();
                  setShowSwiftModal(true);
                }}
              >
                <Code2 size={14} />
                <span>SwiftUI Source</span>
              </button>

              <button
                type="button"
                className="comp-btn"
                onClick={() => {
                  haptics.impactLight();
                  setViewportMode('fullscreen');
                }}
              >
                <Maximize2 size={14} />
                <span>Full-Bleed View</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Floating button to return to iPhone Frame when in Fullscreen on Desktop */}
      {viewportMode === 'fullscreen' && (
        <button
          type="button"
          className="restore-frame-pill"
          onClick={() => {
            haptics.impactLight();
            setViewportMode('device');
          }}
        >
          <Smartphone size={13} />
          <span>iPhone 16 Pro Frame</span>
        </button>
      )}

      {/* iPhone 16 Pro Titanium Hardware Shell */}
      <main className="iphone-device-shell">
        {/* Hardware Titanium Side Buttons */}
        <div className="hw-btn hw-action" />
        <div className="hw-btn hw-vol-up" />
        <div className="hw-btn hw-vol-down" />
        <div className="hw-btn hw-power" />

        <div className="iphone-screen">
          {/* iOS Status Bar + Interactive Dynamic Island */}
          <DynamicIsland
            activeOrder={activeOrder}
            expanded={islandExpanded}
            onToggleExpand={() => setIslandExpanded((e) => !e)}
            onAdvanceStage={handleAdvanceOrderStage}
            onJumpToBrewTab={() => setActiveTab('brew')}
            toastMessage={toastMessage}
          />

          {/* Main Tab Content Area */}
          <div className="ios-view-body">
            {activeTab === 'order' && (
              <div className="tab-view-scroll">
                {/* Top Shophouse Identity & Weather/Queue Bar */}
                <header className="ttdi-top-header">
                  <div className="ttdi-loc-row">
                    <div>
                      <div className="shophouse-eyebrow">
                        <MapPin size={11} className="text-amber" />
                        <span>{TTDI_SHOPHOUSE_INFO.shortAddress}</span>
                      </div>
                      <h1 className="shophouse-brand-title">Satu Lorong</h1>
                    </div>

                    <button
                      type="button"
                      className="live-queue-badge"
                      onClick={() => {
                        haptics.impactLight();
                        setActiveTab('brew');
                      }}
                    >
                      <span className="live-dot dot-ready" />
                      <div>
                        <div className="lq-top">KB90 Queue</div>
                        <div className="lq-bot">~3 mins · 2 cups</div>
                      </div>
                    </button>
                  </div>

                  {/* iOS Segmented Fulfillment Picker */}
                  <div className="ios-segmented-picker">
                    {(
                      [
                        { id: 'pickup', label: 'Skip Queue', icon: Store },
                        { id: 'curbside', label: 'Curbside Lrg 14', icon: Car },
                        { id: 'dine-in', label: `Table ${selectedTableId}`, icon: Utensils },
                      ] as const
                    ).map((mode) => {
                      const Icon = mode.icon;
                      const active = fulfillment === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          className={`seg-option ${active ? 'seg-active' : ''}`}
                          onClick={() => {
                            haptics.impactLight();
                            setFulfillment(mode.id);
                          }}
                        >
                          <Icon size={13} />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Context Banner for Active Fulfillment Mode */}
                  <div className="fulfillment-context-strip">
                    {fulfillment === 'curbside' && (
                      <>
                        <span>
                          <Car size={12} className="text-amber" /> Curbside Drop:{' '}
                          <strong>{carPlate}</strong> ({carDesc})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impactLight();
                            setCheckoutOpen(true);
                          }}
                        >
                          Edit Plate
                        </button>
                      </>
                    )}
                    {fulfillment === 'pickup' && (
                      <>
                        <span>
                          <Store size={12} className="text-amber" /> Express Window at 34 Lorong
                          Rahim Kajai 14
                        </span>
                        <span className="ctx-tag">Walk-up Ready</span>
                      </>
                    )}
                    {fulfillment === 'dine-in' && (
                      <>
                        <span>
                          <Utensils size={12} className="text-amber" /> Checked In:{' '}
                          <strong>Table {selectedTableId}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impactLight();
                            setActiveTab('shophouse');
                          }}
                        >
                          Floorplan
                        </button>
                      </>
                    )}
                  </div>
                </header>

                {/* Featured 6:00 AM Morning Bake & Signature Pairing Card */}
                <section className="morning-ritual-banner">
                  <div className="ritual-content">
                    <div className="ritual-badges">
                      <span className="ritual-pill hot">
                        <Flame size={11} /> 6:00 AM HEARTH BATCH #2
                      </span>
                      <span className="ritual-pill count">6 Kouign-Amann Left</span>
                    </div>
                    <h2>TTDI Morning Ritual Pair</h2>
                    <p>
                      Chilled <strong>Kajai Dirty</strong> (Sarawak Gula Apong) + warm{' '}
                      <strong>Gula Melaka Sea Salt Kouign-Amann</strong> straight from the deck oven.
                    </p>
                    <div className="ritual-cta-row">
                      <button
                        type="button"
                        className="ritual-add-btn"
                        onClick={handleQuickCombo}
                      >
                        <Plus size={14} />
                        <span>Add Pair · RM 27</span>
                        <del>RM 29</del>
                      </button>
                      <button
                        type="button"
                        className="ritual-inspect-btn"
                        onClick={() => {
                          haptics.impactLight();
                          setCustomizingItem(MENU_ITEMS[0]);
                        }}
                      >
                        Customize Dirty
                      </button>
                    </div>
                  </div>
                  <div className="ritual-art-col">
                    <MenuArtwork type="kajai-dirty" size="md" />
                  </div>
                </section>

                {/* Search & Category Filter Pills */}
                <div className="menu-controls-sticky">
                  <div className="ios-search-bar">
                    <Search size={15} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search Kajai Dirty, Cameron V60, Sourdough..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="category-scroll-strip">
                    {CATEGORY_TABS.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`cat-chip ${selectedCategory === cat.id ? 'cat-active' : ''}`}
                        onClick={() => {
                          haptics.impactLight();
                          setSelectedCategory(cat.id);
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Menu Items Grid / Stack */}
                <div className="menu-cards-list">
                  {filteredMenu.map((item) => (
                    <article
                      key={item.id}
                      className="menu-item-card"
                      onClick={() => {
                        haptics.impactLight();
                        setCustomizingItem(item);
                      }}
                    >
                      <div className="menu-card-art">
                        <MenuArtwork type={item.artworkType} size="md" />
                        {item.remainingBatch && (
                          <span className="batch-left-pill">{item.remainingBatch} left</span>
                        )}
                      </div>

                      <div className="menu-card-body">
                        <div className="menu-card-top">
                          {item.badge && <span className="item-badge-tag">{item.badge}</span>}
                          {item.isNew && <span className="item-new-tag">NEW LOT</span>}
                        </div>

                        <h3 className="menu-item-title">{item.name}</h3>
                        <div className="menu-item-malay">{item.malaySubtitle}</div>

                        <div className="menu-tasting-chips">
                          {item.tastingProfile.notes.slice(0, 3).map((note) => (
                            <span key={note} className="mini-note-chip">
                              {note}
                            </span>
                          ))}
                        </div>

                        <div className="menu-card-footer">
                          <div className="price-and-prep">
                            <span className="item-price">RM {item.price.toFixed(2)}</span>
                            <span className="item-prep">· {item.prepMinutes}m</span>
                          </div>

                          <button
                            type="button"
                            className="quick-plus-btn"
                            onClick={(e) => handleQuickAdd(item, e)}
                            aria-label={`Quick add ${item.name}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'brew' && (
              <BrewTrackerView
                activeOrder={activeOrder}
                onAdvanceStage={handleAdvanceOrderStage}
                onToggleHazardBeacon={handleToggleHazardBeacon}
              />
            )}

            {activeTab === 'shophouse' && (
              <ShophouseView
                tables={tables}
                selectedTableId={selectedTableId}
                onSelectAndHoldTable={handleSelectAndHoldTable}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'loyalty' && (
              <LoyaltyView
                stamps={stamps}
                walletBalance={walletBalance}
                activeVoucher={activeVoucher}
                onAddStampDemo={() => {
                  setStamps((s) => s + 1);
                  showToast('NFC Stamp Collected! (+1 Kopi Stamp)');
                }}
                onTopUpWallet={(amt, bonus) => {
                  setWalletBalance((b) => +(b + amt + bonus).toFixed(2));
                  showToast(`Reloaded RM ${amt} (+RM ${bonus} Bonus) via Apple Pay`);
                }}
                onApplyVoucherToBag={(voucher) => {
                  if (activeVoucher?.id === voucher.id) {
                    setActiveVoucher(null);
                    showToast('Removed reward voucher from bag');
                  } else {
                    setActiveVoucher(voucher);
                    showToast(`Applied ${voucher.code} (-RM ${voucher.discountRm}) to Bag!`);
                  }
                }}
                onShowToast={showToast}
              />
            )}
          </div>

          {/* Floating Checkout Bag Bar (Docked above iOS Tab Bar) */}
          {totalBagCount > 0 && (
            <div className="floating-bag-dock">
              <button
                type="button"
                className="floating-bag-pill"
                onClick={() => {
                  haptics.impactMedium();
                  setCheckoutOpen(true);
                }}
              >
                <div className="bag-pill-left">
                  <span className="bag-count-circle">{totalBagCount}</span>
                  <div className="bag-pill-text">
                    <strong>View Order Bag</strong>
                    <span>
                      {fulfillment === 'curbside'
                        ? `Curbside · ${carPlate}`
                        : fulfillment === 'dine-in'
                        ? `Table ${selectedTableId}`
                        : 'Lorong 14 Counter'}
                    </span>
                  </div>
                </div>

                <div className="bag-pill-right">
                  <span>Checkout · RM {totalBagRm.toFixed(2)}</span>
                </div>
              </button>
            </div>
          )}

          {/* Frosted Glass iOS Bottom Tab Bar */}
          <nav className="ios-tab-bar" aria-label="Primary Navigation">
            <button
              type="button"
              className={`ios-tab-item ${activeTab === 'order' ? 'tab-active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setActiveTab('order');
              }}
            >
              <Coffee size={20} />
              <span>Order</span>
            </button>

            <button
              type="button"
              className={`ios-tab-item ${activeTab === 'brew' ? 'tab-active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setActiveTab('brew');
              }}
            >
              <div className="tab-icon-wrap">
                <Gauge size={20} />
                <span className="tab-live-badge">
                  {activeOrder.stage === 4 ? '✓' : `${activeOrder.stage + 1}/5`}
                </span>
              </div>
              <span>Brew #{activeOrder.orderNumber.split('-')[1]}</span>
            </button>

            <button
              type="button"
              className={`ios-tab-item ${activeTab === 'shophouse' ? 'tab-active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setActiveTab('shophouse');
              }}
            >
              <Compass size={20} />
              <span>Shophouse</span>
            </button>

            <button
              type="button"
              className={`ios-tab-item ${activeTab === 'loyalty' ? 'tab-active' : ''}`}
              onClick={() => {
                haptics.impactLight();
                setActiveTab('loyalty');
              }}
            >
              <div className="tab-icon-wrap">
                <Wallet size={20} />
                <span className="tab-stamp-dot">{stamps}</span>
              </div>
              <span>Kelab Pass</span>
            </button>

            <button
              type="button"
              className="ios-tab-item"
              onClick={() => {
                haptics.impactLight();
                setCheckoutOpen(true);
              }}
            >
              <div className="tab-icon-wrap">
                <ShoppingBag size={20} />
                {totalBagCount > 0 && <span className="tab-bag-badge">{totalBagCount}</span>}
              </div>
              <span>Bag</span>
            </button>
          </nav>

          {/* iOS Home Indicator Bar */}
          <div className="ios-home-indicator-zone">
            <div className="ios-home-bar" />
          </div>

          {/* Item Detail & Customizer Sheet */}
          <ItemDetailSheet
            item={customizingItem}
            onClose={() => setCustomizingItem(null)}
            onAddToBag={handleAddToBag}
          />

          {/* Checkout & Apple Pay / DuitNow Sheet */}
          <CheckoutSheet
            isOpen={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            cart={cart}
            onUpdateQty={handleUpdateBagQty}
            fulfillment={fulfillment}
            onChangeFulfillment={setFulfillment}
            carPlate={carPlate}
            onChangeCarPlate={setCarPlate}
            carDesc={carDesc}
            onChangeCarDesc={setCarDesc}
            selectedTable={selectedTableId}
            onChangeTable={setSelectedTableId}
            activeVoucher={activeVoucher}
            onSelectVoucher={setActiveVoucher}
            availableVouchers={REWARD_VOUCHERS}
            walletBalance={walletBalance}
            onCompleteOrder={handleCompleteOrder}
          />
        </div>
      </main>

      {/* Native SwiftUI Source Code Modal */}
      <SwiftCodeModal isOpen={showSwiftModal} onClose={() => setShowSwiftModal(false)} />
    </div>
  );
}

export default App;
