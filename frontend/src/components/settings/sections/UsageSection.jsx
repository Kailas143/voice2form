import React from 'react';

export default function UsageSection({ planUsage, currentPlan }) {
  if (!planUsage) return <div className="text-center p-8 text-base-content/60">Loading usage data...</div>;

  const renderProgressBar = (used, limit) => {
    if (limit === -1) {
      return (
        <div className="w-full bg-base-200 rounded-full h-2.5 mt-2 overflow-hidden">
          <div className="bg-success h-2.5 rounded-full w-full opacity-50"></div>
        </div>
      );
    }
    
    const percent = Math.min(100, (used / limit) * 100);
    let colorClass = 'bg-primary';
    if (percent > 90) colorClass = 'bg-error';
    else if (percent > 75) colorClass = 'bg-warning';

    return (
      <div className="w-full bg-base-200 rounded-full h-2.5 mt-2 overflow-hidden">
        <div className={`${colorClass} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
      </div>
    );
  };

  const getPercentString = (used, limit) => {
    if (limit === -1) return 'Unlimited';
    return `${Math.round((used / limit) * 100)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-2">Usage limits for this month</h3>
          <p className="text-sm text-base-content/60 mb-6">
            Your usage resets at the beginning of every billing cycle. You are on the <strong>{currentPlan?.name}</strong> plan.
          </p>

          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-end mb-1">
                <div>
                  <h4 className="font-bold text-base-content">Form Submissions</h4>
                  <span className="text-xs text-base-content/50">Successful spreadsheet extractions</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{planUsage.submissions}</span>
                  <span className="text-base-content/50 text-sm"> / {planUsage.submissions_limit === -1 ? '∞' : planUsage.submissions_limit}</span>
                </div>
              </div>
              {renderProgressBar(planUsage.submissions, planUsage.submissions_limit)}
              <div className="text-xs font-semibold text-right mt-1 text-base-content/40">
                {getPercentString(planUsage.submissions, planUsage.submissions_limit)} used
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <div>
                  <h4 className="font-bold text-base-content">Audio Minutes</h4>
                  <span className="text-xs text-base-content/50">Total length of processed audio</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{planUsage.audio_minutes}</span>
                  <span className="text-base-content/50 text-sm"> / {planUsage.audio_minutes_limit === -1 ? '∞' : planUsage.audio_minutes_limit}</span>
                </div>
              </div>
              {renderProgressBar(planUsage.audio_minutes, planUsage.audio_minutes_limit)}
              <div className="text-xs font-semibold text-right mt-1 text-base-content/40">
                {getPercentString(planUsage.audio_minutes, planUsage.audio_minutes_limit)} used
              </div>
            </div>

            <div className="opacity-50">
              <div className="flex justify-between items-end mb-1">
                <div>
                  <h4 className="font-bold text-base-content">Team Members</h4>
                  <span className="text-xs text-base-content/50">Seats in your workspace</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">1</span>
                  <span className="text-base-content/50 text-sm"> / 1</span>
                </div>
              </div>
              <div className="w-full bg-base-200 rounded-full h-2.5 mt-2 overflow-hidden">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
              <div className="text-xs font-semibold text-right mt-1 text-base-content/40">
                100% used
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
