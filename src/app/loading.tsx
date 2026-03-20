export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-36 bg-gray-100 rounded animate-pulse mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-3" />
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-white border border-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-32 border-2 border-dashed border-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
