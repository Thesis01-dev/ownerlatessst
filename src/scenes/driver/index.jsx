import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  UserCircle2, 
  IdCard, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Car,
  ShieldCheck,
  Edit,
  ArrowLeft,
  FileText
} from "lucide-react";
import { ClipLoader } from "react-spinners";

const DriverProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate API fetch with Philippine data
    const fetchDriver = async () => {
      try {
        setLoading(true);
        
        // Mock data for a Filipino driver
        const mockDriver = {
          id: id,
          name: "Juan Dela Cruz",
          age: 28,
          birthDate: "1995-08-15",
          birthPlace: "Manila",
          email: "juan.delacruz@example.com",
          phone: "+63 912 345 6789",
          address: "123 Rizal Avenue, Barangay 101, Manila",
          licenseNumber: "N01-23-456789",
          licenseExpiry: "2025-12-31",
          licenseType: "Professional",
          restrictions: "A, B (Manual Transmission)",
          bloodType: "O+",
          status: "Active",
          vehicleAssigned: "Toyota Vios (ABC 1234)",
          hireDate: "2021-03-10",
          imageUrl: "https://randomuser.me/api/portraits/men/42.jpg",
          licenseFrontUrl: "https://i.imgur.com/xyz1234.jpg", // Replace with actual LTO license front
          licenseBackUrl: "https://i.imgur.com/abcd5678.jpg" // Replace with actual LTO license back
        };
        
        setTimeout(() => {
          setDriver(mockDriver);
          setLoading(false);
        }, 800);
      } catch (err) {
        setError("Failed to load driver data");
        setLoading(false);
      }
    };

    fetchDriver();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ClipLoader color="#3B82F6" size={50} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!driver) {
    return <div>Driver not found</div>;
  }

  // Format Philippine license number (e.g., N01-23-456789)
  const formatLicenseNumber = (num) => {
    return num || "Not Available";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-blue-600 mb-6 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft size={18} className="mr-2" />
        Back to Drivers List
      </button>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header Section */}
        <div className="bg-blue-800 text-white p-6 flex flex-col md:flex-row items-start md:items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <img 
              src={driver.imageUrl} 
              alt="Driver" 
              className="w-20 h-20 rounded-full border-4 border-white mr-4"
            />
            <div>
              <h1 className="text-2xl font-bold">{driver.name}</h1>
              <div className="flex items-center mt-1">
                <IdCard size={16} className="mr-1" />
                <span>Driver ID: {driver.id}</span>
              </div>
            </div>
          </div>
          <div className="ml-auto bg-blue-700 px-4 py-2 rounded-md flex items-center">
            <ShieldCheck size={18} className="mr-2" />
            <span>Status: <span className="font-semibold">{driver.status}</span></span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Personal Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Details Card */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <UserCircle2 size={20} className="mr-2 text-blue-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Full Name</label>
                    <p className="font-medium">{driver.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Birth Date</label>
                    <p className="font-medium flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {new Date(driver.birthDate).toLocaleDateString('en-PH')} (Age: {driver.age})
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Birth Place</label>
                    <p className="font-medium">{driver.birthPlace}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Contact Number</label>
                    <p className="font-medium flex items-center">
                      <Phone size={14} className="mr-1" />
                      {driver.phone}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Email Address</label>
                    <p className="font-medium flex items-center">
                      <Mail size={14} className="mr-1" />
                      {driver.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Address</label>
                    <p className="font-medium flex items-center">
                      <MapPin size={14} className="mr-1" />
                      {driver.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* License Details Card */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <IdCard size={20} className="mr-2 text-blue-600" />
                Philippine Driver's License Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">License Number</label>
                    <p className="font-medium">{formatLicenseNumber(driver.licenseNumber)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">License Type</label>
                    <p className="font-medium">{driver.licenseType}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Restrictions</label>
                    <p className="font-medium">{driver.restrictions}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Expiration Date</label>
                    <p className="font-medium flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {new Date(driver.licenseExpiry).toLocaleDateString('en-PH')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Blood Type</label>
                    <p className="font-medium">{driver.bloodType}</p>
                  </div>
                </div>
              </div>
              
              {/* License Images */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 block mb-2">License Front</label>
                  <div className="border border-gray-300 rounded-md p-2">
                    <img 
                      src={driver.licenseFrontUrl} 
                      alt="License Front" 
                      className="w-full h-auto rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-2">License Back</label>
                  <div className="border border-gray-300 rounded-md p-2">
                    <img 
                      src={driver.licenseBackUrl} 
                      alt="License Back" 
                      className="w-full h-auto rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="space-y-6">
            {/* Employment Card */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <FileText size={20} className="mr-2 text-blue-600" />
                Employment Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Hire Date</label>
                  <p className="font-medium flex items-center">
                    <Calendar size={14} className="mr-1" />
                    {new Date(driver.hireDate).toLocaleDateString('en-PH')}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Years of Service</label>
                  <p className="font-medium">
                    {new Date().getFullYear() - new Date(driver.hireDate).getFullYear()} years
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Assignment Card */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Car size={20} className="mr-2 text-blue-600" />
                Current Vehicle Assignment
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Vehicle Model</label>
                  <p className="font-medium">{driver.vehicleAssigned.split('(')[0].trim()}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Plate Number</label>
                  <p className="font-medium">
                    {driver.vehicleAssigned.match(/\(([^)]+)\)/)[1]}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              <div className="space-y-3">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center">
                  <Edit size={16} className="mr-2" />
                  Edit Driver Profile
                </button>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md">
                  View Driving History
                </button>
                <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-md">
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;