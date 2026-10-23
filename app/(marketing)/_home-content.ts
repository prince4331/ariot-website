import {
  BookOpen,
  Bot,
  Building2,
  Cpu,
  Factory,
  FlaskConical,
  GraduationCap,
  House,
  Layers,
  Package,
  PlugZap,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureStackItem } from '@/components/marketing/feature-stack';
import type { Metric } from '@/components/marketing/metric-band';

/**
 * Marketing-route home page content.
 *
 * Lives next to page.tsx (underscored so Next.js does not route to it).
 * All copy is honest and does not claim commercial availability, deployment
 * at customer sites, or verified statistics. Status labels are used in place
 * of unverified claims.
 */
interface FeatureCardData {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  chips?: ReadonlyArray<string>;
  href?: string;
}

// ── Business areas ─────────────────────────────────────────────────────────

export const BUSINESS_AREAS: ReadonlyArray<FeatureCardData> = [
  {
    icon: Bot,
    eyebrow: 'Research & Development',
    title: 'Autonomous robotics R&D',
    description:
      'We research and build autonomous robots — starting with an industrial floor-cleaning system currently in prototype and testing stages.',
    href: '/robotics',
  },
  {
    icon: Users,
    eyebrow: 'Planned Initiative',
    title: 'Robotics workspace',
    description:
      'A planned co-working and engineering space for students, engineers, and research teams building hardware in Bangladesh.',
    href: '/workspace',
  },
  {
    icon: Package,
    eyebrow: 'Store in Development',
    title: 'Electronics & components',
    description:
      'We are building a component supply for development boards, sensors, motors, robotics parts, and IoT modules.',
    href: '/components',
  },
  {
    icon: PlugZap,
    eyebrow: 'In Development',
    title: 'IoT product development',
    description:
      'Connected devices for home safety, smart energy control, and environment monitoring — designed for conditions in Bangladesh.',
    href: '/products',
  },
  {
    icon: Sparkles,
    eyebrow: 'Future',
    title: 'Household & agricultural robotics',
    description:
      'Future product lines covering household automation and precision agricultural robotics, planned once core R&D matures.',
    href: '/research',
  },
] as const;

// ── Product preview ─────────────────────────────────────────────────────────

export const PRODUCTS: ReadonlyArray<FeatureCardData> = [
  {
    icon: Bot,
    eyebrow: 'Prototype Stage',
    title: 'Autonomous floor-cleaning robot',
    description:
      'A self-mapping, low-noise cleaning robot for industrial and commercial floors — currently under R&D and prototype validation.',
    chips: ['LiDAR', 'SLAM', 'Wi-Fi'],
    href: '/products/autonomous-floor-cleaning-robot',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'In Development',
    title: 'IoT home safety device',
    description:
      'Connected smoke, gas, and motion sensing with phone alerts and a local siren — no cloud-only dependency.',
    chips: ['Wi-Fi', 'BLE', 'Buzzer'],
    href: '/products/iot-home-safety-device',
  },
  {
    icon: PlugZap,
    eyebrow: 'In Development',
    title: 'Smart appliance control',
    description:
      'Switch, schedule, and meter common appliances over Wi-Fi from one app, with offline fallback.',
    chips: ['Wi-Fi', 'Energy meter', 'App'],
    href: '/products/smart-appliance-control',
  },
  {
    icon: FlaskConical,
    eyebrow: 'Custom R&D',
    title: 'Custom robotics & prototyping',
    description:
      'Prototype-to-product engagements for institutions, integrators, and industry pilots — from concept to validated build.',
    chips: ['Discover', 'Prototype', 'Validate'],
    href: '/quote',
  },
] as const;

// ── Solutions/deployment contexts ───────────────────────────────────────────

export const SOLUTIONS: ReadonlyArray<FeatureCardData> = [
  {
    icon: House,
    title: 'Homes',
    description:
      'Safety, energy visibility, and smart appliance control for connected households in Bangladesh.',
    href: '/solutions',
  },
  {
    icon: Building2,
    title: 'Offices & SMEs',
    description:
      'Environment monitoring, access-aware workflows, and appliance control for small-to-medium offices.',
    href: '/solutions',
  },
  {
    icon: GraduationCap,
    title: 'Institutions & universities',
    description:
      'Robotics labs, classroom kits, and infrastructure for engineering education programmes.',
    href: '/solutions',
  },
  {
    icon: Factory,
    title: 'Small industries',
    description:
      'Compact automation, sensor networks, and energy monitoring for small-batch production environments.',
    href: '/solutions',
  },
  {
    icon: Sparkles,
    title: 'Custom robotics projects',
    description:
      'Tailored prototype-to-deployment builds for research groups, integrators, and enterprise pilots.',
    href: '/quote',
  },
] as const;

