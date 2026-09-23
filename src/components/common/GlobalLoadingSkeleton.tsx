import React from 'react';

interface GlobalLoadingSkeletonProps {
  isSyncing: boolean;
  isInitialLoad?: boolean;
}

export const GlobalLoadingSkeleton: React.FC<GlobalLoadingSkeletonProps> = ({ 
  isSyncing, 
  isInitialLoad = false 
}) => {
  return (
    <>
      {/* Top Floating Cloud Sync Pulse Indicator */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pointer-events-none ${
          isSyncing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
        }`}
      >
        <div className="h-1 w-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 animate-pulse" />
        <div className="bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-semibold py-1 px-3 w-fit mx-auto rounded-b-lg shadow-md border-x border-b border-white/10 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>
          <span>Syncing with Cloud Firestore...</span>
        </div>
      </div>

      {/* Full Page Initial Skeletons if loading cold */}
      {isInitialLoad && (
        <div 
          id="global-initial-skeleton"
          className="fixed inset-0 z-40 bg-slate-50/80 backdrop-blur-[2px] p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pointer-events-none animate-in fade-in duration-200"
        >
          {/* Header Skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-pulse" />
              <div className="space-y-2">
                <div className="w-28 h-4 rounded bg-slate-200 animate-pulse" />
                <div className="w-20 h-3 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
            <div className="w-24 h-8 rounded-xl bg-slate-200 animate-pulse" />
          </div>

          {/* Banner Skeleton */}
          <div className="w-full h-40 sm:h-52 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />

          {/* Categories Row Skeleton */}
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="w-24 h-9 rounded-xl bg-slate-200 animate-pulse flex-shrink-0" />
            ))}
          </div>

          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                <div className="h-32 rounded-xl bg-slate-200 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-slate-200 animate-pulse" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-6 w-16 rounded bg-slate-200 animate-pulse" />
                  <div className="h-8 w-20 rounded-xl bg-slate-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
