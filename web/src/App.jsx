import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './components/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Welcome from './pages/auth/Welcome.jsx';
import RoleSelect from './pages/auth/RoleSelect.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import Forgot from './pages/auth/Forgot.jsx';
import Legal from './pages/Legal.jsx';

const pages = {
  Dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  Properties: lazy(() => import('./pages/Properties.jsx')),
  Rooms: lazy(() => import('./pages/Rooms.jsx')),
  Tenants: lazy(() => import('./pages/Tenants.jsx')),
  Kyc: lazy(() => import('./pages/Kyc.jsx')),
  Rent: lazy(() => import('./pages/Rent.jsx')),
  Expenses: lazy(() => import('./pages/Expenses.jsx')),
  FoodMenu: lazy(() => import('./pages/FoodMenu.jsx')),
  Facilities: lazy(() => import('./pages/Facilities.jsx')),
  Reminders: lazy(() => import('./pages/Reminders.jsx')),
  Vacate: lazy(() => import('./pages/Vacate.jsx')),
  Visits: lazy(() => import('./pages/Visits.jsx')),
  Concerns: lazy(() => import('./pages/Concerns.jsx')),
  Reports: lazy(() => import('./pages/Reports.jsx')),
  Messages: lazy(() => import('./pages/Messages.jsx')),
  Settings: lazy(() => import('./pages/Settings.jsx')),
};

const Loader = () => <div className="flex h-64 items-center justify-center text-brand-600"><Spinner className="h-7 w-7" /></div>;

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-brand-600"><Spinner className="h-8 w-8" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'owner') return <Navigate to="/" replace />;
  return children;
}
function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === 'owner') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<Public><Welcome /></Public>} />
        <Route path="/role" element={<Public><RoleSelect /></Public>} />
        <Route path="/login" element={<Public><Login /></Public>} />
        <Route path="/signup" element={<Public><Signup /></Public>} />
        <Route path="/forgot" element={<Public><Forgot /></Public>} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/refund-policy" element={<Legal kind="refund" />} />
        <Route path="/contact" element={<Legal kind="contact" />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/dashboard" element={<pages.Dashboard />} />
          <Route path="/properties" element={<pages.Properties />} />
          <Route path="/rooms" element={<pages.Rooms />} />
          <Route path="/tenants" element={<pages.Tenants />} />
          <Route path="/kyc" element={<pages.Kyc />} />
          <Route path="/rent" element={<pages.Rent />} />
          <Route path="/expenses" element={<pages.Expenses />} />
          <Route path="/food-menu" element={<pages.FoodMenu />} />
          <Route path="/facilities" element={<pages.Facilities />} />
          <Route path="/reminders" element={<pages.Reminders />} />
          <Route path="/vacate" element={<pages.Vacate />} />
          <Route path="/visits" element={<pages.Visits />} />
          <Route path="/concerns" element={<pages.Concerns />} />
          <Route path="/reports" element={<pages.Reports />} />
          <Route path="/messages" element={<pages.Messages />} />
          <Route path="/settings" element={<pages.Settings />} />
        </Route>
        <Route path="*" element={<div className="flex h-screen flex-col items-center justify-center gap-3"><h1 className="text-2xl font-semibold">Page not found</h1><Link className="text-brand-600 underline" to="/">Go home</Link></div>} />
      </Routes>
    </Suspense>
  );
}
