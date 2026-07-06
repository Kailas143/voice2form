import React from 'react';

export default function ApiSettingsSection({ currentPlan }) {
  const isFree = currentPlan?.slug === 'free';

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg">API Keys</h3>
              <p className="text-sm text-base-content/60">Manage keys for programmatic access to Voice2Form.</p>
            </div>
            <button className="btn btn-primary btn-sm" disabled={isFree}>Generate New Key</button>
          </div>
          
          {isFree ? (
            <div className="bg-base-200/50 rounded-lg p-6 text-center border border-dashed border-base-300">
              <span className="text-3xl mb-2 block">🔒</span>
              <h4 className="font-bold mb-1">API Access Restricted</h4>
              <p className="text-sm text-base-content/60 mb-4">API access and Webhooks are only available on the Professional plan and above.</p>
              <button className="btn btn-outline btn-primary btn-sm">Upgrade Plan</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Key Prefix</th>
                    <th>Created</th>
                    <th>Last Used</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-base-content/60">No API keys generated yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-sm opacity-60">
        <div className="card-body p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg">Webhooks</h3>
              <p className="text-sm text-base-content/60">Send real-time data to your own servers.</p>
            </div>
            <button className="btn btn-outline btn-sm" disabled>Add Endpoint</button>
          </div>
          
          <div className="bg-base-200/30 rounded-lg p-4 text-center border border-base-200">
            <p className="text-xs text-base-content/50 font-medium">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
