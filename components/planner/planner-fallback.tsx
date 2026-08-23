function PlannerFallback() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:max-w-4xl">
      <div className="hero-glass overflow-hidden rounded-2xl border-border/70 shadow-[0_24px_80px_-40px_rgba(42,36,28,0.35)]">
        <div className="border-b border-border/60 bg-surface/30 px-5 py-5 sm:px-8 lg:px-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-full bg-surface-hover" />
              <div className="h-3 w-32 rounded-full bg-surface-hover/80" />
            </div>
            <div className="h-11 w-11 rounded-full bg-surface-hover" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-1.5 flex-1 rounded-full bg-surface-hover" />
            ))}
          </div>
        </div>
        <div className="space-y-6 px-5 py-8 sm:px-8 lg:px-10">
          <div className="flex gap-4">
            <div className="h-11 w-11 rounded-2xl bg-surface-hover" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 rounded-full bg-surface-hover" />
              <div className="h-8 w-2/3 rounded-lg bg-surface-hover" />
              <div className="h-4 w-1/2 rounded-lg bg-surface-hover/80" />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/35 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-20 rounded-xl bg-surface-hover" />
              <div className="h-20 rounded-xl bg-surface-hover" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PlannerFallback };
