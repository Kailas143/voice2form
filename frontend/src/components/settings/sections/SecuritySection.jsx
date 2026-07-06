import React from 'react';

export default function SecuritySection() {
  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-4">Change Password</h3>
          <form className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold uppercase text-base-content/60 mb-1">Current Password</label>
              <input type="password" className="input input-bordered w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-base-content/60 mb-1">New Password</label>
              <input type="password" className="input input-bordered w-full" />
            </div>
            <button className="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>

    </div>
  );
}
