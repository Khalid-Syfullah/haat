import type { ArtKind } from './seed-art';

export interface CategorySeed {
  slug: string;
  name: string;
  nameBn: string;
  icon: string;
  art?: { kind: ArtKind; body: string; accent: string; bg: string };
  children?: CategorySeed[];
}

export const CATEGORIES: CategorySeed[] = [
  {
    slug: 'electronics', name: 'Electronics', nameBn: 'ইলেকট্রনিক্স', icon: 'smartphone',
    children: [
      { slug: 'mobiles', name: 'Mobiles', nameBn: 'মোবাইল', icon: 'smartphone', art: { kind: 'phone', body: '#2b3040', accent: '#4f8cff', bg: '#dfe8ff' } },
      { slug: 'laptops', name: 'Laptops', nameBn: 'ল্যাপটপ', icon: 'laptop', art: { kind: 'laptop', body: '#9aa3b2', accent: '#22c3a6', bg: '#dff5ef' } },
      { slug: 'audio', name: 'Audio', nameBn: 'অডিও', icon: 'headphones', art: { kind: 'headphones', body: '#2b3040', accent: '#ff7a45', bg: '#ffe6d9' } },
      { slug: 'smart-watches', name: 'Smart Watches', nameBn: 'স্মার্ট ওয়াচ', icon: 'watch', art: { kind: 'watch', body: '#e35d8f', accent: '#7c5cff', bg: '#fde3ee' } },
      { slug: 'power-accessories', name: 'Power & Accessories', nameBn: 'পাওয়ার ও এক্সেসরিজ', icon: 'battery-charging', art: { kind: 'powerbank', body: '#2b3040', accent: '#3ddc84', bg: '#e2f7ea' } },
    ],
  },
  {
    slug: 'fashion', name: 'Fashion', nameBn: 'ফ্যাশন', icon: 'shirt',
    children: [
      { slug: 'mens-clothing', name: "Men's Clothing", nameBn: 'ছেলেদের পোশাক', icon: 'shirt', art: { kind: 'panjabi', body: '#f3ead8', accent: '#b8862b', bg: '#f6efe2' } },
      { slug: 'womens-clothing', name: "Women's Clothing", nameBn: 'মেয়েদের পোশাক', icon: 'sparkle', art: { kind: 'kurti', body: '#1f8a8a', accent: '#f2c14e', bg: '#dcf2f0' } },
      { slug: 'shoes', name: 'Shoes', nameBn: 'জুতা', icon: 'footprints', art: { kind: 'sneaker', body: '#f5f5f5', accent: '#ff5a36', bg: '#ffe9e2' } },
      { slug: 'bags', name: 'Bags', nameBn: 'ব্যাগ', icon: 'shopping-bag', art: { kind: 'backpack', body: '#556070', accent: '#ffb020', bg: '#e8ecf2' } },
      { slug: 'eyewear', name: 'Eyewear', nameBn: 'চশমা', icon: 'glasses', art: { kind: 'sunglasses', body: '#2b3040', accent: '#3b6fd8', bg: '#e3ebfb' } },
    ],
  },
  {
    slug: 'home-living', name: 'Home & Living', nameBn: 'ঘর ও গৃহস্থালি', icon: 'sofa',
    children: [
      { slug: 'kitchen', name: 'Kitchen Appliances', nameBn: 'রান্নাঘর', icon: 'cooking-pot', art: { kind: 'kettle', body: '#2b3040', accent: '#ff5a5a', bg: '#f0f1f4' } },
      { slug: 'lighting', name: 'Lighting', nameBn: 'আলো ও বাতি', icon: 'lamp', art: { kind: 'lamp', body: '#f2f2f2', accent: '#ffd23f', bg: '#fff5d6' } },
      { slug: 'bedding', name: 'Bedding', nameBn: 'বিছানাপত্র', icon: 'bed-double', art: { kind: 'bedsheet', body: '#5b8def', accent: '#ffd166', bg: '#e6eefc' } },
      { slug: 'fans-cooling', name: 'Fans & Cooling', nameBn: 'ফ্যান', icon: 'fan', art: { kind: 'fan', body: '#e9edf2', accent: '#38b6ff', bg: '#e1f3ff' } },
    ],
  },
  {
    slug: 'health-beauty', name: 'Health & Beauty', nameBn: 'স্বাস্থ্য ও সৌন্দর্য', icon: 'sparkles',
    children: [
      { slug: 'skincare', name: 'Skincare', nameBn: 'ত্বকের যত্ন', icon: 'droplet', art: { kind: 'serum', body: '#f7a541', accent: '#e8590c', bg: '#fff0dc' } },
      { slug: 'fragrance', name: 'Fragrance', nameBn: 'সুগন্ধি', icon: 'flower-2', art: { kind: 'attar', body: '#7b2d8e', accent: '#d4af37', bg: '#f3e6f6' } },
    ],
  },
  {
    slug: 'sports-outdoors', name: 'Sports & Outdoors', nameBn: 'খেলাধুলা', icon: 'dumbbell',
    children: [
      { slug: 'team-sports', name: 'Team Sports', nameBn: 'দলগত খেলা', icon: 'trophy', art: { kind: 'football', body: '#ffffff', accent: '#20a464', bg: '#e1f5e9' } },
      { slug: 'fitness', name: 'Fitness', nameBn: 'ফিটনেস', icon: 'dumbbell', art: { kind: 'yogamat', body: '#7c5cff', accent: '#ffffff', bg: '#ece7ff' } },
    ],
  },
];

export const BRANDS = ['Nimbus', 'Orbit', 'Sonora', 'Pulse', 'Volt', 'Bunon', 'Stride', 'Kheya', 'Nazar', 'Ranna', 'Alo', 'Shapla', 'Glow Lab', 'Khela'];

