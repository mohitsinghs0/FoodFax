import React from 'react';

interface GlobalLoadingSkeletonProps {
  isSyncing: boolean;
  isInitialLoad?: boolean;
}

export const GlobalLoadingSkeleton: React.FC<GlobalLoadingSkeletonProps> = ({ 
  isSyncing: _isSyncing, 
  isInitialLoad = false 
}) => {
  return (
    <>


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
