import { Bot, Cpu, GraduationCap, PlugZap, ShieldCheck, Wifi, type LucideIcon } from 'lucide-react';

export interface ProductSpecGroup {
  title: string;
  rows: ReadonlyArray<{ label: string; value: string }>;
}

export interface ProductSummary {
  slug: string;
  title: string;
  category: string;
  useCase: string;
  connectivity: ReadonlyArray<string>;
  status: string;
  tagline: string;
  description: string;
  price: string;
  chips: ReadonlyArray<string>;
  icon: LucideIcon;
  features: ReadonlyArray<string>;
  specs: ReadonlyArray<ProductSpecGroup>;
  downloads: ReadonlyArray<string>;
}

export const PRODUCT_CATEGORIES = [
  'Industrial robotics',
  'Smart-city IoT',
  'Smart-building IoT',
  'Prosumer',
  'Education',
  'Custom',
] as const;

export interface ProductCategory {
  slug: string;
  name: string;
  tagline: string;
  description: string;
}

export const CATEGORIES: ReadonlyArray<ProductCategory> = [
  {
    slug: 'robotics',
    name: 'Industrial robotics',
    tagline: 'Autonomous platforms for structured commercial environments.',
    description:
      'Compact autonomous robots designed for scheduled floor operations, material handling, and field sensing in offices, small factories, and institutions.',
  },
  {
    slug: 'smart-city',
    name: 'Smart-city IoT',
    tagline: 'Sensor networks and gateway nodes for outdoor infrastructure.',
    description:
      'Connected hardware for environmental monitoring, asset tracking, and field telemetry across urban deployments and public infrastructure.',
  },
  {
    slug: 'smart-building',
    name: 'Smart-building IoT',
    tagline: 'Safety, energy, and control devices for connected buildings.',
    description:
      'Wall-mounted safety nodes, appliance controllers, and energy meters for homes, offices, and small commercial buildings.',
  },
  {
    slug: 'prosumer',
    name: 'Prosumer',
    tagline: 'Capable consumer devices for technically-aware households.',
    description:
      'IoT hardware positioned between consumer and professional — designed for hands-on users who want configurability and real data.',
  },
  {
    slug: 'education',
    name: 'Education',
    tagline: 'Robotics kits and lab hardware for institutions and workshops.',
    description:
      'Modular robotics kits, curriculum-paired hardware, and classroom-friendly platforms for schools, universities, and engineering training programmes.',
  },
  {
    slug: 'custom',
    name: 'Custom',
    tagline: 'Purpose-built hardware for specific deployment requirements.',
    description:
      'Prototype-to-production engineering engagements for teams building new products or deploying hardware in non-standard environments.',
  },
] as const;

export function getCategoryBySlug(slug: string): ProductCategory | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function getProductsByCategory(slug: string): ReadonlyArray<ProductSummary> {
  return PRODUCTS.filter((product) =>
    product.category.toLowerCase().includes(slug.replace(/-/g, ' ')),
  );
}

export const PRODUCT_USE_CASES = [
  'Factory',
  'Agriculture',
  'Energy',
  'Security',
  'Education',
] as const;

export const PRODUCT_CONNECTIVITY = [
  'Wi-Fi',
  '4G/LTE',
  'LoRaWAN',
  'Zigbee',
  'Ethernet',
] as const;

