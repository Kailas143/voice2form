import React, { useState, useEffect } from 'react';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../../../api';

export default function NotificationsSection({ sessionToken }) {
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!sessionToken) return;
    setIsLoading(true);
    fetchNotificationPreferences(sessionToken)
      .then(res => {
        setPreferences(res);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [sessionToken]);

  const handleChange = (field) => {
    setPreferences(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateNotificationPreferences(sessionToken, preferences);
      setSuccess('Preferences updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className="p-8 text-center text-base-content/60">Loading preferences...</div>;
  if (!preferences) return <div className="p-8 text-center text-error">Failed to load preferences.</div>;

  const sections = [
    {
      id: 'product_updates',
      title: 'Product Updates',
      description: 'Receive news about new features, integrations, and improvements.'
    },
    {
      id: 'subscription_billing',
      title: 'Subscription & Billing',
      description: 'Alerts about upcoming renewals, failed payments, and quota limits.'
    },
    {
      id: 'security_alerts',
      title: 'Security Alerts',
      description: 'Notifications about new sign-ins from unrecognized devices.'
    },
    {
      id: 'marketing',
      title: 'Marketing Communications',
      description: 'Tips, webinars, and promotional offers.'
    }
  ];

  return (
    <div className="space-y-6">
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {success && <div className="alert alert-success text-sm">{success}</div>}

      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <div className="flex justify-between items-end mb-6">
            <h3 className="font-bold text-lg">Notification Channels</h3>
            <div className="flex gap-12 mr-6">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">In-App</span>
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">Email</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {sections.map(section => (
              <div key={section.id} className="flex items-center justify-between p-3 hover:bg-base-200/50 rounded-lg transition-colors border border-transparent hover:border-base-200">
                <div className="max-w-sm">
                  <span className="block font-bold text-sm">{section.title}</span>
                  <span className="block text-xs text-base-content/60 mt-0.5">{section.description}</span>
                </div>
                <div className="flex gap-10 mr-4">
                  <label className="cursor-pointer flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm" 
                      checked={preferences[`inapp_${section.id}`]}
                      onChange={() => handleChange(`inapp_${section.id}`)}
                      disabled={section.id === 'security_alerts'} // Prevent disabling all security
                    />
                  </label>
                  <label className="cursor-pointer flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm" 
                      checked={preferences[`email_${section.id}`]}
                      onChange={() => handleChange(`email_${section.id}`)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 border-t border-base-200 pt-6">
            <button 
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
            <span className="text-xs text-base-content/50 ml-4 hidden md:inline-block">In-app security alerts cannot be disabled.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
