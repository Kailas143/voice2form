import React, { useState, useEffect } from 'react';
import { 
  fetchWorkspaces,
  fetchWorkspaceIntegrations, 
  addWorkspaceIntegration, 
  deleteWorkspaceIntegration,
  updateWorkspaceIntegration
} from '../../../api';

export default function IntegrationsSection({ sessionToken, activeWorkspaceId }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [isWorkspacesLoading, setIsWorkspacesLoading] = useState(true);

  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  
  // Form states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [targetSheetUrl, setTargetSheetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadIntegrations();
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      setIsWorkspacesLoading(true);
      const data = await fetchWorkspaces(sessionToken);
      const workspaceList = data.workspaces || [];
      setWorkspaces(workspaceList);
      if (workspaceList.length > 0) {
        if (activeWorkspaceId && workspaceList.some(w => w.id === activeWorkspaceId)) {
          setSelectedWorkspaceId(activeWorkspaceId);
        } else {
          setSelectedWorkspaceId(workspaceList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load workspaces", err);
    } finally {
      setIsWorkspacesLoading(false);
    }
  };

  const loadIntegrations = async () => {
    if (!selectedWorkspaceId) return;
    try {
      setIsLoading(true);
      const data = await fetchWorkspaceIntegrations(selectedWorkspaceId, sessionToken);
      setIntegrations(data);
    } catch (err) {
      setError('Failed to load integrations.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = (provider) => {
    if (provider.id === 'slack') {
      const clientId = import.meta.env.VITE_SLACK_CLIENT_ID || "dummy_slack_client_id"; 
      const redirectUri = window.location.origin; // Using the base URL as the redirect URI
      const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=incoming-webhook&redirect_uri=${encodeURIComponent(redirectUri)}&state=${selectedWorkspaceId}`;
      window.location.href = slackUrl;
      return;
    }

    setSelectedProvider(provider);
    setIsConfiguring(true);
    setWebhookUrl('');
    setTargetSheetUrl('');
    setError('');
  };

  const handleDisconnect = async (integrationId) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    
    try {
      await deleteWorkspaceIntegration(selectedWorkspaceId, integrationId, sessionToken);
      await loadIntegrations();
    } catch (err) {
      alert('Failed to disconnect.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const payload = {
        provider: selectedProvider.id,
        config: {},
        credentials: {}
      };
      
      if (selectedProvider.id === 'webhook') {
        payload.config.webhook_url = webhookUrl;
      }
      
      await addWorkspaceIntegration(selectedWorkspaceId, payload, sessionToken);
      await loadIntegrations();
      setIsConfiguring(false);
    } catch (err) {
      setError(err.message || 'Failed to connect integration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isWorkspacesLoading) {
    return <div className="text-center py-8"><span className="loading loading-spinner text-primary"></span></div>;
  }

  if (workspaces.length === 0) {
    return (
      <div className="text-center p-12 bg-base-200/50 rounded-xl border border-dashed border-base-300">
        <h3 className="font-bold text-lg mb-2">No Workspaces Found</h3>
        <p className="text-base-content/60">You need to create a workspace first before configuring integrations.</p>
      </div>
    );
  }

  if (isLoading && selectedWorkspaceId) {
    return <div className="text-center py-8"><span className="loading loading-spinner text-primary"></span></div>;
  }

  const availableProviders = [
    {
      id: 'webhook',
      name: 'Webhook',
      description: 'Send a POST request to a custom URL on every submission.',
      icon: '🔗',
      disabled: false
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notified in a channel for new submissions.',
      icon: '💬',
      disabled: false
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Create database items from submissions.',
      icon: '📓',
      disabled: true
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync leads to your CRM.',
      icon: '🎯',
      disabled: true
    }
  ];

  return (
    <div className="space-y-8">
      {/* Workspace Selector */}
      <div className="bg-base-200/50 p-4 rounded-xl border border-base-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold">Select Workspace</h3>
          <p className="text-sm text-base-content/60">Choose which workspace to configure integrations for.</p>
        </div>
        <select 
          className="select select-bordered w-full sm:max-w-xs"
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
        >
          {workspaces.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Connected Integrations */}
      <div>
        <h3 className="font-bold text-lg mb-4">Connected Integrations</h3>
        {integrations.length === 0 ? (
          <div className="bg-base-200/30 rounded-xl p-6 text-center border border-base-200">
            <p className="text-sm text-base-content/60">No integrations connected for this workspace.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map(integration => {
              const providerInfo = availableProviders.find(p => p.id === integration.provider) || { name: integration.provider, icon: '⚡' };
              return (
                <div key={integration.id} className="flex items-center justify-between p-4 bg-base-100 rounded-xl border border-base-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center text-xl">
                      {providerInfo.icon}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {providerInfo.name}
                        <span className="badge badge-success badge-xs">Connected</span>
                      </div>
                      <div className="text-xs text-base-content/60 mt-0.5 truncate max-w-xs">
                        {integration.config?.target_sheet_url || integration.config?.webhook_url || 'Active'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDisconnect(integration.id)}
                    className="btn btn-sm btn-ghost text-error"
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Integrations */}
      <div>
        <h3 className="font-bold text-lg mb-4">Available Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableProviders.filter(p => !integrations.some(i => i.provider === p.id)).map(provider => (
            <div key={provider.id} className={`flex flex-col p-5 bg-base-100 rounded-xl border border-base-200 shadow-sm ${provider.disabled ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center text-xl">
                  {provider.icon}
                </div>
                <h4 className="font-bold">{provider.name}</h4>
              </div>
              <p className="text-xs text-base-content/60 flex-1 mb-4">{provider.description}</p>
              <button 
                onClick={() => handleConnect(provider)}
                disabled={provider.disabled}
                className="btn btn-sm btn-outline w-full"
              >
                {provider.disabled ? 'Coming Soon' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Modal */}
      {isConfiguring && selectedProvider && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-base-100 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-base-200 flex justify-between items-center">
              <h3 className="font-bold text-lg">Connect {selectedProvider.name}</h3>
              <button onClick={() => setIsConfiguring(false)} className="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {error && <div className="alert alert-error text-sm py-2 mb-4">{error}</div>}
              
              {selectedProvider.id === 'webhook' && (
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Webhook URL</span></label>
                  <input 
                    type="url" 
                    required 
                    placeholder="https://your-api.com/webhook"
                    className="input input-bordered w-full"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <label className="label"><span className="label-text-alt text-base-content/60">We will send a POST request to this URL for every new submission.</span></label>
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsConfiguring(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : 'Connect Integration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
