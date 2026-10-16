export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  brand: string | null;
  price: number;
  originalPrice: number;
  discountPct: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  inStock: boolean;
  flash: boolean;
}

export interface CategoryNode {
  id: string;
  name: string;
  nameBn: string | null;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  children: CategoryNode[];
}

export interface FlashItem {
  productId: string;
  slug: string;
  title: string;
  variantLabel: string | null;
  image: string | null;
  flashPrice: number;
  originalPrice: number;
  discountPct: number;
  soldQty: number;
  quantityLimit: number;
  soldOut: boolean;
}

export interface FlashSaleData {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
  items: FlashItem[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string;
}

export interface ListResponse {
  items: ProductCardData[];
  total: number;
  page: number;
  pages: number;
  facets: { brands: { slug: string; name: string; count: number }[]; priceRange: { min: number; max: number } };
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  division: string;
  district: string;
  area: string;
  line: string;
  label: string;
  isDefault: boolean;
}

export interface Locations {
  divisions: { name: string; nameBn: string; districts: { name: string; zone: string }[] }[];
  dhakaAreas: string[];
  zones: { zone: string; label: string; fee: number; days: string }[];
  freeShippingThreshold: number;
}
