import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DRONE_CATALOG, formatDroneLabel, parseEquipmentString } from "@/lib/drone-catalog";
import { cn } from "@/lib/utils";

export interface FleetEntry {
  /** "DJI Mavic 3 Pro" */
  label: string;
  manufacturer: string;
  model: string;
  /** Quantity owned (>=1). */
  quantity: number;
}

interface FleetCatalogPickerProps {
  /** Existing flat strings such as "DJI Mavic 3 Pro" — converted on first render. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional: receive structured entries with quantities. */
  onEntriesChange?: (entries: FleetEntry[]) => void;
  maxItems?: number;
}

function flattenEntries(entries: FleetEntry[]): string[] {
  // Repeat label per quantity so existing string[] consumers see counts.
  const out: string[] = [];
  for (const e of entries) {
    for (let i = 0; i < Math.max(1, e.quantity); i++) out.push(e.label);
  }
  return out;
}

function entriesFromStrings(values: string[]): FleetEntry[] {
  const map = new Map<string, FleetEntry>();
  for (const v of values) {
    const parsed = parseEquipmentString(v);
    const manufacturer = parsed?.manufacturer ?? "Other / Custom";
    const model = parsed?.model ?? v;
    const label = formatDroneLabel(manufacturer, model);
    const existing = map.get(label);
    if (existing) existing.quantity += 1;
    else map.set(label, { label, manufacturer, model, quantity: 1 });
  }
  return Array.from(map.values());
}

export default function FleetCatalogPicker({
  value,
  onChange,
  onEntriesChange,
  maxItems = 20,
}: FleetCatalogPickerProps) {
  const [search, setSearch] = useState("");
  const entries = useMemo(() => entriesFromStrings(value), [value]);

  const update = (next: FleetEntry[]) => {
    onEntriesChange?.(next);
    onChange(flattenEntries(next));
  };

  const isSelected = (manufacturer: string, model: string) =>
    entries.some((e) => e.manufacturer === manufacturer && e.model === model);

  const getQty = (manufacturer: string, model: string) =>
    entries.find((e) => e.manufacturer === manufacturer && e.model === model)?.quantity ?? 0;

  const toggle = (manufacturer: string, model: string, checked: boolean) => {
    if (checked) {
      if (entries.length >= maxItems) return;
      const label = formatDroneLabel(manufacturer, model);
      update([...entries, { label, manufacturer, model, quantity: 1 }]);
    } else {
      update(entries.filter((e) => !(e.manufacturer === manufacturer && e.model === model)));
    }
  };

  const setQuantity = (manufacturer: string, model: string, qty: number) => {
    if (qty < 1) {
      toggle(manufacturer, model, false);
      return;
    }
    if (qty > 50) qty = 50;
    update(
      entries.map((e) =>
        e.manufacturer === manufacturer && e.model === model ? { ...e, quantity: qty } : e,
      ),
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DRONE_CATALOG;
    return DRONE_CATALOG.map((mfr) => ({
      ...mfr,
      models: mfr.models.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          mfr.name.toLowerCase().includes(q) ||
          formatDroneLabel(mfr.name, m.name).toLowerCase().includes(q),
      ),
    })).filter((mfr) => mfr.models.length > 0);
  }, [search]);

  const totalUnits = entries.reduce((s, e) => s + e.quantity, 0);

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {entries.length} model{entries.length === 1 ? "" : "s"} · {totalUnits} unit
              {totalUnits === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => update([])}
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <Badge key={e.label} variant="secondary" className="gap-1.5 pl-2 pr-1 py-0.5">
                <span>{e.label}</span>
                {e.quantity > 1 && (
                  <span className="text-xs opacity-70">× {e.quantity}</span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(e.manufacturer, e.model, false)}
                  className="ml-0.5 rounded-sm hover:bg-background/60 p-0.5"
                  aria-label={`Remove ${e.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search manufacturer or model…"
          className="pl-9"
        />
      </div>

      <div className="rounded-md border border-border max-h-[360px] overflow-y-auto">
        <Accordion type="multiple" className="w-full">
          {filtered.map((mfr) => {
            const selectedCount = mfr.models.filter((m) => isSelected(mfr.name, m.name)).length;
            return (
              <AccordionItem key={mfr.name} value={mfr.name} className="px-3 last:border-b-0">
                <AccordionTrigger className="py-2.5 hover:no-underline">
                  <div className="flex items-center gap-2 flex-1 text-left">
                    <span className="font-medium">{mfr.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({mfr.models.length})
                    </span>
                    {selectedCount > 0 && (
                      <Badge variant="default" className="ml-auto mr-2 h-5 text-xs">
                        {selectedCount}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-1">
                    {mfr.models.map((m) => {
                      const checked = isSelected(mfr.name, m.name);
                      const qty = getQty(mfr.name, m.name);
                      const disabled = !checked && entries.length >= maxItems;
                      return (
                        <div
                          key={m.name}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50",
                            checked && "bg-muted/40",
                          )}
                        >
                          <Checkbox
                            id={`${mfr.name}-${m.name}`}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(c) => toggle(mfr.name, m.name, !!c)}
                          />
                          <label
                            htmlFor={`${mfr.name}-${m.name}`}
                            className="flex-1 text-sm cursor-pointer select-none"
                          >
                            {m.name}
                            {m.category && (
                              <span className="ml-2 text-xs text-muted-foreground capitalize">
                                {m.category}
                              </span>
                            )}
                          </label>
                          {checked && (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => setQuantity(mfr.name, m.name, qty - 1)}
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => setQuantity(mfr.name, m.name, qty + 1)}
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No models match "{search}". Try a different search.
            </div>
          )}
        </Accordion>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ChevronDown className="h-3 w-3" />
        Expand a manufacturer to pick models. Use ± to set how many of each you operate.
      </p>
    </div>
  );
}