import { useNavigate } from "react-router-dom";
import { Apple, Smartphone, Share2, Plus, Home, Check, ArrowLeft } from "lucide-react";

export default function Install() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-secondary"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="font-display font-700 text-foreground text-sm">Install Dronie</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-2">
            <img src="/pwa-icon-512.png" alt="" className="w-12 h-12 rounded-xl" />
          </div>
          <h2 className="font-display font-700 text-2xl text-foreground">
            Install Dronie on your phone
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Get the full-screen, app-like experience for in-flight pilot mode. No app store
            needed — installs straight from your browser.
          </p>
        </div>

        {/* iPhone */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Apple className="w-5 h-5" />
            <h3 className="font-semibold text-foreground">iPhone / iPad (Safari)</h3>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </span>
              <div>
                <p className="text-foreground">Open Dronie in Safari</p>
                <p className="text-xs text-muted-foreground">
                  Chrome on iOS works too, but Safari gives the best home-screen experience.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </span>
              <div className="flex-1">
                <p className="text-foreground flex items-center gap-1.5">
                  Tap the <Share2 className="w-4 h-4 inline" /> Share button
                </p>
                <p className="text-xs text-muted-foreground">Bottom of the screen.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </span>
              <div className="flex-1">
                <p className="text-foreground flex items-center gap-1.5">
                  Tap <Plus className="w-4 h-4 inline" /> "Add to Home Screen"
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                4
              </span>
              <div>
                <p className="text-foreground">Tap "Add" — done!</p>
                <p className="text-xs text-muted-foreground">
                  Dronie now lives on your home screen and opens fullscreen.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Android */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <h3 className="font-semibold text-foreground">Android (Chrome)</h3>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </span>
              <p className="text-foreground">
                Open Dronie in Chrome — you'll see an "Install Dronie" prompt at the bottom.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </span>
              <p className="text-foreground">
                Tap "Install". If you missed the prompt, open the ⋮ menu →{" "}
                <Home className="w-4 h-4 inline" /> "Add to Home screen".
              </p>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </span>
              <p className="text-foreground">
                Confirm — Dronie installs as a real app, complete with its own icon.
              </p>
            </li>
          </ol>
        </section>

        {/* What you get */}
        <section className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground">What installing gets you</h3>
          <ul className="space-y-2 text-sm">
            {[
              "Fullscreen, no browser bars — perfect for outdoor pilot mode",
              "One-tap launch from your home screen",
              "Quick access shortcuts to the Pilot view and Map",
              "Native-feeling navigation and faster startup",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-foreground">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Tip: install on the same phone you plug into the DJI controller, then swipe between
          DJI Fly and Dronie.
        </p>
      </main>
    </div>
  );
}
