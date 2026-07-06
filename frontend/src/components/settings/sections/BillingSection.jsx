import React from 'react';

export default function BillingSection() {
  return (
    <div className="space-y-6">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg">Payment Method</h3>
              <p className="text-sm text-base-content/60">Update your billing details and address.</p>
            </div>
            <button className="btn btn-outline btn-sm">Add Payment Method</button>
          </div>
          
          <div className="bg-base-200/50 rounded-lg p-6 text-center border border-dashed border-base-300">
            <p className="text-base-content/60">No payment methods on file.</p>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-6">
          <h3 className="font-bold text-lg mb-2">Invoice History</h3>
          <p className="text-sm text-base-content/60 mb-6">View and download previous invoices.</p>
          
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="5" className="text-center py-4 text-base-content/60">No invoices yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
