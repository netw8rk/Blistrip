import { Loader2 } from "lucide-react";

function PlannerFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );
}

export { PlannerFallback };
