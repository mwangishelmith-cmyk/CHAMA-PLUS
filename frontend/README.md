# Green Haven Dashboard

Act as a front-end architect and implement a complete, responsive authentication and dashboard UI with dark/light mode (green as the primary color for both themes). Build a working login/register flow with JWT handling (storage, refresh, and protected routes), a reusable layout (Header with user menu, Sidebar with navigation, Footer), and common components (Button, Input, Card, Table, Modal, LoadingSpinner, StatusBadge, EmptyState, Toast). Use the given project structure and ensure API interaction via axios instance with interceptors. Deliver fully functional pages: auth (LoginPage.jsx, RegisterPage.jsx), dashboard (DashboardPage.jsx) and all required components and contexts. Include loading states, error handling, and test scenarios: user can register, user can login, redirect behavior after login, protected routes redirect to login, session persistence after refresh. Ensure dark/light mode toggle persists across reloads, and colors stay green-oriented in both themes. Provide clearly commented code, proper prop types, accessible UX, and responsive design. Output: a single, cohesive codebase diff or patch snippets for each relevant file, plus a brief integration guide and testing steps.
Ensure to test you have achieved the below tasks and deliverables :{Phase 2: API Client & Authentication (Week 2)
TASKS
Create api/client.js with Axios instance and interceptors
□
Create api/auth.js with auth API calls
□
Create context/AuthContext.jsx with auth state management
□
Create hooks/useAuth.js
□
Create components/auth/Login.jsx and LoginPage.jsx
□
Create components/auth/Register.jsx and RegisterPage.jsx
□
Create components/layout/ProtectedRoute.jsx
□
Create components/common/Button.jsx, Input.jsx, Card.jsx
□
Add loading states and error handling
Deliverables:
Working login/register flow
JWT token storage and refresh
Protected routes
Test Scenarios:
User can register successfully
User can login with valid credentials
User is redirected to dashboard after login
User is redirected to login when accessing protected route
Session persists after page refresh
Tasks:
□
Create components/layout/Layout.jsx
□
Create components/layout/Header.jsx with user menu
□
Create components/layout/Sidebar.jsx with navigation items
□
Create components/layout/Footer.jsx
□
Create components/common/Table.jsx, Modal.jsx, LoadingSpinner.jsx
□
Create components/common/StatusBadge.jsx, EmptyState.jsx
□
Create components/common/Toast.jsx notification system
□
Create pages/dashboard/DashboardPage.jsx
Deliverables:
Complete layout with navigation
Reusable common components
Dashboard page skeleton}

below is my frontend recommended structure
"frontend/
├── src/
│   ├── api/
│   │   ├── client.js        # Axios instance
│   │   ├── auth.js          # Auth API calls
│   │   ├── chama.js         # Chama API calls
│   │   └── ledger.js        # Ledger API calls
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── chama/
│   │   │   ├── ChamaList.jsx
│   │   │   ├── ChamaDetail.jsx
│   │   │   └── CreateChama.jsx
│   │   ├── ledger/
│   │   │   ├── LedgerEntry.jsx
│   │   │   ├── ContributionForm.jsx
│   │   │   └── DebtSummary.jsx
│   │   ├── common/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   └── layout/
│   │       ├── Layout.jsx
│   │       └── ProtectedRoute.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx
│   │   ├── chama/
│   │   │   ├── ChamasPage.jsx
│   │   │   └── ChamaDetailPage.jsx
│   │   └── ledger/
│   │       └── LedgerPage.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useChama.js
│   ├── utils/
│   │   └── helpers.js
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js"

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2421bdfb-d433-4300-96e2-7d2f1e16acdb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
