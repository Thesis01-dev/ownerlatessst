import React, { useState, useRef, useEffect } from 'react';
import { Mail, Phone, MapPin, Shield, User, Camera, CheckCircle, X, AlertCircle, FileText, Upload } from 'lucide-react';
import { getAuth, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase"; 
import TopbarOwner from '../../scenes/global/TopbarOwner';
import SidebarOwner from '../../scenes/global/SidebarOwner';

// Custom SweetAlert-style Modal Component
const SweetAlert = ({ isOpen, onClose, type, title, message, showConfirmButton = true, showCancelButton = false, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />;
      case 'error':
        return <X size={64} className="text-red-500 mx-auto mb-4" />;
      case 'warning':
        return <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />;
      case 'info':
        return <AlertCircle size={64} className="text-blue-500 mx-auto mb-4" />;
      default:
        return <AlertCircle size={64} className="text-gray-500 mx-auto mb-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all">
        <div className="p-6 text-center">
          {getIcon()}
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          
          <div className="flex justify-center space-x-3">
            {showConfirmButton && (
              <button
                onClick={() => {
                  if (onConfirm) onConfirm();
                  onClose();
                }}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  type === 'success' 
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : type === 'error'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                OK
              </button>
            )}
            {showCancelButton && (
              <button
                onClick={() => {
                  if (onCancel) onCancel();
                  onClose();
                }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Document Upload Component
const DocumentUpload = ({ label, currentUrl, onFileSelect, fileInputRef, acceptedTypes = "image/*,.pdf" }) => {
  const getFileName = (url) => {
    if (!url) return '';
    try {
      const decodedUrl = decodeURIComponent(url);
      const parts = decodedUrl.split('/');
      const fileNameWithParams = parts[parts.length - 1];
      const fileName = fileNameWithParams.split('?')[0];
      return fileName.replace(/^[^_]*_[^_]*_/, ''); // Remove userId and timestamp prefix
    } catch (error) {
      return 'Document';
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
      <div className="space-y-4">
        {currentUrl ? (
          <div className="space-y-3">
            <FileText size={48} className="mx-auto text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">{getFileName(currentUrl)}</p>
              <p className="text-xs text-gray-500">Current {label.toLowerCase()}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => window.open(currentUrl, '_blank')}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                View Document
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Replace Document
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={48} className="mx-auto text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Upload {label}</p>
              <p className="text-xs text-gray-500">Click to select file or drag and drop</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              Choose File
            </button>
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        accept={acceptedTypes}
        className="hidden"
      />
    </div>
  );
};

const Profile = () => {
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [currentProfileImageUrl, setCurrentProfileImageUrl] = useState(null);
  
  // Business document states
  const [businessPermit, setBusinessPermit] = useState(null);
  const [businessRegistration, setBusinessRegistration] = useState(null);
  const [currentBusinessPermitUrl, setCurrentBusinessPermitUrl] = useState(null);
  const [currentBusinessRegistrationUrl, setCurrentBusinessRegistrationUrl] = useState(null);
  
  // File input refs
  const fileInputRef = useRef(null);
  const businessPermitRef = useRef(null);
  const businessRegistrationRef = useRef(null);
  
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState({
    businessName: '',
    email: '',
    contactNumber: '',
    address: '',
    role: '',
    username: '',
    fullName: '',
    profileImageUrl: '',
    businessPermitUrl: '',
    businessRegistrationUrl: ''
  });
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    contactNumber: '',
    address: '',
    username: '',
    fullName: '', 
    newPassword: '',
    confirmPassword: ''
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // SweetAlert state
  const [sweetAlert, setSweetAlert] = useState({
    isOpen: false,
    type: '',
    title: '',
    message: ''
  });

  // SweetAlert functions
  const showSweetAlert = (type, title, message) => {
    setSweetAlert({
      isOpen: true,
      type,
      title,
      message
    });
  };

  const closeSweetAlert = () => {
    setSweetAlert(prev => ({ ...prev, isOpen: false }));
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Validate image file
  const validateImageFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      showSweetAlert('error', 'Invalid File Type', 'Please select a valid image file (JPG, PNG, or GIF).');
      return false;
    }

    if (file.size > maxSize) {
      showSweetAlert('error', 'File Too Large', 'Please select an image smaller than 5MB.');
      return false;
    }

    return true;
  };

  // Validate document file
  const validateDocumentFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB for documents

    if (!allowedTypes.includes(file.type)) {
      showSweetAlert('error', 'Invalid File Type', 'Please select a valid image file (JPG, PNG, GIF) or PDF document.');
      return false;
    }

    if (file.size > maxSize) {
      showSweetAlert('error', 'File Too Large', 'Please select a document smaller than 10MB.');
      return false;
    }

    return true;
  };

  // Upload file to Firebase Storage
  const uploadFileToStorage = async (file, userId, folder) => {
    try {
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${userId}_${timestamp}.${fileExtension}`;
      const fileRef = ref(storage, `${folder}/${fileName}`);
      
      // Add metadata to track uploader
      const metadata = {
        customMetadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      };
      
      const snapshot = await uploadBytes(fileRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return { downloadURL, fileName };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  // Delete old file from storage
  const deleteOldFile = async (fileUrl) => {
    try {
      if (fileUrl && (fileUrl.includes('profile_images/') || fileUrl.includes('business_documents/'))) {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      }
    } catch (error) {
      console.error('Error deleting old file:', error);
      // Don't throw error for deletion failures
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userDataValues = {
              businessName: data.businessName || data.name || user.displayName || '',
              email: data.email || user.email || '',
              contactNumber: data.contactNumber || '',
              address: data.address || '',
              role: data.role || 'Owner',
              username: data.username || 'owner',
              fullName: data.fullName || '',
              profileImageUrl: data.profileImageUrl || '',
              businessPermitUrl: data.businessPermitUrl || '',
              businessRegistrationUrl: data.businessRegistrationUrl || ''
            };
            setUserData(userDataValues);
            setCurrentProfileImageUrl(userDataValues.profileImageUrl);
            setCurrentBusinessPermitUrl(userDataValues.businessPermitUrl);
            setCurrentBusinessRegistrationUrl(userDataValues.businessRegistrationUrl);
            setFormData({
              businessName: userDataValues.businessName,
              email: userDataValues.email,
              contactNumber: userDataValues.contactNumber,
              address: userDataValues.address,
              username: userDataValues.username,
              fullName: userDataValues.fullName,
              newPassword: '',
              confirmPassword: ''
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && validateImageFile(file)) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBusinessPermitUpload = (e) => {
    const file = e.target.files[0];
    if (file && validateDocumentFile(file)) {
      setBusinessPermit(file);
    }
  };

  const handleBusinessRegistrationUpload = (e) => {
    const file = e.target.files[0];
    if (file && validateDocumentFile(file)) {
      setBusinessRegistration(file);
    }
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showNotification('You must be logged in to save changes', 'error');
      showSweetAlert('error', 'Authentication Error', 'You must be logged in to save changes');
      return;
    }

    if (formData.newPassword || formData.confirmPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        showNotification('Passwords do not match', 'error');
        showSweetAlert('error', 'Password Mismatch', 'The passwords you entered do not match. Please try again.');
        return;
      }
      if (formData.newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        showSweetAlert('error', 'Weak Password', 'Password must be at least 6 characters long for security.');
        return;
      }
    }

    let newImageUrl = currentProfileImageUrl;
    let newBusinessPermitUrl = currentBusinessPermitUrl;
    let newBusinessRegistrationUrl = currentBusinessRegistrationUrl;

    try {
      // Handle profile image upload if there's a new image
      if (profileImage) {
        // Delete old image if it exists
        if (currentProfileImageUrl) {
          await deleteOldFile(currentProfileImageUrl);
        }

        // Upload new image
        const { downloadURL } = await uploadFileToStorage(profileImage, currentUser.uid, 'profile_images');
        newImageUrl = downloadURL;
      }

      // Handle business permit upload if there's a new file
      if (businessPermit) {
        // Delete old file if it exists
        if (currentBusinessPermitUrl) {
          await deleteOldFile(currentBusinessPermitUrl);
        }

        // Upload new business permit
        const { downloadURL } = await uploadFileToStorage(businessPermit, currentUser.uid, 'business_documents');
        newBusinessPermitUrl = downloadURL;
      }

      // Handle business registration upload if there's a new file
      if (businessRegistration) {
        // Delete old file if it exists
        if (currentBusinessRegistrationUrl) {
          await deleteOldFile(currentBusinessRegistrationUrl);
        }

        // Upload new business registration
        const { downloadURL } = await uploadFileToStorage(businessRegistration, currentUser.uid, 'business_documents');
        newBusinessRegistrationUrl = downloadURL;
      }

      // Update user document in Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      const updateData = {
        name: formData.businessName,
        businessName: formData.businessName,
        email: formData.email,
        contactNumber: formData.contactNumber,
        address: formData.address,
        username: formData.username,
        fullName: formData.fullName,
        updatedAt: new Date()
      };

      // Add URLs if they exist
      if (newImageUrl) {
        updateData.profileImageUrl = newImageUrl;
      }
      if (newBusinessPermitUrl) {
        updateData.businessPermitUrl = newBusinessPermitUrl;
      }
      if (newBusinessRegistrationUrl) {
        updateData.businessRegistrationUrl = newBusinessRegistrationUrl;
      }

      await updateDoc(userDocRef, updateData);

      // Update password if provided
      if (formData.newPassword) {
        await updatePassword(currentUser, formData.newPassword);
      }

      // Update local state
      setUserData({
        businessName: formData.businessName,
        email: formData.email,
        contactNumber: formData.contactNumber,
        address: formData.address,
        role: userData.role,
        username: formData.username,
        fullName: formData.fullName,
        profileImageUrl: newImageUrl,
        businessPermitUrl: newBusinessPermitUrl,
        businessRegistrationUrl: newBusinessRegistrationUrl
      });

      setCurrentProfileImageUrl(newImageUrl);
      setCurrentBusinessPermitUrl(newBusinessPermitUrl);
      setCurrentBusinessRegistrationUrl(newBusinessRegistrationUrl);
      
      // Reset file states
      setProfileImage(null);
      setPreviewImage(null);
      setBusinessPermit(null);
      setBusinessRegistration(null);

      setFormData((prev) => ({
        ...prev,
        newPassword: '',
        confirmPassword: ''
      }));

      showNotification('Profile updated successfully', 'success');
      showSweetAlert('success', 'Profile Updated!', 'Your profile has been successfully updated with the new information.');
      
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification(`Error: ${error.message}`, 'error');
      showSweetAlert('error', 'Update Failed', `Failed to update profile: ${error.message || 'Unknown error occurred'}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* SweetAlert Modal */}
      <SweetAlert
        isOpen={sweetAlert.isOpen}
        onClose={closeSweetAlert}
        type={sweetAlert.type}
        title={sweetAlert.title}
        message={sweetAlert.message}
      />

      <SidebarOwner onLogout={handleLogout} />

      <div className="flex flex-col flex-grow overflow-auto">
        <div className="sticky top-0 z-50 h-16 bg-white shadow">
          <TopbarOwner />
        </div>

        <div className="flex-grow p-6 space-y-6">
          {notification.show && (
            <div className={`fixed top-4 right-4 z-50 flex items-center p-4 shadow-lg rounded-lg ${
              notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <div className="mr-3">
                {notification.type === 'success' ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : (
                  <X size={20} className="text-red-500" />
                )}
              </div>
              <div className="text-sm font-medium">{notification.message}</div>
              <button 
                onClick={() => setNotification(prev => ({...prev, show: false}))}
                className="ml-4 text-gray-500 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-800">Profile Settings</h1>
            <p className="text-gray-600">
              Manage your personal information and account security
              {currentUser ? (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Logged in as {userData.email}
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Not logged in
                </span>
              )}
            </p>
          </div>

          <form onSubmit={handleSaveChanges} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow p-6 text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  {previewImage || currentProfileImageUrl ? (
                    <img 
                      src={previewImage || currentProfileImageUrl} 
                      alt="Profile" 
                      className="w-full h-full rounded-full object-cover border-2 border-gray-200" 
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-3xl">
                      <User size={48} />
                    </div>
                  )}
                  
                  <button 
                    type="button"
                    onClick={triggerFileInput}
                    className="absolute bottom-0 right-0 bg-blue-100 p-2 rounded-full shadow hover:bg-blue-200 transition-colors"
                  >
                    <Camera size={18} className="text-blue-600" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <h2 className="text-xl font-semibold">{userData.fullName || "User"}</h2>
                <p className="text-gray-500">{userData.role || "Owner"}</p>
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p className="flex items-center justify-center gap-2"><Mail size={16} className="text-gray-400" /> {userData.email}</p>
                  <p className="flex items-center justify-center gap-2"><Phone size={16} className="text-gray-400" /> {userData.contactNumber}</p>
                  <p className="flex items-center justify-center gap-2"><MapPin size={16} className="text-gray-400" /> {userData.address}</p>
                  <p className="flex items-center justify-center gap-2"><Shield size={16} className="text-gray-400" /> {userData.role}</p>
                </div>
              </div>

              <div className="md:col-span-2 bg-white rounded-2xl shadow p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  <p className="text-sm text-gray-500">Update your account details and contact information</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inputField({ 
                    label: "Full Name", 
                    name: "fullName", 
                    value: formData.fullName, 
                    onChange: handleInputChange 
                  })}
                  {inputField({ 
                    label: "Email Address", 
                    name: "email", 
                    type: "email", 
                    value: formData.email, 
                    onChange: handleInputChange 
                  })}
                  {inputField({ 
                    label: "Business Name", 
                    name: "businessName", 
                    value: formData.businessName, 
                    onChange: handleInputChange 
                  })}
                  {inputField({ 
                    label: "Contact Number", 
                    name: "contactNumber", 
                    value: formData.contactNumber, 
                    onChange: handleInputChange 
                  })}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Address</label>
                    <textarea 
                      name="address" 
                      value={formData.address} 
                      onChange={handleInputChange} 
                      rows={3}
                      className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-4">
                    <h4 className="text-md font-semibold">Security Settings</h4>
                    <p className="text-sm text-gray-500">Change your password to keep your account secure</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inputField({ 
                      label: "New Password", 
                      name: "newPassword", 
                      type: "password", 
                      placeholder: "Leave blank to keep current", 
                      value: formData.newPassword, 
                      onChange: handleInputChange 
                    })}
                    {inputField({ 
                      label: "Confirm New Password", 
                      name: "confirmPassword", 
                      type: "password", 
                      placeholder: "Leave blank to keep current", 
                      value: formData.confirmPassword, 
                      onChange: handleInputChange 
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Documents Section */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Business Documents</h3>
                <p className="text-sm text-gray-500">Upload or update your business permit and registration documents</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Business Permit</label>
                  <DocumentUpload
                    label="Business Permit"
                    currentUrl={currentBusinessPermitUrl}
                    onFileSelect={handleBusinessPermitUpload}
                    fileInputRef={businessPermitRef}
                    acceptedTypes="image/*,.pdf"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-3">Business Registration</label>
                  <DocumentUpload
                    label="Business Registration"
                    currentUrl={currentBusinessRegistrationUrl}
                    onFileSelect={handleBusinessRegistrationUpload}
                    fileInputRef={businessRegistrationRef}
                    acceptedTypes="image/*,.pdf"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const inputField = ({ label, name, type = "text", placeholder = "", value, onChange }) => (
  <div>
    <label className="text-sm font-medium">{label}</label>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

export default Profile;