export interface ProductSeed {
  title: string;
  brand: string;
  category: string;
  kind: ArtKind;
  bg: string;
  accent: string;
  /** Colour variants, each gets its own image. */
  colors?: { name: string; hex: string }[];
  /** A second option (Storage, Size…). */
  option?: { name: string; values: string[] };
  /** [price, salePrice] by value of `option`, or a single pair. */
  price: [number, number | null] | Record<string, [number, number | null]>;
  highlights: string[];
  description: string;
  specs: [string, string][];
  keywords: string;
  warranty?: string;
  returnDays?: number;
  featured?: boolean;
  /** Units sold before this store's records began, for realistic sorting. */
  soldBase: number;
  weightGrams?: number;
}

const ELEC_WARRANTY = '1 year brand warranty';

export const PRODUCTS: ProductSeed[] = [
  // ───── Mobiles ─────
  {
    title: 'Nimbus X5 5G Smartphone', brand: 'Nimbus', category: 'mobiles', kind: 'phone', bg: '#dfe8ff', accent: '#4f8cff',
    colors: [{ name: 'Midnight Black', hex: '#2b3040' }, { name: 'Ocean Blue', hex: '#2f6fd6' }],
    option: { name: 'Storage', values: ['8GB / 128GB', '8GB / 256GB'] },
    price: { '8GB / 128GB': [32999, 29999], '8GB / 256GB': [35999, 32999] },
    highlights: ['6.7" 120Hz AMOLED display', '50MP OIS main camera', '5000mAh battery with 45W fast charging', 'Dual SIM 5G, eSIM support'],
    description: 'The Nimbus X5 brings flagship features to a sensible price. A bright 120Hz AMOLED screen, a 50MP stabilised camera that handles night shots well, and a battery that comfortably lasts a full day.\n\nShips with a 45W charger in the box and an official 1-year Nimbus warranty serviced across Bangladesh.',
    specs: [['Display', '6.7" AMOLED, 120Hz, 2400×1080'], ['Processor', 'Octa-core 2.6 GHz'], ['Rear camera', '50MP OIS + 8MP ultrawide'], ['Front camera', '16MP'], ['Battery', '5000mAh, 45W wired'], ['Network', '5G / 4G LTE, dual SIM'], ['OS', 'Android 16']],
    keywords: 'mobile phone smartphone 5g android মোবাইল ফোন mobail fon nimbus x5', warranty: ELEC_WARRANTY, featured: true, soldBase: 840, weightGrams: 450,
  },
  {
    title: 'Nimbus A3 Smartphone', brand: 'Nimbus', category: 'mobiles', kind: 'phone', bg: '#e2f6ee', accent: '#2dc58e',
    colors: [{ name: 'Graphite', hex: '#3a3f4c' }, { name: 'Mint', hex: '#7fd8b5' }],
    option: { name: 'Storage', values: ['4GB / 64GB', '6GB / 128GB'] },
    price: { '4GB / 64GB': [13499, 11999], '6GB / 128GB': [15999, 14499] },
    highlights: ['6.5" 90Hz display', '5000mAh battery', '50MP dual camera', 'Side fingerprint sensor'],
    description: 'An everyday phone that gets the basics right: a smooth 90Hz screen, a big battery and a camera that takes clear daylight photos. A great first smartphone or a reliable backup.',
    specs: [['Display', '6.5" IPS LCD, 90Hz'], ['Processor', 'Octa-core 2.0 GHz'], ['Rear camera', '50MP + 2MP depth'], ['Battery', '5000mAh, 18W'], ['Network', '4G LTE, dual SIM']],
    keywords: 'mobile phone budget smartphone মোবাইল ফোন mobail cheap phone', warranty: ELEC_WARRANTY, soldBase: 1260, weightGrams: 420,
  },
  {
    title: 'Nimbus Note 12 Pro', brand: 'Nimbus', category: 'mobiles', kind: 'phone', bg: '#efe6ff', accent: '#8b5cf6',
    colors: [{ name: 'Lunar Silver', hex: '#b9c0cc' }, { name: 'Royal Purple', hex: '#6d3fd6' }],
    option: { name: 'Storage', values: ['8GB / 256GB'] },
    price: [27999, 25499],
    highlights: ['200MP main camera', '6.67" curved AMOLED', '67W turbo charging', 'IP54 splash resistance'],
    description: 'The Note 12 Pro is built for photography, with a 200MP sensor and in-sensor zoom that keeps detail at 2x and 4x. A curved AMOLED panel and 67W charging round out a premium package.',
    specs: [['Display', '6.67" curved AMOLED, 120Hz'], ['Rear camera', '200MP + 8MP + 2MP'], ['Battery', '5100mAh, 67W'], ['Protection', 'IP54'], ['Storage', '256GB UFS 3.1']],
    keywords: 'mobile phone camera phone 200mp মোবাইল note pro', warranty: ELEC_WARRANTY, featured: true, soldBase: 410, weightGrams: 460,
  },
  {
    title: 'Nimbus Lite 2 Smartphone', brand: 'Nimbus', category: 'mobiles', kind: 'phone', bg: '#ffe9e0', accent: '#ff7a45',
    colors: [{ name: 'Black', hex: '#24272f' }, { name: 'Sky Blue', hex: '#69a7ff' }],
    option: { name: 'Storage', values: ['3GB / 32GB'] },
    price: [8999, 7999],
    highlights: ['6.1" HD+ display', '4000mAh battery', 'Face unlock', 'Expandable storage up to 256GB'],
    description: 'A compact, light phone for calls, WhatsApp, YouTube and bKash. Simple to use and easy on the wallet.',
    specs: [['Display', '6.1" HD+'], ['Battery', '4000mAh'], ['Memory', '3GB RAM, 32GB + microSD'], ['Network', '4G LTE']],
    keywords: 'mobile phone low price budget মোবাইল ফোন sosta phone', warranty: ELEC_WARRANTY, soldBase: 980, weightGrams: 380,
  },
  // ───── Laptops ─────
  {
    title: 'Orbit Book 14 Laptop', brand: 'Orbit', category: 'laptops', kind: 'laptop', bg: '#dff5ef', accent: '#22c3a6',
    colors: [{ name: 'Silver', hex: '#a9b1bd' }],
    option: { name: 'Configuration', values: ['Core i5 / 8GB / 512GB SSD', 'Core i7 / 16GB / 1TB SSD'] },
    price: { 'Core i5 / 8GB / 512GB SSD': [72000, 68500], 'Core i7 / 16GB / 1TB SSD': [94000, 89900] },
    highlights: ['14" Full HD IPS display', 'Backlit keyboard', 'Up to 10 hours battery', 'Weighs 1.4 kg'],
    description: 'A slim, light everyday laptop for students and office work. The Orbit Book 14 boots in seconds, runs office apps and browsers smoothly, and fits in any backpack.',
    specs: [['Display', '14" FHD IPS, anti-glare'], ['Processor', 'Intel Core i5 / i7, 13th gen'], ['Memory', '8GB / 16GB DDR5'], ['Storage', '512GB / 1TB NVMe SSD'], ['Weight', '1.4 kg'], ['Ports', '2× USB-C, 2× USB-A, HDMI']],
    keywords: 'laptop notebook computer ল্যাপটপ leptop student office', warranty: '2 years brand warranty', featured: true, soldBase: 230, weightGrams: 2200,
  },
  {
    title: 'Orbit Air 13 Ultrabook', brand: 'Orbit', category: 'laptops', kind: 'laptop', bg: '#e6ecff', accent: '#5b7cfa',
    colors: [{ name: 'Space Grey', hex: '#5f6673' }],
    option: { name: 'Configuration', values: ['Ryzen 5 / 16GB / 512GB SSD'] },
    price: [79990, null],
    highlights: ['13.3" 2.5K display', 'All-metal body, 1.1 kg', 'Fingerprint login', '65W USB-C fast charging'],
    description: 'The Orbit Air 13 is all about portability without compromise: a sharp 2.5K screen, an aluminium body under 1.2 kg and a battery that lasts a full workday.',
    specs: [['Display', '13.3" 2.5K IPS'], ['Processor', 'AMD Ryzen 5'], ['Memory', '16GB LPDDR5'], ['Storage', '512GB SSD'], ['Weight', '1.1 kg']],
    keywords: 'laptop ultrabook thin light ল্যাপটপ', warranty: '2 years brand warranty', soldBase: 120, weightGrams: 1800,
  },
  {
    title: 'Orbit Play 15 Gaming Laptop', brand: 'Orbit', category: 'laptops', kind: 'laptop', bg: '#ffe3e3', accent: '#ff3b5c',
    colors: [{ name: 'Shadow Black', hex: '#2a2d36' }],
    option: { name: 'Configuration', values: ['Core i7 / RTX 4060 / 16GB / 1TB'] },
    price: [124990, 118990],
    highlights: ['15.6" 165Hz display', 'RTX 4060 8GB graphics', 'RGB keyboard', 'Dual-fan cooling'],
    description: 'Built for gaming and creative work, with a 165Hz screen, dedicated RTX graphics and cooling that keeps performance steady during long sessions.',
    specs: [['Display', '15.6" FHD 165Hz'], ['Graphics', 'NVIDIA RTX 4060 8GB'], ['Processor', 'Intel Core i7'], ['Memory', '16GB DDR5'], ['Storage', '1TB NVMe SSD']],
    keywords: 'gaming laptop rtx ল্যাপটপ game', warranty: '2 years brand warranty', soldBase: 64, weightGrams: 3200,
  },
  // ───── Audio ─────
  {
    title: 'Sonora Wave ANC Wireless Headphones', brand: 'Sonora', category: 'audio', kind: 'headphones', bg: '#ffe6d9', accent: '#ff7a45',
    colors: [{ name: 'Black', hex: '#2b3040' }, { name: 'Cream', hex: '#e9dcc4' }],
    price: [6500, 4990],
    highlights: ['Active noise cancellation', '40-hour battery', 'Bluetooth 5.3 with multipoint', 'Foldable with travel case'],
    description: 'Shut out traffic noise on the bus or in the office. The Sonora Wave cancels low-frequency noise, sounds warm and detailed, and lasts all week on a charge.',
    specs: [['Driver', '40mm dynamic'], ['Battery', 'Up to 40 hours (ANC off)'], ['Charging', 'USB-C, 10 min = 5 hours'], ['Bluetooth', '5.3, multipoint']],
    keywords: 'headphone headphones হেডফোন hedphone wireless bluetooth anc noise cancelling', warranty: '6 months brand warranty', featured: true, soldBase: 690, weightGrams: 600,
  },
  {
    title: 'Sonora Buds Pro TWS Earbuds', brand: 'Sonora', category: 'audio', kind: 'earbuds', bg: '#e7ecf5', accent: '#4f8cff',
    colors: [{ name: 'White', hex: '#f4f5f7' }, { name: 'Black', hex: '#2b3040' }],
    price: [3200, 2450],
    highlights: ['Environmental noise cancellation for calls', '30 hours with case', 'IPX5 sweat resistant', 'Low-latency game mode'],
    description: 'True wireless earbuds with clear calls, punchy bass and a pocket-sized charging case. Touch controls and a game mode with low latency.',
    specs: [['Battery', '6 hours + 24 hours case'], ['Water resistance', 'IPX5'], ['Bluetooth', '5.3'], ['Charging', 'USB-C']],
    keywords: 'earbuds earphone tws ইয়ারবাডস airbuds buds wireless', warranty: '6 months brand warranty', soldBase: 1580, weightGrams: 200,
  },
  {
    title: 'Sonora Boom Mini Bluetooth Speaker', brand: 'Sonora', category: 'audio', kind: 'speaker', bg: '#dcf6f4', accent: '#ffb020',
    colors: [{ name: 'Teal', hex: '#1f9e96' }, { name: 'Black', hex: '#2b3040' }, { name: 'Red', hex: '#e04848' }],
    price: [2800, 2199],
    highlights: ['360° sound with deep bass', '12-hour playtime', 'IPX7 waterproof', 'Pair two for stereo'],
    description: 'A rugged little speaker for picnics, rooftops and the bathroom. Waterproof, drop-tested and loud enough to fill a room.',
    specs: [['Output', '10W'], ['Battery', '12 hours'], ['Water resistance', 'IPX7'], ['Bluetooth', '5.3']],
    keywords: 'speaker bluetooth speaker স্পিকার spikar portable', warranty: '6 months brand warranty', soldBase: 520, weightGrams: 500,
  },
  {
    title: 'Sonora Neckband Bass Wireless Earphones', brand: 'Sonora', category: 'audio', kind: 'neckband', bg: '#ece7ff', accent: '#7c5cff',
    colors: [{ name: 'Black', hex: '#2b3040' }, { name: 'Blue', hex: '#3b6fd8' }],
    price: [1500, 1090],
    highlights: ['20-hour playtime', 'Magnetic earbuds', 'Fast charge: 10 min = 8 hours', 'Clear calls with dual mic'],
    description: 'Comfortable neckband earphones for long commutes and calls. Magnetic buds snap together when not in use.',
    specs: [['Battery', '20 hours'], ['Charging', 'USB-C fast charge'], ['Bluetooth', '5.2']],
    keywords: 'neckband earphone হেডফোন bluetooth earphone', warranty: '6 months brand warranty', soldBase: 760, weightGrams: 150,
  },
  // ───── Smart watches ─────
  {
    title: 'Pulse Fit 3 Smart Watch', brand: 'Pulse', category: 'smart-watches', kind: 'watch', bg: '#fde3ee', accent: '#e35d8f',
    colors: [{ name: 'Black', hex: '#2b3040' }, { name: 'Pink', hex: '#ef8fb3' }],
    price: [4500, 3290],
    highlights: ['1.8" AMOLED display', 'Bluetooth calling', 'Heart rate and SpO2', '7-day battery'],
    description: 'Track steps, sleep and workouts, take calls from your wrist and see notifications at a glance. Works with Android and iPhone.',
    specs: [['Display', '1.8" AMOLED'], ['Battery', 'Up to 7 days'], ['Sensors', 'Heart rate, SpO2, accelerometer'], ['Water resistance', 'IP68']],
    keywords: 'smart watch smartwatch ঘড়ি ghori watch fitness band', warranty: '6 months brand warranty', featured: true, soldBase: 940, weightGrams: 250,
  },
  {
    title: 'Pulse Pro AMOLED Smart Watch', brand: 'Pulse', category: 'smart-watches', kind: 'watch', bg: '#e8ecf2', accent: '#22c3a6',
    colors: [{ name: 'Silver', hex: '#b9c0cc' }],
    price: [8990, 7490],
    highlights: ['1.43" round AMOLED', 'Built-in GPS', '14-day battery', 'Stainless steel case'],
    description: 'A premium round smartwatch with built-in GPS for runs and rides, an always-on AMOLED screen and two weeks of battery.',
    specs: [['Display', '1.43" AMOLED, always-on'], ['GPS', 'Built-in, dual band'], ['Battery', 'Up to 14 days'], ['Case', 'Stainless steel']],
    keywords: 'smart watch smartwatch gps ঘড়ি', warranty: ELEC_WARRANTY, soldBase: 210, weightGrams: 300,
  },
  // ───── Power & accessories ─────
  {
    title: 'Volt 20000mAh Power Bank 22.5W', brand: 'Volt', category: 'power-accessories', kind: 'powerbank', bg: '#e2f7ea', accent: '#3ddc84',
    colors: [{ name: 'Black', hex: '#2b3040' }, { name: 'White', hex: '#eef0f3' }],
    price: [2600, 1850],
    highlights: ['20000mAh, charges a phone 4–5 times', '22.5W fast charging', 'USB-C in/out + 2 USB-A', 'LED battery indicator'],
    description: 'Load-shedding ready. Keep your phone, earbuds and router running through outages with a power bank that fast-charges two devices at once.',
    specs: [['Capacity', '20000mAh'], ['Output', '22.5W max'], ['Ports', 'USB-C, 2× USB-A'], ['Recharge time', 'About 6 hours with 18W']],
    keywords: 'power bank powerbank পাওয়ার ব্যাংক charger load shedding', warranty: '6 months brand warranty', featured: true, soldBase: 1820, weightGrams: 500,
  },
  {
    title: 'Volt 65W GaN Fast Charger', brand: 'Volt', category: 'power-accessories', kind: 'charger', bg: '#e8ecf2', accent: '#ff7a45',
    colors: [{ name: 'White', hex: '#f4f5f7' }],
    price: [3200, 2490],
    highlights: ['Charges laptop, phone and tablet', '2× USB-C + USB-A', 'GaN: half the size of normal chargers', 'BD 2-pin plug'],
    description: 'One small charger for your laptop and phone. GaN technology keeps it cool and compact enough for any bag.',
    specs: [['Max output', '65W'], ['Ports', '2× USB-C, 1× USB-A'], ['Plug', 'Type C/D (BD)']],
    keywords: 'charger adapter fast charger চার্জার gan laptop charger', warranty: '1 year replacement warranty', soldBase: 340, weightGrams: 200,
  },
  {
    title: 'Volt Braided USB-C Cable 1m (Pack of 2)', brand: 'Volt', category: 'power-accessories', kind: 'cable', bg: '#fff2d9', accent: '#ffb020',
    colors: [{ name: 'Grey', hex: '#6b7280' }],
    price: [450, 299],
    highlights: ['60W fast charging', 'Nylon braided, 10,000+ bends', 'Data transfer 480 Mbps'],
    description: 'Tough braided cables that survive daily use. Two in a pack: one for home, one for the office.',
    specs: [['Length', '1 m'], ['Power', 'Up to 60W'], ['Connectors', 'USB-C to USB-C']],
    keywords: 'cable charger cable type c usb c ক্যাবল data cable', warranty: '3 months replacement', soldBase: 2400, weightGrams: 100,
  },
  // ───── Men's clothing ─────
  {
    title: 'Bunon Cotton Panjabi', brand: 'Bunon', category: 'mens-clothing', kind: 'panjabi', bg: '#f6efe2', accent: '#b8862b',
    colors: [{ name: 'Off-white', hex: '#f3ead8' }, { name: 'Maroon', hex: '#7a1f2b' }],
    option: { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    price: [2450, 1890],
    highlights: ['100% soft cotton', 'Hand-finished embroidery at the neck', 'Regular fit, side pockets', 'Perfect for Eid and Jummah'],
    description: 'A classic panjabi in breathable cotton with subtle embroidery around the neckline. Easy to wash, keeps its shape and looks right from Jummah to Eid gatherings.',
    specs: [['Fabric', '100% cotton'], ['Fit', 'Regular'], ['Length', '42–44 inches by size'], ['Care', 'Machine wash cold']],
    keywords: 'panjabi punjabi পাঞ্জাবি kurta eid men', returnDays: 14, featured: true, soldBase: 1340, weightGrams: 400,
  },
  {
    title: 'Bunon Classic Polo T-Shirt', brand: 'Bunon', category: 'mens-clothing', kind: 'polo', bg: '#e3e9f6', accent: '#f2c14e',
    colors: [{ name: 'Navy', hex: '#24345c' }, { name: 'White', hex: '#f4f5f7' }, { name: 'Bottle Green', hex: '#1e5a46' }],
    option: { name: 'Size', values: ['M', 'L', 'XL'] },
    price: [890, 690],
    highlights: ['Pique cotton, 220 GSM', 'Two-button placket', 'Ribbed collar that stays flat'],
    description: 'A smart, breathable polo for office casual or weekends. Pique cotton that holds its colour wash after wash.',
    specs: [['Fabric', 'Cotton pique, 220 GSM'], ['Fit', 'Regular'], ['Care', 'Machine wash']],
    keywords: 'polo t-shirt tshirt টি-শার্ট genji men shirt', returnDays: 14, soldBase: 2210, weightGrams: 250,
  },
  {
    title: 'Bunon Graphic Tee "Rickshaw Art"', brand: 'Bunon', category: 'mens-clothing', kind: 'tshirt', bg: '#ffe9e2', accent: '#ff5a36',
    colors: [{ name: 'Black', hex: '#24272f' }, { name: 'Mustard', hex: '#d8a228' }],
    option: { name: 'Size', values: ['M', 'L', 'XL'] },
    price: [650, 499],
    highlights: ['Rickshaw-art inspired print', 'Combed cotton, 180 GSM', 'Unisex fit'],
    description: "A tribute to Dhaka's rickshaw painters, printed on soft combed cotton. Unisex fit.",
    specs: [['Fabric', 'Combed cotton, 180 GSM'], ['Print', 'Screen print'], ['Fit', 'Unisex regular']],
    keywords: 'tshirt t-shirt tee টি-শার্ট graphic rickshaw dhaka', returnDays: 14, soldBase: 870, weightGrams: 220,
  },
  // ───── Women's clothing ─────
  {
    title: 'Bunon Printed Cotton Kurti', brand: 'Bunon', category: 'womens-clothing', kind: 'kurti', bg: '#dcf2f0', accent: '#f2c14e',
    colors: [{ name: 'Teal', hex: '#1f8a8a' }, { name: 'Mustard', hex: '#d8a228' }],
    option: { name: 'Size', values: ['S', 'M', 'L'] },
    price: [1850, 1390],
    highlights: ['Block-print inspired motifs', 'Soft breathable cotton', 'A-line cut, three-quarter sleeves'],
    description: 'An easy everyday kurti with block-print motifs. Pairs with jeans or salwar for university, office or dawat.',
    specs: [['Fabric', 'Cotton'], ['Length', '40 inches'], ['Sleeves', 'Three-quarter']],
    keywords: 'kurti কুর্তি women dress tops salwar', returnDays: 14, featured: true, soldBase: 1120, weightGrams: 300,
  },
  {
    title: 'Bunon Embroidered Three-Piece', brand: 'Bunon', category: 'womens-clothing', kind: 'kurti', bg: '#f6e3ea', accent: '#d4af37',
    colors: [{ name: 'Maroon', hex: '#7a1f2b' }, { name: 'Peach', hex: '#f2a487' }],
    option: { name: 'Size', values: ['M', 'L', 'XL'] },
    price: [3200, 2690],
    highlights: ['Kameez, salwar and dupatta', 'Thread embroidery on the yoke', 'Georgette dupatta'],
    description: 'A festive three-piece set with fine thread embroidery, a matching salwar and a light georgette dupatta.',
    specs: [['Kameez', 'Cotton blend, embroidered'], ['Salwar', 'Cotton'], ['Dupatta', 'Georgette']],
    keywords: 'three piece থ্রি পিস salwar kameez women eid dress', returnDays: 14, soldBase: 640, weightGrams: 600,
  },
  // ───── Shoes ─────
  {
    title: 'Stride Runner Sneakers', brand: 'Stride', category: 'shoes', kind: 'sneaker', bg: '#ffe9e2', accent: '#ff5a36',
    colors: [{ name: 'White', hex: '#f5f5f5' }, { name: 'Black', hex: '#2b2e36' }],
    option: { name: 'Size (EU)', values: ['40', '41', '42', '43', '44'] },
    price: [3500, 2790],
    highlights: ['Breathable knit upper', 'Cushioned EVA sole', 'Non-slip rubber grip'],
    description: 'Light, breathable sneakers for daily walks, the gym and everything in between.',
    specs: [['Upper', 'Knit mesh'], ['Sole', 'EVA + rubber'], ['Weight', '290 g per shoe']],
    keywords: 'sneakers shoes shoe keds জুতা juta running shoe', returnDays: 14, featured: true, soldBase: 980, weightGrams: 900,
  },
  {
    title: 'Stride Leather Loafers', brand: 'Stride', category: 'shoes', kind: 'loafer', bg: '#f3e8dc', accent: '#c8a165',
    colors: [{ name: 'Brown', hex: '#7a4a2a' }, { name: 'Black', hex: '#24272f' }],
    option: { name: 'Size (EU)', values: ['40', '41', '42', '43', '44'] },
    price: [4200, 3590],
    highlights: ['Genuine cow leather', 'Hand-stitched', 'Cushioned insole'],
    description: 'Smart leather loafers made by craftsmen in Dhaka, comfortable enough for a full workday.',
    specs: [['Upper', 'Genuine leather'], ['Sole', 'TPR'], ['Made in', 'Bangladesh']],
    keywords: 'loafer shoes leather shoe জুতা formal shoe', returnDays: 14, soldBase: 410, weightGrams: 1000,
  },
  {
    title: 'Stride Comfort Sandals', brand: 'Stride', category: 'shoes', kind: 'sandal', bg: '#e1f3ff', accent: '#38b6ff',
    colors: [{ name: 'Tan', hex: '#c08a52' }, { name: 'Black', hex: '#2b2e36' }],
    option: { name: 'Size (EU)', values: ['40', '41', '42', '43'] },
    price: [1450, 1190],
    highlights: ['Soft footbed', 'Adjustable strap', 'Water-friendly'],
    description: 'Comfortable everyday sandals that handle monsoon puddles.',
    specs: [['Upper', 'PU'], ['Sole', 'Rubber']],
    keywords: 'sandal sandals স্যান্ডেল chappal juta', returnDays: 14, soldBase: 760, weightGrams: 700,
  },
  // ───── Bags & eyewear ─────
  {
    title: 'Kheya Everyday Backpack 25L', brand: 'Kheya', category: 'bags', kind: 'backpack', bg: '#e8ecf2', accent: '#ffb020',
    colors: [{ name: 'Grey', hex: '#6b7484' }, { name: 'Black', hex: '#2b2e36' }],
    price: [2200, 1650],
    highlights: ['Padded 15.6" laptop sleeve', 'Water-repellent fabric', 'USB charging port', 'Hidden anti-theft pocket'],
    description: 'A tidy, water-repellent backpack for university and office, with a padded laptop sleeve and a pocket for your power bank.',
    specs: [['Capacity', '25 litres'], ['Laptop', 'Up to 15.6"'], ['Material', 'Polyester, water-repellent']],
    keywords: 'backpack bag ব্যাগ school bag laptop bag', returnDays: 14, featured: true, soldBase: 1030, weightGrams: 800,
  },
  {
    title: 'Kheya Leather Tote Bag', brand: 'Kheya', category: 'bags', kind: 'tote', bg: '#f3e8dc', accent: '#d4af37',
    colors: [{ name: 'Tan', hex: '#b07a45' }, { name: 'Black', hex: '#24272f' }],
    price: [3800, 2990],
    highlights: ['Genuine leather', 'Fits a 13" laptop', 'Zip inner pocket'],
    description: 'A roomy leather tote that carries a laptop, a lunch box and everything else, and still looks polished.',
    specs: [['Material', 'Genuine leather'], ['Size', '38 × 30 × 12 cm']],
    keywords: 'tote bag ladies bag handbag ব্যাগ leather bag', returnDays: 14, soldBase: 380, weightGrams: 900,
  },
  {
    title: 'Nazar Polarized Sunglasses', brand: 'Nazar', category: 'eyewear', kind: 'sunglasses', bg: '#e3ebfb', accent: '#3b6fd8',
    colors: [{ name: 'Black', hex: '#24272f' }, { name: 'Tortoise', hex: '#8a5a2b' }],
    price: [1800, 1250],
    highlights: ['Polarized UV400 lenses', 'Lightweight TR90 frame', 'Hard case and cloth included'],
    description: 'Cut glare on bright days and protect your eyes with polarized UV400 lenses in a light, flexible frame.',
    specs: [['Lens', 'Polarized, UV400'], ['Frame', 'TR90']],
    keywords: 'sunglasses sunglass চশমা choshma shades', returnDays: 7, soldBase: 520, weightGrams: 150,
  },
  // ───── Kitchen ─────
  {
    title: 'Ranna Electric Kettle 1.8L', brand: 'Ranna', category: 'kitchen', kind: 'kettle', bg: '#f0f1f4', accent: '#ff5a5a',
    colors: [{ name: 'Steel', hex: '#2b3040' }],
    price: [2200, 1690],
    highlights: ['Boils 1.8L in about 5 minutes', 'Auto shut-off and boil-dry protection', 'Stainless steel inner body'],
    description: 'Tea, coffee and noodles in minutes. A sturdy steel kettle with auto shut-off for peace of mind.',
    specs: [['Capacity', '1.8 L'], ['Power', '1500W'], ['Body', 'Stainless steel']],
    keywords: 'kettle electric kettle কেটলি ketli tea', warranty: '1 year brand warranty', featured: true, soldBase: 1460, weightGrams: 1200,
  },
  {
    title: 'Ranna 3-in-1 Blender 750W', brand: 'Ranna', category: 'kitchen', kind: 'blender', bg: '#fff0dc', accent: '#ff9f1c',
    colors: [{ name: 'Black', hex: '#2b3040' }],
    price: [5500, 4490],
    highlights: ['Blender, grinder and chopper jars', '750W copper motor', 'Grinds spices and masala finely'],
    description: 'From lassi to masala paste, the Ranna blender handles daily kitchen work with a powerful copper motor and three jars.',
    specs: [['Power', '750W'], ['Jars', '1.5L blender, 0.8L grinder, 0.4L chutney'], ['Speeds', '3 + pulse']],
    keywords: 'blender ব্লেন্ডার mixer grinder bilender juicer', warranty: '1 year brand warranty', soldBase: 690, weightGrams: 3500,
  },
  {
    title: 'Ranna Electric Rice Cooker 2.8L', brand: 'Ranna', category: 'kitchen', kind: 'ricecooker', bg: '#e6f4ea', accent: '#ff5a5a',
    colors: [{ name: 'White', hex: '#f1f2f4' }],
    price: [4200, 3450],
    highlights: ['Cooks rice for 6–8 people', 'Keep-warm mode', 'Non-stick inner pot', 'Steamer tray included'],
    description: 'Perfect rice every time, kept warm until dinner. Comes with a steamer tray for vegetables and pitha.',
    specs: [['Capacity', '2.8 L'], ['Power', '900W'], ['Pot', 'Non-stick aluminium']],
    keywords: 'rice cooker রাইস কুকার cooker bhat', warranty: '1 year brand warranty', soldBase: 540, weightGrams: 3000,
  },
  {
    title: 'Ranna Ceramic Mug Set (2 pcs)', brand: 'Ranna', category: 'kitchen', kind: 'mug', bg: '#fde3ee', accent: '#e35d8f',
    colors: [{ name: 'Rose', hex: '#e8a1b8' }, { name: 'Sage', hex: '#9fbf9f' }],
    price: [950, 750],
    highlights: ['350 ml each', 'Microwave and dishwasher safe', 'Matte glaze'],
    description: 'Two matte-glazed ceramic mugs for your morning cha and evening coffee.',
    specs: [['Capacity', '350 ml'], ['Material', 'Ceramic']],
    keywords: 'mug cup মগ coffee mug tea cup gift', returnDays: 7, soldBase: 310, weightGrams: 900,
  },
  // ───── Lighting, bedding, fans ─────
  {
    title: 'Alo Rechargeable LED Desk Lamp', brand: 'Alo', category: 'lighting', kind: 'lamp', bg: '#fff5d6', accent: '#ffd23f',
    colors: [{ name: 'White', hex: '#eef0f3' }, { name: 'Black', hex: '#2b3040' }],
    price: [1650, 1290],
    highlights: ['3 colour modes, stepless dimming', 'Up to 8 hours on battery', 'Flicker-free for study'],
    description: 'A study lamp that keeps working through load-shedding, with eye-friendly light and a flexible arm.',
    specs: [['Battery', '2400mAh'], ['Runtime', 'Up to 8 hours'], ['Charging', 'USB-C']],
    keywords: 'lamp desk lamp study lamp বাতি light bati লাইট rechargeable', warranty: '6 months brand warranty', soldBase: 880, weightGrams: 700,
  },
  {
    title: 'Alo Rechargeable Emergency Lantern', brand: 'Alo', category: 'lighting', kind: 'lantern', bg: '#e2f7ea', accent: '#20a464',
    colors: [{ name: 'Green', hex: '#20a464' }],
    price: [1200, 950],
    highlights: ['Up to 12 hours light', 'Built-in power bank', 'Hanging handle'],
    description: 'Bright, long-lasting light for load-shedding and camping, with a USB port to top up your phone.',
    specs: [['Battery', '4000mAh'], ['Runtime', 'Up to 12 hours']],
    keywords: 'emergency light lantern charger light বাতি load shedding', warranty: '6 months brand warranty', soldBase: 1190, weightGrams: 800,
  },
  {
    title: 'Shapla Cotton Bedsheet Set (King)', brand: 'Shapla', category: 'bedding', kind: 'bedsheet', bg: '#e6eefc', accent: '#ffd166',
    colors: [{ name: 'Blue Floral', hex: '#5b8def' }, { name: 'Green Check', hex: '#3fa36b' }],
    price: [2900, 2250],
    highlights: ['1 bedsheet + 2 pillow covers', '100% cotton, 180 thread count', 'Colourfast print'],
    description: 'Soft, cool cotton bedsheets woven in Bangladesh. The set includes two matching pillow covers.',
    specs: [['Size', 'King, 108 × 108 inches'], ['Fabric', '100% cotton'], ['Includes', '1 sheet, 2 pillow covers']],
    keywords: 'bedsheet bed sheet চাদর chador pillow cover bedding', returnDays: 7, soldBase: 720, weightGrams: 1400,
  },
  {
    title: 'Alo Rechargeable Table Fan 12"', brand: 'Alo', category: 'fans-cooling', kind: 'fan', bg: '#e1f3ff', accent: '#38b6ff',
    colors: [{ name: 'White', hex: '#e9edf2' }],
    price: [4800, 3990],
    highlights: ['Up to 10 hours on battery', '3 speeds + oscillation', 'Built-in LED light'],
    description: 'Stay cool when the power goes out. Runs for hours on battery and charges fully overnight.',
    specs: [['Blade', '12 inch'], ['Battery', '7800mAh'], ['Runtime', 'Up to 10 hours']],
    keywords: 'fan table fan rechargeable fan ফ্যান pakha পাখা charger fan', warranty: '1 year brand warranty', featured: true, soldBase: 1660, weightGrams: 3000,
  },
  // ───── Beauty ─────
  {
    title: 'Glow Lab Vitamin C Serum 30ml', brand: 'Glow Lab', category: 'skincare', kind: 'serum', bg: '#fff0dc', accent: '#e8590c',
    colors: [{ name: 'Standard', hex: '#f7a541' }],
    price: [1250, 990],
    highlights: ['10% vitamin C with hyaluronic acid', 'Brightens dull skin', 'Suits all skin types'],
    description: 'A lightweight daily serum that helps even skin tone and adds a healthy glow. Use in the morning before sunscreen.',
    specs: [['Volume', '30 ml'], ['Key ingredients', 'Vitamin C 10%, hyaluronic acid']],
    keywords: 'serum vitamin c সিরাম skincare face serum', returnDays: 0, soldBase: 1300, weightGrams: 100,
  },
  {
    title: 'Glow Lab Sunscreen SPF 50 PA++++', brand: 'Glow Lab', category: 'skincare', kind: 'sunscreen', bg: '#fff7d6', accent: '#f08c00',
    colors: [{ name: 'Standard', hex: '#ffffff' }],
    price: [950, 790],
    highlights: ['Broad-spectrum SPF 50', 'No white cast', 'Sweat resistant for humid weather'],
    description: 'A light gel sunscreen made for humid weather, with no white cast and no greasy feel.',
    specs: [['Volume', '50 ml'], ['Protection', 'SPF 50, PA++++']],
    keywords: 'sunscreen sunblock সানস্ক্রিন spf skincare', returnDays: 0, featured: true, soldBase: 1710, weightGrams: 100,
  },
  {
    title: 'Glow Lab Oud Attar 12ml', brand: 'Glow Lab', category: 'fragrance', kind: 'attar', bg: '#f3e6f6', accent: '#d4af37',
    colors: [{ name: 'Oud', hex: '#7b2d8e' }],
    price: [1100, 890],
    highlights: ['Alcohol-free', 'Long-lasting woody scent', 'Roll-on bottle'],
    description: 'A rich, alcohol-free oud attar with a warm woody scent that lasts through the day.',
    specs: [['Volume', '12 ml'], ['Type', 'Alcohol-free attar']],
    keywords: 'attar আতর perfume ator সুগন্ধি oud', returnDays: 0, soldBase: 650, weightGrams: 100,
  },
  // ───── Sports ─────
  {
    title: 'Khela Pro Football (Size 5)', brand: 'Khela', category: 'team-sports', kind: 'football', bg: '#e1f5e9', accent: '#20a464',
    colors: [{ name: 'White/Black', hex: '#ffffff' }],
    price: [1350, 1090],
    highlights: ['Match-grade PU cover', 'Machine-stitched 32 panels', 'Holds air for weeks'],
    description: 'A durable size-5 football for the para field and weekend matches.',
    specs: [['Size', '5'], ['Cover', 'PU'], ['Bladder', 'Butyl']],
    keywords: 'football ফুটবল ball soccer', returnDays: 7, soldBase: 420, weightGrams: 450,
  },
  {
    title: 'Khela Yoga Mat 6mm', brand: 'Khela', category: 'fitness', kind: 'yogamat', bg: '#ece7ff', accent: '#ffffff',
    colors: [{ name: 'Purple', hex: '#7c5cff' }, { name: 'Teal', hex: '#1f9e96' }],
    price: [1600, 1190],
    highlights: ['6mm cushioning', 'Non-slip texture both sides', 'Carry strap included'],
    description: 'A thick, non-slip mat for yoga, stretching and home workouts.',
    specs: [['Size', '183 × 61 cm'], ['Thickness', '6 mm'], ['Material', 'TPE']],
    keywords: 'yoga mat exercise mat ব্যায়াম fitness gym', returnDays: 7, soldBase: 460, weightGrams: 900,
  },
  {
    title: 'Khela Insulated Water Bottle 750ml', brand: 'Khela', category: 'fitness', kind: 'bottle', bg: '#e1f3ff', accent: '#ffb020',
    colors: [{ name: 'Black', hex: '#2b3040' }, { name: 'Blue', hex: '#3b6fd8' }],
    price: [1100, 850],
    highlights: ['Keeps cold 24h, hot 12h', 'Leak-proof lid', 'Stainless steel, BPA-free'],
    description: 'Cold water all day in the summer heat. A double-wall steel bottle that fits in most car cup holders.',
    specs: [['Capacity', '750 ml'], ['Material', '18/8 stainless steel']],
    keywords: 'water bottle bottle বোতল botol flask', returnDays: 7, soldBase: 990, weightGrams: 400,
  },
];

export const SYNONYMS: [string, string[]][] = [
  ['mobile', ['phone', 'smartphone', 'মোবাইল', 'ফোন', 'mobail', 'fon', 'cellphone']],
  ['laptop', ['ল্যাপটপ', 'notebook', 'leptop', 'computer']],
  ['headphone', ['headphones', 'হেডফোন', 'hedphone', 'headset']],
  ['earbuds', ['earphone', 'tws', 'ইয়ারবাডস', 'airbuds', 'buds', 'earphones']],
  ['speaker', ['স্পিকার', 'spikar']],
  ['watch', ['smartwatch', 'ঘড়ি', 'ghori']],
  ['powerbank', ['power bank', 'পাওয়ার ব্যাংক']],
  ['charger', ['চার্জার', 'adapter']],
  ['panjabi', ['punjabi', 'পাঞ্জাবি', 'kurta']],
  ['tshirt', ['t-shirt', 'tee', 'টি-শার্ট', 'genji']],
  ['kurti', ['কুর্তি', 'three piece', 'থ্রি পিস', 'salwar']],
  ['shoes', ['shoe', 'জুতা', 'juta', 'sneakers', 'keds']],
  ['bag', ['ব্যাগ', 'backpack', 'tote']],
  ['sunglasses', ['sunglass', 'চশমা', 'choshma', 'shades']],
  ['kettle', ['কেটলি', 'ketli']],
  ['blender', ['ব্লেন্ডার', 'mixer', 'grinder', 'bilender']],
  ['lamp', ['বাতি', 'light', 'bati', 'লাইট']],
  ['bedsheet', ['চাদর', 'chador', 'bed sheet']],
  ['fan', ['ফ্যান', 'pakha', 'পাখা']],
  ['serum', ['সিরাম']],
  ['sunscreen', ['সানস্ক্রিন', 'sunblock']],
  ['attar', ['আতর', 'perfume', 'ator', 'সুগন্ধি']],
  ['football', ['ফুটবল', 'ball']],
  ['bottle', ['বোতল', 'botol', 'flask']],
  ['mug', ['মগ', 'cup']],
];
