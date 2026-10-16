import React, { useState } from 'react';
import {
  CartItem,
  FulfillmentMode,
  RewardVoucher,
} from '../types';
import { MenuArtwork } from './MenuArtwork';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Car,
  Store,
  Utensils,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Wallet,
  Smartphone,
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface CheckoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (cartItemId: string, delta: number) => void;
  fulfillment: FulfillmentMode;
  onChangeFulfillment: (mode: FulfillmentMode) => void;
  carPlate: string;
  onChangeCarPlate: (plate: string) => void;
  carDesc: string;
  onChangeCarDesc: (desc: string) => void;
  selectedTable: string;
  onChangeTable: (tableId: string) => void;
  activeVoucher: RewardVoucher | null;
  onSelectVoucher: (v: RewardVoucher | null) => void;
  availableVouchers: RewardVoucher[];
  walletBalance: number;
  onCompleteOrder: (
    paymentMethod: 'Apple Pay' | 'DuitNow QR' | 'Lorong Credit',
    finalTotalRm: number
  ) => void;
}

export const CheckoutSheet: React.FC<CheckoutSheetProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  fulfillment,
  onChangeFulfillment,
  carPlate,
  onChangeCarPlate,
  carDesc,
  onChangeCarDesc,
  selectedTable,
  onChangeTable,
  activeVoucher,
  onSelectVoucher,
  availableVouchers,
  walletBalance,
  onCompleteOrder,
}) => {
  const [byoCup, setByoCup] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Apple Pay' | 'DuitNow QR' | 'Lorong Credit'>(
    'Apple Pay'
  );
  const [processingState, setProcessingState] = useState<'idle' | 'authenticating' | 'success'>(
    'idle'
  );

  if (!isOpen) return null;

  const subtotal = cart.reduce((acc, c) => acc + c.unitPrice * c.quantity, 0);
  const byoDiscount = byoCup ? 2.0 : 0;
  const voucherDiscount = activeVoucher ? Math.min(subtotal, activeVoucher.discountRm) : 0;
  const discountedSubtotal = Math.max(0, subtotal - byoDiscount - voucherDiscount);
  const sstTax = +(discountedSubtotal * 0.06).toFixed(2);
  const finalTotal = +(discountedSubtotal + sstTax).toFixed(2);

  const handlePay = () => {
    if (cart.length === 0) return;
    haptics.impactMedium();
    setProcessingState('authenticating');
    setTimeout(() => {
      haptics.applePaySuccess();
      setProcessingState('success');
      setTimeout(() => {
        setProcessingState('idle');
        onCompleteOrder(paymentMethod, finalTotal);
      }, 950);
    }, 1100);
  };

  return (
    <div className="ios-sheet-backdrop" onClick={onClose}>
      <div className="ios-sheet-container checkout-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ios-sheet-grabber" />

        <div className="checkout-top-bar">
          <div>
            <span className="checkout-eyebrow">34 LORONG RAHIM KAJAI 14 · TTDI</span>
            <h2 className="checkout-heading">Your Order Bag</h2>
          </div>
          <button
            className="ios-sheet-close static-close"
            onClick={() => {
              haptics.impactLight();
              onClose();
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="ios-sheet-scroll">
          {/* Fulfillment Mode Selector */}
          <div className="checkout-section-card">
            <div className="section-card-title">Fulfillment at TTDI Shophouse</div>
            <div className="fulfillment-seg-row">
              {(
                [
                  { id: 'pickup', label: 'Counter Pickup', icon: Store },
                  { id: 'curbside', label: 'Lorong 14 Curbside', icon: Car },
                  { id: 'dine-in', label: 'Table Service', icon: Utensils },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`fulfill-seg-btn ${fulfillment === tab.id ? 'active' : ''}`}
                    onClick={() => {
                      haptics.impactLight();
                      onChangeFulfillment(tab.id);
                    }}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {fulfillment === 'curbside' && (
              <div className="curbside-inputs-box">
                <div className="curbside-helper">
                  Pull up to the cone outside <strong>34 Lorong Rahim Kajai 14</strong> with hazard
                  lights on. Our runner delivers in 45s.
                </div>
                <div className="curbside-fields-row">
                  <div className="field-col">
                    <label>Car Plate No.</label>
                    <input
                      type="text"
                      value={carPlate}
                      onChange={(e) => onChangeCarPlate(e.target.value.toUpperCase())}
                      placeholder="WYY 4821"
                    />
                  </div>
                  <div className="field-col">
                    <label>Vehicle / Color</label>
                    <input
                      type="text"
                      value={carDesc}
                      onChange={(e) => onChangeCarDesc(e.target.value)}
                      placeholder="Grey Civic FE"
                    />
                  </div>
                </div>
              </div>
            )}

            {fulfillment === 'dine-in' && (
              <div className="curbside-inputs-box">
                <div className="curbside-helper">
                  Select your shophouse table (or check live occupancy in the Shophouse tab):
                </div>
                <div className="table-quick-pills">
                  {['T-01 (Bar)', 'T-03 (Window)', 'L-01 (Skylight Loft)', 'C-01 (Courtyard)'].map(
                    (t) => {
                      const code = t.split(' ')[0];
                      return (
                        <button
                          key={code}
                          type="button"
                          className={`opt-pill ${selectedTable === code ? 'opt-pill-active' : ''}`}
                          onClick={() => {
                            haptics.impactLight();
                            onChangeTable(code);
                          }}
                        >
                          {t}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {fulfillment === 'pickup' && (
              <div className="curbside-inputs-box">
                <div className="curbside-helper">
                  Collect directly at the <strong>La Marzocco Express Window</strong> facing Lorong
                  Rahim Kajai 14. Estimated prep time: <strong>~4 mins</strong>.
                </div>
              </div>
            )}
          </div>

          {/* Bag Items List */}
          <div className="checkout-section-card">
            <div className="section-card-title">Items ({cart.reduce((s, i) => s + i.quantity, 0)})</div>
            {cart.length === 0 ? (
              <div className="empty-bag-msg">Your bag is empty. Add a Kajai Dirty or Kouign-Amann!</div>
            ) : (
              <div className="bag-items-list">
                {cart.map((c) => {
                  const specs = Object.values(c.customization).filter(Boolean).join(' · ');
                  return (
                    <div key={c.cartItemId} className="bag-item-row">
                      <MenuArtwork type={c.item.artworkType} size="sm" />
                      <div className="bag-item-info">
                        <div className="bag-item-name">{c.item.name}</div>
                        {specs && <div className="bag-item-specs">{specs}</div>}
                        <div className="bag-item-price">RM {(c.unitPrice * c.quantity).toFixed(2)}</div>
                      </div>
                      <div className="bag-item-stepper">
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impactLight();
                            onUpdateQty(c.cartItemId, -1);
                          }}
                        >
                          {c.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                        </button>
                        <span>{c.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impactLight();
                            onUpdateQty(c.cartItemId, 1);
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sustainability & Kelab Lorong Vouchers */}
          <div className="checkout-section-card">
            <div className="eco-toggle-row" onClick={() => {
              haptics.impactLight();
              setByoCup(!byoCup);
            }}>
              <div>
                <div className="eco-title">Bring My Own Tumbler (BYO Cup)</div>
                <div className="eco-sub">Fellow Carter / KeepCup rinsed at our bar (-RM 2.00)</div>
              </div>
              <div className={`ios-switch ${byoCup ? 'switch-on' : ''}`}>
                <div className="ios-switch-thumb" />
              </div>
            </div>

            <div className="voucher-picker-block">
              <div className="voucher-label-row">
                <Sparkles size={13} className="text-amber" />
                <span>Kelab Lorong Reward Vouchers</span>
              </div>
              <div className="voucher-chips-row">
                {availableVouchers.map((v) => {
                  const active = activeVoucher?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`voucher-chip ${active ? 'voucher-chip-active' : ''}`}
                      onClick={() => {
                        haptics.impactLight();
                        onSelectVoucher(active ? null : v);
                      }}
                    >
                      <span>{v.code}</span>
                      <strong>-RM {v.discountRm}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="checkout-section-card">
            <div className="section-card-title">Payment Method</div>
            <div className="payment-methods-grid">
              <button
                type="button"
                className={`pay-method-card ${paymentMethod === 'Apple Pay' ? 'active' : ''}`}
                onClick={() => {
                  haptics.impactLight();
                  setPaymentMethod('Apple Pay');
                }}
              >
                <Smartphone size={16} />
                <div>
                  <div className="pay-name">Apple Pay</div>
                  <div className="pay-sub">Face ID · Instant</div>
                </div>
              </button>

              <button
                type="button"
                className={`pay-method-card ${paymentMethod === 'DuitNow QR' ? 'active' : ''}`}
                onClick={() => {
                  haptics.impactLight();
                  setPaymentMethod('DuitNow QR');
                }}
              >
                <QrCode size={16} />
                <div>
                  <div className="pay-name">DuitNow QR</div>
                  <div className="pay-sub">MAE / TnG eWallet</div>
                </div>
              </button>

              <button
                type="button"
                className={`pay-method-card ${paymentMethod === 'Lorong Credit' ? 'active' : ''}`}
                onClick={() => {
                  haptics.impactLight();
                  setPaymentMethod('Lorong Credit');
                }}
              >
                <Wallet size={16} />
                <div>
                  <div className="pay-name">Lorong Pass</div>
                  <div className="pay-sub">RM {walletBalance.toFixed(2)} avail</div>
                </div>
              </button>
            </div>

            {/* Bill Breakdown */}
            <div className="bill-breakdown">
              <div className="bill-row">
                <span>Subtotal</span>
                <span>RM {subtotal.toFixed(2)}</span>
              </div>
              {byoCup && (
                <div className="bill-row discount">
                  <span>BYO Tumbler Eco Rebate</span>
                  <span>-RM 2.00</span>
                </div>
              )}
              {activeVoucher && (
                <div className="bill-row discount">
                  <span>Voucher ({activeVoucher.code})</span>
                  <span>-RM {voucherDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="bill-row">
                <span>SST (6% Service Tax)</span>
                <span>RM {sstTax.toFixed(2)}</span>
              </div>
              <div className="bill-row total">
                <span>Total Payable</span>
                <span>RM {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Apple Pay / DuitNow Authenticating Overlay */}
        {processingState !== 'idle' && (
          <div className="apple-pay-overlay">
            <div className="apple-pay-sheet">
              {processingState === 'authenticating' ? (
                <>
                  <div className="faceid-pulse-ring">
                    <ShieldCheck size={36} className="text-amber" />
                  </div>
                  <h4>
                    {paymentMethod === 'Apple Pay'
                      ? 'Confirming with Face ID…'
                      : paymentMethod === 'DuitNow QR'
                      ? 'Verifying DuitNow Instant Transfer…'
                      : 'Deducting Kelab Lorong Pass…'}
                  </h4>
                  <p>Satu Lorong Roastery Sdn Bhd · RM {finalTotal.toFixed(2)}</p>
                </>
              ) : (
                <>
                  <div className="faceid-success-ring">
                    <CheckCircle2 size={40} />
                  </div>
                  <h4>Ticket Sent to KB90 Barista Queue!</h4>
                  <p>Dynamic Island Live Activity Started · +1 Kopi Stamp</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sticky Pay Footer */}
        <div className="ios-sheet-footer">
          <button
            type="button"
            className="apple-pay-cta"
            disabled={cart.length === 0 || processingState !== 'idle'}
            onClick={handlePay}
          >
            <span>
              {paymentMethod === 'Apple Pay'
                ? 'Pay with Pay'
                : paymentMethod === 'DuitNow QR'
                ? 'Pay via DuitNow QR'
                : 'Pay with Lorong Pass'}
            </span>
            <span className="cta-price-pill">RM {finalTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
