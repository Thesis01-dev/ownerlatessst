import React, { useState, useEffect } from "react";
import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./scenes/dashboard";
import Bookings from "./scenes/bookings";
import Units from "./scenes/units";
import Clients from "./scenes/clients";
import Feedbacks from "./scenes/feedbacks/indes.jsx";
import Messages from "./scenes/messages";
import Notifications from "./components/notification";
import Report from "./scenes/report";
import Profile from "./components/profile/index.jsx";
import Details from "./components/udetails/index.jsx";
import Login from "./scenes/login/index.jsx";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login auth={auth} />} />

      {/* Protected Routes */}
      {user ? (
        <Route
          path="/*"
          element={
            <div className="h-screen overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/bookings" element={<Bookings db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/units" element={<Units db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/clients" element={<Clients db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/feedbacks" element={<Feedbacks db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/messages" element={<Messages db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/notifications" element={<Notifications db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/report" element={<Report db={db} user={user} onLogout={handleLogout} />} />
                <Route path="/profile" element={<Profile db={db} user={user} auth={auth} onLogout={handleLogout} />} />
                <Route path="/details/:unitId" element={<Details db={db} user={user} onLogout={handleLogout} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          }
        />
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

export default App;
