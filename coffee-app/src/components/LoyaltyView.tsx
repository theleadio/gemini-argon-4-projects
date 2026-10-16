import React, { useState } from 'react';
import { RewardVoucher } from '../types';
import { REWARD_VOUCHERS } from '../data/ttdiData';
import {
  Award,
  CheckCircle2,
  Coffee,
  PlusCircle,
  QrCode,
  Sparkles,
  Stamp,
  Wallet,
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface LoyaltyViewProps {
  stamps: number;
  walletBalance: number;
  activeVoucher: RewardVoucher | null;
  onAddStampDemo: () => void;
  onTopUpWallet: (amount: number, bonus: number) => void;
  onApplyVoucherToBag: (voucher: RewardVoucher) => void;
  onShowToast: (msg: string) => void;
}

export const LoyaltyView: React.FC<LoyaltyViewProps> = ({
  stamps,
  walletBalance,
  activeVoucher,
  onAddStampDemo,
  onTopUpWallet,
  onApplyVoucherToBag,
  onShowToast,
}) => {
  const [addedToAppleWallet, setAddedToAppleWallet] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  return (
    <div className="tab-view-scroll">
      {/* Apple Wallet Style Pass Card */}
      <div className="apple-wallet-pass">
        <div className="pass-header">
          <div className="pass-brand">
            <Coffee size={16} className="text-amber" />
            <div>
              <div className="pass-org">SATU LORONG ROASTERY</div>
              <div className="pass-sub">KELAB LORONG · TTDI NEIGHBOR PASS</div>
            </div>
          </div>
          <span className="pass-tier-badge">FOUNDING MEMBER</span>
        </div>

        <div className="pass-metrics-row">
          <div>
            <span className="pass-m-label">STORED CREDIT</span>
            <div className="pass-m-value">RM {walletBalance.toFixed(2)}</div>
          </div>
          <div>
            <span className="pass-m-label">KOPI STAMPS</span>
            <div className="pass-m-value">{stamps} / 8</div>
          </div>
          <div>
            <span className="pass-m-label">HOME LORONG</span>
            <div className="pass-m-value">Kajai 14</div>
          </div>
        </div>

        <div className="pass-actions-row">
          <button
            type="button"
            className="pass-qr-btn"
            onClick={() => {
              haptics.impactLight();
              setShowQrModal(!showQrModal);
            }}
          >
            <QrCode size={14} />
            <span>{showQrModal ? 'Hide Counter QR' : 'Show Barista QR'}</span>
          </button>

          <button
            type="button"
            className={`apple-wallet-badge-btn ${addedToAppleWallet ? 'added' : ''}`}
            onClick={() => {
              haptics.applePaySuccess();
              setAddedToAppleWallet(true);
              onShowToast('Pass synced to iOS Apple Wallet (Auto-Lock Screen near Lorong 14)');
            }}
          >
            <Wallet size={14} />
            <span>{addedToAppleWallet ? 'Added to Wallet' : 'Add to Wallet'}</span>
          </button>
        </div>

        {showQrModal && (
          <div className="pass-qr-drawer">
            <div className="qr-code-box">
              {/* Crisp SVG QR pattern */}
              <svg width="110" height="110" viewBox="0 0 100 100" fill="#14110F">
                <rect width="100" height="100" rx="8" fill="#FFFDF9" />
                <rect x="10" y="10" width="24" height="24" stroke="#14110F" strokeWidth="5" fill="none" />
                <rect x="17" y="17" width="10" height="10" fill="#14110F" />
                <rect x="66" y="10" width="24" height="24" stroke="#14110F" strokeWidth="5" fill="none" />
                <rect x="73" y="17" width="10" height="10" fill="#14110F" />
                <rect x="10" y="66" width="24" height="24" stroke="#14110F" strokeWidth="5" fill="none" />
                <rect x="17" y="73" width="10" height="10" fill="#14110F" />
                <rect x="44" y="14" width="12" height="12" fill="#14110F" />
                <rect x="44" y="36" width="16" height="16" fill="#D97736" rx="3" />
                <rect x="16" y="44" width="18" height="8" fill="#14110F" />
                <rect x="66" y="46" width="20" height="10" fill="#14110F" />
                <rect x="44" y="64" width="12" height="24" fill="#14110F" />
                <rect x="64" y="68" width="24" height="18" fill="#14110F" />
              </svg>
            </div>
            <div className="qr-meta">
              <strong>ID: TTDI-8841-KL</strong>
              <span>Scan at La Marzocco counter for instant stamps & stored credit payment</span>
            </div>
          </div>
        )}
      </div>

      {/* 8-Cup Kopi & Sourdough Stamp Card */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>8-Cup Shophouse Stamp Card</h2>
          <button
            type="button"
            className="demo-stamp-btn"
            onClick={() => {
              haptics.applePaySuccess();
              onAddStampDemo();
            }}
          >
            <Stamp size={12} /> +1 NFC Stamp (Demo)
          </button>
        </div>

        <div className="stamp-grid-card">
          <div className="stamps-8-grid">
            {Array.from({ length: 8 }).map((_, idx) => {
              const filled = idx < stamps;
              const isEighth = idx === 7;
              return (
                <div
                  key={idx}
                  className={`stamp-circle ${filled ? 'stamp-filled' : ''} ${
                    isEighth ? 'stamp-reward-slot' : ''
                  }`}
                >
                  {filled ? (
                    <CheckCircle2 size={20} />
                  ) : isEighth ? (
                    <Award size={18} />
                  ) : (
                    <span>#{idx + 1}</span>
                  )}
                  <small>{isEighth ? 'FREE CUP' : 'KOPI'}</small>
                </div>
              );
            })}
          </div>
          <p className="stamp-card-caption">
            {stamps >= 8
              ? '🎉 Card complete! Redeem a Free Signature Drink below.'
              : `${8 - (stamps % 8)} more stamps until your next complimentary Kajai Dirty or V60 pour-over.`}
          </p>
        </div>
      </div>

      {/* Redeemable Vouchers */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>Redeem Stamps for Rewards</h2>
          <span className="stage-counter-pill">{stamps} Stamps Available</span>
        </div>

        <div className="rewards-list">
          {REWARD_VOUCHERS.map((v) => {
            const canAfford = stamps >= v.stampsCost;
            const isSelected = activeVoucher?.id === v.id;
            return (
              <div
                key={v.id}
                className={`reward-row-card ${isSelected ? 'reward-active' : ''}`}
              >
                <div className="reward-info">
                  <div className="reward-cost-tag">
                    <Sparkles size={11} /> {v.stampsCost} Stamps · Save RM {v.discountRm}
                  </div>
                  <h4>{v.title}</h4>
                  <p>{v.subtitle}</p>
                </div>
                <button
                  type="button"
                  className={`reward-apply-btn ${isSelected ? 'applied' : ''}`}
                  disabled={!canAfford && !isSelected}
                  onClick={() => {
                    haptics.impactMedium();
                    onApplyVoucherToBag(v);
                  }}
                >
                  {isSelected ? 'Applied' : canAfford ? 'Use in Bag' : `Need ${v.stampsCost}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instant Lorong Credit Top-Up */}
      <div className="section-block">
        <div className="section-header-row">
          <h2>Reload Lorong Pass Credit</h2>
          <span className="stage-counter-pill">Instant Bonus RM</span>
        </div>

        <div className="topup-grid">
          {[
            { amt: 30, bonus: 2 },
            { amt: 50, bonus: 5 },
            { amt: 100, bonus: 12 },
          ].map((pack) => (
            <button
              key={pack.amt}
              type="button"
              className="topup-card-btn"
              onClick={() => {
                haptics.applePaySuccess();
                onTopUpWallet(pack.amt, pack.bonus);
              }}
            >
              <PlusCircle size={15} className="text-amber" />
              <div className="topup-amt">RM {pack.amt}</div>
              <div className="topup-bonus">+RM {pack.bonus} Free</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
