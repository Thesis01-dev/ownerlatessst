import React, { useState, useEffect } from "react";
import { Star } from "@mui/icons-material";
import { 
  CalendarCheck2, Car, Users, ChevronLeft, ChevronRight, Clock, MapPin, User, AlertCircle,
  TrendingUp, TrendingDown, DollarSign, CheckCircle, XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";
import { db, auth } from "../../firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where, getDocs, doc, getDoc } from "firebase/firestore";

const Dashboard = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [acceptedBookings, setAcceptedBookings] = useState([]);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [metrics, setMetrics] = useState({ newBookings: 0, availableCars: 0, activeClients: 0 });
  const [businessName, setBusinessName] = useState(localStorage.getItem("businessName") || "");
  
  // Analytics state based on reports
  const [analytics, setAnalytics] = useState({
    totalIncome: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalFeedbacks: 0,
    averageRating: 0,
    monthlyTrend: 0,
    completionRate: 0
  });

  // Consolidated utility functions
  const utils = {
    handleLogout: async () => {
      try {
        await signOut(auth);
        navigate("/login");
      } catch (error) {
        console.error("Logout error:", error);
      }
    },

    getDatesInRange: (startDate, endDate) => {
      const dates = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    },

    normalizeDate: (date) => {
      if (!date) return new Date();
      if (typeof date === 'string') {
        return new Date(date + 'T00:00:00');
      }
      if (date?.toDate) {
        return date.toDate();
      }
      return new Date(date);
    },
    
    formatDate: (timestamp) => {
      try {
        const date = utils.normalizeDate(timestamp);
        return date.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
      } catch { 
        return "No date"; 
      }
    },

    formatTime: (timestamp) => {
      try {
        const date = utils.normalizeDate(timestamp);
        return date.toLocaleTimeString("en-US", { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } catch { 
        return "No time"; 
      }
    },

    getStatusColor: (status) => {
      const colors = {
        Pending: "bg-amber-50 text-amber-600 border-amber-200",
        Completed: "bg-green-50 text-green-600 border-green-200",
        Cancelled: "bg-red-50 text-red-600 border-red-200"
      };
      return `${colors[status] || "bg-gray-50 text-gray-600 border-gray-200"} border`;
    },

    isSameDay: (date1, date2) => {
      const d1 = utils.normalizeDate(date1);
      const d2 = utils.normalizeDate(date2);
      return d1.toDateString() === d2.toDateString();
    },

    getTodaysActivities: (bookings) => {
      const today = new Date();
      const activities = [];

      bookings.forEach(booking => {
        const pickupDate = utils.normalizeDate(booking.startDate);
        const dropoffDate = utils.normalizeDate(booking.endDate);

        // Check if pickup is today
        if (utils.isSameDay(pickupDate, today)) {
          activities.push({
            id: `${booking.id}-pickup`,
            bookingId: booking.id,
            type: 'pickup',
            time: booking.pickupTime || pickupDate,
            location: booking.pickupLocation || 'Location not specified',
            customer: booking.name || 'Customer',
            vehicle: `${booking.vehicleBrand || ''} ${booking.vehicleModel || ''}`.trim() || 'Vehicle',
            status: booking.status,
            booking: booking
          });
        }

        // Check if dropoff is today
        if (utils.isSameDay(dropoffDate, today)) {
          activities.push({
            id: `${booking.id}-dropoff`,
            bookingId: booking.id,
            type: 'dropoff',
            time: booking.dropoffTime || dropoffDate,
            location: booking.dropoffLocation || 'Location not specified',
            customer: booking.name || 'Customer',
            vehicle: `${booking.vehicleBrand || ''} ${booking.vehicleModel || ''}`.trim() || 'Vehicle',
            status: booking.status,
            booking: booking
          });
        }
      });

      // Sort activities by time
      return activities.sort((a, b) => {
        const timeA = utils.normalizeDate(a.time);
        const timeB = utils.normalizeDate(b.time);
        return timeA - timeB;
      });
    }
  };

  // Calendar functions
  const calendar = {
    hasBookingOnDate: (date) => {
      const dateStr = date.toDateString();
      return acceptedBookings.some(booking => {
        const startDate = utils.normalizeDate(booking.startDate);
        const endDate = utils.normalizeDate(booking.endDate);
        
        if (!startDate || !endDate) return false;
        
        const bookedDates = utils.getDatesInRange(startDate, endDate);
        return bookedDates.some(bookedDate => bookedDate.toDateString() === dateStr);
      });
    },

    getBookingsForDate: (date) => {
      const dateStr = date.toDateString();
      return acceptedBookings.filter(booking => {
        const startDate = utils.normalizeDate(booking.startDate);
        const endDate = utils.normalizeDate(booking.endDate);
        
        if (!startDate || !endDate) return false;
        
        const bookedDates = utils.getDatesInRange(startDate, endDate);
        return bookedDates.some(bookedDate => bookedDate.toDateString() === dateStr);
      });
    },

    navigateMonth: (direction) => {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    }
  };

  // Analytics calculation function (based on reports logic)
  const calculateAnalytics = async () => {
    if (!auth.currentUser) return;

    try {
      const bookingsRef = collection(db, "bookings");
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      // Get completed bookings for total income
      const completedQuery = query(
        bookingsRef, 
        where("ownerId", "==", auth.currentUser.uid),
        where("status", "==", "Completed")
      );
      
      const cancelledQuery = query(
        bookingsRef, 
        where("ownerId", "==", auth.currentUser.uid),
        where("status", "==", "Cancelled")
      );

      const [completedSnapshot, cancelledSnapshot] = await Promise.all([
        getDocs(completedQuery),
        getDocs(cancelledQuery)
      ]);

      let totalIncome = 0;
      let currentMonthIncome = 0;
      let lastMonthIncome = 0;
      
      completedSnapshot.forEach(doc => {
        const booking = doc.data();
        const price = Number(booking.price) || 0;
        totalIncome += price;

        // Calculate monthly trends
        const bookingDate = utils.normalizeDate(booking.updatedAt || booking.createdAt);
        if (bookingDate >= new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) && 
            bookingDate <= nextMonth) {
          currentMonthIncome += price;
        } else if (bookingDate >= lastMonth && 
                   bookingDate < new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)) {
          lastMonthIncome += price;
        }
      });

      const completedCount = completedSnapshot.size;
      const cancelledCount = cancelledSnapshot.size;
      const completionRate = completedCount + cancelledCount > 0 
        ? ((completedCount / (completedCount + cancelledCount)) * 100)
        : 0;

      // Calculate monthly trend
      const monthlyTrend = lastMonthIncome > 0 
        ? ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100
        : currentMonthIncome > 0 ? 100 : 0;

      // Get reviews data
      const reviewsQuery = query(collection(db, "reviews"), where("ownerId", "==", auth.currentUser.uid));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      
      let totalRating = 0;
      let reviewCount = 0;
      
      reviewsSnapshot.forEach(doc => {
        const review = doc.data();
        if (review.rating) {
          totalRating += Number(review.rating);
          reviewCount++;
        }
      });

      const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

      setAnalytics({
        totalIncome,
        completedBookings: completedCount,
        cancelledBookings: cancelledCount,
        totalFeedbacks: reviewCount,
        averageRating,
        monthlyTrend,
        completionRate
      });

    } catch (error) {
      console.error("Error calculating analytics:", error);
    }
  };

  // Fetch business name
  const fetchBusinessName = async () => {
    if (!auth.currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const name = userData.businessName || userData.companyName || userData.name || userData.firstName || "Owner";
        setBusinessName(name);
        localStorage.setItem("businessName", name);
      } else {
        setBusinessName("Owner");
        localStorage.setItem("businessName", "Owner");
      }
    } catch (error) {
      console.error("Error fetching business name:", error);
      setBusinessName("Owner");
      localStorage.setItem("businessName", "Owner");
    }
  };

  // Consolidated Firebase listeners
  useEffect(() => {
    if (!auth.currentUser) return;

    const queries = [
      {
        query: query(collection(db, "vehicles"), where("uid", "==", auth.currentUser.uid), where("status", "==", "Available")),
        handler: (snapshot) => setMetrics(prev => ({ ...prev, availableCars: snapshot.size }))
      },
      {
        query: query(collection(db, "bookings"), where("ownerId", "==", auth.currentUser.uid)),
        handler: (snapshot) => {
          const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBookings(bookingsData);
          
          const accepted = bookingsData.filter(b => b.status === "Accepted");
          setAcceptedBookings(accepted);
          
          const todaysActivities = utils.getTodaysActivities(accepted);
          setTodaysSchedule(todaysActivities);
          
          const pendingCount = bookingsData.filter(b => b.status === "Pending").length;
          setMetrics(prev => ({ ...prev, newBookings: pendingCount }));
          
          // Recalculate analytics when bookings change
          calculateAnalytics();
        }
      },
      {
        query: query(collection(db, "bookings"), where("ownerId", "==", auth.currentUser.uid), where("status", "==", "Completed")),
        handler: (snapshot) => {
          const uniqueClients = new Set(snapshot.docs.map(doc => doc.data().email).filter(Boolean));
          setMetrics(prev => ({ ...prev, activeClients: uniqueClients.size }));
        }
      }
    ];

    const unsubscribes = queries.map(({ query: q, handler }) => onSnapshot(q, handler));
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Reviews fetcher
  const fetchReviews = async () => {
    if (!auth.currentUser) return;

    try {
      const reviewsQuery = query(collection(db, "reviews"), where("ownerId", "==", auth.currentUser.uid));
      const snapshot = await getDocs(reviewsQuery);
      
      const reviewsData = await Promise.all(
        snapshot.docs.map(async (docRef) => {
          const data = docRef.data();
          
          const [userDoc, vehicleDoc] = await Promise.all([
            data.userId ? getDoc(doc(db, "users", data.userId)).catch(() => null) : null,
            data.vehicleId ? getDoc(doc(db, "vehicles", data.vehicleId)).catch(() => null) : null
          ]);

          const userName = userDoc?.exists() 
            ? userDoc.data()?.name || userDoc.data()?.firstName || userDoc.data()?.email || "Unknown User"
            : "Unknown User";

          const vehicleName = vehicleDoc?.exists()
            ? `${vehicleDoc.data()?.make || vehicleDoc.data()?.brand || ""} ${vehicleDoc.data()?.model || ""}`.trim() || "Unknown Vehicle"
            : "Unknown Vehicle";

          return {
            id: docRef.id,
            car: vehicleName,
            user: userName,
            date: utils.formatDate(data.timestamp || data.createdAt),
            review: data.reviewText || data.review || data.comment || "No review text",
            rating: data.rating || 0,
            timestamp: data.timestamp
          };
        })
      );

      const sortedReviews = reviewsData
        .sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          const dateA = utils.normalizeDate(a.timestamp);
          const dateB = utils.normalizeDate(b.timestamp);
          return dateB - dateA;
        })
        .slice(0, 5);

      setReviews(sortedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchReviews();
        fetchBusinessName();
        calculateAnalytics();
      }
    });
    return unsubscribe;
  }, []);

  // Analytics Cards Component (based on reports)
  const renderAnalyticsCards = () => {
    const analyticsCards = [
      {
        title: "Total Revenue",
        value: `₱${analytics.totalIncome.toLocaleString()}`,
        icon: DollarSign,
        trend: analytics.monthlyTrend,
        trendLabel: `${analytics.monthlyTrend >= 0 ? '+' : ''}${analytics.monthlyTrend.toFixed(1)}% from last month`,
        color: "bg-green-500",
        bgColor: "bg-green-50",
        textColor: "text-green-600"
      },
      {
        title: "Completed Bookings",
        value: analytics.completedBookings,
        icon: CheckCircle,
        trend: analytics.completionRate,
        trendLabel: `${analytics.completionRate.toFixed(1)}% completion rate`,
        color: "bg-blue-500",
        bgColor: "bg-blue-50",
        textColor: "text-blue-600"
      },
      {
        title: "Cancelled Bookings",
        value: analytics.cancelledBookings,
        icon: XCircle,
        trend: null,
        trendLabel: `${analytics.cancelledBookings > 0 ? 'Monitor cancellation reasons' : 'Great job!'}`,
        color: "bg-red-500",
        bgColor: "bg-red-50",
        textColor: "text-red-600"
      },
      {
        title: "Total Feedbacks",
        value: analytics.totalFeedbacks,
        icon: Star,
        trend: analytics.averageRating,
        trendLabel: `${analytics.averageRating.toFixed(1)} average rating`,
        color: "bg-yellow-500",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-600"
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {analyticsCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/reports')}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
              {card.trend !== null && (
                <div className={`flex items-center text-sm ${
                  card.trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.trend >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
              <p className="text-sm text-gray-500 font-medium">{card.title}</p>
              <p className="text-xs text-gray-400">{card.trendLabel}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Today's Schedule renderer
  const renderTodaysSchedule = () => {
    const today = new Date().toLocaleDateString("en-US", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Today's Schedule</h2>
            <p className="text-sm text-gray-500 mt-1">{today}</p>
          </div>
          <button 
            onClick={() => navigate("/bookings")} 
            className="px-4 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center"
          >
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        <div className="space-y-4">
          {todaysSchedule.length > 0 ? (
            todaysSchedule.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start space-x-4 p-4 border border-gray-100 rounded-lg hover:border-blue-100 hover:bg-blue-50/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/bookings`)}
              >
                <div className="flex-shrink-0 text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {utils.formatTime(activity.time)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {activity.type === 'pickup' ? 'Pickup' : 'Return'}
                  </div>
                </div>

                <div className="flex-shrink-0 mt-1">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.type === 'pickup' 
                      ? 'bg-green-500' 
                      : 'bg-blue-500'
                  }`}></div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.vehicle}
                    </p>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full font-medium ${
                      activity.status === 'Accepted' 
                        ? 'bg-green-50 text-green-600'
                        : activity.status === 'Overdue'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-gray-50 text-gray-600'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate">{activity.customer}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span className="truncate">{activity.location}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {activity.status === 'Overdue' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-500 bg-gray-50/50 rounded-lg">
              <div className="flex flex-col items-center">
                <Clock className="w-10 h-10 text-gray-300 mb-2" />
                <p>No activities scheduled for today</p>
                <p className="text-sm text-gray-400 mt-1">Enjoy your free day!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calendar renderer
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

    const renderDay = (day) => {
      const currentDayDate = new Date(year, month, day);
      const isToday = new Date().toDateString() === currentDayDate.toDateString();
      const hasBooking = calendar.hasBookingOnDate(currentDayDate);
      const dayBookings = calendar.getBookingsForDate(currentDayDate);
      
      return (
        <div 
          key={day} 
          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors relative group cursor-pointer ${
            isToday 
              ? "bg-blue-500 text-white font-medium" 
              : hasBooking
                ? "bg-green-100 text-green-800 font-semibold border-2 border-green-300"
                : "hover:bg-blue-50 hover:text-blue-600"
          }`}
          title={hasBooking ? `${dayBookings.length} booking(s) on this date` : undefined}
        >
          {day}
          {hasBooking && (
            <>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <div className="space-y-1">
                  {dayBookings.slice(0, 3).map((booking, idx) => (
                    <div key={idx} className="text-xs">
                      {booking.name} - {booking.vehicleBrand} {booking.vehicleModel}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-xs text-gray-300">+{dayBookings.length - 3} more...</div>
                  )}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
              </div>
            </>
          )}
        </div>
      );
    };

    const days = [
      ...Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} className="w-8 h-8" />),
      ...Array(daysInMonth).fill(null).map((_, i) => renderDay(i + 1))
    ];

    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => calendar.navigateMonth(-1)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-semibold text-lg text-gray-800">{monthNames[month]} {year}</div>
          <button onClick={() => calendar.navigateMonth(1)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-3">
          {dayNames.map(day => <div key={day} className="text-xs text-gray-500 font-medium text-center">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
        
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 bg-green-100 border-2 border-green-300 rounded-full"></div>
            <span>Booked</span>
          </div>
        </div>
      </div>
    );
  };

  // Configuration data
  const metricCards = [
    { label: "New Bookings", value: metrics.newBookings, icon: CalendarCheck2, route: "/bookings", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
    { label: "Available Cars", value: metrics.availableCars, icon: Car, route: "/units", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { label: "Number of Clients", value: metrics.activeClients, icon: Users, route: "/clients", iconBg: "bg-amber-100", iconColor: "text-amber-600" }
  ];

  const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
    <div className="py-8 text-center text-gray-500 bg-gray-50/50 rounded-lg">
      <div className="flex flex-col items-center">
        <Icon className="w-10 h-10 text-gray-300 mb-2" />
        <p>{title}</p>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        {action}
      </div>
    </div>
  );

  const SectionHeader = ({ title, subtitle, buttonText, onButtonClick }) => (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <button onClick={onButtonClick} className="px-4 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center">
        {buttonText} <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="sticky top-0 h-screen w-64 transition-all duration-300 bg-white border-r shadow-md z-20">
        <SidebarOwner onLogout={utils.handleLogout} />
      </div>
      <div className="flex flex-col flex-1">
        <div className="sticky top-0 z-20 bg-white shadow-md border-b border-gray-200">
          <TopbarOwner />
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              Hello, {businessName}
              <span className="ml-3 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full font-medium">Dashboard</span>
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Welcome back! Here's what's happening with your rentals.</p>
          </div>

          {/* Analytics Cards - Based on Reports */}
          {renderAnalyticsCards()}

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metricCards.map(({ label, value, icon: Icon, route, iconBg, iconColor }, idx) => (
              <div key={idx} className="rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden group bg-white border border-gray-200" onClick={() => navigate(route)}>
                <div className="bg-white p-6 text-gray-900">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-500 font-medium mb-1">{label}</p>
                      <h3 className="text-3xl font-bold">{value}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${iconBg} ${iconColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-blue-600 flex items-center group-hover:translate-x-1 transition-transform">
                    View details <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Schedule + Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">{renderTodaysSchedule()}</div>
            <div className="lg:col-span-1">{renderCalendar()}</div>
          </div>

          {/* Bookings */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <SectionHeader 
              title="Recent Bookings" 
              subtitle="Latest rental transactions"
              buttonText="View All"
              onButtonClick={() => navigate("/bookings")}
            />

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {["Client", "Brand", "Model", "Booking Dates", "Status"].map((header, i) => (
                      <th key={header} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 ${i === 0 ? "rounded-tl-lg" : i === 4 ? "rounded-tr-lg" : ""}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {bookings.length > 0 ? (
                    bookings.slice(0, 5).map(({ id, name, vehicleBrand, vehicleModel, bookingDates, status }) => (
                      <tr key={id} className="hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/bookings/${id}`)}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{vehicleBrand}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{vehicleModel}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{bookingDates}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 text-xs rounded-full font-medium ${utils.getStatusColor(status)}`}>{status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="px-4 py-8">
                      <EmptyState 
                        icon={CalendarCheck2} 
                        title="No bookings found" 
                        action={<button onClick={() => navigate('/add-booking')} className="mt-2 text-blue-600 hover:underline text-sm font-medium">Create a booking</button>}
                      />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <SectionHeader 
              title="Client Reviews" 
              subtitle="Recent client feedback"
              buttonText="View All"
              onButtonClick={() => navigate("/feedbacks")}
            />
            <div className="space-y-5">
              {reviews.length > 0 ? (
                reviews.map(({ id, user, car, rating, review, date }) => (
                  <div key={id} className="p-4 border border-gray-100 rounded-lg hover:border-blue-100 hover:bg-blue-50/20 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">{user}</p>
                          <span className="text-xs text-gray-400">{date}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{car}</p>
                        <div className="flex items-center mb-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} fontSize="small" className={i < rating ? "text-amber-400" : "text-gray-300"} />
                          ))}
                          <span className="ml-2 text-sm text-gray-600">{rating}.0</span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">"{review}"</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState 
                  icon={Star} 
                  title="No reviews found" 
                  subtitle="Reviews will appear here once clients rate their experience"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;