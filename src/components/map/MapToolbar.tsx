import { useState } from "react";
import {
  MapPin, Ruler, Pentagon, Minus, Circle, Square,
  Layers, Code2, Camera, Leaf, Mountain, MousePointerClick, Plane, ShieldAlert,
  ChevronDown, ChevronUp, Undo2, Redo2, Maximize, Bookmark,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

export type DrawTool = "marker" | "polyline" | "polygon" | "rectangle" | "circle" | "measure-distance" | "measure-area" | "fetch-parcels" | "flight-plan" | "laanc-check" | null;

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
};

const DRAW_TOOLS: ToolDef[] = [
  { id: "marker", icon: MapPin, label: "Drop Pin", shortcut: "M" },
  { id: "polyline", icon: Minus, label: "Draw Line", shortcut: "L" },
  { id: "polygon", icon: Pentagon, label: "Draw Polygon", shortcut: "P" },
  { id: "rectangle", icon: Square, label: "Draw Rectangle", shortcut: "R" },
  { id: "circle", icon: Circle, label: "Draw Circle", shortcut: "C" },
];

const MEASURE_TOOLS: ToolDef[] = [
  { id: "measure-distance", icon: Ruler, label: "Measure Distance", shortcut: "D" },
  { id: "measure-area", icon: Pentagon, label: "Measure Area", shortcut: "A" },
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

function ToolButton({ tool, isActive, onClick, activeClass = "bg-primary text-primary-foreground" }: {
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
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isActive ? activeClass : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {tool.label}{tool.shortcut && <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted text-[10px] font-mono">{tool.shortcut}</kbd>}
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

  return (
    <div className="absolute top-3 left-3 z-[900] flex flex-col gap-0.5 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-1 max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none">
      {/* Undo / Redo */}
      <div className="flex gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canUndo ? "text-muted-foreground hover:bg-secondary hover:text-foreground" : "text-muted-foreground/30 cursor-not-allowed"}`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${canRedo ? "text-muted-foreground hover:bg-secondary hover:text-foreground" : "text-muted-foreground/30 cursor-not-allowed"}`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>

      <div className="h-px bg-border mx-1" />

      {/* Draw tools — collapsible */}
      <button
        onClick={() => setDrawExpanded(v => !v)}
        className={`w-8 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${hasActiveDrawTool ? "text-primary" : ""}`}
      >
        {drawExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {drawExpanded && DRAW_TOOLS.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          isActive={activeTool === tool.id}
          onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
        />
      ))}

      <div className="h-px bg-border mx-1" />

      {/* Measure */}
      {MEASURE_TOOLS.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          isActive={activeTool === tool.id}
          onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
          activeClass="bg-accent text-accent-foreground"
        />
      ))}

      <div className="h-px bg-border mx-1" />

      {/* Overlays */}
      {OVERLAYS.map((ov) => {
        const Icon = ov.icon;
        const isActive = activeOverlay === ov.id;
        return (
          <Tooltip key={ov.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onOverlayChange(isActive ? null : ov.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{ov.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="h-px bg-border mx-1" />

      {/* More tools — collapsible */}
      <button
        onClick={() => setMoreExpanded(v => !v)}
        className={`w-8 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${hasActiveSpecial ? "text-primary" : ""}`}
      >
        {moreExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {moreExpanded && (
        <>
          {SPECIAL_TOOLS.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
              activeClass={tool.id === "laanc-check" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"}
            />
          ))}
        </>
      )}

      <div className="h-px bg-border mx-1" />

      {/* Fullscreen */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onFullscreen} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
      </Tooltip>

      {/* Export / Embed */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onExportPng} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <Camera className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Export PNG</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onEmbedCode} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Embed Code</TooltipContent>
      </Tooltip>
    </div>
  );
}
