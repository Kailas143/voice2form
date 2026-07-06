import React from 'react';

export default function IntegrationsSection() {
  const integrations = [
    {
      id: 'google',
      name: 'Google Workspace',
      description: 'Sync forms directly to Google Sheets and use SSO.',
      connected: true,
      icon: 'G'
    },
    {
      id: 'microsoft',
      name: 'Microsoft 365',
      description: 'Connect with Teams and Excel (Coming soon).',
      connected: false,
      icon: 'M',
      disabled: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Receive notifications for new submissions.',
      connected: false,
      icon: 'S',
      disabled: true
    }
  ];

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-6">Connected Accounts</h3>
          
          <div className="space-y-4">
            {integrations.map(integration => (
              <div key={integration.id} className={`flex items-center justify-between p-4 bg-base-200/30 rounded-xl border border-base-200 ${integration.disabled ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center font-bold text-lg">
                    {integration.icon}
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      {integration.name}
                      {integration.connected && <span className="badge badge-success badge-xs">Connected</span>}
                    </div>
                    <div className="text-xs text-base-content/60 mt-0.5">{integration.description}</div>
                  </div>
                </div>
                <button 
                  className={`btn btn-sm ${integration.connected ? 'btn-outline btn-error' : 'btn-outline'}`}
                  disabled={integration.disabled}
                >
                  {integration.disabled ? 'Coming Soon' : (integration.connected ? 'Disconnect' : 'Connect')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
