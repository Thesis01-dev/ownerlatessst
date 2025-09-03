import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Car,
  Users,
  MessageCircle,
  BarChart3,
  Mail,
  LogOut
} from "lucide-react";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";

const SidebarOwner = ({ user, onLogout }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { label: "Dashboard", icon: <LayoutDashboard size={20} />, to: "/" },
    { label: "Bookings", icon: <ClipboardList size={20} />, to: "/bookings" },
    { label: "Vehicles", icon: <Car size={20} />, to: "/units" },
    { label: "Clients", icon: <Users size={20} />, to: "/clients" },
    { label: "Feedbacks", icon: <MessageCircle size={20} />, to: "/feedbacks" },
    { label: "Rental Reports", icon: <BarChart3 size={20} />, to: "/report" },
  ];

  const handleNavigation = (path) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const handleContactSupport = () => {
    Swal.fire({
      title: 'Contact Support',
      html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 15px; color: #374151;">Need help with the Car Rental System?</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 0; color: #1f2937; font-weight: 600;">Support Email:</p>
            <p style="margin: 5px 0 0 0; color: #2563eb; font-family: monospace;">thesiscarrental@gmail.com</p>
          </div>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Click "Open Gmail" to compose an email directly in Gmail.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Open Gmail',
      cancelButtonText: 'Close',
      customClass: {
        popup: 'contact-support-popup'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const subject = "Car Rental System - Support Request";
        const body = "Hello,\n\nI need assistance with the Car Rental System.\n\nDetails:\n\n\nThank you.";
        
        // Gmail compose URL
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=thesiscarrental@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
        
        // Show success message
        Swal.fire({
          title: 'Gmail Opened!',
          text: 'Gmail should now be open in a new tab with your message ready to send.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          timer: 3000,
          timerProgressBar: true
        });
      }
    });
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    setShowLogoutModal(false);
    
    // Add a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Confirm Logout
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center min-w-[80px]"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ClipLoader color="#ffffff" size={18} />
                ) : (
                  "Log Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Loading Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <ClipLoader color="#ffffff" size={50} className="mb-4" />
            <p className="text-xl">Logging out...</p>
          </div>
        </div>
      )}

      <div className="h-screen flex">
        {/* Sidebar */}
        <div className="w-[260px] bg-[#111827] text-white flex flex-col">
          
          {/* Logo */}
          <div className="flex items-center p-4">
            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              <img 
                src="logo.png" 
                alt="Car Rental Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="ml-2 text-lg font-semibold whitespace-nowrap">
              Car Rental System
            </span>
          </div>

          {/* Scrollable Menu */}
          <nav className="flex-1 mt-2 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <div
                  key={item.label}
                  onClick={() => handleNavigation(item.to)}
                  className={`flex items-center gap-3 px-4 py-2 mx-2 my-1 rounded-md cursor-pointer transition-all duration-200 ${
                    isActive
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <div className="text-xl">{item.icon}</div>
                  <span className="text-sm font-medium">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </nav>

          {/* Contact Support */}
          <div
            onClick={handleContactSupport}
            className="flex items-center gap-3 px-4 py-3 mx-2 mb-2 rounded-md cursor-pointer transition-all duration-200 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Mail size={20} />
            <span className="text-sm font-medium">Contact Support</span>
          </div>

          {/* Logout */}
          <div
            onClick={handleLogoutClick}
            className="flex items-center gap-3 px-4 py-3 mx-2 mb-4 rounded-md cursor-pointer transition-all duration-200 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Log Out</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SidebarOwner;