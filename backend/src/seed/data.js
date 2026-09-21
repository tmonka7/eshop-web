'use strict';

/** Categories mirror the storefront sidebar in the design. */
const categories = [
  { name: 'Electronics', icon: 'cpu', order: 1, description: 'Phones, laptops, audio and more', color: ['#EF4444', '#F97316'] },
  { name: 'Fashion', icon: 'shirt', order: 2, description: 'Clothing, shoes and accessories', color: ['#EC4899', '#F43F5E'] },
  { name: 'Home & Living', icon: 'home', order: 3, description: 'Furniture, decor and kitchen', color: ['#10B981', '#059669'] },
  { name: 'Beauty & Health', icon: 'sparkles', order: 4, description: 'Skincare, wellness and personal care', color: ['#8B5CF6', '#6366F1'] },
  { name: 'Sports & Outdoors', icon: 'dumbbell', order: 5, description: 'Fitness gear and outdoor equipment', color: ['#F59E0B', '#EF4444'] },
  { name: 'Toys & Games', icon: 'gamepad', order: 6, description: 'Toys, board games and consoles', color: ['#06B6D4', '#3B82F6'] },
  { name: 'Groceries', icon: 'shopping-basket', order: 7, description: 'Fresh and healthy organic food', color: ['#22C55E', '#84CC16'] },
  { name: 'Books', icon: 'book', order: 8, description: 'Fiction, non-fiction and textbooks', color: ['#0EA5E9', '#6366F1'] },
  { name: 'Automotive', icon: 'car', order: 9, description: 'Car care, parts and accessories', color: ['#64748B', '#334155'] },
];

const subCategories = [
  { name: 'Headphones', parent: 'Electronics' },
  { name: 'Laptops', parent: 'Electronics' },
  { name: 'Smartphones', parent: 'Electronics' },
  { name: 'Cameras', parent: 'Electronics' },
  { name: 'Wearables', parent: 'Electronics' },
  { name: 'Footwear', parent: 'Fashion' },
  { name: 'Bags', parent: 'Fashion' },
];

/**
 * Product catalogue. Prices and names follow the mockups so the seeded store
 * looks exactly like the design on first run.
 */
