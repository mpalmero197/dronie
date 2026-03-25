import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Map, ArrowLeft, Share2, MapPin, Trash2, Ruler,
  Layers, Calendar, Image as ImageIcon, AreaChart, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, Project } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// Fix Leaflet default marker icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Demo project for /viewer/demo
const DEMO_PROJECT: Project = {
  id: "demo",
  user_id: "demo",
  name: "Example: Farm Survey Block 4",
  description: "Demonstration orthomosaic — Rio Grande Valley, TX",
  image_count: 842,
  area_ha: 47.3,
  status: "complete",
  progress: 100,
  outputs: ["GeoTIFF", "LAZ Point Cloud", "DSM", "DTM", "Contours SHP", "Flight Report PDF"],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_CENTER: [number, number] = [26.2034, -98.2300];

interface Pin {
  id: string;
  lat: number;
  lng: number;
  note: string;
}

function AnnotationLayer({
  pins,
  addPin,
  deletePin,
}: {
  pins: Pin[];
  addPin: (lat: number, lng: number) => void;
  deletePin: (id: string) => void;
}) {
  useMapEvents({
    contextmenu(e) {
      addPin(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <>
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]}>
          <Popup>
            <div className="min-w-[140px]">
              <p className="font-semibold text-xs mb-1">Annotation Pin</p>
              <p className="text-xs text-gray-500 mb-2">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </p>
              <button
                onClick={() => deletePin(pin.id)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Remove pin
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function MapViewer() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState<Pin[]>([]);
  const [measuring, setMeasuring] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  const isDemo = projectId === "demo";

  useEffect(() => {
    if (isDemo) {
      setProject(DEMO_PROJECT);
      setLoading(false);
      return;
    }

    async function fetchProject() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }
      setProject(data as Project);
      setLoading(false);
    }

    fetchProject();
  }, [projectId, isDemo]);

  const addPin = useCallback((lat: number, lng: number) => {
    const newPin: Pin = {
      id: crypto.randomUUID(),
      lat,
      lng,
      note: "",
    };
    setPins((prev) => [...prev, newPin]);
    toast({ title: "Pin added", description: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
  }, [toast]);

  const deletePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const shareLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "Share this URL for public access — no login required." });
  }, [toast]);

  const center: [number, number] = isDemo ? DEMO_CENTER : [37.7749, -122.4194];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Map className="w-12 h-12 text-muted-foreground/40" />
        <h2 className="font-display font-700 text-foreground">Project not found</h2>
        <p className="text-muted-foreground text-sm">This project may not exist or isn't complete yet.</p>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (project.status !== "complete" && !isDemo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <h2 className="font-display font-700 text-foreground">Processing in Progress</h2>
        <p className="text-muted-foreground text-sm">The map viewer will be available once processing is complete.</p>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
        <p className="text-sm font-semibold text-accent">{project.progress}%</p>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="z-[1000] bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Map className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-700 text-foreground text-sm truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isDemo ? "Demo · Public viewer" : "Interactive map viewer"}
            </p>
          </div>
          {project.status === "complete" && (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMeasuring((v) => !v)}
            className={`gap-1.5 text-xs hidden sm:flex ${measuring ? "border-accent text-accent bg-accent/10" : ""}`}
          >
            <Ruler className="w-3.5 h-3.5" />
            {measuring ? "Measuring…" : "Measure"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInfo((v) => !v)}
            className="gap-1.5 text-xs hidden sm:flex"
          >
            <Layers className="w-3.5 h-3.5" />
            Info
          </Button>
          <Button
            size="sm"
            onClick={shareLink}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </Button>
        </div>
      </header>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer
          center={center}
          zoom={isDemo ? 14 : 12}
          className="w-full h-full"
          zoomControl={true}
        >
          {/* Satellite tiles for orthomosaic feel */}
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          {/* Road/label overlay */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.25}
          />

          <AnnotationLayer pins={pins} addPin={addPin} deletePin={deletePin} />
        </MapContainer>

        {/* Info panel overlay */}
        {showInfo && (
          <div className="absolute top-4 right-4 z-[900] w-56 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-4 space-y-3">
            <h3 className="font-display font-700 text-foreground text-sm truncate">{project.name}</h3>
            <div className="space-y-2 text-xs">
              {project.area_ha && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AreaChart className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{project.area_ha} ha</span>
                </div>
              )}
              {project.image_count > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{project.image_count.toLocaleString()} images</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              {pins.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span>{pins.length} annotation{pins.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            {project.outputs && project.outputs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">Outputs</p>
                <div className="flex flex-wrap gap-1">
                  {project.outputs.map((o) => (
                    <span key={o} className="px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground font-medium">
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hint overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
          <div className="bg-card/90 backdrop-blur rounded-full px-4 py-2 border border-border shadow text-xs text-muted-foreground flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            Right-click anywhere on the map to drop an annotation pin
          </div>
        </div>
      </div>
    </div>
  );
}