// ── Engineering capability pillars ─────────────────────────────────────────

export const ENGINEERING_PILLARS: ReadonlyArray<FeatureStackItem> = [
  {
    eyebrow: '01 · NAVIGATION & AUTONOMY',
    title: 'Real-room autonomy — not just lab demos',
    description:
      'We design control loops, planning, and obstacle handling that work on real floors and real factory aisles. Our systems are tested in environments where surfaces, lighting, and layout change.',
    chips: ['ROS 2', 'LiDAR', 'SLAM'],
  },
  {
    eyebrow: '02 · EMBEDDED CONTROL',
    title: 'Custom boards tuned for the duty cycle',
    description:
      'We select the silicon, lay out the PCB, and write the firmware — every signal chain matched to how the device actually operates in the field, not just in a demo environment.',
    chips: ['STM32', 'ESP32-S3', 'RTOS'],
  },
  {
    eyebrow: '03 · CLOUD-READY IOT',
    title: 'Devices that report without surprising operators',
    description:
      'Authentication, telemetry, and OTA updates designed for flaky regional networks — with offline fallback so field devices remain useful when connectivity drops.',
    chips: ['MQTT', 'HTTPS', 'OTA'],
  },
] as const;

export const ENGINEERING_FULL_LIST = [
  'Navigation & autonomy',
  'Sensor integration',
  'Embedded control',
  'Cloud & app-ready IoT',
  'Prototype to validation',
] as const;

// ── Capability strip ────────────────────────────────────────────────────────

export const CAPABILITIES = [
  { label: 'Autonomous systems' },
  { label: 'Embedded electronics' },
  { label: 'IoT products' },
  { label: 'Engineering workspace' },
  { label: 'Components supply' },
] as const;

// ── Status metrics (honest, no invented numbers) ────────────────────────────

export const METRICS: ReadonlyArray<Metric> = [
  { value: 'R&D', label: 'Autonomous systems stage' },
  { value: 'Planned', label: 'Workspace & component store' },
  { value: 'BD', label: 'Home market' },
  { value: '< 24h', label: 'Quote response target' },
] as const;

// ── Blog teasers ─────────────────────────────────────────────────────────────

export const BLOG_TEASERS: ReadonlyArray<FeatureCardData> = [
  {
    icon: FlaskConical,
    eyebrow: 'Robotics R&D',
    title: 'Build logs from the lab floor',
    description:
      'Control theory, mechanical decisions, and the small wins that make autonomous machines actually finish the job.',
    href: '/blog',
  },
  {
    icon: Wifi,
    eyebrow: 'IoT in Bangladesh',
    title: 'Why deployments here look different',
    description:
      'Power reliability, regional networks, and the design choices that make IoT stick in real environments in Bangladesh.',
    href: '/blog',
  },
  {
    icon: BookOpen,
    eyebrow: 'Build logs · Tutorials',
    title: 'Hands-on guides for engineers',
    description:
      'Practical walkthroughs for robotics and IoT engineers — protocols, firmware patterns, and field-tested approaches.',
    href: '/blog',
  },
] as const;

// ── Component categories for homepage teaser ────────────────────────────────

export const COMPONENT_TEASERS: ReadonlyArray<FeatureCardData> = [
  {
    icon: Cpu,
    title: 'Development boards',
    description: 'Microcontroller and microprocessor boards for embedded and robotics projects.',
    href: '/components',
  },
  {
    icon: Radio,
    title: 'Sensors & IoT modules',
    description: 'Distance, motion, environmental sensors and wireless connectivity modules.',
    href: '/components',
  },
  {
    icon: Layers,
    title: 'Robotics & mechanical parts',
    description: 'Motors, motor drivers, chassis frames, and structural parts for mobile robots.',
    href: '/components',
  },
  {
    icon: GraduationCap,
    title: 'Education kits',
    description: 'Bundled learning kits for robotics courses, workshops, and maker programmes.',
    href: '/components',
  },
] as const;
