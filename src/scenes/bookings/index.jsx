import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase"; 
import {
  CheckCircle2, XCircle, MessageSquare, Calendar, Car,
  DollarSign, Mail, Bell, FileText, Clock, AlertTriangle, MapPin,
  CalendarDays, Filter, X
} from "lucide-react";
import { 
  collection, query, where, getDocs, doc, updateDoc,
  onSnapshot, getDoc, Timestamp 
} from "firebase/firestore";
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); 
  
  // Date filter states
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [activeDateFilter, setActiveDateFilter] = useState(null);

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  // Status configuration
  const statusConfig = {
    Pending: { bgColor: "bg-amber-50", textColor: "text-amber-600", dotColor: "bg-amber-500" },
    Accepted: { bgColor: "bg-blue-50", textColor: "text-blue-600", dotColor: "bg-blue-500" },
    Cancelled: { bgColor: "bg-red-50", textColor: "text-red-600", dotColor: "bg-red-500" },
    Completed: { bgColor: "bg-emerald-50", textColor: "text-emerald-600", dotColor: "bg-emerald-500" },
    Overdue: { bgColor: "bg-red-50", textColor: "text-red-600", dotColor: "bg-red-500" }
  };

  // Action buttons configuration
  const actionButtons = [
    {
      action: "Accepted",
      enabledWhen: "Pending",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Accept",
      style: "bg-blue-50 text-blue-600 hover:bg-blue-100"
    },
    {
      action: "Cancelled",
      enabledWhen: "Pending",
      icon: <XCircle className="w-4 h-4" />,
      label: "Cancel",
      style: "bg-red-50 text-red-600 hover:bg-red-100"
    },
    {
      action: "Completed",
      enabledWhen: ["Accepted", "Overdue"],
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Complete",
      style: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
    },
    {
      action: "message",
      alwaysEnabled: true,
      icon: <MessageSquare className="w-4 h-4" />,
      label: "Message",
      style: "bg-blue-50 text-blue-600 hover:bg-blue-100"
    },
    {
      action: "details",
      alwaysEnabled: true,
      icon: <FileText className="w-4 h-4" />,
      label: "Details",
      style: "bg-purple-50 text-purple-600 hover:bg-purple-100"
    }
  ];

  // Combined helper functions
  const helpers = {
    logout: async () => {
      try {
        await auth.signOut();
        navigate("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    },
    
    formatDate: (dateString) => {
      if (!dateString) return "N/A";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (error) {
        console.error("Error formatting date:", error);
        return "Invalid Date";
      }
    },
    
    formatTime: (dateString) => {
      if (!dateString) return "N/A";
      try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit'
        });
      } catch (error) {
        console.error("Error formatting time:", error);
        return "Invalid Time";
      }
    },
    
    formatDateTime: (dateString) => {
      if (!dateString) return "N/A";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch (error) {
        console.error("Error formatting date and time:", error);
        return "Invalid Date/Time";
      }
    },
    
    sortBookings: (bookingsArray) => {
      return [...bookingsArray].sort((a, b) => {
        const getTime = (booking) => {
          // Use timestamp field if available, otherwise use createdAt or default to 0
          if (booking.timestamp) {
            return new Date(booking.timestamp).getTime();
          } else if (booking.createdAt) {
            return booking.createdAt instanceof Timestamp ? 
                   booking.createdAt.toMillis() : 
                   new Date(booking.createdAt).getTime();
          }
          return 0;
        };
        return getTime(b) - getTime(a); // Newest first
      });
    },
    
    getStatusTag: (status) => {
      const formattedStatus = status ? 
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 
        'Pending';
  
      const config = statusConfig[formattedStatus] || statusConfig.Pending;
      
      return (
        <span className={`${config.bgColor} ${config.textColor} px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1`}>
          <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
          {formattedStatus}
        </span>
      );
    },

    getBookingDates: (booking) => {
      return {
        pickupDate: booking.startDate || booking.pickupDate,
        pickupTime: booking.pickupTime,
        pickupLocation: booking.pickupLocation,
        dropoffDate: booking.endDate || booking.dropoffDate,
        dropoffTime: booking.dropoffTime,
        dropoffLocation: booking.dropoffLocation
      };
    },

    renderInfoField: (label, value, icon = null) => (
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium flex items-center gap-1.5">
          {icon && icon}
          {value || "Not provided"}
        </p>
      </div>
    ),

    renderSection: (title, content) => (
      <div className="border-t border-gray-100 pt-4 mb-4">
        <h4 className="font-medium mb-3">{title}</h4>
        {content}
      </div>
    ),

    // Date filtering 
    getDateFromString: (dateString) => {
      if (!dateString) return null;
      try {
        return new Date(dateString);
      } catch (error) {
        console.error("Error converting date string:", error);
        return null;
      }
    },

    isDateInRange: (dateString, startDate, endDate) => {
      if (!dateString) return false;
      
      const checkDate = new Date(dateString);
      checkDate.setHours(0, 0, 0, 0);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (checkDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (checkDate > end) return false;
      }
      
      return true;
    },

    // Check if booking is overdue
    isBookingOverdue: (booking) => {
      const bookingDates = helpers.getBookingDates(booking);
      const dropoffDate = helpers.getDateFromString(bookingDates.dropoffDate);
      
      if (!dropoffDate) return false;
      
      const now = new Date();
      const overdueMs = now - dropoffDate;
      const overdueHours = overdueMs / (1000 * 60 * 60);

      return (
        (booking.status === 'Accepted' || booking.status === 'Pending') && 
        overdueHours >= 1 
      );
    },

    // Calculate overdue amount based on hourly rate
    calculateOverdueAmount: (booking) => {
      if (booking.status !== 'Overdue' || !booking.hourlyRate) return 0;
      
      const bookingDates = helpers.getBookingDates(booking);
      const dropoffDate = helpers.getDateFromString(bookingDates.dropoffDate);
      const now = new Date();
      
      if (!dropoffDate) return 0;
      
      // Calculate overdue hours (rounded up to nearest hour)
      const overdueMs = now - dropoffDate;
      const overdueHours = Math.ceil(overdueMs / (1000 * 60 * 60));
      
      return overdueHours >= 1 ? overdueHours * booking.hourlyRate : 0;
    }
  };

  // Date filter functions
  const dateFilterFunctions = {
    applyDateFilter: () => {
      if (dateFilter.startDate && dateFilter.endDate) {
        setActiveDateFilter({
          type: 'range',
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          display: `${dateFilter.startDate} to ${dateFilter.endDate}`
        });
      }
      setShowDateFilter(false);
    },

    clearDateFilter: () => {
      setActiveDateFilter(null);
      setDateFilter({
        startDate: "",
        endDate: ""
      });
    }
  };

  // Combined booking actions
  const actions = {
    updateStatus: async (id, newStatus) => {
      try {
        const bookingRef = doc(db, "bookings", id);
        const bookingSnap = await getDoc(bookingRef);
        
        if (!bookingSnap.exists()) {
          throw new Error("Booking not found");
        }
        
        // Capitalize the first letter of the status
        const formattedStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();
        
        await updateDoc(bookingRef, {
          status: formattedStatus, 
          updatedAt: Timestamp.now()
        });
        
        // Update selected booking if modal is open
        if (selectedBooking && selectedBooking.id === id) {
          setSelectedBooking(prev => ({
            ...prev,
            status: formattedStatus
          }));
        }
      } catch (error) {
        console.error("Error updating booking status:", error);
      }
    },
    
    viewDetails: (booking) => {
      setSelectedBooking(booking);
      setShowDetailModal(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
    },
    
    closeDetails: () => {
      setShowDetailModal(false);
      setSelectedBooking(null);
      document.body.style.overflow = 'auto';
    },
    
    message: (booking) => navigate('/messages', { 
      state: { 
        clientId: booking.userId,  
        clientName: booking.name,
        clientEmail: booking.email,
        bookingId: booking.id
      }
    }),
  };

  // Function to check and update overdue bookings
  const checkAndUpdateOverdueBookings = async (bookingsData) => {
    const now = new Date();
    const overdueBookings = bookingsData.filter(booking => 
      helpers.isBookingOverdue(booking) && 
      booking.status !== 'Overdue' && 
      booking.status !== 'Completed' && 
      booking.status !== 'Cancelled'
    );

    if (overdueBookings.length > 0) {
      const updatePromises = overdueBookings.map(async (booking) => {
        try {
          const bookingRef = doc(db, "bookings", booking.id);
          await updateDoc(bookingRef, {
            status: "Overdue",
            updatedAt: Timestamp.now()
          });
        } catch (error) {
          console.error("Error updating overdue booking:", error);
        }
      });
      
      await Promise.all(updatePromises);
      
      // Return the updated bookings data
      const updatedBookings = bookingsData.map(booking => {
        if (overdueBookings.some(b => b.id === booking.id)) {
          return { ...booking, status: "Overdue" };
        }
        return booking;
      });
      
      return updatedBookings;
    }
    
    return bookingsData;
  };

  // Fetch bookings with real-time updates and overdue check
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error("No user logged in");
          navigate("/login");
          return;
        }
        
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("ownerId", "==", currentUser.uid));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
          let bookingsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Check for overdue bookings and update if needed
          bookingsData = await checkAndUpdateOverdueBookings(bookingsData);
          
          bookingsData = helpers.sortBookings(bookingsData);
          setBookings(bookingsData);
        }, (error) => {
          console.error("Error fetching bookings:", error);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching bookings:", error);
      }
    };

    fetchBookings();
  }, [navigate]);

  // Filter bookings based on active filter and date filter
  const filteredBookings = bookings.filter(booking => {
    // Status filter
    const statusMatch = activeFilter === "all" || 
                       booking.status.toLowerCase() === activeFilter;
    
    // Date filter
    let dateMatch = true;
    if (activeDateFilter) {
      const bookingDates = helpers.getBookingDates(booking);
      
      // Check both start date and created timestamp
      const startDate = bookingDates.pickupDate;
      const createdDate = booking.timestamp || booking.createdAt;
      
      const datesToCheck = [startDate, createdDate].filter(Boolean);
      
      if (activeDateFilter.type === 'range') {
        dateMatch = datesToCheck.some(date => 
          helpers.isDateInRange(date, activeDateFilter.startDate, activeDateFilter.endDate)
        );
      }
    }
    
    return statusMatch && dateMatch;
  });

  // Render date/time info for bookings
  const renderDateTimeInfo = (label, date, time, location, icon) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-medium ml-6">{helpers.formatDate(date)}</p>
      {time && <p className="text-gray-600 ml-6">
        <Clock className="w-3 h-3 inline mr-1" />
        {helpers.formatTime(time)}
      </p>}
      <p className="text-gray-500 ml-6">{location || "Not specified"}</p>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarOwner onLogout={helpers.logout} />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-white shadow">
          <TopbarOwner onLogout={helpers.logout} />
        </div>

        <div className="p-6">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900">Booking Management</h1>

            {/* Filter Controls */}
            <div className="flex items-center justify-between mt-6">
              {/* Status Filter Tabs */}
              <div className="flex space-x-2 border-b border-gray-200">
                {["all", "pending", "accepted", "overdue", "cancelled", "completed"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-2 text-sm font-medium relative ${
                      activeFilter === filter
                        ? "text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    {activeFilter === filter && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                    )}
                  </button>
                ))}
              </div>

              {/* Date Filter Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeDateFilter 
                      ? "bg-blue-100 text-blue-700 border border-blue-200" 
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Date Filter
                  {activeDateFilter && <span className="text-xs">({activeDateFilter.display})</span>}
                </button>

                {activeDateFilter && (
                  <button
                    onClick={dateFilterFunctions.clearDateFilter}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Clear date filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Filter Panel */}
            {showDateFilter && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Filter by Date Range</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowDateFilter(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results Summary */}
          {activeDateFilter && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <Filter className="w-4 h-4 inline mr-1" />
                Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} 
                {` from ${activeDateFilter.display}`}
                {activeFilter !== 'all' && ` with status: ${activeFilter}`}
              </p>
            </div>
          )}

          {/* Booking Cards */}
          {filteredBookings.length > 0 ? (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const bookingDates = helpers.getBookingDates(booking);
                const overdueAmount = helpers.calculateOverdueAmount(booking);
                
                return (
                  <div
                    key={booking.id}
                    className="bg-white border border-gray-200 rounded-lg p-5 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{booking.name || "Customer"}</h3>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            Booking ID: {booking.id}
                          </span>
                          {booking.timestamp && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              Booked: {helpers.formatDateTime(booking.timestamp)}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {booking.email || "No email provided"}
                        </p>
                        
                        {/* Client Address Display */}
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {booking.address || "No address provided"}
                        </p>
                        
                        {/* Vehicle Information Display */}
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-gray-400" />
                          {booking.vehicleBrand || ""} {booking.vehicleModel || "Vehicle"} 
                          {booking.vehicleYear ? `(${booking.vehicleYear})` : ""}
                          {booking.licensePlate && ` - ${booking.licensePlate}`}
                          {booking.fuelType && ` - ${booking.fuelType}`}
                        </p>
                        
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          ₱{booking.dailyPrice || booking.rentalAmount || 0}
                          {booking.status === "Pending" && (
                            <span className="text-xs text-gray-500 ml-1">(Base price)</span>
                          )}
                          {booking.status === "Overdue" && booking.hourlyRate && (
                            <>
                              <span className="text-xs text-gray-500 ml-1">(₱{booking.hourlyRate}/hr)</span>
                              <span className="text-xs text-red-500 ml-1">
                                + ₱{overdueAmount} overdue
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {helpers.getStatusTag(booking.status)}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {renderDateTimeInfo(
                        "Pickup / Start Date", 
                        bookingDates.pickupDate,
                        bookingDates.pickupTime,
                        bookingDates.pickupLocation,
                        <Calendar className="w-4 h-4" />
                      )}
                      {renderDateTimeInfo(
                        "Return / End Date", 
                        bookingDates.dropoffDate,
                        bookingDates.dropoffTime,
                        bookingDates.dropoffLocation,
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {actionButtons.map((btn, index) => {
                        // Check if the button should be enabled for this booking's status
                        const isEnabled = btn.alwaysEnabled || 
                          (Array.isArray(btn.enabledWhen) 
                            ? btn.enabledWhen.includes(booking.status)
                            : booking.status === btn.enabledWhen);
                        
                        // Special case for message and details buttons
                        if (btn.action === "message" || btn.action === "details") {
                          const clickHandler = btn.action === "message" 
                            ? () => actions.message(booking)
                            : () => actions.viewDetails(booking);
                          
                          return (
                            <button 
                              key={index}
                              onClick={clickHandler}
                              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm ${btn.style}`}
                            >
                              {btn.icon}
                              <span>{btn.label}</span>
                            </button>
                          );
                        }
                        
                        // Status change buttons
                        return (
                          <button
                            key={index}
                            onClick={() => actions.updateStatus(booking.id, btn.action)}
                            disabled={!isEnabled}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm ${
                              isEnabled ? btn.style : "bg-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            {btn.icon}
                            <span>{btn.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Car className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No bookings found</h3>
              <p className="mt-1 text-gray-500">
                {activeDateFilter 
                  ? `No ${activeFilter === "all" ? "" : activeFilter} bookings found for the selected date range.`
                  : `There are currently no ${activeFilter === "all" ? "" : activeFilter} bookings.`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Booking Modal */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 md:p-0 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-16 relative">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h3 className="text-lg font-medium text-gray-900">Booking Details</h3>
              <button 
                onClick={actions.closeDetails} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Booking ID and Status */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-sm text-gray-500">Booking ID</p>
                  <p className="font-medium">{selectedBooking.id}</p>
                </div>
                {helpers.getStatusTag(selectedBooking.status)}
              </div>
              
              {/* Customer Information */}
              {helpers.renderSection("Customer Information", 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Name", selectedBooking.name)}
                  {helpers.renderInfoField("Email", selectedBooking.email)}
                  {helpers.renderInfoField("Phone", selectedBooking.phone)}
                  {helpers.renderInfoField("Address", selectedBooking.address, <MapPin className="w-4 h-4 text-gray-400" />)}
                </div>
              )}
              
              {/* Vehicle Information */}
              {helpers.renderSection("Vehicle Information", 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Vehicle", `${selectedBooking.vehicleBrand || ""} ${selectedBooking.vehicleModel || ""} ${selectedBooking.vehicleYear ? `(${selectedBooking.vehicleYear})` : ""}`)}
                  {helpers.renderInfoField("License Plate", selectedBooking.licensePlate)}
                  {helpers.renderInfoField("Fuel Type", selectedBooking.fuelType)}
                  {selectedBooking.hourlyRate && 
                    helpers.renderInfoField("Hourly Rate", `₱${selectedBooking.hourlyRate}/hr`)}
                </div>
              )}
              
              {/* Booking Dates */}
              {(() => {
                const dates = helpers.getBookingDates(selectedBooking);
                return helpers.renderSection("Booking Schedule", 
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Pickup / Start Date</p>
                      <p className="font-medium">{helpers.formatDate(dates.pickupDate)}</p>
                      {dates.pickupTime && <p className="text-sm text-gray-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {helpers.formatTime(dates.pickupTime)}
                      </p>}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Return / End Date</p>
                      <p className="font-medium">{helpers.formatDate(dates.dropoffDate)}</p>
                      {dates.dropoffTime && <p className="text-sm text-gray-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {helpers.formatTime(dates.dropoffTime)}
                      </p>}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pickup Location</p>
                      <p className="font-medium">{dates.pickupLocation || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Dropoff Location</p>
                      <p className="font-medium">{dates.dropoffLocation || "Not specified"}</p>
                    </div>
                  </div>
                );
              })()}
              
              {/* Payment Information */}
              {helpers.renderSection("Payment Information",  
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Base Price", `₱${selectedBooking.dailyPrice || selectedBooking.rentalAmount || 0}`)}
                  
                  {selectedBooking.status === "Overdue" && (
                    <>
                      {helpers.renderInfoField(
                        "Overdue Charges", 
                        `₱${helpers.calculateOverdueAmount(selectedBooking)}`
                      )}
                    </>
                  )}
                  
                  {helpers.renderInfoField(
                    "Total Amount", 
                    `₱${selectedBooking.status === "Overdue" 
                      ? (selectedBooking.dailyPrice || selectedBooking.rentalAmount || 0) + helpers.calculateOverdueAmount(selectedBooking)
                      : selectedBooking.dailyPrice || selectedBooking.rentalAmount || 0
                    }`
                  )}
                  
                  {selectedBooking.paymentProofUploadTimestamp && 
                    helpers.renderInfoField("Payment Proof Uploaded", helpers.formatDateTime(selectedBooking.paymentProofUploadTimestamp))}
                  {selectedBooking.proofOfPaymentUrl && ( 
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500">Proof of Payment</p>
                      <a href={selectedBooking.proofOfPaymentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline flex items-center gap-1.5" >
                        <FileText className="w-4 h-4" /> View Proof of Payment</a>
                    </div>
                  )} 
                </div>
              )}
              
              {/* Additional Notes (if any) */}
              {selectedBooking.notes && helpers.renderSection("Additional Notes", 
                <p className="text-gray-700">{selectedBooking.notes}</p>
              )}
              
              {/* Actions */}
              <div className="border-t border-gray-100 pt-4 mt-6">
                <div className="flex justify-end space-x-2">
                  {selectedBooking.status === "Pending" && (
                    <>
                      <button 
                        onClick={() => {
                          actions.updateStatus(selectedBooking.id, "accepted");
                          actions.closeDetails();
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                      >
                        Accept Booking
                      </button>
                      <button 
                        onClick={() => {
                          actions.updateStatus(selectedBooking.id, "cancelled");
                          actions.closeDetails();
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                      >
                        Cancel Booking
                      </button>
                    </>
                  )}
                  
                  {selectedBooking.status === "Accepted" && (
                    <>
                      <button 
                        onClick={() => {
                          actions.updateStatus(selectedBooking.id, "completed");
                          actions.closeDetails();
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Mark as Completed
                      </button>
                    </>
                  )}
                  
                  {selectedBooking.status === "Overdue" && (
                    <button 
                      onClick={() => {
                        actions.updateStatus(selectedBooking.id, "completed");
                        actions.closeDetails();
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Mark as Completed
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;