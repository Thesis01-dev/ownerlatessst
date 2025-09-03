import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { 
  collection, query, where, onSnapshot, deleteDoc, doc, Timestamp 
} from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  Search, Calendar as CalendarIcon, XCircle, MapPin, 
  Car, DollarSign, Mail, Clock, Phone, User 
} from "lucide-react";
import { FiEye, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";

const Clients = () => {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  // Helper functions matching the Bookings component
  const helpers = {
    formatDate: (timestamp) => {
      if (!timestamp) return "N/A";
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (error) {
        console.error("Error formatting date:", error);
        return "Invalid Date";
      }
    },
    
    formatTime: (timestamp) => {
      if (!timestamp) return "N/A";
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit'
        });
      } catch (error) {
        console.error("Error formatting time:", error);
        return "Invalid Time";
      }
    },
    
    formatDateTime: (timestamp) => {
      if (!timestamp) return "N/A";
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch (error) {
        console.error("Error formatting date and time:", error);
        return "Invalid Date/Time";
      }
    },

    getBookingDates: (booking) => {
      return {
        pickupDate: booking.pickupDate || booking.startDate || booking.bookingDates?.start,
        pickupTime: booking.pickupTime,
        pickupLocation: booking.pickupLocation,
        dropoffDate: booking.dropoffDate || booking.endDate || booking.bookingDates?.end,
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

    sortClients: (clientsArray) => {
      return [...clientsArray].sort((a, b) => {
        // Sort by completion date (updatedAt) - most recent first
        const getCompletionTime = (client) => {
          const timestamp = client.updatedAt || client.createdAt || new Date(0);
          return timestamp instanceof Timestamp ? timestamp.toMillis() : 
                 timestamp instanceof Date ? timestamp.getTime() : 
                 new Date(timestamp).getTime();
        };
        return getCompletionTime(b) - getCompletionTime(a);
      });
    }
  };

  const fetchClients = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("No user logged in");
        navigate("/login");
        return;
      }

      setLoading(true);
      
      // Query bookings where ownerId equals the current user's ID and status is "completed"
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef, 
        where("ownerId", "==", currentUser.uid),
        where("status", "==", "Completed") // Fixed: should be "Completed" not "completed" to match the status format from bookings
      );
      
      // Set up real-time listener for completed bookings (clients)
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let clientsData = snapshot.docs.map(doc => {
          const data = doc.data();
          const bookingDates = helpers.getBookingDates(data);
          
          return {
            id: doc.id,
            ...data,
            // Use completion date (updatedAt) for display and filtering
            completionDate: data.updatedAt,
            // Use the primary pickup/start date for rental date display
            rentalDate: bookingDates.pickupDate || data.createdAt || new Date(),
            // Store all date information for detailed view
            bookingDates: bookingDates
          };
        });
        
        // Sort clients by most recent completion
        clientsData = helpers.sortClients(clientsData);
        
        setClients(clientsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching clients:", error);
        setLoading(false);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error("Error fetching clients:", error);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = fetchClients();
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDelete = async (id) => {
    const clientToDelete = clients.find((client) => client.id === id);
    Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete the client record for ${clientToDelete.name || "this client"}. This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // Delete the client record from Firestore
          await deleteDoc(doc(db, "bookings", id));
          
          // Local state update is handled by the onSnapshot listener
          Swal.fire("Deleted!", "The client record has been deleted.", "success");
        } catch (error) {
          console.error("Error deleting client record: ", error);
          Swal.fire("Error!", "There was an error deleting the client record.", "error");
        }
      }
    });
  };

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedClient(null);
    // Re-enable body scrolling when modal is closed
    document.body.style.overflow = 'auto';
  };

  const handleDateChange = (date) => setSelectedDate(date);
  const clearDateFilter = () => setSelectedDate(null);

  // Helper function to check if two dates are the same day
  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    
    const d1 = date1 instanceof Date ? date1 : 
               date1.toDate ? date1.toDate() : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  const filteredClients = clients.filter((client) => {
    const searchTerm = search.toLowerCase();
    const vehicleNumber = client.vehicleNumber ? client.vehicleNumber.toString().toLowerCase() : '';
    
    const matchesSearch =
      client.id.toString().toLowerCase().includes(searchTerm) ||
      (client.name && client.name.toLowerCase().includes(searchTerm)) ||
      (client.vehicleBrand && client.vehicleBrand.toLowerCase().includes(searchTerm)) ||
      (client.vehicleModel && client.vehicleModel.toLowerCase().includes(searchTerm)) ||
      (client.email && client.email.toLowerCase().includes(searchTerm)) ||
      vehicleNumber.includes(searchTerm);

    // Filter by completion date instead of rental date
    const matchesDate = !selectedDate || isSameDay(client.completionDate, selectedDate);

    return matchesSearch && matchesDate;
  });

  // Render date/time info for client details (matching Bookings component)
  const renderDateTimeInfo = (label, date, time, location, icon) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-medium ml-6">{helpers.formatDate(date)}</p>
      {time && <p className="text-gray-600 ml-6">
        <Clock className="w-3 h-3 inline mr-1" />
        {helpers.formatTime(time || date)}
      </p>}
      <p className="text-gray-500 ml-6">{location || "Not specified"}</p>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarOwner onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 bg-gray-50">
        {/* Sticky Topbar with logout handler */}
        <div className="sticky top-0 z-20 bg-white shadow">
          <TopbarOwner onLogout={handleLogout} />
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Title and Subtitle */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-3xl font-semibold text-gray-900">Client Records</h2>
            <p className="text-gray-600 mt-2">All completed bookings from your clients</p>
          </div>

          {/* Search and Filter Section */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            {/* Search Bar - Left Side */}
            <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all w-full lg:w-96">
              <Search className="text-gray-400 mr-2 h-4 w-4" />
              <input
                type="text"
                placeholder="Search clients by name, email, vehicle, or ID"
                className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Date Filter - Right Side */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white w-full lg:w-64">
                <CalendarIcon className="text-gray-400 w-4 h-4 mr-2" />
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="MMM dd, yyyy"
                  placeholderText="Filter by completion date"
                  className="w-full bg-transparent outline-none text-gray-700 text-sm"
                  wrapperClassName="w-full"
                  showYearDropdown
                  showMonthDropdown
                  dropdownMode="select"
                />
              </div>
              {selectedDate && (
                <button
                  onClick={clearDateFilter}
                  className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Results Summary */}
          {(search || selectedDate) && (
            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredClients.length} of {clients.length} client records
              {selectedDate && (
                <span className="ml-1">
                  completed on {helpers.formatDate(selectedDate)}
                </span>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
            <table className="w-full text-left text-gray-700">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="py-3 px-4 font-medium text-center">Booking ID</th>
                  <th className="py-3 px-4 font-medium text-center">Name</th>
                  <th className="py-3 px-4 font-medium text-center">Email</th>
                  <th className="py-3 px-4 font-medium text-center">Vehicle</th>
                  <th className="py-3 px-4 font-medium text-center">Rental Date</th>
                  <th className="py-3 px-4 font-medium text-center">Completed Date</th>
                  <th className="py-3 px-4 font-medium text-center">Total Paid</th>
                  <th className="py-3 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      Loading client records...
                    </td>
                  </tr>
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => {
                    // Calculate total amount paid (including overdue charges if any)
                    const basePrice = client.dailyPrice || client.price || 0;
                    const overdueAmount = client.status === "Overdue" && client.hourlyRate ? 
                      Math.ceil((new Date() - (client.bookingDates?.dropoffDate?.toDate() || new Date())) / (1000 * 60 * 60)) * client.hourlyRate : 0;
                    const totalPaid = basePrice + overdueAmount;

                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4 text-center text-xs">
                          {client.id.substring(0, 8)}...
                        </td>
                        <td className="py-4 px-4 font-medium text-gray-900 text-center">
                          {client.name || "N/A"}
                        </td>
                        <td className="py-4 px-4 text-center text-sm">
                          {client.email || "N/A"}
                        </td>
                        <td className="py-4 px-4 text-center text-sm">
                          {client.vehicleBrand || ""} {client.vehicleModel || ""} 
                          {client.vehicleYear ? ` (${client.vehicleYear})` : ""}
                          {client.licensePlate ? ` - ${client.licensePlate}` : ""}
                        </td>
                        <td className="py-4 px-4 text-center text-sm">
                          {helpers.formatDate(client.rentalDate)}
                        </td>
                        <td className="py-4 px-4 text-center text-sm">
                          {helpers.formatDate(client.completionDate)}
                        </td>
                        <td className="py-4 px-4 text-center text-sm font-medium text-green-600">
                          ₱{totalPaid.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleViewDetails(client)}
                              className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50"
                              title="View client details"
                            >
                              <FiEye className="text-lg" />
                            </button>
                            <button
                              onClick={() => handleDelete(client.id)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                              title="Delete client record"
                            >
                              <FiTrash2 className="text-lg" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      {search || selectedDate ? "No client records match your filters" : "No completed bookings found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Client Details Modal - Matching Bookings component style */}
      {showDetailModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 md:p-0 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-16 relative">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h3 className="text-lg font-medium text-gray-900">Client Booking Details</h3>
              <button 
                onClick={closeDetailModal} 
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
                  <p className="font-medium">{selectedClient.id}</p>
                </div>
                <span className="bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Completed
                </span>
              </div>
              
              {/* Customer Information */}
              {helpers.renderSection("Customer Information", 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Name", selectedClient.name, <User className="w-4 h-4 text-gray-400" />)}
                  {helpers.renderInfoField("Email", selectedClient.email, <Mail className="w-4 h-4 text-gray-400" />)}
                  {helpers.renderInfoField("Phone", selectedClient.phone, <Phone className="w-4 h-4 text-gray-400" />)}
                  {helpers.renderInfoField("Address", selectedClient.address, <MapPin className="w-4 h-4 text-gray-400" />)}
                </div>
              )}
              
              {/* Vehicle Information */}
              {helpers.renderSection("Vehicle Information", 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Brand & Model", `${selectedClient.vehicleBrand || ""} ${selectedClient.vehicleModel || ""} ${selectedClient.vehicleYear ? `(${selectedClient.vehicleYear})` : ""}`, <Car className="w-4 h-4 text-gray-400" />)}
                  {helpers.renderInfoField("Vehicle ID", selectedClient.vehicleId)}
                  {helpers.renderInfoField("License Plate", selectedClient.licensePlate)}
                  {helpers.renderInfoField("Fuel Type", selectedClient.fuelType)}
                  {selectedClient.dailyPrice && 
                    helpers.renderInfoField("Base Price", `₱${selectedClient.dailyPrice}`, <DollarSign className="w-4 h-4 text-gray-400" />)}
                  {selectedClient.hourlyRate && 
                    helpers.renderInfoField("Hourly Rate", `₱${selectedClient.hourlyRate}/hr`)}
                </div>
              )}
              
              {/* Booking Schedule */}
              {(() => {
                const dates = selectedClient.bookingDates || helpers.getBookingDates(selectedClient);
                return helpers.renderSection("Booking Schedule", 
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      {renderDateTimeInfo(
                        "Pickup / Start Date", 
                        dates.pickupDate,
                        dates.pickupTime,
                        dates.pickupLocation,
                        <CalendarIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      {renderDateTimeInfo(
                        "Return / End Date", 
                        dates.dropoffDate,
                        dates.dropoffTime,
                        dates.dropoffLocation,
                        <CalendarIcon className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Booking Timeline */}
              {helpers.renderSection("Booking Timeline",
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Booking Created</p>
                      <p className="text-xs text-gray-500">{helpers.formatDateTime(selectedClient.createdAt)}</p>
                    </div>
                  </div>
                  {selectedClient.completionDate && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-xs text-gray-500">{helpers.formatDateTime(selectedClient.completionDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Payment Information */}
              {helpers.renderSection("Payment Information",
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpers.renderInfoField("Base Price", `₱${selectedClient.dailyPrice || selectedClient.price || 0}`)}
                  {selectedClient.hourlyRate && 
                    helpers.renderInfoField("Hourly Rate", `₱${selectedClient.hourlyRate}/hr`)}
                  {selectedClient.proofOfPaymentUrl && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500">Proof of Payment</p>
                      <a 
                        href={selectedClient.proofOfPaymentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline flex items-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" /> 
                        View Payment Proof
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {/* Additional Notes */}
              {selectedClient.notes && helpers.renderSection("Additional Notes", 
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedClient.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;