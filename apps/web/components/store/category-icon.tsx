import {
  BatteryCharging,
  BedDouble,
  CookingPot,
  Droplet,
  Dumbbell,
  Fan,
  Flower2,
  Footprints,
  Glasses,
  Headphones,
  Lamp,
  Laptop,
  LayoutGrid,
  LucideProps,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkle,
  Sparkles,
  Trophy,
  Watch,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  smartphone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  watch: Watch,
  'battery-charging': BatteryCharging,
  shirt: Shirt,
  sparkle: Sparkle,
  sparkles: Sparkles,
  footprints: Footprints,
  'shopping-bag': ShoppingBag,
  glasses: Glasses,
  sofa: Sofa,
  'cooking-pot': CookingPot,
  lamp: Lamp,
  'bed-double': BedDouble,
  fan: Fan,
  droplet: Droplet,
  'flower-2': Flower2,
  dumbbell: Dumbbell,
  trophy: Trophy,
};

export function CategoryIcon({ icon, ...props }: { icon: string | null } & Omit<LucideProps, "name">) {
  const Icon = (icon && ICONS[icon]) || LayoutGrid;
  return <Icon {...props} />;
}
