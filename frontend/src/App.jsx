import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import SignIn from "./pages/SignIn.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import Attendance from "./pages/Attendance.jsx";
import Packages from "./pages/Packages.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";

/** Protected routes: unauthenticated visitors are sent to /signin. */
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Loading session…
        </p>
      </div>
    );
  }
  return user ? <AppShell /> : <Navigate to="/signin" replace />;
}

/** Signed-in owners skip the sign-in screen. */
function SignInRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <SignIn />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/signin" element={<SignInRoute />} />
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}