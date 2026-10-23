import {
  Combine,
  Eye,
  Factory,
  Layers,
  Navigation,
  Radar,
  ScanSearch,
  Truck,
  type LucideIcon,
} from 'lucide-react';

/**
 * Marketing route-group robotics page content.
 *
 * Co-located next to page.tsx (underscored so Next.js does not route to it).
 * Copy is honest engineering language — no invented metrics, availability,
 * or achievement claims. Status labels reflect where the program actually
 * stands today.
 */

export interface RoboticsTechItem {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  chips: ReadonlyArray<string>;
}

export const ROBOTICS_TECH: ReadonlyArray<RoboticsTechItem> = [
  {
    icon: Layers,
    eyebrow: 'Middleware',
    title: 'ROS 2',
    description:
      'The robot software stack runs on ROS 2 so drivers, planners, and system nodes stay modular, testable, and portable across platforms.',
    chips: ['Modular nodes', 'Simulation', 'Hardware drivers'],
  },
  {
    icon: Radar,
    eyebrow: 'Perception',
    title: 'LiDAR SLAM',
    description:
      'LiDAR-based mapping and localization let the robot build a floor map, locate itself inside it, and return to its dock without an operator.',
    chips: ['Mapping', 'Localization', 'Re-docking'],
  },
  {
    icon: Combine,
    eyebrow: 'Estimation',
    title: 'Sensor Fusion',
    description:
      'LiDAR, IMU, wheel odometry, and optional vision are fused so the robot keeps its position when surfaces, lighting, or floor layout change.',
    chips: ['IMU', 'Odometry', 'Robustness'],
  },
  {
    icon: Eye,
    eyebrow: 'Perception',
    title: 'AI Vision',
    description:
      'Vision models help distinguish obstacles, furniture, and people from false readings — so planning decisions are based on what is actually on the floor.',
    chips: ['Object detection', 'Clutter handling'],
  },
  {
    icon: Navigation,
    eyebrow: 'Planning',
    title: 'Autonomous Navigation',
    description:
      'Global and local planners steer the robot through doorways and around people, with recovery behaviours when the path is unexpectedly blocked.',
    chips: ['Global plan', 'Local plan', 'Recovery'],
  },
] as const;

export interface RoboticsRoadmapItem {
  label: string;
  title: string;
  description: string;
}

export const ROBOTICS_ROADMAP: ReadonlyArray<RoboticsRoadmapItem> = [
  {
    label: 'Now',
    title: 'Prototype validation',
    description:
      'A working prototype is tested on real floors — navigation, docking, cleaning quality, and fault recovery are measured and logged against a defined test matrix.',
  },
  {
    label: 'Next',
    title: 'Controlled field pilots',
    description:
      'Supervised pilots with a small number of partner sites will prove reliability under operator schedules before any availability claim is made.',
  },
  {
    label: 'After',
    title: 'Service-ready release',
    description:
      'Commercial availability will follow only once pilots, service paths, documentation, and local support are in place.',
  },
] as const;

export interface RoboticsFutureLine {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  chips: ReadonlyArray<string>;
}

export const ROBOTICS_FUTURE_LINES: ReadonlyArray<RoboticsFutureLine> = [
  {
    icon: Truck,
    eyebrow: 'Planned',
    title: 'Autonomous mobile robots',
    description:
      'Compact AMRs for moving bins, parts, and payloads inside factories and warehouses — planned once the core autonomy stack matures.',
    chips: ['Material handling', 'Fleet-ready'],
  },
  {
    icon: ScanSearch,
    eyebrow: 'Planned',
    title: 'Inspection robots',
    description:
      'Scheduled inspection rounds for facilities that run continuously — visual checks, environment logging, and report generation without a walking patrol.',
    chips: ['Field inspection', 'Condition logging'],
  },
  {
    icon: Factory,
    eyebrow: 'Planned',
    title: 'Industrial automation',
    description:
      'Productive cells that combine compact robot arms, vision systems, and safety interlocks for repetitive production tasks.',
    chips: ['Robot arms', 'Vision guided', 'Safety interlocks'],
  },
] as const;

/** CleanBot technology chips — shared with the homepage featured section. */
export const CLEANBOT_TECH: ReadonlyArray<string> = [
  'ROS 2',
  'LiDAR SLAM',
  'Sensor Fusion',
  'AI Vision',
  'Autonomous Navigation',
] as const;