import { useState } from "react";
import {
  MapPin, Ruler, Pentagon, Minus, Circle, Square,
  Layers, Code2, Camera, Leaf, Mountain, MousePointerClick, Plane, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

const TOOLS: { id: DrawTool; icon: typeof MapPin; label: string; group: string }[] = [
  { id: "marker", icon: MapPin, label: "Drop Pin", group: "draw" },
  { id: "polyline", icon: Minus, label: "Draw Line", group: "draw" },
  { id: "polygon", icon: Pentagon, label: "Draw Polygon", group: "draw" },
  { id: "rectangle", icon: Square, label: "Draw Rectangle", group: "draw" },
  { id: "circle", icon: Circle, label: "Draw Circle", group: "draw" },
  { id: "measure-distance", icon: Ruler, label: "Measure Distance", group: "measure" },
  { id: "measure-area", icon: Pentagon, label: "Measure Area", group: "measure" },
];

const OVERLAYS = [
  { id: "elevation", icon: Mountain, label: "Elevation" },
  { id: "ndvi", icon: Leaf, label: "NDVI" },
  { id: "airspace", icon: ShieldAlert, label: "Airspace / No-Fly Zones" },
];

export default function MapToolbar({
  activeTool, onToolChange, onExportPng, onEmbedCode, activeOverlay, onOverlayChange,
}: MapToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-[900] flex flex-col gap-1 bg-card/95 backdrop-blur rounded-xl border border-border shadow-xl p-1.5">
      {/* Drawing tools */}
      {TOOLS.filter(t => t.group === "draw").map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToolChange(isActive ? null : tool.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="h-px bg-border my-1" />

      {/* Measurement tools */}
      {TOOLS.filter(t => t.group === "measure").map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToolChange(isActive ? null : tool.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="h-px bg-border my-1" />

      {/* Overlays */}
      {OVERLAYS.map((ov) => {
        const Icon = ov.icon;
        const isActive = activeOverlay === ov.id;
        return (
          <Tooltip key={ov.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onOverlayChange(isActive ? null : ov.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{ov.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="h-px bg-border my-1" />

      {/* Parcel + Flight Plan */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange(activeTool === "fetch-parcels" ? null : "fetch-parcels")}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              activeTool === "fetch-parcels" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <MousePointerClick className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Fetch Parcels (click map)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange(activeTool === "flight-plan" ? null : "flight-plan")}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              activeTool === "flight-plan" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Plane className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Flight Planner</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange(activeTool === "laanc-check" ? null : "laanc-check")}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              activeTool === "laanc-check" ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">LAANC Authorization Check</TooltipContent>
      </Tooltip>

      <div className="h-px bg-border my-1" />

      {/* Export / Embed */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onExportPng} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <Camera className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Export as PNG</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onEmbedCode} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            <Code2 className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Embed Code</TooltipContent>
      </Tooltip>
    </div>
  );
}
