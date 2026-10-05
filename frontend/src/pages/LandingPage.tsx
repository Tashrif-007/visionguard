import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Cpu,
  Crop,
  Film,
  Gauge,
  MessageSquareText,
  ScanEye,
  ShieldHalf,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useAuth'

const STEPS = [
  { icon: ScanEye, title: 'Motion detection', body: 'Every frame is checked for motion first.' },
  { icon: Crop, title: 'ROI extraction', body: 'Only the region around the motion is processed.' },
  { icon: Sparkles, title: 'Hybrid dehazing', body: 'Physics-based dark channel prior, refined by a tiny CNN.' },
  { icon: Activity, title: 'Event log', body: 'Logged and searchable in plain English.' },
]

const STATS = [
  { value: '30 FPS', label: 'on a plain CPU' },
  { value: '0 GPUs', label: 'required' },
  { value: 'ROI only', label: 'never the full frame' },
  { value: 'Top-K', label: 'stable atmospheric light' },
]

const FEATURES = [
  { icon: Video, title: 'Multi-camera', body: 'Webcams, IP streams and uploaded video run side by side, each started and stopped independently.' },
  { icon: MessageSquareText, title: 'Ask in plain English', body: '"Any motion last night?" is turned into filters and answered from the event log.' },
  { icon: Film, title: 'Evidence on record', body: 'Every event keeps a snapshot, a short clip, a timestamp and the ROI coordinates.' },
  { icon: Gauge, title: 'Analytics', body: 'Events per day, per camera, a weekday-by-hour heatmap and motion-size breakdowns.' },
  { icon: Users, title: 'Roles built in', body: 'Admins create operator accounts. No open signup, JWT-protected end to end.' },
  { icon: Cpu, title: 'Edge friendly', body: 'A tiny CNN refines a physics prior, so it stays light enough for a small box on site.' },
]

export function LandingPage() {
  const { data: user } = useCurrentUser()
  const navigate = useNavigate()
  const goToApp = () => navigate(user ? '/dashboard' : '/login')

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-10 lg:px-16">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldHalf className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">VisionGuard AI</span>
        </div>
        <Button size="sm" onClick={goToApp}>
          {user ? 'Go to dashboard' : 'Sign in'}
        </Button>
      </header>

      {/* Asymmetric split hero — headline + CTA on the left, a real hazy→clear
          visual on the right (no cards/badges — deliberately not the app's
          dashboard vocabulary). */}
      <section className="grid gap-12 px-6 pb-16 pt-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-10 md:px-10 md:pb-24 md:pt-10 lg:px-16">
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            See clearly through{' '}
            <span className="text-primary">fog and smog</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            VisionGuard AI restores visibility in hazy CCTV footage in real time — only on the regions
            where motion happens, so a single CPU keeps up at 30 FPS.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={goToApp}>
              {user ? 'Go to dashboard' : 'Sign in to monitor'}
            </Button>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              See how it works ↓
            </a>
          </div>
          <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground">
            <span>CPU-only</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>No GPU required</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>30 FPS</span>
          </div>
        </div>

        {/* Hazy → clear split visual, pure CSS; the divider slowly sweeps back and forth */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
          <div className="absolute inset-0 bg-muted-foreground/40" />
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,color-mix(in_oklab,var(--card)_45%,transparent),transparent_60%)]"
          />
          <div
            className="vg-sweep absolute inset-0 bg-gradient-to-br from-primary/25 to-card"
          />
          <div
            className="vg-sweep absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <span className="absolute left-4 top-4 label-mono rounded-sm bg-card/70 px-2 py-1 text-muted-foreground">
            Hazy
          </span>
          <span className="absolute right-4 top-4 label-mono rounded-sm bg-card/70 px-2 py-1 text-primary">
            Dehazed
          </span>
          <div className="absolute bottom-6 right-6 flex h-16 w-24 items-center justify-center overflow-hidden rounded-sm border border-primary/60">
            <span className="vg-scan absolute inset-x-0 top-0 h-0.5 bg-primary" />
            <span className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-primary" />
            <span className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-primary" />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 px-6 py-10 md:px-10 lg:px-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.value} delayMs={i * 100}>
              <p className="font-mono text-2xl font-semibold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works — a connected horizontal step sequence, not a card grid */}
      <section id="how-it-works" className="border-t border-border px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </h2>
        <div className="relative mt-10 grid gap-10 md:grid-cols-4 md:gap-6">
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-border md:block">
            <span className="vg-travel absolute -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 120} className="relative flex flex-col gap-3">
              <span
                style={{ animationDelay: `${i * 1.5}s` }}
                className="vg-step relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary"
              >
                {i + 1}
              </span>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <step.icon className="h-4 w-4 text-muted-foreground" />
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The physics — why the CNN stays small */}
      <section className="border-t border-border px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Physics first, learning second
            </h2>
            <p className="mt-6 text-3xl font-bold leading-tight tracking-tight">
              The CNN only refines one thing: the transmission map.
            </p>
            <p className="mt-4 max-w-md text-muted-foreground">
              Haze follows a known atmospheric scattering model. The dark channel prior estimates how much
              light survives; a four-layer CNN sharpens that estimate. The clean image is then rebuilt by the
              physical model itself, so the output stays explainable and not a black box.
            </p>
          </Reveal>
          <Reveal delayMs={150}>
            <div className="vg-float rounded-lg border border-border bg-card p-6">
              <p className="label-mono text-muted-foreground">Atmospheric scattering model</p>
              <p className="mt-4 font-mono text-xl text-primary">I(x) = J(x)·t(x) + A·(1 − t(x))</p>
              <p className="mt-4 font-mono text-xl text-primary">J(x) = (I(x) − A) / t(x) + A</p>
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-mono text-foreground">I</dt>
                <dd className="text-muted-foreground">observed hazy frame</dd>
                <dt className="font-mono text-foreground">J</dt>
                <dd className="text-muted-foreground">recovered clear scene</dd>
                <dt className="font-mono text-foreground">t</dt>
                <dd className="text-muted-foreground">transmission, refined by the Tiny CNN</dd>
                <dt className="font-mono text-foreground">A</dt>
                <dd className="text-muted-foreground">atmospheric light, averaged over the Top-K brightest pixels</dd>
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature list */}
      <section className="border-t border-border px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Built for the control room
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delayMs={(i % 3) * 100} className="flex gap-4">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="border-t border-border bg-muted/40 px-6 py-16 text-center md:px-10 md:py-24 lg:px-16">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to see through the haze?</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Sign in, add a camera or upload a clip, and watch the dehazed view appear on the moving regions.
          </p>
          <Button size="lg" className="mt-8" onClick={goToApp}>
            {user ? 'Go to dashboard' : 'Sign in to monitor'}
          </Button>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground md:px-10 lg:px-16">
        VisionGuard AI — hybrid dark channel prior + tiny CNN dehazing, built for edge deployment.
      </footer>
    </div>
  )
}
