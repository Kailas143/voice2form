import React from 'react';

export default function ProfileSection({ authUser }) {
  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <div className="flex items-center gap-6">
            <div className="avatar">
              <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {authUser?.avatar ? (
                  <img src={authUser.avatar} alt="Avatar" />
                ) : (
                  <span className="text-3xl font-bold bg-base-300 flex items-center justify-center h-full w-full">
                    {authUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold">{authUser?.name || 'Voice2Form User'}</h3>
              <p className="text-base-content/60">{authUser?.email}</p>
              <div className="mt-2 flex gap-2">
                <span className="badge badge-success badge-sm font-semibold uppercase tracking-wider">Active Account</span>
              </div>
            </div>
            <div className="ml-auto">
              <button className="btn btn-outline btn-sm">Edit Profile</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-base-content/60 mb-1">Full Name</label>
              <input type="text" className="input input-bordered w-full bg-base-200/50" defaultValue={authUser?.name} readOnly />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-base-content/60 mb-1">Email Address</label>
              <input type="email" className="input input-bordered w-full bg-base-200/50" defaultValue={authUser?.email} readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
