export function SignalsSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-slate-200" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
              </div>
              <div className="mt-2 h-8 w-64 bg-slate-100 rounded" />
              <div className="mt-2 h-4 w-80 bg-slate-50 rounded" />
            </div>
            <div className="h-9 w-24 bg-slate-100 rounded-xl" />
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="h-5 w-32 bg-slate-100 rounded" />
              <div className="mt-0.5 h-3 w-48 bg-slate-50 rounded" />
            </div>
            <div className="h-4 w-16 bg-slate-50 rounded" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 bg-slate-100 rounded" />
                  <div className="h-4 w-24 bg-slate-100 rounded" />
                  <div className="h-4 w-20 bg-slate-50 rounded" />
                </div>
                <div className="mt-2 h-5 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-5 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-slate-50 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-8 w-8 bg-slate-100 rounded" />
                <div className="mt-1 h-4 w-20 bg-slate-100 rounded" />
                <div className="mt-0.5 h-3 w-16 bg-slate-50 rounded" />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-5 w-40 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-slate-50 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse h-8 w-24 bg-slate-100 rounded-full" />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-slate-200" />
              <div className="h-5 w-48 bg-slate-100 rounded" />
            </div>
            <div className="flex items-center gap-1">
              <div className="h-4 w-12 bg-slate-100 rounded" />
              <div className="h-4 w-4 bg-slate-200 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-12 bg-slate-100 rounded" />
                      <div className="h-4 w-20 bg-slate-100 rounded" />
                      <div className="h-4 w-20 bg-slate-50 rounded" />
                    </div>
                    <div className="mt-1.5 h-5 w-full bg-slate-100 rounded" />
                    <div className="mt-1 h-4 w-3/4 bg-slate-50 rounded" />
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-3 w-16 bg-slate-50 rounded" />
                      <div className="h-3 w-24 bg-slate-50 rounded" />
                      <div className="h-3 w-12 bg-slate-50 rounded" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-8 bg-slate-50 rounded" />
                    <div className="h-3 w-10 bg-slate-50 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}