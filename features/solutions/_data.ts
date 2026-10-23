import {
  Building2,
  Factory,
  GraduationCap,
  House,
  Lightbulb,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface SolutionApproachItem {
  eyebrow: string;
  title: string;
  description: string;
  chips: ReadonlyArray<string>;
}

export interface SolutionStat {
  value: string;
  label: string;
}

export interface SolutionSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  industry: string;
  icon: LucideIcon;
  stats: ReadonlyArray<SolutionStat>;
  approach: ReadonlyArray<SolutionApproachItem>;
  techStack: ReadonlyArray<string>;
  relatedProductSlugs: ReadonlyArray<string>;
}

export const SOLUTIONS: ReadonlyArray<SolutionSeed> = [
  {
    slug: 'smart-factory',
    name: 'Smart Factory',
    tagline:
      'Machine telemetry, compact automation, and operator visibility for small production floors.',
    description:
      'Connected sensors, compact robots, and dashboard tooling for small-batch factories and workshops that need reliability without enterprise overhead.',
    industry: 'Small & medium manufacturing',
    icon: Factory,
    stats: [
      { value: 'Pilot', label: 'Downtime impact measured at pilot' },
      { value: 'Targeted', label: 'Alert response before escalation' },
      { value: 'Scoped', label: 'Sensor nodes sized per floor' },
    ],
    approach: [
      {
        eyebrow: '01 · SENSORS',
        title: 'Map what the floor is actually doing',
        description: 'Vibration, temperature, and cycle counters before any automation decision.',
        chips: ['Vibration', 'Temp', 'Cycle count'],
      },
      {
        eyebrow: '02 · CONTROL',
        title: 'Compact automation where it pays off',
        description:
          'Small robots and actuators for repetitive pick/pack tasks that free operators for skilled work.',
        chips: ['Robot arm', 'Conveyor', 'PLC interface'],
      },
      {
        eyebrow: '03 · VISIBILITY',
        title: 'Operator dashboard and alert routing',
        description:
          'A single screen showing floor status, with SLA-aware alerts before problems escalate.',
        chips: ['MQTT', 'Dashboard', 'Alerts'],
      },
    ],
    techStack: ['LiDAR', 'SLAM', 'STM32', 'MQTT', 'Ethernet', 'Pending final selection'],
    relatedProductSlugs: [
      'autonomous-floor-cleaning-robot',
      'iot-gateway-node',
      'custom-embedded-controller',
    ],
  },
  {
    slug: 'smart-agriculture',
    name: 'Smart Agriculture',
    tagline: 'Field sensor networks and irrigation decision support for small-scale farms.',
    description:
      'Soil moisture, weather, and crop telemetry nodes connected to simple dashboards that help smallholder farmers make better irrigation and harvest decisions.',
    industry: 'Smallholder & commercial farms',
    icon: Lightbulb,
    stats: [
      { value: 'Pilot', label: 'Water-use reduction under measurement' },
      { value: 'Designed', label: 'Multi-day node autonomy' },
      { value: 'Scoped', label: 'LoRaWAN coverage per gateway' },
    ],
    approach: [
      {
        eyebrow: '01 · SENSING',
        title: 'Understand the soil before the sky',
        description:
          'Soil probes for moisture, salinity, and temperature — the primary inputs for irrigation decisions.',
        chips: ['Soil moisture', 'Salinity', 'Temperature'],
      },
      {
        eyebrow: '02 · CONNECTIVITY',
        title: 'LoRaWAN for wide-area farms with poor cell coverage',
        description:
          'Long-range, low-power radio links to a site gateway that pushes data to the cloud when the window is available.',
        chips: ['LoRaWAN', 'Solar', 'MQTT'],
      },
      {
        eyebrow: '03 · DECISIONS',
        title: 'Simple alerts, not data overload',
        description:
          'Farmers receive a low-moisture alert and a recommended action — not a raw sensor graph.',
        chips: ['SMS alert', 'Pending final selection', 'Threshold rules'],
      },
    ],
    techStack: [
      'LoRaWAN',
      'Solar harvesting',
      'Soil probes',
      'ESP32',
      'MQTT',
      'Threshold rules',
    ],
    relatedProductSlugs: ['iot-gateway-node', 'custom-embedded-controller'],
  },
  {
    slug: 'smart-city',
    name: 'Smart City',
    tagline: 'Environmental monitoring, asset tracking, and public infrastructure telemetry.',
    description:
      'City-scale sensor networks for air quality, flood sensing, public lighting, and asset condition monitoring — designed to run on unreliable power and intermittent connectivity.',
    industry: 'Municipal & utility operators',
    icon: Building2,
    stats: [
      { value: 'Scoped', label: 'Sensor uptime per deployment' },
      { value: 'Planned', label: 'Nodes per district rollout' },
      { value: 'Targeted', label: 'Alert latency at the gateway' },
    ],
    approach: [
      {
        eyebrow: '01 · FIELD NODES',
        title: 'Weatherproof sensing in public spaces',
        description:
          'IP65+ enclosures for air, noise, flood, and public-asset monitoring with solar or PoE power.',
        chips: ['IP65', 'Solar / PoE', 'Air quality'],
      },
      {
        eyebrow: '02 · BACKHAUL',
        title: '4G/LTE with LoRaWAN fallback',
        description:
          'Primary LTE connectivity with LoRaWAN gateway fallback for areas with intermittent cell coverage.',
        chips: ['4G/LTE', 'LoRaWAN', 'Edge buffer'],
      },
      {
        eyebrow: '03 · CONTROL ROOM',
        title: 'Operational dashboards for city teams',
        description:
          'A GIS-aware status view, alert queue, and incident export for operations teams.',
        chips: ['GIS dashboard', 'Alert queue', 'Export CSV'],
      },
    ],
    techStack: [
      '4G/LTE',
      'LoRaWAN',
      'IP65 enclosures',
      'MQTT',
      'Edge buffering',
      'GIS dashboard',
    ],
    relatedProductSlugs: ['iot-gateway-node', 'custom-embedded-controller'],
  },
  {
    slug: 'energy-utilities',
    name: 'Energy & Utilities',
    tagline:
      'Sub-metering, load monitoring, and energy-use visibility for buildings and facilities.',
    description:
      'Connected energy meters, smart breaker interfaces, and demand dashboards that give building managers the visibility to cut waste without replacing the existing switchboard.',
    industry: 'Commercial buildings · utilities · facilities',
    icon: Settings2,
    stats: [
      { value: 'Scoped', label: 'Energy-cost baseline per building' },
      { value: 'Modular', label: 'Circuits monitored per panel' },
      { value: 'Targeted', label: 'Anomaly alert delay' },
    ],
    approach: [
      {
        eyebrow: '01 · METERING',
        title: 'Sub-circuit visibility without panel replacement',
        description:
          'Clip-on CTs and smart plugs layer energy metering onto existing wiring with minimal disruption.',
        chips: ['CT clamp', 'Smart plug', 'Modbus'],
      },
      {
        eyebrow: '02 · MONITORING',
        title: 'Real-time load tracking and anomaly alerts',
        description:
          'Baseline usage modelling flags unusual draw before the monthly bill arrives.',
        chips: ['Baseline', 'Anomaly', 'MQTT'],
      },
      {
        eyebrow: '03 · REPORTING',
        title: 'Consumption reports for facilities managers',
        description:
          'Weekly and monthly CSV/PDF exports mapped to cost centres and procurement cycles.',
        chips: ['Reports', 'CSV export', 'Cost centre'],
      },
    ],
    techStack: [
      'CT clamp',
      'Modbus',
      'MQTT',
      'ESP32',
      'Dashboard tooling',
      'Reporting exports',
    ],
    relatedProductSlugs: [
      'smart-appliance-control',
      'iot-gateway-node',
      'custom-embedded-controller',
    ],
  },
  {
    slug: 'education',
    name: 'Education',
    tagline: 'Robotics labs, classroom kits, and guided hardware programmes for institutions.',
    description:
      'Modular robotics kits, curriculum-paired hardware, and lab-ready platforms for schools, polytechnics, and university engineering programmes across Bangladesh and South Asia.',
    industry: 'Schools · polytechnics · universities',
    icon: GraduationCap,
    stats: [
      { value: 'Modular', label: 'Lesson packs per skill level' },
      { value: 'Simple', label: 'Setup flow per class session' },
      { value: 'Planned', label: 'Institution pilots' },
    ],
    approach: [
      {
        eyebrow: '01 · HARDWARE',
        title: 'Visible wiring and serviceable modules',
        description:
          'Students see the signal path — sensors, MCU, actuators are separated and labelled to support learning.',
        chips: ['MCU visible', 'Sensor modules', 'Actuators'],
      },
      {
        eyebrow: '02 · CURRICULUM',
        title: 'Structured exercises for each skill level',
        description:
          'From LED blink to PID motor control — lesson packs matched to BL/BS/BSc progression.',
        chips: ['Lesson packs', 'BSc-aligned', 'Bilingual-ready'],
      },
      {
        eyebrow: '03 · SUPPORT',
        title: 'Technician-ready documentation and spares',
        description:
          'Lab coordinators receive setup notes, fault guides, and a spares checklist to run the lab without engineering support.',
        chips: ['Lab guide', 'Fault tree', 'Spares list'],
      },
    ],
    techStack: [
      'Arduino-compatible MCU',
      'Sensor modules',
      'Motor drivers',
      'USB programming',
      'Bilingual documentation',
    ],
    relatedProductSlugs: ['education-robotics-kit', 'custom-embedded-controller'],
  },
  {
    slug: 'custom',
    name: 'Custom R&D',
    tagline:
      'Prototype-to-deployment engineering for teams building new robotics or IoT products.',
    description:
      'End-to-end hardware development: board design, firmware, enclosure, and field trial support for institutions, integrators, and industry teams building their own IoT or robotics product.',
    industry: 'R&D teams · integrators · OEM pilots',
    icon: House,
    stats: [
      { value: 'Scoped', label: 'Discovery-to-prototype per engagement' },
      { value: 'Defined', label: 'Prototype deliverables upfront' },
      { value: 'Active', label: 'Engineering capacity for pilots' },
    ],
    approach: [
      {
        eyebrow: '01 · DISCOVERY',
        title: 'Document before designing',
        description:
          'We map the environment, duty cycle, connectivity, and service model before recommending a board architecture.',
        chips: ['Site survey', 'Duty cycle', 'Service plan'],
      },
      {
        eyebrow: '02 · PROTOTYPE',
        title: 'Build a testable system fast',
        description:
          'Dev-board prototype first, custom PCB second — so the firmware and interface are validated before expensive tooling.',
        chips: ['Dev board', 'PCB design', 'Firmware'],
      },
      {
        eyebrow: '03 · HANDOVER',
        title: 'Deliverables a client team can maintain',
        description:
          'Gerbers, firmware repo, test jig, and documentation so the client team is not dependent on ARIOT for every revision.',
        chips: ['Gerbers', 'Firmware repo', 'Test jig'],
      },
    ],
    techStack: [
      'PCB design',
      'STM32 / ESP32-S3',
      'RTOS',
      'MQTT / HTTPS',
      'Enclosure design',
      'QA process',
    ],
    relatedProductSlugs: ['custom-embedded-controller', 'iot-gateway-node'],
  },
] as const;

export function getSolutionBySlug(slug: string): SolutionSeed | undefined {
  return SOLUTIONS.find((solution) => solution.slug === slug);
}
