export type MenuCategory =
  | 'all'
  | 'signature'
  | 'espresso'
  | 'filter'
  | 'bakehouse'
  | 'roastery';

export type FulfillmentMode = 'pickup' | 'curbside' | 'dine-in';

export interface TastingProfile {
  acidity: number; // 1-5
  body: number; // 1-5
  sweetness: number; // 1-5
  bitterness: number; // 1-5
  notes: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  malaySubtitle: string;
  category: Exclude<MenuCategory, 'all'>;
  price: number; // in RM
  calories: number;
  prepMinutes: number;
  caffeineMg: number;
  badge?: string;
  remainingBatch?: number;
  isNew?: boolean;
  isPopular?: boolean;
  description: string;
  originOrFlour: string;
  tastingProfile: TastingProfile;
  artworkType:
    | 'kajai-dirty'
    | 'asam-boi-tonic'
    | 'flat-white'
    | 'hojicha-pepper'
    | 'long-black'
    | 'cameron-v60'
    | 'pink-bourbon-v60'
    | 'kouign-amann'
    | 'cempedak-tart'
    | 'kaya-sourdough'
    | 'smoked-duck-bagel'
    | 'miso-scone'
    | 'beans-bukit-kiara'
    | 'beans-liberica'
    | 'drip-box';
  supportsTemp?: boolean;
  supportsMilk?: boolean;
  supportsBeanHopper?: boolean;
  supportsSweetness?: boolean;
  supportsGrind?: boolean;
  supportsWarming?: boolean;
}

export interface CartItemCustomization {
  temperature?: 'Iced' | 'Less Ice' | 'Hot (62°C)';
  beanHopper?: 'Bukit Kiara Blend' | 'Cameron Anaerobic (+RM3)' | 'Swiss Water Decaf (+RM2)';
  milk?: 'Full Cream Dairy' | 'Oatside Barista (+RM3)' | 'Hokkaido Milk (+RM3)' | 'Bonsoy (+RM3)';
  shotStrength?: 'Standard Double (18g)' | 'Ristretto Pull' | 'Triple Shot (+RM4)';
  sweetness?: '0% Unsweetened' | '50% TTDI Standard' | '100% Regular';
  grindSize?: 'Whole Bean' | 'Espresso Fine' | 'V60 Medium-Fine' | 'AeroPress' | 'Cold Brew Coarse';
  warming?: 'Torched Warm (65°C)' | 'Room Temp' | 'Extra Cultured Butter (+RM3)';
  specialNote?: string;
}

export interface CartItem {
  cartItemId: string;
  item: MenuItem;
  quantity: number;
  unitPrice: number;
  customization: CartItemCustomization;
}

export type OrderStage = 0 | 1 | 2 | 3 | 4;
// 0: Order Received
// 1: Grinding on Mythos MY75
// 2: Pulling 9.0 Bar Extraction / Oven Torch
// 3: Plating & QC at Bar
// 4: Ready for Pickup / Runner En Route

export interface ActiveOrder {
  orderNumber: string;
  placedAt: string;
  fulfillment: FulfillmentMode;
  stage: OrderStage;
  estimatedMinutesLeft: number;
  baristaName: string;
  machineGroup: string;
  carPlate?: string;
  carDescription?: string;
  curbsideHazardActive?: boolean;
  tableId?: string;
  items: {
    name: string;
    qty: number;
    summary: string;
    artworkType: MenuItem['artworkType'];
  }[];
  totalRm: number;
  paymentMethod: 'Apple Pay' | 'DuitNow QR' | 'Lorong Credit';
}

export interface ShophouseTable {
  id: string;
  label: string;
  zone: 'ground-bar' | 'upstairs-loft' | 'back-courtyard';
  seats: number;
  status: 'available' | 'occupied' | 'reserved-you';
  hasPowerOutlet: boolean;
  isPetFriendly: boolean;
  sunlightLevel: 'Shaded Bar' | 'Skylight Bright' | 'Dappled Courtyard';
  xPercent: number;
  yPercent: number;
}

export interface RewardVoucher {
  id: string;
  title: string;
  subtitle: string;
  stampsCost: number;
  discountRm: number;
  code: string;
}