const products = [
  {
    name: 'Wireless Headphones Pro',
    category: 'Headphones',
    brand: 'AuraSound',
    price: 199,
    comparePrice: 249,
    cost: 120,
    stock: 120,
    rating: 4.8,
    soldCount: 486,
    isFeatured: true,
    freeShipping: true,
    colors: ['Black', 'Red', 'White'],
    tags: ['audio', 'wireless', 'noise-cancelling', 'best-seller'],
    shortDescription: 'Premium sound quality with active noise cancellation. Perfect for music, gaming and calls.',
    description:
      'Wireless Headphones Pro deliver studio-grade audio with adaptive active noise cancellation. '
      + 'Forty hours of battery life, multipoint Bluetooth 5.3 pairing and memory-foam ear cushions make '
      + 'them equally at home on a long flight or a long work day. Fast charge gives you 5 hours of '
      + 'playback from a 10 minute top-up.',
    gradient: ['#EF4444', '#B91C1C'],
    variants: [
      { name: 'Color', value: 'Black', hex: '#111827', stock: 60 },
      { name: 'Color', value: 'Red', hex: '#EF4444', stock: 40 },
      { name: 'Color', value: 'White', hex: '#F3F4F6', stock: 20 },
    ],
  },
  {
    name: 'Smart Watch Series 7',
    category: 'Wearables',
    brand: 'AuraFit',
    price: 149,
    comparePrice: 189,
    cost: 88,
    stock: 85,
    rating: 4.6,
    soldCount: 372,
    isFeatured: true,
    colors: ['Black', 'Silver'],
    tags: ['wearable', 'fitness', 'best-seller'],
    shortDescription: 'Health tracking, GPS and a 7-day battery in an always-on AMOLED display.',
    description:
      'Track heart rate, blood oxygen, sleep stages and over 100 workout modes. The 1.9" always-on '
      + 'AMOLED panel stays readable in direct sunlight, and 5ATM water resistance means you can swim '
      + 'with it on.',
    gradient: ['#1F2937', '#4B5563'],
    variants: [
      { name: 'Color', value: 'Black', hex: '#111827', stock: 50 },
      { name: 'Color', value: 'Silver', hex: '#D1D5DB', stock: 35 },
    ],
  },
  {
    name: 'Laptop Pro 15"',
    category: 'Laptops',
    brand: 'AuraTech',
    price: 1299,
    comparePrice: 1499,
    cost: 980,
    stock: 45,
    rating: 4.9,
    soldCount: 158,
    isFeatured: true,
    freeShipping: true,
    colors: ['Space Grey', 'Silver'],
    tags: ['laptop', 'work', 'premium'],
    shortDescription: '15" Retina display, 16GB RAM and a 1TB SSD in a 1.6kg aluminium body.',
    description:
      'A 15-inch workstation built for developers and creators. 16GB of unified memory, a 1TB NVMe SSD '
      + 'and an 8-core CPU handle builds, renders and a hundred browser tabs without the fans spinning up. '
      + 'Up to 18 hours of real-world battery life.',
    gradient: ['#334155', '#0F172A'],
  },
  {
    name: 'Smartphone Galaxy X',
    category: 'Smartphones',
    brand: 'Galaxy',
    price: 899,
    comparePrice: 999,
    cost: 610,
    stock: 64,
    rating: 4.5,
    soldCount: 293,
    isFeatured: true,
    colors: ['Black', 'Blue', 'Green'],
    tags: ['phone', 'mobile', '5g'],
    shortDescription: '6.7" 120Hz AMOLED, triple 50MP camera system and all-day 5000mAh battery.',
    description:
      'A flagship 5G phone with a 6.7-inch 120Hz AMOLED display, a triple 50MP camera array with optical '
      + 'stabilisation, and 45W fast charging that refills half the battery in 20 minutes.',
    gradient: ['#3B82F6', '#1E40AF'],
    variants: [
      { name: 'Color', value: 'Black', hex: '#111827', stock: 30 },
      { name: 'Color', value: 'Blue', hex: '#2563EB', stock: 20 },
      { name: 'Color', value: 'Green', hex: '#059669', stock: 14 },
    ],
  },
  {
    name: 'Camera DSLR 4K',
    category: 'Cameras',
    brand: 'Lensa',
    price: 649,
    comparePrice: 749,
    cost: 470,
    stock: 30,
    rating: 4.7,
    soldCount: 122,
    colors: ['Black'],
    tags: ['camera', 'photography', '4k'],
    shortDescription: '24MP APS-C sensor, 4K60 video and dual-pixel autofocus with a kit lens included.',
    description:
      'A 24.2MP APS-C sensor paired with dual-pixel phase-detect autofocus, 4K60 internal recording and '
      + 'a fully articulating touchscreen. Ships with an 18-55mm stabilised kit lens.',
    gradient: ['#111827', '#374151'],
  },
  {
    name: 'Gaming Console Ultra',
    category: 'Toys & Games',
    brand: 'PlayCore',
    price: 499,
    comparePrice: 549,
    cost: 390,
    stock: 8,
    rating: 4.8,
    soldCount: 210,
    isFeatured: true,
    colors: ['White', 'Black'],
    tags: ['gaming', 'console', 'best-seller'],
    shortDescription: '4K 120fps gaming, 1TB SSD and a haptic controller in the box.',
    description:
      'Next-generation console with a custom 8-core CPU, ray-traced 4K graphics at up to 120fps, and a '
      + '1TB NVMe SSD that loads open worlds in seconds. Includes one haptic-feedback controller.',
    gradient: ['#6366F1', '#4338CA'],
  },
  {
    name: 'Running Shoes Flex',
    category: 'Footwear',
    brand: 'Strider',
    price: 89,
    comparePrice: 129,
    cost: 42,
    stock: 200,
    rating: 4.4,
    soldCount: 540,
    isFeatured: true,
    colors: ['Green', 'Black', 'Blue'],
    tags: ['shoes', 'running', 'sports', 'best-seller'],
    shortDescription: 'Lightweight foam midsole with a breathable knit upper for daily miles.',
    description:
      'A responsive daily trainer weighing just 238g. The compression-moulded foam midsole returns energy '
      + 'on every stride while the engineered knit upper keeps your foot cool over long distances.',
    gradient: ['#22C55E', '#15803D'],
    variants: [
      { name: 'Size', value: '40', stock: 60 },
      { name: 'Size', value: '42', stock: 80 },
      { name: 'Size', value: '44', stock: 60 },
    ],
  },
  {
    name: 'Everyday Backpack 24L',
    category: 'Bags',
    brand: 'Nomad',
    price: 59,
    comparePrice: 79,
    cost: 24,
    stock: 150,
    rating: 4.3,
    soldCount: 318,
    colors: ['Black', 'Grey'],
    tags: ['bag', 'travel', 'commute'],
    shortDescription: 'Water-resistant 24L pack with a padded 16" laptop sleeve.',
    description:
      'A 24-litre commuter pack in water-resistant recycled polyester, with a fleece-lined 16-inch laptop '
      + 'sleeve, a hidden back pocket for valuables and luggage pass-through straps.',
    gradient: ['#374151', '#111827'],
  },
  {
    name: 'Classic Cotton T-Shirt',
    category: 'Fashion',
    brand: 'AuraBasics',
    price: 29,
    comparePrice: 39,
    cost: 9,
    stock: 300,
    rating: 4.2,
    soldCount: 612,
    colors: ['White', 'Black', 'Red', 'Blue'],
    tags: ['clothing', 'basics'],
    shortDescription: '180gsm organic cotton tee with a relaxed fit that keeps its shape.',
    description:
      'Cut from 180gsm certified organic cotton with a pre-shrunk relaxed fit and twin-needle hems that '
      + 'survive the wash. Available in four year-round colours.',
    gradient: ['#F43F5E', '#BE123C'],
    variants: [
      { name: 'Size', value: 'S', stock: 70 },
      { name: 'Size', value: 'M', stock: 110 },
      { name: 'Size', value: 'L', stock: 90 },
      { name: 'Size', value: 'XL', stock: 30 },
    ],
  },
  {
    name: 'Organic Fruit Box',
    category: 'Groceries',
    brand: 'FreshFarm',
    price: 34,
    comparePrice: 45,
    cost: 18,
    stock: 60,
    rating: 4.6,
    soldCount: 275,
    isFeatured: true,
    tags: ['organic', 'fresh', 'food'],
    shortDescription: 'A weekly box of seasonal organic fruit, picked and delivered within 24 hours.',
    description:
      'Seven to nine varieties of certified-organic seasonal fruit, harvested to order from partner farms '
      + 'and delivered within 24 hours of picking. Box contents rotate with the season.',
    gradient: ['#22C55E', '#65A30D'],
  },
  {
    name: 'Espresso Machine Barista',
    category: 'Home & Living',
    brand: 'BrewLab',
    price: 279,
    comparePrice: 349,
    cost: 165,
    stock: 40,
    rating: 4.5,
    soldCount: 143,
    tags: ['kitchen', 'coffee'],
    shortDescription: '15-bar pump, built-in grinder and a steam wand for proper microfoam.',
    description:
      'A 15-bar pump espresso machine with a conical burr grinder, PID temperature control and a '
      + 'commercial-style steam wand. Pulls a balanced double shot in 28 seconds from cold start.',
    gradient: ['#B45309', '#78350F'],
  },
  {
    name: 'Vitamin C Serum',
    category: 'Beauty & Health',
    brand: 'GlowLab',
    price: 39,
    comparePrice: 52,
    cost: 12,
    stock: 4,
    rating: 4.7,
    soldCount: 401,
    tags: ['skincare', 'beauty'],
    shortDescription: '15% stabilised vitamin C with hyaluronic acid for brighter, even-toned skin.',
    description:
      'A lightweight 15% L-ascorbic acid serum buffered with ferulic acid and hyaluronic acid. Absorbs in '
      + 'seconds, layers under sunscreen, and visibly evens skin tone over four weeks of daily use.',
    gradient: ['#F59E0B', '#EA580C'],
  },
  {
    name: 'Yoga Mat Pro',
    category: 'Sports & Outdoors',
    brand: 'ZenFlow',
    price: 45,
    comparePrice: 60,
    cost: 18,
    stock: 110,
    rating: 4.4,
    soldCount: 226,
    colors: ['Purple', 'Green', 'Grey'],
    tags: ['fitness', 'yoga'],
    shortDescription: '6mm non-slip TPE mat with alignment markings and a carry strap.',
    description:
      'A 6mm closed-cell TPE mat that cushions joints without sinking underfoot. Laser-etched alignment '
      + 'lines help with posture, and the textured surface keeps its grip through hot yoga.',
    gradient: ['#8B5CF6', '#5B21B6'],
  },
  {
    name: 'Mechanical Keyboard TKL',
    category: 'Electronics',
    brand: 'AuraTech',
    price: 119,
    comparePrice: 149,
    cost: 62,
    stock: 75,
    rating: 4.6,
    soldCount: 189,
    colors: ['Black', 'White'],
    tags: ['keyboard', 'gaming', 'work'],
    shortDescription: 'Hot-swappable tenkeyless board with PBT keycaps and south-facing RGB.',
    description:
      'A tenkeyless mechanical keyboard with hot-swappable sockets, a gasket-mounted plate, doubleshot PBT '
      + 'keycaps and per-key south-facing RGB. Connects over USB-C, Bluetooth or 2.4GHz.',
    gradient: ['#0F172A', '#1E293B'],
  },
  {
    name: 'Bestseller Novel Collection',
    category: 'Books',
    brand: 'PagePress',
    price: 49,
    comparePrice: 72,
    cost: 22,
    stock: 90,
    rating: 4.8,
    soldCount: 167,
    tags: ['books', 'fiction', 'gift'],
    shortDescription: 'Six award-winning contemporary novels in a hardcover slipcase.',
    description:
      'Six critically acclaimed contemporary novels collected in a linen-bound hardcover slipcase, each '
      + 'with a new introduction from the author. A ready-made gift for a serious reader.',
    gradient: ['#0EA5E9', '#1D4ED8'],
  },
  {
    name: 'Car Dash Cam 4K',
    category: 'Automotive',
    brand: 'RoadEye',
    price: 129,
    comparePrice: 169,
    cost: 74,
    stock: 55,
    rating: 4.3,
    soldCount: 98,
    tags: ['car', 'safety', 'camera'],
    shortDescription: '4K front recording, 1080p rear channel and built-in GPS logging.',
    description:
      'Records 4K at the windscreen and 1080p behind you, with a 140-degree lens, GPS speed and location '
      + 'logging, and parking mode that wakes on impact.',
    gradient: ['#475569', '#1E293B'],
  },
];

