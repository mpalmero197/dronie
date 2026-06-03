import { ArrowLeft, Map, Mail, MessageSquare, Briefcase, ShieldAlert, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const channels = [
  {
    icon: LifeBuoy,
    title: "Product support",
    desc: "Bugs, account issues, processing questions, billing.",
    email: "[email protected]",
  },
  {
    icon: Briefcase,
    title: "Sales & enterprise",
    desc: "Volume pricing, SLAs, on-prem, white-label, procurement docs.",
    email: "[email protected]",
  },
  {
    icon: MessageSquare,
    title: "Press & partnerships",
    desc: "Media inquiries, integration proposals, co-marketing.",
    email: "[email protected]",
  },
  {
    icon: ShieldAlert,
    title: "Security & abuse",
    desc: "Responsible disclosure, copyright, marketplace abuse reports.",
    email: "[email protected]",
  },
];

export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Contact Dronie | Support, Sales, Press</title>
        <meta name="description" content="Reach the Dronie team for product support, enterprise sales, partnerships, press, and security reports. We answer every email." />
        <link rel="canonical" href="https://dronieapp.com/contact" />
        <meta property="og:title" content="Contact Dronie" />
        <meta property="og:description" content="Reach support, sales, press, or security. We answer every email." />
        <meta property="og:url" content="https://dronieapp.com/contact" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Dronie",
          url: "https://dronieapp.com",
          contactPoint: channels.map((c) => ({
            "@type": "ContactPoint",
            contactType: c.title,
            email: c.email,
            availableLanguage: ["en"],
          })),
        })}</script>
      </Helmet>

      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Map className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-700 text-foreground">Dronie</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">Contact</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <h1 className="font-display font-700 text-4xl text-foreground mb-3">Get in touch</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          A real human reads every email. Pick the channel that fits and we'll get back within one
          business day — usually much sooner.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {channels.map((c) => (
            <a
              key={c.email}
              href={`mailto:${c.email}`}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-colors group"
            >
              <c.icon className="w-5 h-5 text-primary mb-3" />
              <div className="font-semibold text-foreground">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">{c.desc}</div>
              <div className="inline-flex items-center gap-1.5 text-sm text-primary group-hover:underline">
                <Mail className="w-3.5 h-3.5" /> {c.email}
              </div>
            </a>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Mailing address</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Halcyon Systems Group<br />
            Operator of Dronie (dronieapp.com)<br />
            United States
          </p>
          <p className="text-xs text-muted-foreground">
            For legal notices, see our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        <div className="mt-10 text-sm text-muted-foreground">
          Looking for hands-on flying help, FAA Part 107 study material, or background reading? See our{" "}
          <Link to="/field-guides" className="text-primary hover:underline">Field Guides &amp; Books</Link>.
        </div>
      </main>
    </div>
  );
}
