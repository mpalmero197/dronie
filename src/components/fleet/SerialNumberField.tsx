import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSerial } from "@/lib/drone-catalog";
import { cn } from "@/lib/utils";

interface SerialNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Drone id to exclude from duplicate check (for edits). */
  excludeDroneId?: string;
  /** Notify parent when duplicate state changes so submit can be blocked. */
  onDuplicateChange?: (isDuplicate: boolean) => void;
  label?: string;
  required?: boolean;
  id?: string;
}

export default function SerialNumberField({
  value,
  onChange,
  excludeDroneId,
  onDuplicateChange,
  label = "Serial Number",
  required,
  id = "drone-serial",
}: SerialNumberFieldProps) {
  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setDuplicate(null);
      onDuplicateChange?.(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setChecking(false);
          return;
        }
        let query = supabase
          .from("drones")
          .select("id, name, serial_number")
          .eq("assigned_pilot_id", uid)
          .ilike("serial_number", trimmed);
        if (excludeDroneId) query = query.neq("id", excludeDroneId);
        const { data, error } = await query.limit(5);
        if (cancelled || error) {
          setChecking(false);
          return;
        }
        const norm = normalizeSerial(trimmed);
        const match = (data ?? []).find(
          (d) => normalizeSerial(d.serial_number ?? "") === norm,
        );
        if (match) {
          setDuplicate({ id: match.id, name: match.name });
          onDuplicateChange?.(true);
        } else {
          setDuplicate(null);
          onDuplicateChange?.(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value, excludeDroneId, onDuplicateChange]);

  const trimmed = value.trim();
  const showOk = trimmed.length > 0 && !checking && !duplicate;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 1ZNBJ1234567"
          className={cn(
            duplicate && "border-destructive focus-visible:ring-destructive",
            showOk && "border-green-600/60",
          )}
          maxLength={64}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {showOk && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {duplicate && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
      </div>
      {duplicate && (
        <p className="text-xs text-destructive flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            This serial is already assigned to <strong>{duplicate.name}</strong> in your fleet.
            Each drone needs a unique serial number.
          </span>
        </p>
      )}
      {!duplicate && (
        <p className="text-xs text-muted-foreground">
          Optional but recommended — helps track maintenance and warranty.
        </p>
      )}
    </div>
  );
}