import React, { useState } from 'react';
import { simulateUpgradeApi, simulateDowngradeApi } from '../../../api';

export default function SubscriptionSection({ currentPlan, sessionToken, fetchPlanData }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isFree = currentPlan?.slug === 'free';
  const isPro = currentPlan?.slug === 'professional';

  const handleSimulateUpgrade = async () => {
    setIsLoading(true);
    setError('');
    try {
      await simulateUpgradeApi(sessionToken, 'professional');
      await fetchPlanData();
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  const handleSimulateDowngrade = async () => {
    setIsLoading(true);
    setError('');
    try {
      await simulateDowngradeApi(sessionToken);
      await fetchPlanData();
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {error && <div className="alert alert-error">{error}</div>}
      
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-lg">Current Plan</h3>
              <p className="text-base-content/60 text-sm">You are currently on the {currentPlan?.name || 'Free'} plan.</p>
            </div>
            <div className="badge badge-primary font-bold uppercase tracking-wider">{currentPlan?.name || 'Free'}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-base-200/50 rounded-lg border border-base-300">
            <div>
              <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Billing Cycle</span>
              <span className="font-medium text-base-content">Monthly</span>
            </div>
            <div>
              <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Price</span>
              <span className="font-medium text-base-content">${currentPlan?.price || 0} / month</span>
            </div>
            <div>
              <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Renewal Date</span>
              <span className="font-medium text-base-content">Auto-renews next month</span>
            </div>
            <div>
              <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Status</span>
              <span className="badge badge-success badge-sm">Active</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isFree && (
              <button 
                onClick={handleSimulateUpgrade} 
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? 'Upgrading...' : 'Upgrade to Professional'}
              </button>
            )}
            {isPro && (
              <button 
                onClick={handleSimulateDowngrade}
                disabled={isLoading}
                className="btn btn-outline btn-error"
              >
                {isLoading ? 'Downgrading...' : 'Downgrade to Free'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
