import {
  Box,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Divider,
  Button,
} from "@mui/material";
import { 
  Bell, 
  User, 
  Calendar,
  Star as StarIcon,
  Car,
  CheckCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
  doc,
  updateDoc,
  setDoc,
  writeBatch, 
  getDoc
} from "firebase/firestore";

const TopbarOwner = () => {
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = (path) => {
    if (path.startsWith("/profile")) return "Owner Profile";
    if (path.startsWith("/notifications")) return "Notifications";
    if (path.startsWith("/bookings")) return "Bookings";
    if (path.startsWith("/units")) return "Units";
    if (path.startsWith("/clients")) return "Clients";
    if (path.startsWith("/feedbacks")) return "Feedbacks";
    if (path.startsWith("/report")) return "Car Reports";
    if (path.startsWith("/calendar")) return "Calendar";
    return "Dashboard";
  };

  const pageTitle = getPageTitle(location.pathname);

  const isNotificationsOpen = Boolean(notificationAnchorEl);

  // Function to save notification to database
  const saveNotificationToDb = async (notification, userId) => {
    try {
      const notificationData = {
        ...notification,
        userId: userId,
        createdAt: Timestamp.now(),
        read: false,
        updatedAt: Timestamp.now()
      };
      
      // Use the notification ID as document ID to prevent duplicates
      const notificationRef = doc(db, "notifications", notification.id);
      
      // Use a transaction to ensure atomicity
      const { runTransaction } = await import("firebase/firestore");
      
      await runTransaction(db, async (transaction) => {
        const existingDoc = await transaction.get(notificationRef);
        
        if (!existingDoc.exists()) {
          // Only create if it doesn't exist
          transaction.set(notificationRef, notificationData);
          console.log("New notification saved to database:", notification.id);
        } else {
          console.log("Notification already exists, skipping:", notification.id);
        }
      });
      
    } catch (error) {
      console.error("Error saving notification to database:", error);
      // Fallback to regular set if transaction fails
      try {
        const notificationRef = doc(db, "notifications", notification.id);
        const existingDoc = await getDoc(notificationRef);
        
        if (!existingDoc.exists()) {
          // Must re-define notificationData here in fallback scope too
          const fallbackNotificationData = {
            ...notification,
            userId: userId,
            createdAt: Timestamp.now(),
            read: false,
            updatedAt: Timestamp.now()
          };
          await setDoc(notificationRef, fallbackNotificationData);
          console.log("Notification saved with fallback method:", notification.id);
        }
      } catch (fallbackError) {
        console.error("Fallback save also failed:", fallbackError);
      }
    }
  };

  // Function to mark notification as read in database
  const markNotificationAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: Timestamp.now(),
      });
      console.log("Notification marked as read in database:", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Function to mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      setIsMarkingAllRead(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const batch = writeBatch(db);
      const unreadNotifs = notifications.filter((notif) => !notif.read);

      unreadNotifs.forEach((notif) => {
        const notificationRef = doc(db, "notifications", notif.id);
        batch.update(notificationRef, {
          read: true,
          readAt: Timestamp.now(),
        });
      });

      await batch.commit();

      // Update local state
      setNotifications((prevNotifications) =>
        prevNotifications.map((notif) => ({ ...notif, read: true }))
      );
      setUnreadNotifications(0);

      console.log("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const validateBookingExists = async (bookingId, ownerId) => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      const bookingDoc = await getDoc(bookingRef);

      if (!bookingDoc.exists()) {
        console.log("Booking no longer exists:", bookingId);
        return false;
      }

      const bookingData = bookingDoc.data();
      if (bookingData.ownerId !== ownerId) {
        console.log("Booking owner mismatch:", bookingId);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating booking:", error);
      return false;
    }
  };

  const cleanupOrphanedNotifications = async (userId) => {
    try {
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where("userId", "==", userId),
        where("type", "in", [
          "booking",
          "booking_Confirmed",
          "booking_Cancelled",
          "booking_Completed",
        ])
      );

      const snapshot = await getDocs(notificationsQuery);
      const batch = writeBatch(db);
      let deletedCount = 0;

      for (const notifDoc of snapshot.docs) {
        const notifData = notifDoc.data();
        if (notifData.bookingId) {
          const bookingExists = await validateBookingExists(
            notifData.bookingId,
            userId
          );
          if (!bookingExists) {
            batch.delete(notifDoc.ref);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
        console.log(`Cleaned up ${deletedCount} orphaned notifications`);
      }
    } catch (error) {
      console.error("Error cleaning up orphaned notifications:", error);
    }
  };

  // Load existing notifications from database
  useEffect(() => {
    const loadExistingNotifications = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const notificationsRef = collection(db, "notifications");
        const notificationsQuery = query(
          notificationsRef,
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
          notificationsQuery,
          (snapshot) => {
            const existingNotifications = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            setNotifications(existingNotifications);
            const unreadCount = existingNotifications.filter(
              (notif) => !notif.read
            ).length;
            setUnreadNotifications(unreadCount);

            console.log(
              "Loaded existing notifications:",
              existingNotifications.length
            );
          },
          (error) => {
            console.error("Error loading existing notifications:", error);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up notifications listener:", error);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadExistingNotifications();
      }
    });

    return unsubscribe;
  }, []);

  // Fixed booking notifications
  useEffect(() => {
    const setupBookingNotifications = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.log("No authenticated user found");
          return;
        }

        console.log(
          "Setting up booking notifications for user:",
          currentUser.uid
        );

        // First, get all existing notifications to avoid duplicates
        const existingNotificationsMap = new Map();
        try {
          const notificationsRef = collection(db, "notifications");
          const existingQuery = query(
            notificationsRef,
            where("userId", "==", currentUser.uid),
            where("type", "in", [
              "booking",
              "booking_Confirmed",
              "booking_Cancelled",
              "booking_Completed",
            ])
          );
          const existingSnapshot = await getDocs(existingQuery);
          existingSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.bookingId) {
              // Store both the notification key and the last processed status
              existingNotificationsMap.set(`${data.bookingId}_${data.type}`, {
                notificationId: doc.id,
                lastStatus: data.type,
                createdAt: data.createdAt,
              });
            }
          });
          console.log("Existing notifications loaded:", existingNotificationsMap.size);
        } catch (error) {
          console.error("Error loading existing notifications:", error);
        }

        const bookingsRef = collection(db, "bookings");
        const bookingsQuery = query(
          bookingsRef,
          where("ownerId", "==", currentUser.uid),
          orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(
          bookingsQuery,
          async (snapshot) => {
            console.log("Booking snapshot received, docs:", snapshot.docs.length);

            // Process only actual changes, not initial load
            for (const change of snapshot.docChanges()) {
              const docChange = change.doc;
              const data = docChange.data();
              const bookingId = docChange.id;

              console.log("Processing booking change:", change.type, bookingId, data.status);

              // Only process if this is a new booking or status change
              if (change.type === "added" || (change.type === "modified" && data.status)) {
                let notificationType = "booking";
                let notificationMessage = "";

                switch (data.status) {
                  case "Pending":
                    notificationType = "booking";
                    notificationMessage = `New booking request for ${data.vehicleBrand || ""} ${
                      data.vehicleModel || "your vehicle"
                    }`;
                    break;
                  case "Accepted":
                    notificationType = "booking_Confirmed";
                    notificationMessage = `Booking confirmed for ${data.vehicleBrand || ""} ${
                      data.vehicleModel || "your vehicle"
                    }`;
                    break;
                  case "Cancelled":
                    notificationType = "booking_Cancelled";
                    notificationMessage = `Booking cancelled for ${data.vehicleBrand || ""} ${
                      data.vehicleModel || "your vehicle"
                    }`;
                    break;
                  case "Completed":
                    notificationType = "booking_Completed";
                    notificationMessage = `Booking completed for ${data.vehicleBrand || ""} ${
                      data.vehicleModel || "your vehicle"
                    }`;
                    break;
                  default:
                    // Skip unknown statuses
                    return;
                }

                const uniqueNotificationKey = `${bookingId}_${notificationType}`;

                // Check if we should create this notification
                const existingNotif = existingNotificationsMap.get(uniqueNotificationKey);

                if (!existingNotif) {
                  // Create new notification only if it doesn't exist
                  const notification = {
                    id: `booking_${uniqueNotificationKey}`,
                    type: notificationType,
                    title: data.status === "Pending" ? "New Booking Request" : "Booking Update",
                    message: notificationMessage,
                    time: data.timestamp || data.updatedAt || Timestamp.now(),
                    read: false,
                    routePath: `/bookings?id=${bookingId}`,
                    bookingId: bookingId,
                    userId: data.userId,
                    vehicleInfo: `${data.vehicleBrand || ""} ${data.vehicleModel || ""}`.trim(),
                  };

                  await saveNotificationToDb(notification, currentUser.uid);
                  existingNotificationsMap.set(uniqueNotificationKey, {
                    notificationId: notification.id,
                    lastStatus: notificationType,
                    createdAt: Timestamp.now(),
                  });
                  console.log("Created new booking notification:", uniqueNotificationKey);
                } else {
                  console.log("Notification already exists, skipping:", uniqueNotificationKey);
                }
              }
            }
          },
          (error) => {
            console.error("Error in booking notifications listener:", error);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up booking notifications:", error);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setupBookingNotifications();
      }
    });

    return unsubscribe;
  }, []);

  // Fixed reviews notifications
  useEffect(() => {
    let unsubscribeReviews = null;

    const setupReviewNotifications = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const reviewsRef = collection(db, "reviews");
        const reviewsQuery = query(reviewsRef, where("ownerId", "==", currentUser.uid), limit(20));

        // Check existing notifications first
        const existingNotifications = new Set();
        try {
          const notificationsRef = collection(db, "notifications");
          const existingQuery = query(
            notificationsRef,
            where("userId", "==", currentUser.uid),
            where("type", "==", "feedback")
          );
          const existingSnapshot = await getDocs(existingQuery);
          existingSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.reviewId) {
              existingNotifications.add(data.reviewId);
            }
          });
        } catch (error) {
          console.error("Error checking existing notifications:", error);
        }

        const unsubscribe = onSnapshot(
          reviewsQuery,
          (snapshot) => {
            console.log("Review snapshot received, docs:", snapshot.docs.length);

            snapshot.docChanges().forEach(async (change) => {
              const docChange = change.doc;
              const data = docChange.data();
              const reviewId = docChange.id;

              if (change.type === "added" && !existingNotifications.has(reviewId)) {
                const rating = data.rating || 0;
                const stars =
                  Array.from({ length: Math.floor(rating) }, (_, i) => `★${i}`).join("") +
                  Array.from({ length: 5 - Math.floor(rating) }, (_, i) => `☆${i}`).join("");

                const notification = {
                  id: `review_${reviewId}`,
                  type: "feedback",
                  title: `New ${rating}-Star Review`,
                  message: `Someone left a ${rating}-star review: "${
                    data.reviewText?.substring(0, 50) || "No comment"
                  }${data.reviewText?.length > 50 ? "..." : ""}"`,
                  time: data.timestamp || Timestamp.now(),
                  read: false,
                  routePath: `/feedbacks`,
                  rating: rating,
                  stars: stars,
                  reviewText: data.reviewText || "",
                  bookingId: data.bookingId,
                  reviewerId: data.userId,
                  vehicleId: data.vehicleId,
                  reviewId: reviewId,
                };

                await saveNotificationToDb(notification, auth.currentUser.uid);
                existingNotifications.add(reviewId);
              }
            });
          },
          (error) => {
            console.error("Error in review notifications listener:", error);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up review notifications:", error);
      }
    };

    const initializeReviewNotifications = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        unsubscribeReviews = await setupReviewNotifications();
      } catch (error) {
        console.error("Error initializing review notifications:", error);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        initializeReviewNotifications();
      } else {
        if (unsubscribeReviews) {
          unsubscribeReviews();
          unsubscribeReviews = null;
        }
      }
    });

    // Cleanup function
    return () => {
      unsubscribeAuth();
      if (unsubscribeReviews) {
        unsubscribeReviews();
      }
    };
  }, []);

  const handleViewAllNotifications = () => {
    setNotificationAnchorEl(null);
    navigate("/notifications");
  };

  // Fixed notification click handler
  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read in database first
      await markNotificationAsRead(notification.id);

      // Update local state immediately for better UX
      setNotifications((prevNotifications) =>
        prevNotifications.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );

      // Update unread count
      setUnreadNotifications((prev) => Math.max(0, prev - 1));

      // Close menu and navigate
      setNotificationAnchorEl(null);
      navigate(notification.routePath);

      console.log("Notification marked as read:", notification.id);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;

      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "booking":
      case "booking_Confirmed":
        return <Calendar size={16} color="#1976d2" />;
      case "booking_Cancelled":
        return <Calendar size={16} color="#f44336" />;
      case "booking_Completed":
        return <CheckCircle size={16} color="#4caf50" />;
      case "feedback":
        return <StarIcon size={16} color="#ff9800" />;
      default:
        return <Car size={16} color="#757575" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "booking":
      case "booking_Confirmed":
        return "rgba(25, 118, 210, 0.12)";
      case "booking_Cancelled":
        return "rgba(244, 67, 54, 0.12)";
      case "booking_Completed":
        return "rgba(76, 175, 80, 0.12)";
      case "feedback":
        return "rgba(255, 152, 0, 0.12)";
      default:
        return "rgba(117, 117, 117, 0.12)";
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px={4}
      py={2}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        bgcolor: "#f8f9fa",
        color: "#333",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      {/* Title */}
      <Typography variant="h5" fontWeight="600" color="black">
        {pageTitle}
      </Typography>

      {/* Action Icons */}
      <Box display="flex" alignItems="center" gap={2}>
        {/* Enhanced Notifications with Arrow */}
        <Box position="relative">
          <Tooltip title="Notifications">
            <IconButton
              onClick={(e) => setNotificationAnchorEl(e.currentTarget)}
              sx={{
                position: "relative",
                borderRadius: 2,
                bgcolor: isNotificationsOpen
                  ? "rgba(25, 118, 210, 0.12)"
                  : "transparent",
                "&:hover": {
                  bgcolor: isNotificationsOpen
                    ? "rgba(25, 118, 210, 0.18)"
                    : "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <Badge badgeContent={unreadNotifications} color="error" max={99}>
                <Bell size={20} />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Arrow for Notifications */}
          {isNotificationsOpen && (
            <Box
              sx={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderBottom: "8px solid white",
                zIndex: 1300,
                filter: "drop-shadow(0 -2px 4px rgba(0,0,0,0.1))",
              }}
            />
          )}
        </Box>

        <Menu
          anchorEl={notificationAnchorEl}
          open={isNotificationsOpen}
          onClose={() => setNotificationAnchorEl(null)}
          sx={{
            mt: "53px",
            "& .MuiPaper-root": {
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              border: "1px solid rgba(0,0,0,0.08)",
            },
          }}
          PaperProps={{ sx: { width: 360, maxHeight: 400 } }}
        >
          <MenuItem disabled sx={{ py: 1 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Typography variant="subtitle2" fontWeight="bold">
                Notifications {unreadNotifications > 0 && `(${unreadNotifications} new)`}
              </Typography>
              {unreadNotifications > 0 && (
                <Button
                  size="small"
                  onClick={markAllNotificationsAsRead}
                  disabled={isMarkingAllRead}
                  sx={{
                    minWidth: "auto",
                    py: 0.5,
                    px: 1,
                    fontSize: "0.75rem",
                    textTransform: "none",
                  }}
                >
                  {isMarkingAllRead ? "Marking..." : "Mark all read"}
                </Button>
              )}
            </Box>
          </MenuItem>
          <Divider />
          {notifications.length > 0 ? (
            notifications.slice(0, 8).map((notif) => (
              <MenuItem
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                sx={{
                  bgcolor: notif.read ? "inherit" : "rgba(25, 118, 210, 0.08)",
                  "&:hover": {
                    bgcolor: notif.read
                      ? "rgba(0, 0, 0, 0.04)"
                      : "rgba(25, 118, 210, 0.12)",
                  },
                  py: 1.5,
                  borderLeft: notif.read ? "none" : "3px solid #1976d2",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
                  <Box
                    sx={{
                      mr: 1.5,
                      p: 1,
                      backgroundColor: getNotificationColor(notif.type),
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 32,
                      height: 32,
                    }}
                  >
                    {getNotificationIcon(notif.type)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 0.5,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: notif.read ? "normal" : "bold",
                          lineHeight: 1.2,
                        }}
                      >
                        {notif.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1, flexShrink: 0 }}
                      >
                        {formatDate(notif.time)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        fontWeight: notif.read ? "normal" : "medium",
                        lineHeight: 1.3,
                      }}
                    >
                      {notif.message}
                    </Typography>
                    {notif.type === "feedback" && notif.stars && (
                      <Typography
                        variant="caption"
                        color="primary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {notif.stars}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled sx={{ py: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                <Bell size={24} color="#ccc" style={{ marginRight: 8 }} />
                <Typography variant="body2" color="text.secondary">
                  No notifications yet
                </Typography>
              </Box>
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={handleViewAllNotifications} sx={{ py: 1.5 }}>
            <Typography color="primary" sx={{ fontWeight: 500 }}>
              View all notifications
            </Typography>
          </MenuItem>
        </Menu>

        {/* Profile Icon */}
        <Tooltip title="Profile">
          <IconButton
            component={Link}
            to="/profile"
            sx={{
              ml: 1,
              position: "relative",
              borderRadius: 2,
              bgcolor: location.pathname.startsWith("/profile")
                ? "rgba(25, 118, 210, 0.12)"
                : "transparent",
              "&:hover": {
                bgcolor: location.pathname.startsWith("/profile")
                  ? "rgba(25, 118, 210, 0.18)"
                  : "rgba(0, 0, 0, 0.04)",
              },
            }}
          >
            <User size={20} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default TopbarOwner;