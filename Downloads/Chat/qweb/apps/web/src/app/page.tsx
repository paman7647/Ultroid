import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  Lock,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle gradient orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-60 -right-40 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />

      {/* Navigation */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">qweb</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Get started
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            End-to-end encrypted messaging
          </div>
          <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Where teams{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              connect
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Secure, real-time messaging built for speed. Group chats, direct messages,
            file sharing, and voice — all in one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 text-sm font-medium">
                Create your workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-sm font-medium">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-32">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="Real-time messaging"
            description="Messages delivered instantly via WebSocket connections with automatic reconnection."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Secure by design"
            description="JWT authentication, rotating refresh tokens, RBAC, and signed file uploads."
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Privacy first"
            description="Your data stays yours. Self-hostable with full control over your infrastructure."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} qweb</span>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card/50 p-6 transition-all hover:border-primary/20 hover:shadow-soft">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
