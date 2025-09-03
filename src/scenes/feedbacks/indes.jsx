import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Star, StarBorder, ArrowDropDown, Restore } from "@mui/icons-material";
import Swal from "sweetalert2";
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";

const Feedbacks = () => {
  const [reviews, setReviews] = useState([]);
  const [deletedReviews, setDeletedReviews] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [selectedTrash, setSelectedTrash] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Enhanced fetch function with better error handling
  const fetchReviews = async () => {
    try {
      // Get current user from Firebase Auth instead of localStorage
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("No authenticated user found");
        Swal.fire("Error", "Please log in to view reviews", "error");
        window.location.href = "/login";
        return;
      }

      const ownerId = currentUser.uid;
      console.log("Fetching reviews for owner:", ownerId);

      // Query reviews for this owner
      const q = query(
        collection(db, "reviews"),
        where("ownerId", "==", ownerId)
      );
      
      const querySnapshot = await getDocs(q);
      console.log("Found reviews:", querySnapshot.size);
      
      const reviewsData = [];
      const uniqueVehicles = new Set();
      
      // Process reviews with additional data
      for (const docRef of querySnapshot.docs) {
        const reviewData = docRef.data();
        console.log("Processing review:", reviewData);
        
        // Get user data safely
        let userName = "Unknown User";
        if (reviewData.userId) {
          try {
            const userDoc = await getDoc(doc(db, "users", reviewData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userName = userData.name || userData.firstName || userData.email || "Unknown User";
            }
          } catch (error) {
            console.error("Error fetching user data for", reviewData.userId, ":", error);
          }
        }

        // Get vehicle data safely
        let vehicleName = "Unknown Vehicle";
        if (reviewData.vehicleId) {
          try {
            const vehicleDoc = await getDoc(doc(db, "vehicles", reviewData.vehicleId));
            if (vehicleDoc.exists()) {
              const vehicleData = vehicleDoc.data();
              vehicleName = `${vehicleData.make || vehicleData.brand || ""} ${vehicleData.model || ""}`.trim() || "Unknown Vehicle";
            }
          } catch (error) {
            console.error("Error fetching vehicle data for", reviewData.vehicleId, ":", error);
          }
        }

        // Add vehicle to unique vehicles set
        uniqueVehicles.add(vehicleName);

        // Format date safely
        let formattedDate = "No date";
        if (reviewData.timestamp) {
          try {
            const date = reviewData.timestamp.toDate ? reviewData.timestamp.toDate() : new Date(reviewData.timestamp);
            formattedDate = date.toLocaleDateString("en-US", {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          } catch (error) {
            console.error("Error formatting date:", error);
            formattedDate = "Invalid date";
          }
        } else if (reviewData.createdAt) {
          try {
            const date = reviewData.createdAt.toDate ? reviewData.createdAt.toDate() : new Date(reviewData.createdAt);
            formattedDate = date.toLocaleDateString("en-US", {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          } catch (error) {
            console.error("Error formatting createdAt date:", error);
          }
        }

        reviewsData.push({
          id: docRef.id,
          car: vehicleName,
          user: userName,
          date: formattedDate,
          review: reviewData.reviewText || reviewData.review || reviewData.comment || "No review text",
          rating: reviewData.rating || 0,
          ...reviewData
        });
      }

      console.log("Processed reviews data:", reviewsData);
      setReviews(reviewsData);
      setVehicles(Array.from(uniqueVehicles).sort());
    } catch (error) {
      console.error("Error fetching reviews:", error);
      
      // More specific error messages
      let errorMessage = "Failed to load reviews";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your authentication.";
      } else if (error.code === 'unavailable') {
        errorMessage = "Firebase service is currently unavailable. Please try again later.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      Swal.fire("Error", errorMessage, "error");
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthChecked(true);
      if (user) {
        setIsAuthenticated(true);
        fetchReviews();
      } else {
        setIsAuthenticated(false);
        console.log("No user authenticated");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    const deletedReview = reviews.find((review) => review.id === id);

    // First confirmation - are you sure?
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete review by ${deletedReview.user}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e3342f",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel"
    });

    if (result.isConfirmed) {
      try {
        // Show loading state
        Swal.fire({
          title: 'Deleting...',
          text: 'Please wait while we delete the review.',
          icon: 'info',
          allowOutsideClick: false,
          showConfirmButton: false,
          willOpen: () => {
            Swal.showLoading();
          }
        });

        await deleteDoc(doc(db, "reviews", id));
        setDeletedReviews([...deletedReviews, deletedReview]);
        setReviews(reviews.filter((r) => r.id !== id));
        setSelectedTrash(null); // Reset selected trash
        
        // Update vehicles list if this was the last review for this vehicle
        const remainingReviews = reviews.filter((r) => r.id !== id);
        const remainingVehicles = [...new Set(remainingReviews.map(r => r.car))].sort();
        setVehicles(remainingVehicles);
        
        // Reset vehicle filter if the selected vehicle no longer has reviews
        if (vehicleFilter && !remainingVehicles.includes(vehicleFilter)) {
          setVehicleFilter("");
        }
        
        // Success message
        await Swal.fire({
          title: "Deleted!",
          text: "Review has been deleted successfully.",
          icon: "success",
          confirmButtonColor: "#10b981",
          timer: 2000,
          timerProgressBar: true
        });
      } catch (error) {
        console.error("Delete error:", error);
        await Swal.fire({
          title: "Error!",
          text: "Failed to delete review. Please try again.",
          icon: "error",
          confirmButtonColor: "#e3342f"
        });
      }
    }
  };

  const handleRetrieve = async (id) => {
    const restored = deletedReviews.find((r) => r.id === id);

    Swal.fire({
      title: "Restore review?",
      text: `Restore review by ${restored.user}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#38b2ac",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, restore it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { id: docId, ...reviewData } = restored;
          await addDoc(collection(db, "reviews"), reviewData);
          setReviews([...reviews, restored]);
          setDeletedReviews(deletedReviews.filter((r) => r.id !== id));
          
          // Update vehicles list
          const updatedVehicles = [...new Set([...reviews.map(r => r.car), restored.car])].sort();
          setVehicles(updatedVehicles);
          
          Swal.fire("Restored!", "Review restored successfully.", "success");
        } catch (error) {
          console.error("Restore error:", error);
          Swal.fire("Error!", "Failed to restore review.", "error");
        }
      }
    });
  };

  // Simplified filtering function (only vehicle filter)
  const filteredReviews = reviews.filter((review) => {
    const matchesVehicle = vehicleFilter ? review.car === vehicleFilter : true;
    return matchesVehicle;
  });

  const handleVehicleFilter = (vehicle) => {
    setVehicleFilter(vehicle === vehicleFilter ? "" : vehicle);
    setVehicleDropdownOpen(false);
  };

  const clearAllFilters = () => {
    setVehicleFilter("");
  };

  return (
    <div className="flex min-h-screen">
      <SidebarOwner onLogout={handleLogout} />
      <div className="flex flex-col flex-1 bg-gray-50">
        <div className="sticky top-0 z-20 bg-white shadow-lg">
          <TopbarOwner />
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-col w-full h-full bg-gray-50">
            {/* Header and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">Client Feedback</h1>
              </div>

              {vehicles.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-4 w-full sm:w-auto border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className="text-sm text-gray-600 font-medium">Filter by:</span>
                    
                    {/* Vehicle Filter */}
                    <div className="relative w-full sm:w-52">
                      <button
                        onClick={() => setVehicleDropdownOpen(!vehicleDropdownOpen)}
                        className="flex items-center justify-between border border-gray-300 bg-white px-4 py-2 rounded-lg w-full shadow-md hover:border-blue-500 hover:shadow-lg transition-all duration-200"
                      >
                        <span className={`text-sm ${vehicleFilter ? "text-gray-900" : "text-gray-500"}`}>
                          {vehicleFilter || "All Vehicles"}
                        </span>
                        <ArrowDropDown className={`text-gray-600 ml-2 transition-transform ${vehicleDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {vehicleDropdownOpen && (
                        <div className="absolute mt-1 right-0 bg-white border border-gray-300 shadow-xl rounded-lg w-64 z-10 overflow-hidden max-h-48 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-200 flex items-center"
                            onClick={() => handleVehicleFilter("")}
                          >
                            All Vehicles
                          </div>
                          {vehicles.map((vehicle) => (
                            <div
                              key={vehicle}
                              className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-200 last:border-0"
                              onClick={() => handleVehicleFilter(vehicle)}
                            >
                              {vehicle}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Clear Filters Button */}
                    {vehicleFilter && (
                      <button
                        onClick={clearAllFilters}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Active Reviews */}
            <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Active Reviews</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredReviews.length} {filteredReviews.length === 1 ? "review" : "reviews"} 
                    {vehicleFilter && ` (filtered from ${reviews.length})`}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                {filteredReviews.length > 0 ? (
                  filteredReviews.map((review) => (
                    <div key={review.id} className="p-6 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-200 relative">
                      <div className="flex items-start gap-4">
                        <div className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 rounded-full w-12 h-12 flex items-center justify-center font-semibold shadow-md">
                          {review.user?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">{review.user}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{review.date}</span>
                              <button
                                onClick={() => setSelectedTrash(selectedTrash === review.id ? null : review.id)}
                                className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shadow-md hover:shadow-lg"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm font-medium text-gray-600 mt-1">{review.car}</p>

                          <div className="flex mt-2">
                            {Array.from({ length: 5 }).map((_, index) =>
                              index < review.rating ? (
                                <Star key={index} className="text-yellow-400" fontSize="small" />
                              ) : (
                                <StarBorder key={index} className="text-yellow-400" fontSize="small" />
                              )
                            )}
                            <span className="ml-2 text-sm text-gray-600 font-medium">{review.rating}.0</span>
                          </div>

                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                            <p className="text-gray-700 text-sm leading-relaxed italic">"{review.review}"</p>
                          </div>
                        </div>
                      </div>
                      {selectedTrash === review.id && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-lg backdrop-blur-sm">
                          <div className="bg-white p-4 rounded-lg shadow-2xl border border-gray-200">
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => handleDelete(review.id)}
                                className="bg-red-500 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-red-600 hover:shadow-xl transition-all duration-200"
                              >
                                Delete Review
                              </button>
                              <button
                                onClick={() => setSelectedTrash(null)}
                                className="bg-gray-500 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-gray-600 hover:shadow-xl transition-all duration-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Star className="text-gray-400" fontSize="large" />
                    </div>
                    <p className="text-gray-500 text-lg">
                      {!authChecked 
                        ? "Loading..." 
                        : !isAuthenticated 
                        ? "Please log in to view reviews" 
                        : reviews.length === 0
                        ? "No reviews found"
                        : "No reviews match your current filter"}
                    </p>
                    {vehicleFilter && reviews.length > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Deleted Reviews */}
            {deletedReviews.length > 0 && (
              <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200 mt-6">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-pink-50">
                  <h2 className="text-lg font-semibold text-gray-800">Deleted Reviews</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {deletedReviews.length} deleted {deletedReviews.length === 1 ? "review" : "reviews"}
                  </p>
                </div>

                <div className="divide-y divide-gray-200 max-h-[30vh] overflow-y-auto">
                  {deletedReviews.map((review) => (
                    <div key={review.id} className="p-6 hover:bg-gradient-to-r hover:from-gray-50 hover:to-red-50 transition-all duration-200 relative opacity-75">
                      <div className="flex items-start gap-4">
                        <div className="bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600 rounded-full w-12 h-12 flex items-center justify-center font-semibold shadow-md">
                          {review.user?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-700">{review.user}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{review.date}</span>
                              <button
                                onClick={() => handleRetrieve(review.id)}
                                className="p-2 rounded-full text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors shadow-md hover:shadow-lg"
                              >
                                <Restore fontSize="small" />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm font-medium text-gray-500 mt-1">{review.car}</p>

                          <div className="flex mt-2">
                            {Array.from({ length: 5 }).map((_, index) =>
                              index < review.rating ? (
                                <Star key={index} className="text-yellow-400" fontSize="small" />
                              ) : (
                                <StarBorder key={index} className="text-yellow-400" fontSize="small" />
                              )
                            )}
                            <span className="ml-2 text-sm text-gray-500">{review.rating}.0</span>
                          </div>

                          <div className="mt-3 p-3 bg-gray-100 rounded-lg border-l-4 border-gray-400">
                            <p className="text-gray-600 text-sm leading-relaxed italic line-through">"{review.review}"</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedbacks;