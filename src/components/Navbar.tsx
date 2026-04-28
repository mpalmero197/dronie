import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Map, LogOut, LayoutDashboard, Loader2, ChevronDown, Briefcase, Building2, Plane } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { VERTICAL_LIST } from "@/pages/solutions/verticals.config";

const navLinks = [
{ label: "Features", href: "#features" },
{ label: "How It Works", href: "#how-it-works" },
{ label: "Pricing", href: "#pricing" }];


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut, loading } = useAuth();
  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled || isDashboard ?
      "bg-card/95 backdrop-blur-md border-b border-border shadow-sm" :
      "bg-transparent"}`
      }>
      
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Map className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-700 text-lg text-foreground tracking-tight">
            Dronie
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((l) =>
          <a
            key={l.label}
            href={l.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            
              {l.label}
            </a>
          )}
          {/* Solutions dropdown */}
          <div className="relative group">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Solutions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[220px]">
                {VERTICAL_LIST.map((v) => {
                  const VIcon = v.icon;
                  return (
                    <Link
                      key={v.slug}
                      to={`/solutions/${v.slug}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm text-foreground"
                    >
                      <VIcon className="w-4 h-4 text-primary" />
                      {v.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <Link to="/marketplace" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Marketplace
          </Link>
          <Link to="/pilots" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Find Pilots
          </Link>
          <Link to="/pilots/join" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            For Pilots
          </Link>
          <Link to="/orgs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            For Business
          </Link>
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          {loading ?
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
          user ?
          <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                  {isAdmin &&
                <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-bold bg-accent text-accent-foreground">
                      Admin
                    </span>
                }
                </Button>
              </Link>
              <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              className="gap-1.5 hover:border-destructive hover:text-destructive transition-colors active:scale-[0.97]">
              
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </> :

          <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all active:scale-[0.97]">
                  Start Free
                </Button>
              </Link>
            </>
          }
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu">
          
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open &&
      <div className="md:hidden bg-card border-b border-border px-6 pb-6 pt-2 space-y-2">
          {navLinks.map((l) =>
        <a
          key={l.label}
          href={l.href}
          className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(false)}>
          
              {l.label}
            </a>
        )}
          <Link to="/marketplace" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span className="inline-flex items-center gap-2"><Briefcase className="w-4 h-4" />Marketplace</span>
          </Link>
          <Link to="/pilots" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span className="inline-flex items-center gap-2"><Plane className="w-4 h-4" />Find Pilots</span>
          </Link>
          <Link to="/pilots/join" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            For Pilots
          </Link>
          <Link to="/orgs" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span className="inline-flex items-center gap-2"><Building2 className="w-4 h-4" />For Business</span>
          </Link>
          <div className="pt-2 border-t border-border">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Solutions</p>
            {VERTICAL_LIST.map((v) => (
              <Link key={v.slug} to={`/solutions/${v.slug}`} onClick={() => setOpen(false)} className="block py-1.5 text-sm text-foreground">
                {v.name}
              </Link>
            ))}
          </div>
          <div className="pt-3 flex flex-col gap-2">
            {user ?
          <>
                <Link to="/dashboard" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </Button>
                </Link>
                <Button size="sm" variant="outline" onClick={handleSignOut} className="w-full gap-2 hover:border-destructive hover:text-destructive">
                  <LogOut className="w-4 h-4" /> Sign Out
                </Button>
              </> :

          <>
                <Link to="/auth" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                <Link to="/auth" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Start Free</Button>
                </Link>
              </>
          }
          </div>
        </div>
      }
    </header>);

}