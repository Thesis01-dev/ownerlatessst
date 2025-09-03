import React, { useState, useEffect } from "react";
import { Edit3, Trash2, Plus, Search, X, Car, Upload, Eye, ArrowLeft, Camera } from "lucide-react";
import Swal from "sweetalert2";
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";
import { useNavigate } from "react-router-dom";
import { db, auth, storage } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  where,
  Timestamp,
  writeBatch,
  updateDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';

const Units = () => {
  const [userData, setUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formError, setFormError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [accountStatus, setAccountStatus] = useState("pending");
  const [isAdmin, setIsAdmin] = useState(false);
  const [nextVehicleNumber, setNextVehicleNumber] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const navigate = useNavigate();

  // Form data for adding a new vehicle
  const [carData, setCarData] = useState({
    model: "",
    brand: "",
    year: "",
    carNumber: "",
    transmission: "",
    capacity: "",
    price: "",
    hourlyRate: "",
    status: "Available",
    uid: "",
    users: "",
    fuelType: "",
    description: "",
    minRentalPeriod: "",
    fuelReturnPolicy: "same",
    securityDeposit: "",
    vehicleNumber: 0,
    carType: "",
    mainImageUrl: "",
    angleImageUrls: [],
    gcashQrUrl: ""
  });

  // Form data for editing a vehicle
  const [editFormData, setEditFormData] = useState({
    model: "",
    brand: "",
    year: "",
    carNumber: "",
    transmission: "",
    capacity: "",
    price: "",
    hourlyRate: "",
    status: "Available",
    fuelType: "",
    description: "",
    minRentalPeriod: "",
    fuelReturnPolicy: "same",
    securityDeposit: "",
    carType: "",
    mainImageUrl: "",
    angleImageUrls: [],
    gcashQrUrl: ""
  });

  const [imageFiles, setImageFiles] = useState({
    mainImage: null,
    angleImages: [null, null, null],
    gcashQr: null
  });

  const [editImageFiles, setEditImageFiles] = useState({
    mainImage: null,
    angleImages: [null, null, null],
    gcashQr: null
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            setIsAdmin(userData.role === "admin");
            setAccountStatus(userData.status || "pending");
            const userBusinessName = userData.businessName || "Unknown Business";
            setBusinessName(userBusinessName);
            setUserData(userData);
            setCarData(prev => ({ ...prev, users: userBusinessName }));
          } else {
            setIsAdmin(false);
            setAccountStatus("pending");
          }
        } catch (error) {
          console.error("Error checking admin role:", error);
          setIsAdmin(false);
          setAccountStatus("pending");
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setAccountStatus("pending");
        setBusinessName("");
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      Swal.fire("Error!", "Logout failed. Please try again.", "error");
    }
  };

  const fetchUnits = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User not logged in");

      const unitsRef = collection(db, "vehicles");
      const q = query(unitsRef, where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUnits(data);
      
      const highestNumber = data.length > 0 ? Math.max(...data.map(unit => unit.vehicleNumber || 0)) : 0;
      setNextVehicleNumber(highestNumber + 1);
      
    } catch (error) {
      console.error("Error fetching units:", error);
      Swal.fire("Error!", "Failed to fetch vehicles.", "error");
    }
  };

  useEffect(() => {
    if (currentUser) fetchUnits();
  }, [currentUser]);

  const uploadImage = async (file, path) => {
    if (!file) return null;
    
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleImageChange = (e, type, index = null, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'main') {
      if (isEdit) {
        setEditImageFiles(prev => ({ ...prev, mainImage: file }));
      } else {
        setImageFiles(prev => ({ ...prev, mainImage: file }));
      }
    } else if (type === 'angle' && index !== null) {
      if (isEdit) {
        const newAngleImages = [...editImageFiles.angleImages];
        newAngleImages[index] = file;
        setEditImageFiles(prev => ({ ...prev, angleImages: newAngleImages }));
      } else {
        const newAngleImages = [...imageFiles.angleImages];
        newAngleImages[index] = file;
        setImageFiles(prev => ({ ...prev, angleImages: newAngleImages }));
      }
    } else if (type === 'gcash') {
      if (isEdit) {
        setEditImageFiles(prev => ({ ...prev, gcashQr: file }));
      } else {
        setImageFiles(prev => ({ ...prev, gcashQr: file }));
      }
    }
  };

  const handleRemoveImage = (type, index = null, isEdit = false) => {
    if (type === 'main') {
      if (isEdit) {
        setEditImageFiles(prev => ({ ...prev, mainImage: null }));
        setEditFormData(prev => ({ ...prev, mainImageUrl: null }));
      } else {
        setImageFiles(prev => ({ ...prev, mainImage: null }));
      }
    } else if (type === 'angle' && index !== null) {
      if (isEdit) {
        const newAngleImages = [...editImageFiles.angleImages];
        newAngleImages[index] = null;
        setEditImageFiles(prev => ({ ...prev, angleImages: newAngleImages }));
        
        const newAngleUrls = [...editFormData.angleImageUrls];
        newAngleUrls[index] = null;
        setEditFormData(prev => ({ ...prev, angleImageUrls: newAngleUrls.filter(url => url) }));
      } else {
        const newAngleImages = [...imageFiles.angleImages];
        newAngleImages[index] = null;
        setImageFiles(prev => ({ ...prev, angleImages: newAngleImages }));
      }
    } else if (type === 'gcash') {
      if (isEdit) {
        setEditImageFiles(prev => ({ ...prev, gcashQr: null }));
        setEditFormData(prev => ({ ...prev, gcashQrUrl: null }));
      } else {
        setImageFiles(prev => ({ ...prev, gcashQr: null }));
      }
    }
  };

  const renderImagePreview = (file, existingUrl, type, index = null, isEdit = false) => {
    if (file || existingUrl) {
      return (
        <div className="mt-2 relative">
          <img 
            src={file ? URL.createObjectURL(file) : existingUrl} 
            alt="Preview" 
            className="h-24 w-full object-cover rounded-md"
          />
          <button
            type="button"
            onClick={() => handleRemoveImage(type, index, isEdit)}
            className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      );
    }
    return null;
  };

  const handleAddCar = async () => {
    if (accountStatus !== "approved") {
      Swal.fire(
        "Account Pending",
        "Your account is still under review. Please wait for admin approval before uploading vehicles.",
        "warning"
      );
      return;
    }

    const { model, brand, year, carNumber, transmission, capacity, price, hourlyRate, fuelType, carType } = carData;
    if (!model || !brand || !year || !carNumber || !transmission || !capacity || !price || !hourlyRate || !fuelType || !carType || !imageFiles.gcashQr) {
      setFormError("Please fill out all required fields including the year and GCash QR code.");
      return;
    }

    if (!currentUser) {
      setFormError("You must be logged in to add a vehicle.");
      return;
    }

    try {
      setUploadingImages(true);

      const vehicleId = uuidv4();

      const mainImagePath = `vehicles/${currentUser.uid}/${vehicleId}/main_${uuidv4()}`;
      const mainImageUrl = await uploadImage(imageFiles.mainImage, mainImagePath);

      const angleImageUrls = await Promise.all(imageFiles.angleImages.map(async (image, index) => {
        if (image) {
          const angleImagePath = `vehicles/${currentUser.uid}/${vehicleId}/angle_${index}_${uuidv4()}`;
          return await uploadImage(image, angleImagePath);
        }
        return null;
      }));

      const gcashQrPath = `vehicles/${currentUser.uid}/${vehicleId}/gcash_qr_${uuidv4()}`;
      const gcashQrUrl = await uploadImage(imageFiles.gcashQr, gcashQrPath);

      if (!businessName) {
        throw new Error("Business name not available. Please refresh the page.");
      }

      const newCar = {
        ...carData,
        ownerId: currentUser.uid,
        ownerData: {                        // Add this object with owner details
        fullName: currentUser.displayName || "Car Owner",
        businessName: businessName,
        contactNumber: userData?.contactNumber || "Not available",
        email: currentUser.email
      },
      businessName: businessName,         // Direct field for easy access
      ownerName: businessName,            // Individual field for compatibility
      ownerEmail: currentUser.email,      // Individual field for compatibility
      ownerContact: userData?.contactNumber || "Not available", // Individual field
        users: businessName,
        createdAt: Timestamp.now(),
        vehicleNumber: nextVehicleNumber,
        mainImageUrl: mainImageUrl || null,
        angleImageUrls: angleImageUrls.filter(url => url),
        gcashQrUrl: gcashQrUrl
      };

      await addDoc(collection(db, "vehicles"), newCar);
      setNextVehicleNumber(nextVehicleNumber + 1);
      fetchUnits();
      setShowForm(false);
      
      setCarData({
        model: "",
        brand: "",
        year: "",
        carNumber: "",
        transmission: "",
        capacity: "",
        price: "",
        hourlyRate: "",
        status: "Available",
        uid: "",
        users: businessName,
        fuelType: "",
        carType: "",
        description: "",
        minRentalPeriod: "",
        fuelReturnPolicy: "same",
        securityDeposit: "",
        vehicleNumber: 0,
        mainImageUrl: "",
        angleImageUrls: [],
        gcashQrUrl: ""
      });

      setImageFiles({
        mainImage: null,
        angleImages: [null, null, null],
        gcashQr: null
      });
      
      setFormError("");
      Swal.fire("Success!", "Vehicle added successfully.", "success");
    } catch (error) {
      console.error("Error adding car:", error);
      Swal.fire("Error!", `Failed to add vehicle: ${error.message}`, "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleEditCar = async () => {
    if (!editingVehicle) return;

    const { model, brand, year, carNumber, transmission, capacity, price, hourlyRate, fuelType, carType } = editFormData;
    if (!model || !brand || !year || !carNumber || !transmission || !capacity || !price || !hourlyRate || !fuelType || !carType) {
      setFormError("Please fill out all required fields.");
      return;
    }

    try {
      setUploadingImages(true);

      const vehicleId = editingVehicle.id;
      let mainImageUrl = editFormData.mainImageUrl;
      let gcashQrUrl = editFormData.gcashQrUrl;
      let angleImageUrls = [...editFormData.angleImageUrls];

      // Upload new main image if changed
      if (editImageFiles.mainImage) {
        const mainImagePath = `vehicles/${currentUser.uid}/${vehicleId}/main_${uuidv4()}`;
        mainImageUrl = await uploadImage(editImageFiles.mainImage, mainImagePath);
      }

      // Upload new angle images if changed
      for (let i = 0; i < editImageFiles.angleImages.length; i++) {
        if (editImageFiles.angleImages[i]) {
          const angleImagePath = `vehicles/${currentUser.uid}/${vehicleId}/angle_${i}_${uuidv4()}`;
          const url = await uploadImage(editImageFiles.angleImages[i], angleImagePath);
          angleImageUrls[i] = url;
        }
      }

      // Upload new GCash QR if changed
      if (editImageFiles.gcashQr) {
        const gcashQrPath = `vehicles/${currentUser.uid}/${vehicleId}/gcash_qr_${uuidv4()}`;
        gcashQrUrl = await uploadImage(editImageFiles.gcashQr, gcashQrPath);
      }

      const updatedCar = {
        ...editFormData,
         ownerData: {                        // Add this object with owner details
        fullName: currentUser.displayName || "Car Owner",
        businessName: businessName,
        contactNumber: userData?.contactNumber || "Not available",
        email: currentUser.email
      },
      businessName: businessName,         // Direct field for easy access
      ownerName: businessName,            // Individual field for compatibility
      ownerEmail: currentUser.email,      // Individual field for compatibility
      ownerContact: userData?.contactNumber || "Not available", // Individual field
        mainImageUrl,
        angleImageUrls: angleImageUrls.filter(url => url),
        gcashQrUrl,
        updatedAt: Timestamp.now()
      };

      await updateDoc(doc(db, "vehicles", vehicleId), updatedCar);
      fetchUnits();
      setShowEditModal(false);
      
      setEditFormData({
        model: "",
        brand: "",
        year: "",
        carNumber: "",
        transmission: "",
        capacity: "",
        price: "",
        hourlyRate: "",
        status: "Available",
        fuelType: "",
        description: "",
        minRentalPeriod: "",
        fuelReturnPolicy: "Same",
        securityDeposit: "",
        carType: "",
        mainImageUrl: "",
        angleImageUrls: [],
        gcashQrUrl: ""
      });

      setEditImageFiles({
        mainImage: null,
        angleImages: [null, null, null],
        gcashQr: null
      });
      
      setFormError("");
      Swal.fire("Success!", "Vehicle updated successfully.", "success");
    } catch (error) {
      console.error("Error updating car:", error);
      Swal.fire("Error!", `Failed to update vehicle: ${error.message}`, "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const reorganizeVehicleNumbers = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("User not logged in");

      const unitsRef = collection(db, "vehicles");
      const q = query(unitsRef, where("uid", "==", currentUser.uid));
      const snapshot = await getDocs(q);
      
      const allVehicles = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      if (allVehicles.length === 0) {
        setNextVehicleNumber(1);
        return;
      }
      
      const sortedVehicles = [...allVehicles].sort((a, b) => {
        const numA = a.vehicleNumber ? parseInt(a.vehicleNumber) : Number.MAX_SAFE_INTEGER;
        const numB = b.vehicleNumber ? parseInt(b.vehicleNumber) : Number.MAX_SAFE_INTEGER;
        return numA - numB;
      });

      const batch = writeBatch(db);
      
      sortedVehicles.forEach((vehicle, index) => {
        const newNumber = index + 1;
        
        if (vehicle.vehicleNumber !== newNumber) {
          const vehicleRef = doc(db, "vehicles", vehicle.id);
          batch.update(vehicleRef, { vehicleNumber: newNumber });
        }
      });
      
      await batch.commit();
      setNextVehicleNumber(sortedVehicles.length + 1);
      fetchUnits();
    } catch (error) {
      console.error("Error reorganizing vehicle numbers:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const vehicle = units.find((u) => u.id === id);
      const isOwner = currentUser && vehicle && vehicle.uid === currentUser.uid;

      if (!isOwner && !isAdmin) {
        Swal.fire("Permission Denied", "Only the owner or admin can delete this vehicle.", "error");
        return;
      }

      const result = await Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!",
      });

      if (result.isConfirmed) {
        await deleteDoc(doc(db, "vehicles", id));
        
        setUnits(units.filter((u) => u.id !== id));
        await reorganizeVehicleNumbers();
        
        Swal.fire("Deleted!", "Vehicle has been deleted and numbers reorganized.", "success");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      Swal.fire("Error!", `Failed to delete: ${error.message}`, "error");
    }
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setEditFormData({
      model: vehicle.model || "",
      brand: vehicle.brand || "",
      year: vehicle.year || "",
      carNumber: vehicle.carNumber || "",
      transmission: vehicle.transmission || "",
      capacity: vehicle.capacity || "",
      price: vehicle.price || "",
      hourlyRate: vehicle.hourlyRate || "",
      status: vehicle.status || "Available",
      fuelType: vehicle.fuelType || "",
      description: vehicle.description || "",
      minRentalPeriod: vehicle.minRentalPeriod || "",
      fuelReturnPolicy: vehicle.fuelReturnPolicy || "same",
      securityDeposit: vehicle.securityDeposit || "",
      carType: vehicle.carType || "",
      mainImageUrl: vehicle.mainImageUrl || "",
      angleImageUrls: vehicle.angleImageUrls || [],
      gcashQrUrl: vehicle.gcashQrUrl || ""
    });
    setEditImageFiles({
      mainImage: null,
      angleImages: [null, null, null],
      gcashQr: null
    });
    setShowEditModal(true);
  };

  const handleViewDetails = (unit) => {
    setSelectedVehicle(unit);
    setShowDetailsModal(true);
  };

  const handleInput = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    } else {
      setCarData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (e, isEdit = false) => {
    handleInput(e, isEdit);
  };

  const filteredUnits = searchTerm
    ? units.filter((unit) =>
        unit.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.carType && unit.carType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (unit.year && unit.year.toString().includes(searchTerm))
      )
    : [...units];
  
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    const numA = a.vehicleNumber ? parseInt(a.vehicleNumber) : Number.MAX_SAFE_INTEGER;
    const numB = b.vehicleNumber ? parseInt(b.vehicleNumber) : Number.MAX_SAFE_INTEGER;
    return numA - numB;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800";
      case "Booked":
        return "bg-blue-100 text-blue-800";
      case "Maintenance":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleAddVehicleClick = () => {
    if (accountStatus !== "approved") {
      Swal.fire(
        "Account Pending",
        "Your account is still under review. Please wait for admin approval before uploading vehicles.",
        "warning"
      );
    } else {
      setShowForm(true);
    }
  };

  const VehicleDetailsModal = ({ vehicle, isOpen, onClose }) => {
    if (!isOpen || !vehicle) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <Eye className="h-5 w-5 text-gray-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Vehicle Details</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Vehicle Image and Status */}
              <div>
                <div className="relative mb-4">
                  {vehicle.mainImageUrl ? (
                    <img
                      src={vehicle.mainImageUrl}
                      alt={`${vehicle.brand} ${vehicle.model} ${vehicle.year || ''}`}
                      className="w-full h-64 object-cover rounded-lg shadow-sm"
                    />
                  ) : (
                    <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Car className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                        <span className="text-gray-500">No Image Available</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-4 left-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(vehicle.status)}`}>
                      ● {vehicle.status}
                    </span>
                  </div>
                </div>

                {/* Additional Images */}
                {vehicle.angleImageUrls && vehicle.angleImageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {vehicle.angleImageUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Angle ${index + 1}`}
                        className="w-full h-20 object-cover rounded-md"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column - Vehicle Information */}
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Information</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Brand:</span>
                        <p className="text-lg font-semibold text-gray-900">{vehicle.brand}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Model:</span>
                        <p className="text-lg font-semibold text-gray-900">{vehicle.model}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Year:</span>
                        <p className="text-base text-gray-900">{vehicle.year || "Not specified"}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Car #:</span>
                        <p className="text-base text-gray-900">{vehicle.carNumber}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Type:</span>
                        <p className="text-base text-gray-900">{vehicle.carType || "Not specified"}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Vehicle #:</span>
                        <p className="text-base text-gray-900">#{vehicle.vehicleNumber || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">₱</span> Pricing
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Daily Rate:</span>
                      <span className="text-xl font-bold text-blue-600">₱{vehicle.price}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Hourly Rate:</span>
                      <span className="text-base font-semibold text-blue-500">₱{vehicle.hourlyRate}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Security Deposit:</span>
                      <span className="text-base font-semibold text-gray-900">₱{vehicle.securityDeposit || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚙️</span> Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Transmission:</span>
                      <p className="text-base text-gray-900">{vehicle.transmission}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Capacity:</span>
                      <p className="text-base text-gray-900">{vehicle.capacity} seats</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Fuel Type:</span>
                      <p className="text-base text-gray-900">{vehicle.fuelType || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Min Rental:</span>
                      <p className="text-base text-gray-900">{vehicle.minRentalPeriod || 24} hours</p>
                    </div>
                  </div>
                </div>

                {vehicle.description && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Features & Description</h3>
                    <p className="text-gray-700 leading-relaxed">{vehicle.description}</p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Rental Terms</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Fuel Policy:</span>{" "}
                      {vehicle.fuelReturnPolicy === "same" ? "Return with same fuel level" : 
                       vehicle.fuelReturnPolicy === "full" ? "Return with full tank" : 
                       vehicle.fuelReturnPolicy === "pay" ? "Pay for used fuel" : "Same level"}
                    </div>
                    <div>
                      <span className="font-medium">Business:</span> {vehicle.users || vehicle.businessName || "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  onClose();
                  handleEdit(vehicle);
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Vehicle
              </button>
              <button
                onClick={() => {
                  onClose();
                  handleDelete(vehicle.id);
                }}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Vehicle
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EditVehicleModal = ({ vehicle, isOpen, onClose }) => {
    if (!isOpen || !vehicle) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <Edit3 className="h-5 w-5 text-gray-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Edit Vehicle</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Business Information</h3>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <div className="text-blue-700 font-medium">Business Name: {businessName}</div>
                <div className="text-xs text-blue-600 mt-1">This name will be displayed with your vehicle</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Basic Vehicle Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Brand *</label>
                  <input
                    type="text"
                    name="brand"
                    value={editFormData.brand}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model *</label>
                  <input
                    type="text"
                    name="model"
                    value={editFormData.model}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">License Plate *</label>
                  <input
                    type="text"
                    name="carNumber"
                    value={editFormData.carNumber}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Car Type</label>
                  <select
                    name="carType"
                    value={editFormData.carType}
                    onChange={(e) => handleSelectChange(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select car type</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Van">Van</option>
                    <option value="Minivan">Minivan</option>
                    <option value="Convertible">Convertible</option>
                    <option value="Coupe">Coupe</option>
                    <option value="Crossover">Crossover</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={editFormData.status}
                    onChange={(e) => handleSelectChange(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Booked">Booked</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Capacity (Seats)</label>
                  <input
                    type="number"
                    name="capacity"
                    value={editFormData.capacity}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Pricing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Daily Price (₱) *</label>
                  <input
                    type="number"
                    name="price"
                    value={editFormData.price}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hourly Rate (₱) *</label>
                  <input
                    type="number"
                    name="hourlyRate"
                    value={editFormData.hourlyRate}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Security Deposit (₱)</label>
                  <input
                    type="number"
                    name="securityDeposit"
                    value={editFormData.securityDeposit}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Technical Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transmission</label>
                  <select
                    name="transmission"
                    value={editFormData.transmission}
                    onChange={(e) => handleSelectChange(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select transmission</option>
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fuel Type</label>
                  <select
                    name="fuelType"
                    value={editFormData.fuelType}
                    onChange={(e) => handleSelectChange(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select fuel type</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Bio-Diesel">Bio-Diesel</option>
                    <option value="Premium">Premium</option>
                    <option value="Premium Diesel">Premium Diesel</option>
                    <option value="Octane (mid-grade)">Octane (mid-grade)</option>
                    <option value="Regular Gas">Regular Gas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fuel Return Policy</label>
                  <select
                    name="fuelReturnPolicy"
                    value={editFormData.fuelReturnPolicy}
                    onChange={(e) => handleSelectChange(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="same">Return with Same Level</option>
                    <option value="full">Return with Full Tank</option>
                    <option value="pay">Pay for Used Fuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Rental Period (hours)</label>
                  <input
                    type="number"
                    name="minRentalPeriod"
                    value={editFormData.minRentalPeriod}
                    onChange={(e) => handleInput(e, true)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Additional Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={editFormData.description}
                  onChange={(e) => handleInput(e, true)}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter vehicle description"
                ></textarea>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Vehicle Images</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Image</label>
                <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-2 pb-3">
                    <Upload className="h-6 w-6 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500">Click to change main image</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'main', null, true)}
                  />
                </label>
                {renderImagePreview(editImageFiles.mainImage, editFormData.mainImageUrl, 'main', null, true)}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Views (Optional - Max 3)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex flex-col">
                      <label className="flex flex-col items-center justify-center w-full p-2 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <Upload className="h-5 w-5 text-gray-500 mb-1" />
                          <p className="text-xs text-gray-500">Angle {index + 1}</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'angle', index, true)}
                        />
                      </label>
                      {renderImagePreview(
                        editImageFiles.angleImages[index], 
                        editFormData.angleImageUrls[index], 
                        'angle', 
                        index, 
                        true
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">GCash QR Code</label>
                <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-2 pb-3">
                    <Upload className="h-6 w-6 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500">Click to change GCash QR code</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'gcash', null, true)}
                  />
                </label>
                {renderImagePreview(editImageFiles.gcashQr, editFormData.gcashQrUrl, 'gcash', null, true)}
              </div>
            </div>

            {formError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700 text-sm rounded mb-4">
                {formError}
              </div>
            )}

            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCar}
                disabled={uploadingImages}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${uploadingImages ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploadingImages ? 'Updating...' : 'Update Vehicle'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Modern Vehicle Card Component
  const VehicleCard = ({ unit }) => {
    const vehicleId = unit.carNumber?.toLowerCase() || 'unknown';
    
    return (
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group">
        {/* Vehicle Number Badge - Top Right */}
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg">
              #{unit.vehicleNumber || "-"}
            </span>
          </div>
          
          {/* Vehicle Image */}
          <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
            {unit.mainImageUrl ? (
              <img
                src={unit.mainImageUrl}
                alt={`${unit.brand} ${unit.model} ${unit.year || ''}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`${unit.mainImageUrl ? 'hidden' : 'flex'} absolute inset-0 flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400`}
            >
              <Car className="w-16 h-16 mb-3 opacity-50" />
              <span className="text-sm font-medium">No Image Available</span>
            </div>
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="p-5">
          {/* Title and License Plate */}
          <div className="mb-3">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {unit.brand} {unit.model} {unit.year || ''}
            </h3>
            <p className="text-sm text-gray-600 font-medium">{vehicleId}</p>
            <p className="text-xs text-gray-500">{businessName}</p>
          </div>

          {/* Price Display */}
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-blue-600 font-bold text-xl">₱{unit.price}</span>
              <span className="text-gray-500 text-sm">₱{unit.hourlyRate}/hr</span>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="space-y-2 mb-4 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span className="font-medium">{unit.transmission}</span>
              <span>•</span>
              <span>{unit.fuelType || 'Gasoline'} ({unit.fuelType === 'Premium' ? '91 Octane' : 'Standard'})</span>
              <span>•</span>
              <span>{unit.capacity} Seats</span>
            </div>
          </div>

          {/* Vehicle Type Badge */}
          <div className="mb-4">
            <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              {unit.carType || 'Hatchback'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button 
              onClick={() => handleViewDetails(unit)} 
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 text-sm font-medium flex-1"
            >
              <Eye className="h-4 w-4" />
              View Details
            </button>
            <button 
              onClick={() => handleEdit(unit)} 
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
            <button 
              onClick={() => handleDelete(unit.id)} 
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="sticky top-0 h-screen w-64 transition-all duration-300 bg-white border-r shadow-md z-20">
        <SidebarOwner onLogout={handleLogout} />
      </div>

      <div className="flex flex-col flex-1 bg-gray-50">
        <div className="sticky top-0 z-20 bg-white shadow">
          <TopbarOwner/>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900">Manage Rental Units</h1>
            <p className="text-gray-600">View, add, edit, and manage your fleet of rental vehicles</p>
            {businessName && (
              <p className="text-blue-600 font-medium mt-1">
                Business: {businessName}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleAddVehicleClick}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Vehicle
            </button>
          </div>

          {/* Vehicle Details Modal */}
          <VehicleDetailsModal 
            vehicle={selectedVehicle} 
            isOpen={showDetailsModal} 
            onClose={() => setShowDetailsModal(false)} 
          />

          {/* Edit Vehicle Modal */}
          <EditVehicleModal 
            vehicle={editingVehicle} 
            isOpen={showEditModal} 
            onClose={() => setShowEditModal(false)} 
          />

          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Add New Vehicle</h3>
                  <button onClick={() => { setShowForm(false); setFormError(""); }}>
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {formError && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700 text-sm rounded">
                      {formError}
                    </div>
                  )}
                  
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-4">
                    <div className="text-blue-700 font-medium">Business Name: {businessName}</div>
                    <div className="text-xs text-blue-600 mt-1">This name will be displayed with your vehicle</div>
                  </div>
                  
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-blue-700 text-sm rounded flex items-center">
                    <div className="font-medium">Vehicle Number: {nextVehicleNumber}</div>
                    <div className="ml-2 text-xs text-blue-600">(Automatically assigned)</div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-800 mb-3">Vehicle Images</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Main Image *</label>
                      <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                          <Upload className="h-6 w-6 text-gray-500 mb-2" />
                          <p className="text-sm text-gray-500">Click to upload main image</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'main')}
                        />
                      </label>
                      {renderImagePreview(imageFiles.mainImage, null, 'main')}
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Angle Images</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="flex flex-col">
                            <label className="flex flex-col items-center justify-center w-full p-2 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                              <div className="flex flex-col items-center justify-center pt-1 pb-2">
                                <Upload className="h-5 w-5 text-gray-500 mb-1" />
                                <p className="text-xs text-gray-500">Angle {index + 1}</p>
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleImageChange(e, 'angle', index)}
                              />
                            </label>
                            {renderImagePreview(imageFiles.angleImages[index], null, 'angle', index)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">GCash/Bank Account QR Code *</label>
                      <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                          <Upload className="h-6 w-6 text-gray-500 mb-2" />
                          <p className="text-sm text-gray-500">Click to upload GCash or Bank Account QR code</p>
                          <p className="text-xs text-gray-400 mt-1">Required for receiving payments</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'gcash')}
                        />
                      </label>
                      {renderImagePreview(imageFiles.gcashQr, null, 'gcash')}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[{ name: "model", label: "Model" },
                      { name: "brand", label: "Brand" },
                      { name: "year", label: "Year", type: "number" },
                      { name: "carNumber", label: "License Plate" },
                      { name: "capacity", label: "Seating Capacity" },
                      { name: "price", label: "Price per Day (₱)", type: "number" },
                      { name: "hourlyRate", label: "Penalty Rate (₱)", type: "number" }
                    ].map(({ name, label, type = "text" }) => (
                      <div key={name}>
                        <label className="block text-sm font-medium text-gray-700">{label} *</label>
                        <input
                          type={type}
                          name={name}
                          value={carData[name]}
                          onChange={handleInput}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                          min={name === "year" ? "1900" : undefined}
                          max={name === "year" ? new Date().getFullYear() + 1 : undefined}
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Transmission *</label>
                      <select
                        name="transmission"
                        value={carData.transmission}
                        onChange={handleSelectChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select transmission</option>
                        <option value="Automatic">Automatic</option>
                        <option value="Manual">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fuel Type *</label>
                      <select
                        name="fuelType"
                        value={carData.fuelType}
                        onChange={handleSelectChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select fuel type</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Bio-Diesel">Bio-Diesel</option>
                        <option value="Premium">Premium</option>
                        <option value="Premium Diesel">Premium Diesel</option>
                        <option value="Octane (mid-grade)">Octane (mid-grade)</option>
                        <option value="Regular Gas">Regular Gas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Car Type *</label>
                      <select
                        name="carType"
                        value={carData.carType}
                        onChange={handleSelectChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select car type</option>
                        <option value="Sedan">Sedan</option>
                        <option value="SUV">SUV</option>
                        <option value="Hatchback">Hatchback</option>
                        <option value="Pickup">Pickup</option>
                        <option value="Van">Van</option>
                        <option value="Minivan">Minivan</option>
                        <option value="Convertible">Convertible</option>
                        <option value="Coupe">Coupe</option>
                        <option value="Crossover">Crossover</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Vehicle Features & Description</label>
                    <textarea
                      name="description"
                      value={carData.description}
                      onChange={handleInput}
                      rows="3"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter vehicle features and description (e.g., Bluetooth, Navigation, Leather Seats)"
                    ></textarea>
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-800 mb-3">Rental Terms</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Min. Rental Period (hours)</label>
                        <input
                          type="number"
                          name="minRentalPeriod"
                          value={carData.minRentalPeriod}
                          onChange={handleInput}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Security Deposit (₱)</label>
                        <input
                          type="number"
                          name="securityDeposit"
                          value={carData.securityDeposit}
                          onChange={handleInput}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Fuel Return Policy</label>
                        <select
                          name="fuelReturnPolicy"
                          value={carData.fuelReturnPolicy}
                          onChange={handleSelectChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="same">Return with same fuel level</option>
                          <option value="full">Return with full tank</option>
                          <option value="pay">Pay for used fuel</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button
                      onClick={handleAddCar}
                      disabled={uploadingImages}
                      className={`w-full sm:w-auto py-2 px-4 rounded-md text-white ${uploadingImages ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {uploadingImages ? 'Uploading...' : 'Add Vehicle'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sortedUnits.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md mx-auto">
                <Car className="mx-auto h-16 w-16 text-gray-300 mb-6" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No vehicles found</h3>
                <p className="text-gray-500 mb-6">Add your first vehicle to get started with your rental business</p>
                <button
                  onClick={handleAddVehicleClick}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedUnits.map((unit) => (
                <VehicleCard key={unit.id} unit={unit} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Units;