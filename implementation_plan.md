# Profile & Account Management Page Implementation

This plan outlines the architecture and design for a production-ready Settings Hub for Voice2Form, inspired by best-in-class SaaS dashboards (Vercel, Linear, Stripe).

## Open Questions
> [!IMPORTANT]  
> 1. **Integration into `App.jsx`:** Currently, `App.jsx` handles state-based rendering (steps 1, 2, 3). I plan to add a boolean state `isSettingsOpen` (or `view="settings"`) that will render this new page over the main view. Are you comfortable with this approach, or are you planning to introduce a router (like `react-router-dom`) soon?
> 2. **Mock vs Real Data:** I will use the actual backend data where we have it (e.g., the `currentPlan`, `planUsage`, and `authUser` from our recent API additions) and use robust mock data (with standard loading/empty states) for the rest (Billing, API keys, etc.) so it's ready for backend integration later. Does that work for you?

## Proposed Architecture

We will implement a modular, component-based structure under `frontend/src/components/settings/`. The UI will be built using Tailwind CSS and DaisyUI, leveraging the existing project's dark/light mode architecture.

### Directory Structure

```text
frontend/src/components/settings/
├── SettingsPage.jsx         # Main shell, manages active tab state and responsive layout
├── SettingsSidebar.jsx      # Left navigation (Profile, Subscription, Usage, etc.)
└── sections/
    ├── ProfileSection.jsx      # Avatar, Name, Email, Account Status
    ├── SubscriptionSection.jsx # Current Plan, Billing Cycle, Upgrade/Downgrade flows
    ├── UsageSection.jsx        # Voice Minutes, API Requests, Storage limits
    ├── BillingSection.jsx      # Payment methods, Invoice history
    ├── SecuritySection.jsx     # Password, 2FA, Active Sessions
    ├── NotificationsSection.jsx# Email preferences, product updates
    ├── IntegrationsSection.jsx # Google, Microsoft, Slack connections
    ├── ApiSettingsSection.jsx  # API Keys, Webhooks
    └── PrivacySection.jsx      # Data export, Account deletion
```

## Proposed Changes

### [NEW] `frontend/src/components/settings/SettingsPage.jsx`
- Acts as the main container layout.
- Handles responsive design (hamburger menu on mobile, static sidebar on desktop).
- Maintains the `activeTab` state.

### [NEW] `frontend/src/components/settings/sections/*.jsx`
- Each file will be a self-contained component using Tailwind/DaisyUI cards (`card`, `card-body`).
- Standardized layouts: a header with title and description, a main content area with form fields or lists, and a footer with primary/secondary action buttons.

### [MODIFY] `frontend/src/App.jsx`
- Import the new `SettingsPage` component.
- Add state: `const [isSettingsOpen, setIsSettingsOpen] = useState(false);`
- Update the User Dropdown menu in the Header to include an "Account Settings" button.
- Conditionally render `<SettingsPage />` taking up the full screen when `isSettingsOpen` is true.

## Design System Considerations
- **Typography & Spacing:** Use `text-sm` for standard descriptions, `font-medium` for labels, and consistent `gap-4` / `gap-6` spacing inside cards.
- **Card Layout:** `bg-base-100 rounded-xl border border-base-200 shadow-sm` to mirror Vercel/Linear aesthetics.
- **Progress Bars:** For the `UsageSection`, we will use sleek `progress progress-primary` or custom Tailwind width transitions.
- **Status Indicators:** Use `badge badge-success badge-sm` for active states.

## Verification Plan

### Manual Verification
1. Open the app and open the user dropdown.
2. Click "Account Settings".
3. Verify the layout looks premium and matches Vercel/Linear aesthetics in both Light and Dark mode.
4. Click through all 9 tabs on the left sidebar to ensure state updates correctly and renders the appropriate sections.
5. Resize the browser to mobile width and verify the sidebar collapses into a responsive mobile menu or dropdown.
