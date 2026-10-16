import React from 'react';
import { MenuItem } from '../types';

interface MenuArtworkProps {
  type: MenuItem['artworkType'];
  size?: 'sm' | 'md' | 'lg';
}

export const MenuArtwork: React.FC<MenuArtworkProps> = ({ type, size = 'md' }) => {
  const dim = size === 'sm' ? 54 : size === 'lg' ? 148 : 80;

  switch (type) {
    case 'kajai-dirty':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="kd-bg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B2314" />
              <stop offset="100%" stopColor="#1B120C" />
            </linearGradient>
            <linearGradient id="kd-glass" x1="60" y1="24" x2="60" y2="102" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4A2511" />
              <stop offset="32%" stopColor="#7C3F1C" />
              <stop offset="55%" stopColor="#D6B588" />
              <stop offset="86%" stopColor="#F5EFE6" />
              <stop offset="100%" stopColor="#8C4A19" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx="26" fill="url(#kd-bg)" />
          <circle cx="92" cy="28" r="24" fill="#D97736" fillOpacity="0.16" />
          {/* Chilled Fluted Glass */}
          <path
            d="M36 28H84L79 94C78.5 99 74.5 102 69.5 102H50.5C45.5 102 41.5 99 41 94L36 28Z"
            fill="url(#kd-glass)"
            stroke="#F4E4CE"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          {/* Espresso marbling waves */}
          <path
            d="M38 45C46 53 53 42 61 50C69 58 75 44 82 49"
            stroke="#3E1D0C"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M40 58C49 65 56 54 64 62C71 68 76 59 80 62"
            stroke="#6E3818"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
          {/* Gula Apong bottom swirl */}
          <path
            d="M42 92C50 88 70 89 78 92"
            stroke="#59290C"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Rim highlight */}
          <ellipse cx="60" cy="28" rx="24" ry="4.5" fill="#C68B59" stroke="#F8EFE2" strokeWidth="1.5" />
          {/* Frost droplets */}
          <circle cx="46" cy="74" r="1.6" fill="#FFFFFF" fillOpacity="0.65" />
          <circle cx="71" cy="69" r="1.4" fill="#FFFFFF" fillOpacity="0.65" />
          <circle cx="54" cy="82" r="1.3" fill="#FFFFFF" fillOpacity="0.5" />
        </svg>
      );

    case 'asam-boi-tonic':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#18221D" />
          <circle cx="90" cy="28" r="26" fill="#84CC16" fillOpacity="0.18" />
          {/* Highball glass */}
          <rect
            x="38"
            y="24"
            width="44"
            height="78"
            rx="8"
            fill="#E7C888"
            fillOpacity="0.22"
            stroke="#E5E7EB"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          {/* Layered Espresso Top */}
          <path d="M40 28H80V54C70 58 50 52 40 56V28Z" fill="#4E2612" />
          {/* Tonic amber layer */}
          <path d="M40 55C50 52 70 58 80 54V94C80 97 77 100 74 100H46C43 100 40 97 40 94V55Z" fill="#D99B38" fillOpacity="0.78" />
          {/* Calamansi wheel */}
          <circle cx="67" cy="44" r="10" fill="#A3E635" stroke="#365314" strokeWidth="2" />
          <circle cx="67" cy="44" r="6" fill="#D9F99D" />
          {/* Salted Asam Boi plum */}
          <circle cx="51" cy="78" r="6.5" fill="#9A3412" stroke="#FDE68A" strokeWidth="1.2" />
          {/* Effervescent bubbles */}
          <circle cx="58" cy="88" r="1.5" fill="#FEF9C3" />
          <circle cx="64" cy="74" r="1.8" fill="#FEF9C3" />
          <circle cx="54" cy="65" r="1.3" fill="#FEF9C3" />
          {/* Rosemary sprig */}
          <path d="M72 16L63 40" stroke="#84CC16" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'hojicha-pepper':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#231D18" />
          <circle cx="32" cy="30" r="24" fill="#A16207" fillOpacity="0.2" />
          {/* Ceramic Artisanal Tumbler */}
          <path
            d="M34 36H86L81 94C80.5 98.5 76.5 102 72 102H48C43.5 102 39.5 98.5 39 94L34 36Z"
            fill="#855836"
            stroke="#D6C2AD"
            strokeWidth="2"
          />
          <ellipse cx="60" cy="36" rx="26" ry="7" fill="#D6B99B" stroke="#785032" strokeWidth="1.8" />
          {/* Microfoam swirl + cracked Bario pepper specks */}
          <path d="M47 36C53 32 67 32 73 36C67 40 53 40 47 36Z" fill="#F5EBE0" />
          <circle cx="56" cy="35" r="1.2" fill="#292524" />
          <circle cx="63" cy="37" r="1.1" fill="#292524" />
          <circle cx="60" cy="34" r="0.9" fill="#78350F" />
          {/* Stoneware glaze dip */}
          <path d="M38 76C50 71 70 79 82 74L81 94C80.5 98.5 76.5 102 72 102H48C43.5 102 39.5 98.5 39 94L38 76Z" fill="#3F322A" />
        </svg>
      );

    case 'flat-white':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#261B14" />
          {/* ACME style TTDI cup & saucer */}
          <ellipse cx="58" cy="94" rx="36" ry="6" fill="#D6CFC7" />
          <path
            d="M30 44H86C86 71 75 88 58 88C41 88 30 71 30 44Z"
            fill="#E7E0D6"
          />
          <path
            d="M84 52H93C97 52 100 55 100 60C100 65 97 68 92 68H80"
            stroke="#E7E0D6"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Rich Crema & Rosetta Heart */}
          <ellipse cx="58" cy="44" rx="28" ry="9" fill="#9A5B32" stroke="#F5EFE6" strokeWidth="2" />
          <path
            d="M58 50C58 50 48 44 51 39C53 36 58 39 58 41C58 39 63 36 65 39C68 44 58 50 58 50Z"
            fill="#FBF7F0"
          />
        </svg>
      );

    case 'long-black':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#181310" />
          <rect x="36" y="28" width="48" height="68" rx="10" fill="#231711" stroke="#A88B73" strokeWidth="2" />
          {/* Tiger-striped crema */}
          <rect x="38" y="34" width="44" height="9" fill="#B46934" />
          <rect x="38" y="43" width="44" height="51" rx="6" fill="#1A0F0A" />
          {/* Crystal Ice cubes */}
          <rect x="45" y="48" width="13" height="13" rx="3" stroke="#E5E7EB" strokeOpacity="0.45" strokeWidth="1.5" />
          <rect x="61" y="54" width="13" height="13" rx="3" stroke="#E5E7EB" strokeOpacity="0.45" strokeWidth="1.5" />
        </svg>
      );

    case 'cameron-v60':
    case 'pink-bourbon-v60':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill={type === 'cameron-v60' ? '#1E1612' : '#24151B'} />
          <circle
            cx="88"
            cy="28"
            r="24"
            fill={type === 'cameron-v60' ? '#F59E0B' : '#EC4899'}
            fillOpacity="0.16"
          />
          {/* Glass Carafe Server */}
          <path
            d="M42 54H78L88 88C90 94 85 100 79 100H41C35 100 30 94 32 88L42 54Z"
            fill="#7C2D12"
            fillOpacity="0.45"
            stroke="#F3E8DD"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          {/* Ruby tea-like filter brew */}
          <path
            d="M36 74H84L88 88C90 94 85 100 79 100H41C35 100 30 94 32 88L36 74Z"
            fill={type === 'cameron-v60' ? '#9A3412' : '#BE185D'}
            fillOpacity="0.85"
          />
          {/* Origami / V60 Dripper on top */}
          <path
            d="M34 22H86L68 54H52L34 22Z"
            fill={type === 'cameron-v60' ? '#D97706' : '#F472B6'}
            stroke="#FEF3C7"
            strokeWidth="1.8"
          />
          {/* Rib lines */}
          <path d="M46 22L55 54M60 22V54M74 22L65 54" stroke="#FEF3C7" strokeOpacity="0.5" strokeWidth="1.4" />
        </svg>
      );

    case 'kouign-amann':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#261911" />
          {/* Laminated caramelized pastry crown */}
          <circle cx="60" cy="62" r="34" fill="#92400E" stroke="#F59E0B" strokeWidth="2" />
          <circle cx="60" cy="62" r="26" fill="#B45309" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="5 3" />
          <circle cx="60" cy="62" r="17" fill="#D97706" stroke="#FEF3C7" strokeWidth="1.5" />
          <circle cx="60" cy="62" r="8" fill="#78350F" />
          {/* Flaky sea salt crystals */}
          <rect x="55" y="56" width="3" height="3" fill="#FFFFFF" transform="rotate(15 55 56)" />
          <rect x="63" y="61" width="3" height="3" fill="#FFFFFF" transform="rotate(35 63 61)" />
          <rect x="57" y="65" width="2.5" height="2.5" fill="#FFFFFF" />
        </svg>
      );

    case 'cempedak-tart':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#251A10" />
          {/* Brioche fluted tart ring */}
          <circle cx="60" cy="62" r="35" fill="#B45309" stroke="#FBBF24" strokeWidth="2" />
          {/* Golden Cempedak custard center */}
          <circle cx="60" cy="62" r="25" fill="#F59E0B" />
          {/* Torched Basque burnt spots */}
          <ellipse cx="52" cy="56" rx="7" ry="4" fill="#451A03" fillOpacity="0.75" />
          <ellipse cx="69" cy="66" rx="6" ry="4.5" fill="#451A03" fillOpacity="0.8" />
          <circle cx="60" cy="52" r="3" fill="#78350F" />
        </svg>
      );

    case 'kaya-sourdough':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#1B2219" />
          {/* Country Sourdough Slice */}
          <path
            d="M26 52C26 36 42 28 60 28C78 28 94 36 94 52V84C94 90 89 94 83 94H37C31 94 26 90 26 84V52Z"
            fill="#C28E5C"
            stroke="#5C3A1D"
            strokeWidth="3.5"
          />
          {/* Pandan Kaya spread */}
          <path
            d="M34 54C34 43 46 37 60 37C74 37 86 43 86 54V80C86 84 82 86 78 86H42C38 86 34 84 34 80V54Z"
            fill="#65A30D"
          />
          {/* Cold French Butter Slab */}
          <rect
            x="45"
            y="50"
            width="30"
            height="22"
            rx="4"
            transform="rotate(-6 45 50)"
            fill="#FEF08A"
            stroke="#CA8A04"
            strokeWidth="1.5"
          />
        </svg>
      );

    case 'smoked-duck-bagel':
    case 'miso-scone':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#241815" />
          {/* Sesame Sourdough Bagel */}
          <circle cx="60" cy="62" r="34" fill="#B46934" stroke="#E7C89E" strokeWidth="2" />
          {/* Pickled Bunga Kantan & Smoked Duck ribbon */}
          <circle cx="60" cy="62" r="24" fill="#991B1B" stroke="#F472B6" strokeWidth="3" strokeDasharray="8 4" />
          {/* Bagel center hole with cream cheese */}
          <circle cx="60" cy="62" r="10" fill="#FEF3C7" />
          {/* Sesame seeds */}
          <circle cx="48" cy="38" r="1.5" fill="#FEF3C7" />
          <circle cx="68" cy="36" r="1.5" fill="#FEF3C7" />
          <circle cx="77" cy="46" r="1.5" fill="#1C1917" />
          <circle cx="42" cy="49" r="1.5" fill="#1C1917" />
        </svg>
      );

    case 'beans-bukit-kiara':
    case 'beans-liberica':
    case 'drip-box':
      return (
        <svg width={dim} height={dim} viewBox="0 0 120 120" fill="none">
          <rect width="120" height="120" rx="26" fill="#1A1614" />
          {/* Matte Roastery Bag */}
          <path
            d="M36 24H84L88 96C88 99 85 102 82 102H38C35 102 32 99 32 96L36 24Z"
            fill={type === 'beans-liberica' ? '#7C2D12' : '#E7DEC8'}
            stroke="#A89F91"
            strokeWidth="1.8"
          />
          {/* Degassing Valve */}
          <circle cx="60" cy="36" r="3.5" fill="#78716C" />
          {/* TTDI Architectural Label */}
          <rect
            x="41"
            y="46"
            width="38"
            height="42"
            rx="4"
            fill={type === 'beans-liberica' ? '#FEF3C7' : '#1C1917'}
          />
          <rect
            x="46"
            y="53"
            width="28"
            height="5"
            rx="2"
            fill={type === 'beans-liberica' ? '#9A3412' : '#D97736'}
          />
          <rect
            x="46"
            y="63"
            width="20"
            height="3"
            rx="1.5"
            fill={type === 'beans-liberica' ? '#451A03' : '#E7E5E4'}
          />
          <rect
            x="46"
            y="70"
            width="24"
            height="3"
            rx="1.5"
            fill={type === 'beans-liberica' ? '#78350F' : '#A8A29E'}
          />
        </svg>
      );
  }
};
