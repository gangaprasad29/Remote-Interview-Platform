import { useUser } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ProblemsPage from "./pages/ProblemsPage";

function App() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;

  return (
    <Routes>
      {/* Public Home */}
      <Route path="/" element={<HomePage />} />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={isSignedIn ? <DashboardPage /> : <Navigate to="/" />}
      />

      {/* Protected Problems */}
      <Route
        path="/problems"
        element={isSignedIn ? <ProblemsPage /> : <Navigate to="/" />}
      />
    </Routes>
  );
}

export default App;
