import React, { useState, useMemo } from 'react';
import { MenuItem, CartItemCustomization } from '../types';
import { MenuArtwork } from './MenuArtwork';
import { X, Flame, Clock, Zap, Plus, Minus, Sparkles } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface ItemDetailSheetProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToBag: (item: MenuItem, quantity: number, unitPrice: number, customization: CartItemCustomization) => void;
}

export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({ item, onClose, onAddToBag }) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState<CartItemCustomization['temperature']>('Iced');
  const [beanHopper, setBeanHopper] = useState<CartItemCustomization['beanHopper']>('Bukit Kiara Blend');
  const [milk, setMilk] = useState<CartItemCustomization['milk']>(
    item.id === 'kajai-dirty' ? 'Hokkaido Milk (+RM3)' : 'Full Cream Dairy'
  );
  const [shotStrength, setShotStrength] = useState<CartItemCustomization['shotStrength']>('Standard Double (18g)');
  const [sweetness, setSweetness] = useState<CartItemCustomization['sweetness']>('50% TTDI Standard');
  const [grindSize, setGrindSize] = useState<CartItemCustomization['grindSize']>('Whole Bean');
  const [warming, setWarming] = useState<CartItemCustomization['warming']>('Torched Warm (65°C)');
  const [specialNote, setSpecialNote] = useState('');

  const unitPrice = useMemo(() => {
    let p = item.price;
    if (item.supportsBeanHopper) {
      if (beanHopper === 'Cameron Anaerobic (+RM3)') p += 3;
      if (beanHopper === 'Swiss Water Decaf (+RM2)') p += 2;
    }
    if (item.supportsMilk && item.id !== 'kajai-dirty') {
      if (milk && milk.includes('+RM3')) p += 3;
    }
    if (item.supportsBeanHopper && shotStrength === 'Triple Shot (+RM4)') {
      p += 4;
    }
    if (item.supportsWarming && warming === 'Extra Cultured Butter (+RM3)') {
      p += 3;
    }
    return p;
  }, [item, beanHopper, milk, shotStrength, warming]);

  const handleConfirm = () => {
    haptics.impactMedium();
    const cust: CartItemCustomization = {};
    if (item.supportsTemp) cust.temperature = temperature;
    if (item.supportsBeanHopper) {
      cust.beanHopper = beanHopper;
      cust.shotStrength = shotStrength;
    }
    if (item.supportsMilk) cust.milk = milk;
    if (item.supportsSweetness) cust.sweetness = sweetness;
    if (item.supportsGrind) cust.grindSize = grindSize;
    if (item.supportsWarming) cust.warming = warming;
    if (specialNote.trim()) cust.specialNote = specialNote.trim();

    onAddToBag(item, quantity, unitPrice, cust);
  };

  return (
    <div className="ios-sheet-backdrop" onClick={onClose}>
      <div className="ios-sheet-container" onClick={(e) => e.stopPropagation()}>
        <div className="ios-sheet-grabber" />

        <button
          className="ios-sheet-close"
          onClick={() => {
            haptics.impactLight();
            onClose();
          }}
          aria-label="Close item customizer"
        >
          <X size={18} />
        </button>

        <div className="ios-sheet-scroll">
          {/* Hero Header */}
          <div className="customizer-hero">
            <div className="customizer-artwork-wrap">
              <MenuArtwork type={item.artworkType} size="lg" />
              {item.badge && <span className="customizer-floating-badge">{item.badge}</span>}
            </div>

            <div className="customizer-title-group">
              <span className="customizer-malay-sub">{item.malaySubtitle}</span>
              <h2 className="customizer-title">{item.name}</h2>
              <p className="customizer-origin">{item.originOrFlour}</p>
            </div>

            <div className="customizer-meta-pills">
              <div className="meta-pill">
                <Clock size={12} />
                <span>~{item.prepMinutes} mins</span>
              </div>
              {item.caffeineMg > 0 && (
                <div className="meta-pill">
                  <Zap size={12} />
                  <span>{item.caffeineMg}mg caffeine</span>
                </div>
              )}
              {item.calories > 0 && (
                <div className="meta-pill">
                  <Flame size={12} />
                  <span>{item.calories} kcal</span>
                </div>
              )}
            </div>

            <p className="customizer-desc">{item.description}</p>
          </div>

          {/* Sensory & Tasting Notes Card */}
          <div className="tasting-card">
            <div className="tasting-header">
              <span className="tasting-label">ROASTER & BAKEHOUSE SENSORY PROFILE</span>
              <div className="tasting-notes-row">
                {item.tastingProfile.notes.map((note) => (
                  <span key={note} className="tasting-note-chip">
                    <Sparkles size={10} /> {note}
                  </span>
                ))}
              </div>
            </div>

            <div className="tasting-bars-grid">
              {[
                { label: 'Acidity', val: item.tastingProfile.acidity },
                { label: 'Body', val: item.tastingProfile.body },
                { label: 'Sweetness', val: item.tastingProfile.sweetness },
                { label: 'Roast / Crust', val: item.tastingProfile.bitterness },
              ].map((stat) => (
                <div key={stat.label} className="tasting-bar-item">
                  <div className="tasting-bar-top">
                    <span>{stat.label}</span>
                    <span>{stat.val}/5</span>
                  </div>
                  <div className="tasting-bar-track">
                    <div className="tasting-bar-fill" style={{ width: `${(stat.val / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customization Controls */}
          <div className="customizer-options-stack">
            {item.supportsTemp && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Temperature</span>
                  <span className="opt-req">Required</span>
                </div>
                <div className="opt-pills-grid">
                  {(['Iced', 'Less Ice', 'Hot (62°C)'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${temperature === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setTemperature(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsBeanHopper && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Mythos Hopper Selection</span>
                  <span className="opt-req">18g Precision Dose</span>
                </div>
                <div className="opt-pills-grid">
                  {(
                    [
                      'Bukit Kiara Blend',
                      'Cameron Anaerobic (+RM3)',
                      'Swiss Water Decaf (+RM2)',
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${beanHopper === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setBeanHopper(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsMilk && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Milk & Alternative</span>
                  <span className="opt-req">Steamed to 62°C / Chilled</span>
                </div>
                <div className="opt-pills-grid">
                  {(
                    [
                      'Full Cream Dairy',
                      'Oatside Barista (+RM3)',
                      'Hokkaido Milk (+RM3)',
                      'Bonsoy (+RM3)',
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${milk === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setMilk(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsBeanHopper && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Extraction Pull</span>
                  <span className="opt-req">KB90 Grouphead</span>
                </div>
                <div className="opt-pills-grid">
                  {(
                    ['Standard Double (18g)', 'Ristretto Pull', 'Triple Shot (+RM4)'] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${shotStrength === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setShotStrength(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsSweetness && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Sarawak Gula Apong / Sweetness</span>
                </div>
                <div className="opt-pills-grid">
                  {(['0% Unsweetened', '50% TTDI Standard', '100% Regular'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${sweetness === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setSweetness(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsWarming && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Bakehouse Preparation</span>
                  <span className="opt-req">Deck Hearth</span>
                </div>
                <div className="opt-pills-grid">
                  {(
                    [
                      'Torched Warm (65°C)',
                      'Room Temp',
                      'Extra Cultured Butter (+RM3)',
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${warming === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setWarming(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.supportsGrind && (
              <div className="opt-group">
                <div className="opt-group-header">
                  <span>Mahlkönig EK43S Grind Setting</span>
                  <span className="opt-req">Freshly Purged</span>
                </div>
                <div className="opt-pills-grid">
                  {(
                    [
                      'Whole Bean',
                      'Espresso Fine',
                      'V60 Medium-Fine',
                      'AeroPress',
                      'Cold Brew Coarse',
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`opt-pill ${grindSize === opt ? 'opt-pill-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        setGrindSize(opt);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="opt-group">
              <div className="opt-group-header">
                <span>Barista Note (Optional)</span>
              </div>
              <input
                type="text"
                className="barista-note-input"
                placeholder="e.g., Extra cinnamon dust, separate ice, slice bagel in half..."
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="ios-sheet-footer">
          <div className="qty-stepper">
            <button
              type="button"
              onClick={() => {
                haptics.impactLight();
                setQuantity((q) => Math.max(1, q - 1));
              }}
              aria-label="Decrease quantity"
            >
              <Minus size={15} />
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              onClick={() => {
                haptics.impactLight();
                setQuantity((q) => q + 1);
              }}
              aria-label="Increase quantity"
            >
              <Plus size={15} />
            </button>
          </div>

          <button type="button" className="add-to-bag-cta" onClick={handleConfirm}>
            <span>Add to Bag</span>
            <span className="cta-price-pill">RM {(unitPrice * quantity).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
