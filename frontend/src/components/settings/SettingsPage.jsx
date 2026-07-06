import React, { useState } from 'react';
import SettingsSidebar from './SettingsSidebar';
import ProfileSection from './sections/ProfileSection';
import SubscriptionSection from './sections/SubscriptionSection';
import UsageSection from './sections/UsageSection';
import BillingSection from './sections/BillingSection';
import SecuritySection from './sections/SecuritySection';
import NotificationsSection from './sections/NotificationsSection';
import IntegrationsSection from './sections/IntegrationsSection';
import ApiSettingsSection from './sections/ApiSettingsSection';
import PrivacySection from './sections/PrivacySection';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'usage', label: 'Usage & Limits' },
  { id: 'billing', label: 'Billing' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'api', label: 'API Settings' },
  { id: 'privacy', label: 'Data & Privacy' }
];

export default function SettingsPage({ 
  onClose, 
  authUser, 
  currentPlan, 
  planUsage, 
  sessionToken,
  fetchPlanData
}) {
  const [activeTab, setActiveTab] = useState('profile');

  const renderSection = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection authUser={authUser} />;
      case 'subscription':
        return (
          <SubscriptionSection 
            currentPlan={currentPlan} 
            sessionToken={sessionToken} 
            fetchPlanData={fetchPlanData} 
          />
        );
      case 'usage':
        return <UsageSection planUsage={planUsage} currentPlan={currentPlan} />;
      case 'billing':
        return <BillingSection />;
      case 'security':
        return <SecuritySection />;
      case 'notifications':
        return <NotificationsSection sessionToken={sessionToken} />;
      case 'integrations':
        return <IntegrationsSection />;
      case 'api':
        return <ApiSettingsSection currentPlan={currentPlan} />;
      case 'privacy':
        return <PrivacySection />;
      default:
        return <ProfileSection authUser={authUser} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-base-100 overflow-hidden animate-fade-in">
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="text-xl font-bold">Account Settings</h1>
        </div>
        <div className="text-sm text-base-content/60 font-medium">
          {authUser?.email}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <SettingsSidebar 
          tabs={TABS} 
          activeTab={activeTab} 
          onChangeTab={setActiveTab} 
        />
        
        <main className="flex-1 overflow-y-auto bg-base-200/30">
          <div className="max-w-4xl mx-auto py-8 px-6 pb-24">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-base-content">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-base-content/60 mt-1">
                Manage your {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} preferences and configurations.
              </p>
            </div>
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}
