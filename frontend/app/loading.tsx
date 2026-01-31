export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center">
        {/* Spinner */}
        <div className="inline-flex items-center justify-center mb-4">
          <div className="w-12 h-12 border-4 border-border-subtle border-t-white rounded-full animate-spin" />
        </div>

        {/* Loading Text */}
        <p className="text-sm text-muted-foreground uppercase tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
}
