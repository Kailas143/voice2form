import React from 'react';

export default function SettingsSidebar({ tabs, activeTab, onChangeTab }) {
  return (
    <aside className="w-64 flex-none overflow-y-auto border-r border-base-200 bg-base-100 hidden md:block">
      <nav className="p-4 space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              activeTab === tab.id 
                ? 'bg-primary/10 text-primary' 
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