const coupons = [
  {
    code: 'WELCOME10',
    description: '10% off your first order',
    discountType: 'percent',
    discountValue: 10,
    minPurchase: 50,
    maxDiscount: 100,
    usageLimit: 0,
  },
  {
    code: 'SAVE20',
    description: '$20 off orders over $150',
    discountType: 'fixed',
    discountValue: 20,
    minPurchase: 150,
    usageLimit: 500,
  },
  {
    code: 'MEGA50',
    description: 'Big sale: 50% off, capped at $150',
    discountType: 'percent',
    discountValue: 50,
    minPurchase: 200,
    maxDiscount: 150,
    usageLimit: 100,
  },
];

const banners = [
  {
    title: 'Discover Premium Products',
    subtitle: 'Top brands. Better prices. Faster delivery.',
    ctaText: 'Shop Now',
    ctaLink: '/products',
    placement: 'hero',
    order: 1,
    gradient: ['#EF4444', '#F97316'],
  },
  {
    title: 'Big Sale Up to 50% OFF',
    subtitle: 'Limited time offer on selected electronics',
    ctaText: 'Grab the deal',
    ctaLink: '/products?sort=price_asc',
    placement: 'mobile',
    order: 1,
    gradient: ['#F43F5E', '#EF4444'],
  },
  {
    title: 'Fresh & Healthy Organic Food',
    subtitle: 'Up to 30% off groceries this week',
    ctaText: 'Shop groceries',
    ctaLink: '/products?category=groceries',
    placement: 'promo',
    order: 2,
    gradient: ['#22C55E', '#84CC16'],
  },
];

