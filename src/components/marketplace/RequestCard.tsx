import { Link } from "react-router-dom";
import { MapPin, Calendar, Briefcase } from "lucide-react";
import { ServiceRequest, VERTICAL_LABELS, formatBudget } from "@/lib/marketplace";

export default function RequestCard({ request }: { request: ServiceRequest }) {
  return (
    <Link
      to={`/marketplace/${request.id}`}
      className="block p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-display font-600 text-foreground line-clamp-2 flex-1">
          {request.title}
        </h3>
        <span className="text-xs font-bold text-primary whitespace-nowrap">
          {formatBudget(request.budget_cents)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3">
        <span className="inline-flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          {VERTICAL_LABELS[request.vertical]}
        </span>
        {request.location_label && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {request.location_label}
          </span>
        )}
        {request.deadline && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Due {new Date(request.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      {request.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {request.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {request.deliverables.slice(0, 4).map((d) => (
          <span key={d} className="px-2 py-0.5 rounded-full bg-secondary text-xs text-foreground">
            {d}
          </span>
        ))}
      </div>
    </Link>
  );
}