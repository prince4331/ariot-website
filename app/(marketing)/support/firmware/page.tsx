import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowDownToLine, CheckCircle, Clock } from 'lucide-react';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { defineMetadata } from '@/lib/seo/metadata';

const FIRMWARE_RELEASES = [
  {
    product: 'Autonomous floor-cleaning robot',
    version: 'Pre-release',
    status: 'pending',
    releaseDate: 'To be announced',
    notes: ['SLAM tuning improvements', 'Docking reliability fixes', 'App connectivity updates'],
  },
  {
    product: 'IoT home safety device',
    version: 'Pre-release',
    status: 'pending',
    releaseDate: 'To be announced',
    notes: ['Gas sensor calibration updates', 'Wi-Fi reconnect improvements', 'Alarm tone adjustments'],
  },
  {
    product: 'Smart appliance control',
    version: 'Pre-release',
    status: 'pending',
    releaseDate: 'To be announced',
    notes: ['Schedule reliability fixes', 'Energy metering accuracy updates', 'OTA foundation'],
  },
  {
    product: 'IoT gateway node',
    version: 'Pre-release',
    status: 'pending',
    releaseDate: 'To be announced',
    notes: ['LTE connection stability', 'MQTT retry improvements', 'Edge buffer expansion'],
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'Firmware',
  description:
    'Download ARIOT firmware releases and read release notes for all current hardware products.',
  path: '/support/firmware',
});

export default function FirmwarePage() {
  return (
    <>
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-6">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Support', href: '/support' },
                { label: 'Firmware' },
              ]}
            />
            <div className="max-w-4xl">
              <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                Support · Firmware
              </p>
              <h1 className="text-steel-100 font-display mt-4 text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Firmware
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg">
                Release notes and download links for ARIOT hardware. Firmware is currently in
                pre-release — published versions will appear here as field validation completes.
              </p>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            eyebrow="All products"
            title="Current firmware status"
            subhead="Firmware files are published once hardware reaches the firmware-release milestone. Status below reflects today's stage."
            size="compact"
          />
          <div className="flex flex-col gap-6">
            {FIRMWARE_RELEASES.map((release) => (
              <Card key={release.product}>
                <CardHeader>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>{release.product}</CardTitle>
                    <span className="text-steel-400 font-mono text-[11px] tracking-[0.14em] uppercase">
                      {release.version}
                    </span>
                  </div>
                </CardHeader>
                <CardBody className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span
                      className={
                        release.status === 'pending'
                          ? 'text-warning border-warning/30 bg-warning/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px]'
                          : 'text-success border-success/30 bg-success/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px]'
                      }
                    >
                      {release.status === 'pending' ? (
                        <Clock className="h-3 w-3" aria-hidden />
                      ) : (
                        <CheckCircle className="h-3 w-3" aria-hidden />
                      )}
                      {release.status === 'pending' ? 'Pre-release' : 'Stable'}
                    </span>
                    <span className="text-steel-400 font-mono text-[11px]">
                      {release.releaseDate}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {release.notes.map((note) => (
                      <li key={note} className="text-steel-300 flex items-start gap-2 text-sm">
                        <span
                          aria-hidden
                          className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-cyan-400"
                        />
                        {note}
                      </li>
                    ))}
                  </ul>

                  <Button variant="secondary" size="sm" disabled className="w-full sm:w-auto">
                    <ArrowDownToLine className="h-4 w-4" />
                    Downloads open at release
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container>
          <Card variant="glass">
            <CardBody className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
              <div>
                <h2 className="text-steel-100 font-display text-2xl font-semibold tracking-tight">
                  Need firmware recovery help?
                </h2>
                <p className="text-steel-300 mt-2 text-sm">
                  If a firmware update has left your device in an unexpected state, contact support
                  before attempting another update.
                </p>
              </div>
              <Button asChild variant="primary">
                <Link href="/contact">Contact support</Link>
              </Button>
            </CardBody>
          </Card>
        </Container>
      </Section>
    </>
  );
}
