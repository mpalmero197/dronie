import { useState } from "react";
import {
  MapPin, Ruler, Pentagon, Spline, Circle, Square,
  Code2, Camera, Leaf, Mountain, MousePointerClick, Plane, ShieldAlert,
  ChevronDown, ChevronUp, Undo2, Redo2, Maximize, Minimize, Bookmark, Compass,
  PencilRuler, MountainSnow, Sparkles,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

export type DrawTool = "marker" | "polyline" | "polygon" | "rectangle" | "circle" | "measure-distance" | "measure-area" | "bearing" | "fetch-parcels" | "flight-plan" | "laanc-check" | null;

interface MapToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  onExportPng: () => void;
  onEmbedCode: () => void;
  activeOverlay: string | null;
  onOverlayChange: (overlay: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  onToggleBookmarks?: () => void;
  bookmarksOpen?: boolean;
}

type ToolDef = { id: DrawTool; icon: typeof MapPin; label: string; shortcut?: string };

export const KEYBOARD_SHORTCUT_MAP: Record<string, DrawTool> = {
  m: "marker",
  l: "polyline",
  p: "polygon",
  r: "rectangle",
  c: "circle",
  d: "measure-distance",
  a: "measure-area",
  g: "bearing",
};

const DRAW_TOOLS: ToolDef[] = [
  { id: "marker", icon: MapPin, label: "Drop Pin", shortcut: "M" },
  { id: "polyline", icon: Spline, label: "Draw Line", shortcut: "L" },
  { id: "polygon", icon: Pentagon, label: "Draw Polygon", shortcut: "P" },
  { id: "rectangle", icon: Square, label: "Draw Rectangle", shortcut: "R" },
  { id: "circle", icon: Circle, label: "Draw Circle", shortcut: "C" },
];

const MEASURE_TOOLS: ToolDef[] = [
  { id: "measure-distance", icon: Ruler, label: "Measure Distance", shortcut: "D" },
  { id: "measure-area", icon: Pentagon, label: "Measure Area", shortcut: "A" },
  { id: "bearing", icon: Compass, label: "Bearing Line", shortcut: "G" },
];

const OVERLAYS = [
  { id: "elevation", icon: Mountain, label: "Elevation" },
  { id: "ndvi", icon: Leaf, label: "NDVI" },
  { id: "airspace", icon: ShieldAlert, label: "Airspace / No-Fly" },
];

const SPECIAL_TOOLS: ToolDef[] = [
  { id: "fetch-parcels", icon: MousePointerClick, label: "Fetch Parcels" },
  { id: "flight-plan", icon: Plane, label: "Flight Planner" },
  { id: "laanc-check", icon: ShieldAlert, label: "LAANC Check" },
];

function ToolButton({ tool, isActive, onClick, activeClass = "bg-primary text-primary-foreground shadow-sm" }: {
  tool: ToolDef;
  isActive: boolean;
  onClick: () => void;
  activeClass?: string;
}) {
  const Icon = tool.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-pressed={isActive}
          className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${
            isActive
              ? `${activeClass} scale-[1.03]`
              : "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95"
          }`}
        >
          <Icon className="w-4 h-4" strokeWidth={isActive ? 2.4 : 2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs font-medium flex items-center gap-1.5">
        {tool.label}
        {tool.shortcut && (
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/60">
            {tool.shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}



export default function MapToolbar({
  activeTool, onToolChange, onExportPng, onEmbedCode, activeOverlay, onOverlayChange,
  onUndo, onRedo, canUndo, canRedo, onFullscreen, isFullscreen, onToggleBookmarks, bookmarksOpen,
}: MapToolbarProps) {
  const [drawExpanded, setDrawExpanded] = useState(true);
  const [moreExpanded, setMoreExpanded] = useState(false);

  const hasActiveDrawTool = DRAW_TOOLS.some(t => t.id === activeTool);
  const hasActiveSpecial = SPECIAL_TOOLS.some(t => t.id === activeTool);
  const hasActiveMeasure = MEASURE_TOOLS.some(t => t.id === activeTool);

  return (
    <div className="absolute top-3 left-3 z-[900] flex flex-col bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.03] p-1.5 max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none w-12">
      {/* History */}
      <div className="flex gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-[18px] h-9 flex-1 rounded-lg flex items-center justify-center transition-all ${canUndo ? "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95" : "text-muted-foreground/25 cursor-not-allowed"}`}
              aria-label="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">Undo · ⌘Z</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-[18px] h-9 flex-1 rounded-lg flex items-center justify-center transition-all ${canRedo ? "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95" : "text-muted-foreground/25 cursor-not-allowed"}`}
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">Redo · ⇧⌘Z</TooltipContent>
        </Tooltip>
      </div>

      <div className="h-px bg-border/70 my-1.5" />

      {/* Draw tools — collapsible group */}
      <button
        onClick={() => setDrawExpanded(v => !v)}
        aria-label={drawExpanded ? "Collapse draw tools" : "Expand draw tools"}
        aria-expanded={drawExpanded}
        className={`w-9 h-6 rounded-md flex items-center justify-between px-1.5 transition-colors ${hasActiveDrawTool ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
      >
        <PencilRuler className="w-3 h-3" />
        {drawExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {drawExpanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {DRAW_TOOLS.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
            />
          ))}
        </div>
      )}

      <div className="h-px bg-border/70 my-1.5" />

      {/* Measure */}
      <div className={`w-9 h-6 rounded-md flex items-center justify-center transition-colors ${hasActiveMeasure ? "text-accent" : "text-muted-foreground/60"}`}>
        <Ruler className="w-3 h-3" />
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {MEASURE_TOOLS.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
            activeClass="bg-accent text-accent-foreground shadow-sm"
          />
        ))}
      </div>

      <div className="h-px bg-border/70 my-1.5" />

      {/* Overlays */}
      <div className="w-9 h-6 rounded-md flex items-center justify-center text-muted-foreground/60">
        <MountainSnow className="w-3 h-3" />
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {OVERLAYS.map((ov) => {
          const Icon = ov.icon;
          const isActive = activeOverlay === ov.id;
          return (
            <Tooltip key={ov.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onOverlayChange(isActive ? null : ov.id)}
                  aria-pressed={isActive}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.03]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2.4 : 2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">{ov.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="h-px bg-border/70 my-1.5" />

      {/* Pro tools — collapsible */}
      <button
        onClick={() => setMoreExpanded(v => !v)}
        aria-label={moreExpanded ? "Collapse pro tools" : "Expand pro tools"}
        aria-expanded={moreExpanded}
        className={`w-9 h-6 rounded-md flex items-center justify-between px-1.5 transition-colors ${hasActiveSpecial ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
      >
        <Sparkles className="w-3 h-3" />
        {moreExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {moreExpanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {SPECIAL_TOOLS.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
              activeClass={tool.id === "laanc-check" ? "bg-amber-500 text-white shadow-sm" : "bg-primary text-primary-foreground shadow-sm"}
            />
          ))}
        </div>
      )}

      {/* Bookmarks */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleBookmarks}
            aria-pressed={!!bookmarksOpen}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all mt-0.5 ${bookmarksOpen ? "bg-accent text-accent-foreground shadow-sm scale-[1.03]" : "text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95"}`}
          >
            <Bookmark className="w-4 h-4" strokeWidth={bookmarksOpen ? 2.4 : 2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs font-medium flex items-center gap-1.5">
          Bookmarks
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/60">B</kbd>
        </TooltipContent>
      </Tooltip>

      <div className="h-px bg-border/70 my-1.5" />

      {/* View / Export */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onFullscreen} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all active:scale-95">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onExportPng} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all active:scale-95">
            <Camera className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs">Export PNG</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onEmbedCode} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all active:scale-95">
            <Code2 className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs">Embed code</TooltipContent>
      </Tooltip>
    </div>
  );
}