const customers = [
  { name: 'John Doe', email: 'john@example.com', phone: '+358 40 111 2233', city: 'Helsinki' },
  { name: 'Sarah Wilson', email: 'sarah@example.com', phone: '+358 40 222 3344', city: 'Espoo' },
  { name: 'Mike Johnson', email: 'mike@example.com', phone: '+358 40 333 4455', city: 'Tampere' },
  { name: 'Emily Davis', email: 'emily@example.com', phone: '+358 40 444 5566', city: 'Vantaa' },
  { name: 'David Lee', email: 'david@example.com', phone: '+358 40 555 6677', city: 'Turku' },
  { name: 'Anna Kim', email: 'anna@example.com', phone: '+358 40 666 7788', city: 'Oulu' },
];

const reviewSnippets = [
  { rating: 5, title: 'Exactly what I hoped for', comment: 'Arrived two days early and the build quality is better than the photos suggest. Would buy again.' },
  { rating: 5, title: 'Worth every cent', comment: 'I was hesitant at this price point but it has replaced a product that cost twice as much.' },
  { rating: 4, title: 'Very good, one small niggle', comment: 'Does everything it promises. The packaging could be more protective, but the product itself is solid.' },
  { rating: 4, title: 'Happy with the purchase', comment: 'Been using it daily for three weeks with no complaints. Delivery was quick too.' },
  { rating: 3, title: 'Decent but not amazing', comment: 'It works fine and looks good. I expected a little more given the reviews, but no regrets.' },
  { rating: 5, title: 'Great gift', comment: 'Bought this for my partner and they love it. Presentation out of the box is lovely.' },
];

module.exports = {
  categories,
  subCategories,
  products,
  coupons,
  banners,
  customers,
  reviewSnippets,
};
