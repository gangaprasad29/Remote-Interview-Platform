import { useUser } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ProblemsPage from "./pages/ProblemsPage";

function App() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null; // wait for Clerk

  return (
    <Routes>
      {/* Home */}
      <Route
        path="/"
        element={isSignedIn ? <Navigate to="/dashboard" /> : <HomePage />}
      />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={isSignedIn ? <DashboardPage /> : <Navigate to="/" />}
      />

      {/* Problems (protected) */}
      <Route
        path="/problems"
        element={isSignedIn ? <ProblemsPage /> : <Navigate to="/" />}
      />
    </Routes>
  );
}

export default App;
