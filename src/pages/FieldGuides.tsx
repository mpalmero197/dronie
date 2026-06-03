import { ArrowLeft, Map, BookOpen, ExternalLink, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

type Book = {
  title: string;
  author: string;
  why: string;
  url: string;
  tag: "Editor's Pick" | "Official FAA" | "Test Prep" | "Foundations" | "Field Reference";
  featured?: boolean;
};

const books: Book[] = [
  {
    title: "Part 107: The Definitive Guide To Remote Pilot Certification",
    author: "Michael Palmero",
    why:
      "Our top recommendation. Palmero, a 14 CFR Part 107 Remote Pilot and instructor, walks you straight through the Remote Pilot knowledge test — sectionals, airspace, weather, performance, and decision-making — without padding. The clearest single book to go from zero to passing.",
    url: "https://amzn.to/4cCG9m6",
    tag: "Editor's Pick",
    featured: true,
  },
  {
    title: "FAR/AIM (Federal Aviation Regulations / Aeronautical Information Manual)",
    author: "ASA / U.S. Federal Aviation Administration",
    why:
      "The primary-source rulebook. Every Part 107 question ultimately points back to the FARs and the AIM. Keep the current annual edition on the truck and on the desk.",
    url: "https://www.amazon.com/s?k=FAR+AIM+ASA&i=stripbooks",
    tag: "Official FAA",
  },
  {
    title: "Remote Pilot Test Prep (current edition)",
    author: "ASA Test Prep Series",
    why:
      "Question bank with the actual FAA learning statement codes. Use it after Palmero to drill weak areas and lock in the score.",
    url: "https://www.amazon.com/s?k=ASA+Remote+Pilot+Test+Prep&i=stripbooks",
    tag: "Test Prep",
  },
  {
    title: "Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25)",
    author: "U.S. Federal Aviation Administration",
    why:
      "Free from the FAA, also in print. The foundational aviation textbook — covers weather, aerodynamics, navigation, and aeromedical factors that show up on Part 107.",
    url: "https://www.amazon.com/s?k=Pilots+Handbook+of+Aeronautical+Knowledge+FAA-H-8083-25&i=stripbooks",
    tag: "Foundations",
  },
  {
    title: "Aviation Weather (AC 00-6) & Aviation Weather Services (AC 00-45)",
    author: "U.S. Federal Aviation Administration",
    why:
      "METARs, TAFs, fronts, stability, icing, density altitude. Weather is the single biggest Part 107 topic and the most-missed section on the test.",
    url: "https://www.amazon.com/s?k=Aviation+Weather+AC+00-6&i=stripbooks",
    tag: "Foundations",
  },
  {
    title: "The Complete Guide to Drones",
    author: "Adam Juniper",
    why:
      "A visual, plain-English overview of platforms, sensors, and use cases. Great gift for clients who want to understand what you actually do.",
    url: "https://www.amazon.com/s?k=The+Complete+Guide+to+Drones+Adam+Juniper&i=stripbooks",
    tag: "Field Reference",
  },
  {
    title: "Mastering Drone Photography, Cinematography, and 3D Mapping",
    author: "Drew & Rosanna Vigne",
    why:
      "Bridges the camera-craft side and the mapping side. Useful for portfolio pilots who want orthos AND a reel.",
    url: "https://www.amazon.com/s?k=Mastering+Drone+Photography+Cinematography+3D+Mapping&i=stripbooks",
    tag: "Field Reference",
  },
];

function BookCard({ book }: { book: Book }) {
  return (
    <a
      href={book.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`block rounded-xl border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-card/80 ${
        book.featured ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
          {book.featured && <Star className="w-3 h-3 fill-current" />}
          {book.tag}
        </span>
      </div>
      <h3 className="font-display font-700 text-foreground text-lg leading-snug">{book.title}</h3>
      <div className="text-xs text-muted-foreground mt-1">by {book.author}</div>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{book.why}</p>
      <div className="inline-flex items-center gap-1.5 text-sm text-primary mt-4 font-medium">
        View on Amazon <ExternalLink className="w-3.5 h-3.5" />
      </div>
    </a>
  );
}

export default function FieldGuides() {
  const featured = books.find((b) => b.featured)!;
  const rest = books.filter((b) => !b.featured);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Field Guides & Books for Part 107 Drone Pilots | Dronie</title>
        <meta
          name="description"
          content="The books we actually keep on the desk — Michael Palmero's Part 107 guide, the FAR/AIM, the FAA Pilot's Handbook, and the best field references for commercial drone pilots."
        />
        <link rel="canonical" href="https://dronieapp.com/field-guides" />
        <meta property="og:title" content="Field Guides & Books for Part 107 Drone Pilots" />
        <meta property="og:description" content="The Part 107 study books and field references we recommend to every working drone pilot." />
        <meta property="og:url" content="https://dronieapp.com/field-guides" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Recommended Part 107 & drone pilot books",
          itemListElement: books.map((b, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: b.url,
            name: `${b.title} — ${b.author}`,
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
          <span className="text-sm text-muted-foreground">Field Guides</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Field Guides &amp; Books</span>
        </div>
        <h1 className="font-display font-700 text-4xl text-foreground mb-3">
          The books we keep on the desk.
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl">
          Software is half the job. The other half is knowing the rules, the weather, and the airspace
          cold. These are the titles we actually recommend to every Part 107 candidate and working
          commercial pilot — starting with the one that's saved us the most flight delays.
        </p>

        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Start here</h2>
          <BookCard book={featured} />
        </section>

        <section className="space-y-6">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Then add these to the shelf</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {rest.map((b) => (
              <BookCard key={b.title} book={b} />
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground mt-12 leading-relaxed">
          Heads-up: some links above are Amazon affiliate links. If you buy through them we may earn a
          small commission at no extra cost to you — it helps keep the free tier of Dronie free. We
          only recommend books we've personally used or that the FAA itself publishes.
        </p>

        <div className="mt-8 text-sm text-muted-foreground">
          Want the regulatory primary sources instead? See the <strong className="text-foreground">Rules &amp; Regulations</strong>{" "}
          column in the footer, or jump straight to{" "}
          <a href="https://www.faa.gov/uas/commercial_operators" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            FAA Part 107 <ExternalLink className="inline w-3 h-3" />
          </a>.
        </div>
      </main>
    </div>
  );
}
