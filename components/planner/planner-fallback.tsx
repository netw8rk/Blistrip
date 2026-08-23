function PlannerFallback() {
  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="hero-glass overflow-hidden">
        <div className="border-b border-border/70 px-5 py-5 sm:px-8 lg:px-10">
          <div className="mb-4 h-3 w-20 rounded-full bg-surface-hover" />
          <div className="flex gap-1.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-1 flex-1 rounded-full bg-surface-hover" />
            ))}
          </div>
        </div>
        <div className="space-y-4 px-5 py-8 sm:px-8 lg:px-10">
          <div className="h-8 w-2/3 rounded-lg bg-surface-hover" />
          <div className="h-4 w-1/2 rounded-lg bg-surface-hover" />
          <div className="h-12 rounded-xl bg-surface-hover" />
        </div>
      </div>
    </div>
  );
}

export { PlannerFallback };
