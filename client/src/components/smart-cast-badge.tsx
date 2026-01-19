import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface SmartCastBadgeProps {
  enabled?: boolean;
}

export function SmartCastBadge({ enabled = true }: SmartCastBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 px-2.5 py-1 text-xs font-medium border-primary/30 text-primary bg-primary/5"
      data-testid="badge-smart-cast"
    >
      <Sparkles className="h-3 w-3" />
      Smart Cast {enabled ? "On" : "Off"}
    </Badge>
  );
}
