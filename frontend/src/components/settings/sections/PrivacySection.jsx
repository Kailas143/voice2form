import React from 'react';

export default function PrivacySection() {
  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-2">Export Data</h3>
          <p className="text-sm text-base-content/60 mb-6">Download a copy of your personal data, form templates, and submission history.</p>
          
          <button className="btn btn-outline max-w-xs">Request Data Export</button>
        </div>
      </div>

      <div className="card bg-error/5 border border-error/20 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg text-error mb-2">Danger Zone</h3>
          <p className="text-sm text-base-content/60 mb-6">Permanently delete your account and all associated data. This action cannot be undone.</p>
          
          <div className="p-4 bg-base-100 rounded-lg border border-error/20 mb-4">
            <h4 className="font-bold text-sm mb-1">Are you absolutely sure?</h4>
            <p className="text-xs text-base-content/60">
              Deleting your account will remove your access to all workspaces, delete all your custom templates, and cancel your active subscription immediately.
            </p>
          </div>

          <button className="btn btn-error max-w-xs text-white">Delete Account</button>
        </div>
      </div>
    </div>
  );
}