export const PRODUCTS: ReadonlyArray<ProductSummary> = [
  {
    slug: 'autonomous-floor-cleaning-robot',
    title: 'Autonomous floor-cleaning robot',
    category: 'Autonomous robotics',
    useCase: 'Homes · offices',
    connectivity: ['Wi-Fi', 'BLE'],
    status: 'R&D — concept stage',
    tagline: 'Clean mapped spaces with unattended autonomy.',
    description:
      'A compact autonomous platform for scheduled floor cleaning in homes, offices, and education labs.',
    price: 'Price on request',
    chips: ['LiDAR', 'SLAM', 'Docking'],
    icon: Bot,
    features: [
      'Maps real rooms and avoids common floor obstacles.',
      'Schedules repeat cleaning runs from the companion app.',
      'Returns to a charging dock when the battery is low.',
      'Designed for serviceable modules and local support.',
    ],
    specs: [
      {
        title: 'Mechanical',
        rows: [
          { label: 'Dimensions', value: 'To be confirmed' },
          { label: 'Payload / tank', value: 'To be confirmed' },
        ],
      },
      {
        title: 'Connectivity',
        rows: [
          { label: 'Wireless', value: 'Wi-Fi 2.4 GHz · BLE' },
          { label: 'App', value: 'iOS / Android planned' },
        ],
      },
    ],
    downloads: ['Datasheet (PDF)', 'Quick-start guide (PDF)'],
  },
  {
    slug: 'iot-home-safety-device',
    title: 'IoT home safety device',
    category: 'Smart-building IoT',
    useCase: 'Safety · security',
    connectivity: ['Wi-Fi', 'BLE'],
    status: 'Pilot stage',
    tagline: 'Detect safety events and alert people fast.',
    description:
      'A connected safety node for smoke, gas, motion, and local siren alerts with app notification support.',
    price: 'Price on request',
    chips: ['Smoke', 'Gas', 'Motion'],
    icon: ShieldCheck,
    features: [
      'Combines multiple safety sensors in one wall-mounted unit.',
      'Keeps a local audible alarm path for offline events.',
      'Sends phone alerts when the network is available.',
      'Designed for household and small-office installation.',
    ],
    specs: [
      {
        title: 'Sensors',
        rows: [
          { label: 'Smoke', value: 'To be confirmed' },
          { label: 'Gas', value: 'To be confirmed' },
        ],
      },
      {
        title: 'Electrical',
        rows: [
          { label: 'Power', value: 'To be confirmed' },
          { label: 'Backup', value: 'To be confirmed' },
        ],
      },
    ],
    downloads: ['Datasheet (PDF)', 'Installation guide (PDF)'],
  },
  {
    slug: 'smart-appliance-control',
    title: 'Smart appliance control',
    category: 'Prosumer IoT',
    useCase: 'Energy · automation',
    connectivity: ['Wi-Fi'],
    status: 'EARLY PROTOTYPE',
    tagline: 'Switch and schedule appliances with energy visibility.',
    description:
      'A connected controller for appliance switching, scheduling, and energy metering in small spaces.',
    price: 'Price on request',
    chips: ['Relay', 'Energy meter', 'App'],
    icon: PlugZap,
    features: [
      'Controls compatible appliances from a single app interface.',
      'Reports energy readings for simple usage visibility.',
      'Supports schedules for repeated daily routines.',
      'Includes local manual override for safe operation.',
    ],
    specs: [
      {
        title: 'Electrical',
        rows: [
          { label: 'Load rating', value: 'To be confirmed' },
          { label: 'Metering', value: 'To be confirmed' },
        ],
      },
      {
        title: 'Software',
        rows: [
          { label: 'Scheduling', value: 'Supported' },
          { label: 'OTA updates', value: 'Planned' },
        ],
      },
    ],
    downloads: ['Datasheet (PDF)', 'Wiring guide (PDF)'],
  },
  {
    slug: 'education-robotics-kit',
    title: 'Education robotics kit',
    category: 'Education',
    useCase: 'Labs · classrooms',
    connectivity: ['Wi-Fi', 'Bluetooth'],
    status: 'Planned',
    tagline: 'Teach embedded robotics with real hardware.',
    description:
      'A modular robotics kit for classroom labs, workshops, and university-level prototyping.',
    price: 'Price on request',
    chips: ['Sensors', 'Motor drivers', 'Curriculum'],
    icon: GraduationCap,
    features: [
      'Pairs hardware modules with structured learning exercises.',
      'Keeps wiring visible so students understand the signal path.',
      'Supports repeatable classroom setup and teardown.',
      'Designed for Bangla bilingual-ready teaching material later.',
    ],
    specs: [
      {
        title: 'Kit contents',
        rows: [
          { label: 'Controller', value: 'To be confirmed' },
          { label: 'Modules', value: 'To be confirmed' },
        ],
      },
      {
        title: 'Software',
        rows: [
          { label: 'Examples', value: 'To be confirmed' },
          { label: 'IDE', value: 'To be confirmed' },
        ],
      },
    ],
    downloads: ['Curriculum outline (PDF)', 'Lab guide (PDF)'],
  },
  {
    slug: 'iot-gateway-node',
    title: 'IoT gateway node',
    category: 'Smart-city IoT',
    useCase: 'Telemetry · monitoring',
    connectivity: ['Ethernet', 'Wi-Fi', '4G/LTE'],
    status: 'Custom build',
    tagline: 'Route field sensor data to the right dashboard.',
    description:
      'A configurable gateway node for sensor networks, telemetry collection, and edge buffering.',
    price: 'Quote only',
    chips: ['MQTT', 'Edge buffer', 'OTA'],
    icon: Wifi,
    features: [
      'Buffers telemetry during intermittent network windows.',
      'Publishes data over standard IoT protocols.',
      'Supports local diagnostics for field technicians.',
      'Configurable per deployment and network environment.',
    ],
    specs: [
      {
        title: 'Connectivity',
        rows: [
          { label: 'WAN', value: 'Ethernet · Wi-Fi · LTE (variant dependent)' },
          { label: 'Protocols', value: 'MQTT · HTTPS' },
        ],
      },
      {
        title: 'Environmental',
        rows: [
          { label: 'Enclosure', value: 'To be confirmed' },
          { label: 'Temperature', value: 'To be confirmed' },
        ],
      },
    ],
    downloads: ['Deployment brief (PDF)', 'Protocol sheet (PDF)'],
  },
  {
    slug: 'custom-embedded-controller',
    title: 'Custom embedded controller',
    category: 'Custom',
    useCase: 'Product R&D',
    connectivity: ['Project-dependent'],
    status: 'Engineering service',
    tagline: 'Prototype a control board around your duty cycle.',
    description:
      'Custom electronics, firmware, and enclosure design for robotics and IoT product development.',
    price: 'Quote only',
    chips: ['PCB', 'Firmware', 'Enclosure'],
    icon: Cpu,
    features: [
      'Defines board requirements from the mechanical and firmware needs.',
      'Builds testable prototypes before production decisions.',
      'Documents interfaces, pinouts, firmware behavior, and risks.',
      'Supports pilot batches and deployment feedback loops.',
    ],
    specs: [
      {
        title: 'Engagement',
        rows: [
          { label: 'Discovery', value: 'To be confirmed' },
          { label: 'Prototype', value: 'To be confirmed' },
        ],
      },
      {
        title: 'Deliverables',
        rows: [
          { label: 'Hardware', value: 'To be confirmed' },
          { label: 'Firmware', value: 'To be confirmed' },
        ],
      },
    ],
    downloads: [
      'R&D intake checklist (PDF)',
      'NDA / procurement pack (PDF)',
    ],
  },
] as const;

export function getProductBySlug(slug: string): ProductSummary | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getRelatedProducts(slug: string): ReadonlyArray<ProductSummary> {
  return PRODUCTS.filter((product) => product.slug !== slug).slice(0, 3);
}
