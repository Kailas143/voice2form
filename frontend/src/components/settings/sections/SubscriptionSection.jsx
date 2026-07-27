import React, { useState } from 'react';
import { simulateUpgradeApi, simulateDowngradeApi } from '../../../api';

const AVAILABLE_PLANS = [
  {
    name: 'Free',
    slug: 'free',
    price: '₹0',
    period: '/ month',
    description: 'Perfect for individuals and small tests.',
    features: [
      '50 form submissions / month', 
      'Up to 3 active forms', 
      'Basic AI extraction',
      'Single user workspace',
      'Community support'
    ]
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: '₹999',
    period: '/ month',
    annualPrice: 'or ₹9,999/year (Save 17%)',
    description: 'For teams replacing manual data entry.',
    isPopular: true,
    features: [
      '1,000 form submissions / month', 
      'Unlimited active forms', 
      'Advanced AI data extraction',
      'Team workspaces',
      'Google Sheets sync',
      'Priority support'
    ]
  }
];

export default function SubscriptionSection({ currentPlan, planUsage, sessionToken, fetchPlanData }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const currentSlug = currentPlan?.slug || 'free';

  const handleSimulateUpgrade = async (planSlug) => {
    setIsLoading(true);
    setError('');
    try {
      if (planSlug === 'free') {
        await simulateDowngradeApi(sessionToken);
      } else {
        await simulateUpgradeApi(sessionToken, planSlug);
      }
      await fetchPlanData();
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  const resetDateString = nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {error && <div className="alert alert-error">{error}</div>}
      
      {planUsage && (
        <div className="card bg-base-100 border border-base-200 shadow-sm mb-8">
          <div className="card-body p-6">
            <h3 className="font-bold text-lg mb-4">Current Usage</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-base-200/50 p-4 rounded-lg border border-base-300">
                <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Forms Submitted</span>
                <span className="font-bold text-lg text-base-content">
                  {planUsage.submissions} <span className="text-base-content/50 text-sm font-normal">/ {planUsage.submissions_limit === -1 ? '∞' : planUsage.submissions_limit}</span>
                </span>
              </div>
              <div className="bg-base-200/50 p-4 rounded-lg border border-base-300">
                <span className="block text-xs font-bold uppercase text-base-content/50 mb-1">Active Forms</span>
                <span className="font-bold text-lg text-base-content">
                  {planUsage.active_forms ?? 2} <span className="text-base-content/50 text-sm font-normal">/ {planUsage.active_forms_limit ?? 3}</span>
                </span>
              </div>
            </div>
            <p className="text-sm text-base-content/60">
              Usage resets on <strong>{resetDateString}</strong>
            </p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-bold text-lg mb-2">Available Plans</h3>
        <p className="text-sm text-base-content/60">Choose the plan that best fits your needs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {AVAILABLE_PLANS.map((plan) => {
          const isCurrent = currentSlug === plan.slug;
          
          return (
            <div 
              key={plan.slug} 
              className={`card bg-base-100 border ${
                isCurrent ? 'border-primary shadow-md relative' : 'border-base-200 shadow-sm'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 right-0 bg-primary text-primary-content text-xs font-bold uppercase py-1 px-3 rounded-bl-lg rounded-tr-lg z-10">
                  Current Plan
                </div>
              )}
              {plan.isPopular && !isCurrent && (
                <div className="absolute top-0 right-0 bg-warning text-warning-content text-xs font-bold uppercase py-1 px-3 rounded-bl-lg rounded-tr-lg z-10 flex items-center gap-1">
                  ⭐ MOST POPULAR
                </div>
              )}
              
              <div className="card-body p-6 relative">
                <h3 className="font-bold text-xl">{plan.name}</h3>
                <p className="text-base-content/60 text-sm mb-4 h-10">{plan.description}</p>
                
                <div className="mb-6 min-h-[4.5rem]">
                  <div className="flex items-end">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className="text-base-content/50 font-medium ml-1 pb-1">{plan.period}</span>
                  </div>
                  {plan.annualPrice && (
                    <div className="text-sm font-medium text-success mt-1">{plan.annualPrice}</div>
                  )}
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-success font-bold flex-shrink-0">✓</span>
                      <span className="text-base-content/80 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto">
                  {isCurrent ? (
                    <button className="btn btn-outline btn-block" disabled>
                      Active Plan
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSimulateUpgrade(plan.slug)}
                      disabled={isLoading}
                      className={`btn btn-block ${
                        plan.slug === 'professional' ? 'btn-primary' : 'btn-outline btn-error'
                      }`}
                    >
                      {isLoading ? 'Processing...' : (plan.slug === 'professional' ? 'Upgrade to Pro' : 'Downgrade to Free')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
