export function Loading({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center items-center ${className ?? ""}`}>
      <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

export function SimpleLoading() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin" />
    </div>
  );
}
