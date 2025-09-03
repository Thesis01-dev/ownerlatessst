import { useState, useEffect, useRef } from 'react';
import { 
  Car, 
  Trash2, 
  CheckCircle,
  XCircle,
  Search,
  Bell,
  Mail,
  Calendar,
  Star as StarIcon,
  MoreHorizontal,
  Filter,
  RefreshCw
} from 'lucide-react';
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  writeBatch, 
  deleteDoc,
  Timestamp,
  limit
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase'; 
import TopbarOwner from '../../scenes/global/TopbarOwner';
import SidebarOwner from '../../scenes/global/SidebarOwner';
import { useNavigate } from "react-router-dom";
import Swal from 'sweetalert2';

const Notification = () => {
  // State for notifications data
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Listen to the same notifications collection that TopbarOwner uses
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log("Setting up notifications listener for user:", currentUser.uid);

    // Listen to the notifications collection directly (same as TopbarOwner)
    const notificationsRef = collection(db, "notifications");
    const notificationsQuery = query(
      notificationsRef,
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(100) // Get more for the full notification page
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      console.log("Notifications snapshot received, docs:", snapshot.docs.length);
      
      const fetchedNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'general',
          from: data.title || data.message?.split(' ')[0] || 'System',
          message: data.message || '',
          timestamp: data.time?.toDate ? data.time.toDate() : 
                   data.createdAt?.toDate ? data.createdAt.toDate() : 
                   new Date(),
          read: data.read || false,
          redirectUrl: data.routePath || `/bookings?id=${data.bookingId}`,
          bookingId: data.bookingId,
          userId: data.userId,
          vehicleInfo: data.vehicleInfo || '',
          rating: data.rating,
          stars: data.stars,
          reviewText: data.reviewText,
          emailId: data.emailId,
          // Keep all original data for compatibility
          ...data
        };
      });
      
      setNotifications(fetchedNotifications);
      setLoading(false);
      console.log("Updated notifications state:", fetchedNotifications);
    }, (error) => {
      console.error("Error in notifications listener:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = filteredNotifications.map((n) => n.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event, id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  // Updated to use the same database operations as TopbarOwner
  const handleMarkAsRead = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || selected.length === 0) return;

      const batch = writeBatch(db);
      
      selected.forEach((notificationId) => {
        const notificationRef = doc(db, "notifications", notificationId);
        batch.update(notificationRef, {
          read: true,
          readAt: Timestamp.now()
        });
      });

      await batch.commit();
      console.log("Notifications marked as read in database:", selected);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `${selected.length} notification${selected.length > 1 ? 's' : ''} marked as read`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      // Local state will be updated automatically via the onSnapshot listener
      setSelected([]);
    } catch (error) {
      console.error("Error marking as read:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to mark notifications as read',
        confirmButtonColor: '#3085d6'
      });
    }
  };
  
  const handleMarkAsUnread = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || selected.length === 0) return;

      const batch = writeBatch(db);
      
      selected.forEach((notificationId) => {
        const notificationRef = doc(db, "notifications", notificationId);
        batch.update(notificationRef, {
          read: false,
          readAt: null // Remove the readAt timestamp
        });
      });

      await batch.commit();
      console.log("Notifications marked as unread in database:", selected);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `${selected.length} notification${selected.length > 1 ? 's' : ''} marked as unread`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      // Local state will be updated automatically via the onSnapshot listener
      setSelected([]);
    } catch (error) {
      console.error("Error marking as unread:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to mark notifications as unread',
        confirmButtonColor: '#3085d6'
      });
    }
  };

  const handleDelete = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || selected.length === 0) return;

      // Show confirmation dialog
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete ${selected.length} notification${selected.length > 1 ? 's' : ''}. This action cannot be undone!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, delete!',
        cancelButtonText: 'Cancel',
        reverseButtons: true
      });

      if (!result.isConfirmed) {
        return;
      }

      const batch = writeBatch(db);
      
      selected.forEach((notificationId) => {
        const notificationRef = doc(db, "notifications", notificationId);
        batch.delete(notificationRef);
      });

      await batch.commit();
      console.log("Notifications deleted from database:", selected);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: `${selected.length} notification${selected.length > 1 ? 's have' : ' has'} been deleted successfully.`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      // Local state will be updated automatically via the onSnapshot listener
      setSelected([]);
    } catch (error) {
      console.error("Error deleting notifications:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to delete notifications. Please try again.',
        confirmButtonColor: '#3085d6'
      });
    }
  };

  const handleOpenEmail = (emailId) => {
    if (emailId) {
      window.open(`https://mail.google.com/mail/u/0/#inbox/${emailId}`, '_blank');
    } else {
      window.open('https://mail.google.com/mail/u/0/#inbox', '_blank');
    }
  };

  const handleRowClick = async (notification) => {
    try {
      // If notification is unread, mark it as read in the database
      if (!notification.read) {
        const notificationRef = doc(db, "notifications", notification.id);
        await updateDoc(notificationRef, {
          read: true,
          readAt: Timestamp.now()
        });
        console.log("Notification marked as read:", notification.id);
        // Local state will be updated automatically via the onSnapshot listener
      }
      
      // If it has an email link, open it in Gmail
      if (notification.emailId) {
        handleOpenEmail(notification.emailId);
      }
      
      // If it has a redirect URL, navigate to it
      if (notification.redirectUrl) {
        window.location.href = notification.redirectUrl;
      }
    } catch (error) {
      console.error("Error processing notification click:", error);
    }
  };

  // Filter notifications based on selected filter and search term
  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && !notification.read) || 
                         (filter === 'read' && notification.read);
    
    const matchesSearch = searchTerm === '' || 
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.from.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Format date to display
  const formatDate = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // If today, show time only
    if (notifDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString();
  };

  // Get time for more specific display
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get appropriate icon based on notation type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
      case 'booking_Confirmed':
        return <Calendar size={20} className="text-blue-600" />;
      case 'booking_Cancelled':
        return <Calendar size={20} className="text-red-600" />;
      case 'booking_Completed':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'feedback':
        return <StarIcon size={20} className="text-orange-600" />;
      case 'account_approval':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'email':
        return <Mail size={20} className="text-purple-600" />;
      default:
        return <Bell size={20} className="text-gray-600" />;
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(notification => !notification.read).length;
  };

  const getFilterCounts = () => {
    return {
      all: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      read: notifications.filter(n => n.read).length
    };
  };

  const filterCounts = getFilterCounts();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="sticky top-0 h-screen w-64 transition-all duration-300 bg-white border-r shadow-sm z-20">
        <SidebarOwner onLogout={handleLogout} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-200">
          <TopbarOwner />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full h-full">
            {/* Page Header */}
            <div className="p-6 pb-4">
            </div>

            <div className="mx-6 bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Header with stats and filters */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">
                        Inbox ({notifications.length})
                      </span>
                      {getUnreadCount() > 0 && (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                          {getUnreadCount()} unread
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-64"
                      />
                    </div>
                    
                    {/* Filter buttons */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button 
                        onClick={() => setFilter('all')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          filter === 'all' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All ({filterCounts.all})
                      </button>
                      <button 
                        onClick={() => setFilter('unread')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          filter === 'unread' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Unread ({filterCounts.unread})
                      </button>
                      <button 
                        onClick={() => setFilter('read')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          filter === 'read' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Read ({filterCounts.read})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              {selected.length > 0 && (
                <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-blue-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {selected.length} notification{selected.length > 1 ? 's' : ''} selected
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        onClick={handleMarkAsRead}
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Mark Read
                      </button>
                      
                      <button 
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        onClick={handleMarkAsUnread}
                      >
                        <XCircle size={16} className="mr-2" />
                        Mark Unread
                      </button>
                      
                      <button 
                        className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors"
                        onClick={handleDelete}
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications List */}
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <div className="text-gray-500">Loading notifications...</div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col justify-center items-center p-12">
                  <Bell className="h-12 w-12 text-gray-400 mb-4" />
                  <div className="text-gray-500 text-lg font-medium mb-2">
                    {searchTerm ? 'No matching notifications' : 'No notifications found'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {searchTerm ? 'Try adjusting your search terms' : 'You\'re all caught up!'}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {/* Select all header */}
                  <div className="px-6 py-3 bg-gray-50">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        onChange={handleSelectAllClick}
                        checked={filteredNotifications.length > 0 && selected.length === filteredNotifications.length}
                      />
                      <span className="ml-3 text-sm text-gray-600">
                        Select all notifications
                      </span>
                    </label>
                  </div>

                  {/* Notifications */}
                  {filteredNotifications.map((notification) => {
                    const isItemSelected = isSelected(notification.id);

                    return (
                      <div
                        key={notification.id}
                        className={`flex items-center px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          notification.read ? 'bg-white' : 'bg-blue-50/50'
                        } ${isItemSelected ? 'bg-blue-100' : ''}`}
                        onClick={(event) => {
                          if (!event.target.closest('input[type="checkbox"]')) {
                            handleRowClick(notification);
                          }
                        }}
                      >
                        {/* Checkbox */}
                        <div className="flex-shrink-0 mr-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            checked={isItemSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleClick(e, notification.id);
                            }}
                          />
                        </div>

                        {/* Icon */}
                        <div className="flex-shrink-0 mr-4">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center">
                              <p className={`text-sm ${notification.read ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                                {notification.from || 'System'}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                              )}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <span>{formatDate(notification.timestamp)}</span>
                              {formatTime(notification.timestamp) !== formatDate(notification.timestamp) && (
                                <span className="ml-1">• {formatTime(notification.timestamp)}</span>
                              )}
                            </div>
                          </div>
                          
                          <p className={`text-sm text-gray-600 line-clamp-2 ${!notification.read ? 'font-medium' : ''}`}>
                            {notification.message}
                          </p>
                          
                          {/* Additional info */}
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            {notification.emailId && (
                              <span className="text-blue-500 font-medium">📧 Gmail Link</span>
                            )}
                            {notification.stars && (
                              <span className="text-orange-500">{notification.stars}</span>
                            )}
                            {notification.vehicleInfo && (
                              <span className="text-gray-500">{notification.vehicleInfo}</span>
                            )}
                          </div>
                        </div>

                        {/* Status indicator */}
                        <div className="flex-shrink-0 ml-4">
                          {notification.read ? (
                            <CheckCircle size={20} className="text-green-500" />
                          ) : (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notification;