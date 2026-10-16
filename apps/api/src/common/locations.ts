import { DeliveryZone } from '@prisma/client';

export interface Division {
  name: string;
  nameBn: string;
  districts: string[];
}

/** 8 divisions, 64 districts. */
export const DIVISIONS: Division[] = [
  {
    name: 'Dhaka',
    nameBn: 'ঢাকা',
    districts: [
      'Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj',
      'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail',
    ],
  },
  {
    name: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    districts: [
      'Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', "Cox's Bazar", 'Cumilla', 'Feni',
      'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati',
    ],
  },
  {
    name: 'Rajshahi',
    nameBn: 'রাজশাহী',
    districts: ['Bogura', 'Chapainawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  },
  {
    name: 'Khulna',
    nameBn: 'খুলনা',
    districts: [
      'Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur',
      'Narail', 'Satkhira',
    ],
  },
  {
    name: 'Barishal',
    nameBn: 'বরিশাল',
    districts: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  },
  {
    name: 'Sylhet',
    nameBn: 'সিলেট',
    districts: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  },
  {
    name: 'Rangpur',
    nameBn: 'রংপুর',
    districts: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  },
  {
    name: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    districts: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
  },
];

/** Common delivery areas inside Dhaka district; other districts take a free-text area. */
export const DHAKA_AREAS = [
  'Adabor', 'Badda', 'Banani', 'Bangshal', 'Baridhara', 'Bashundhara R/A', 'Cantonment', 'Demra',
  'Dhanmondi', 'Gulshan', 'Hazaribagh', 'Jatrabari', 'Kafrul', 'Kamrangirchar', 'Keraniganj',
  'Khilgaon', 'Khilkhet', 'Lalbagh', 'Mirpur', 'Mohakhali', 'Mohammadpur', 'Motijheel', 'New Market',
  'Pallabi', 'Paltan', 'Ramna', 'Rampura', 'Sabujbagh', 'Savar', 'Shahbagh', 'Shyamoli', 'Tejgaon',
  'Uttara', 'Wari',
];

const SUBURBS = new Set(['Gazipur', 'Narayanganj', 'Narsingdi', 'Munshiganj', 'Manikganj']);

export function zoneForDistrict(district: string): DeliveryZone {
  if (district === 'Dhaka') return DeliveryZone.INSIDE_DHAKA;
  if (SUBURBS.has(district)) return DeliveryZone.DHAKA_SUBURBS;
  return DeliveryZone.OUTSIDE_DHAKA;
}

export function isValidLocation(division: string, district: string): boolean {
  return DIVISIONS.some((d) => d.name === division && d.districts.includes(district));
}

export const ZONE_LABELS: Record<DeliveryZone, string> = {
  INSIDE_DHAKA: 'Inside Dhaka',
  DHAKA_SUBURBS: 'Dhaka suburbs',
  OUTSIDE_DHAKA: 'Outside Dhaka',
};
