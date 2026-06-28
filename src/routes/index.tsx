import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Scale, Gauge, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AshoMa — Weigh, capture, and track every meal" },
      { name: "description", content: "A connected food scale + camera deck that recognizes meals and tracks your nutrition automatically." },
      { property: "og:title", content: "AshoMa" },
      { property: "og:description", content: "Capture, weigh, recognize, and log meals automatically." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">AM</span>
            AshoMa
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/login" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            For your Raspberry Pi smart kitchen deck
          </span>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-6xl">
            Weigh it. Snap it. <span className="text-primary">Know it.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            AshoMa pairs four load cells, a depth sensor, and a camera with AI food recognition.
            Every plate becomes a labeled meal with grams, calories, and nutrients — automatically.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/login" className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
              Open the dashboard
            </Link>
            <a href="#how" className="rounded-md border px-5 py-3 text-sm font-medium">
              How it works
            </a>
          </div>
        </div>

        <div id="how" className="mt-20 grid gap-4 md:grid-cols-4">
          {[
            { icon: Camera, title: "Capture", text: "Camera snaps the plate the moment weight stabilizes." },
            { icon: Scale, title: "Weigh", text: "4 HX711 load cells sum to a precise gram reading." },
            { icon: Gauge, title: "Measure", text: "ToF depth sensor estimates volume for better portions." },
            { icon: LineChart, title: "Track", text: "Live meal feed, weekly + monthly nutrition trends." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
