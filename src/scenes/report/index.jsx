import React, { useState, useEffect } from 'react';
import {
  BarChart2, Download, CalendarCheck, XCircle, Car, FileText, FileSpreadsheet, Calendar
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  MenuItem,
  Button,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  TextField
} from '@mui/material';
import SidebarOwner from "../global/SidebarOwner";
import TopbarOwner from "../global/TopbarOwner";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase"; 
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp
} from "firebase/firestore";

const Reports = () => {
  const [reportType, setReportType] = useState('weekly');
  const [timePeriod, setTimePeriod] = useState('last-7');
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Helper function to format date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to calculate days between two dates
  const getDaysBetween = (startDate, endDate) => {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    return Math.round(Math.abs((startDate - endDate) / oneDay));
  };

  // Helper function to get date range based on time period or custom dates
  const getDateRange = (period) => {
    if (useCustomDateRange) {
      if (!customStartDate || !customEndDate) {
        throw new Error('Please select both start and end dates for custom range');
      }
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      if (startDate > endDate) {
        throw new Error('Start date must be before end date');
      }
      
      return { startDate, endDate };
    }

    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case 'last-7':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last-30':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last-90':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'last-365':
        startDate.setDate(endDate.getDate() - 365);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    return { startDate, endDate };
  };

  // Helper to group bookings by time period for the chart
  const groupBookingsByTimePeriod = (completedBookings, cancelledBookings, type, startDate, endDate) => {
    const groupedData = [];
    
    if (type === 'weekly') {
      // Group by days of the week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysMap = days.reduce((acc, day, index) => {
        acc[index] = { 
          day, 
          sales: 0, 
          customers: 0, 
          cancelled: 0,
          completedBookings: [],
          cancelledBookings: []
        };
        return acc;
      }, {});

      completedBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const dayIndex = bookingDate.getDay();
        daysMap[dayIndex].sales += Number(booking.price) || 0;
        daysMap[dayIndex].customers += 1;
        daysMap[dayIndex].completedBookings.push(booking);
      });

      cancelledBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const dayIndex = bookingDate.getDay();
        daysMap[dayIndex].cancelled += 1;
        daysMap[dayIndex].cancelledBookings.push(booking);
      });

      days.forEach((day, index) => {
        groupedData.push({
          day,
          sales: daysMap[index].sales,
          customers: daysMap[index].customers,
          cancelled: daysMap[index].cancelled,
          avgDuration: calculateAverageDuration(daysMap[index].completedBookings)
        });
      });
    } else if (type === 'monthly') {
      // Group by weeks
      const totalWeeks = Math.ceil(getDaysBetween(startDate, endDate) / 7);
      
      for (let i = 0; i < totalWeeks; i++) {
        groupedData.push({
          week: `Week ${i + 1}`,
          sales: 0,
          customers: 0,
          cancelled: 0,
          completedBookings: [],
          cancelledBookings: []
        });
      }

      completedBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const weekIndex = Math.floor(getDaysBetween(startDate, bookingDate) / 7);
        if (weekIndex >= 0 && weekIndex < groupedData.length) {
          groupedData[weekIndex].sales += Number(booking.price) || 0;
          groupedData[weekIndex].customers += 1;
          groupedData[weekIndex].completedBookings = groupedData[weekIndex].completedBookings || [];
          groupedData[weekIndex].completedBookings.push(booking);
        }
      });

      cancelledBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const weekIndex = Math.floor(getDaysBetween(startDate, bookingDate) / 7);
        if (weekIndex >= 0 && weekIndex < groupedData.length) {
          groupedData[weekIndex].cancelled += 1;
          groupedData[weekIndex].cancelledBookings = groupedData[weekIndex].cancelledBookings || [];
          groupedData[weekIndex].cancelledBookings.push(booking);
        }
      });

      // Calculate average duration for each week
      groupedData.forEach(week => {
        week.avgDuration = calculateAverageDuration(week.completedBookings);
        delete week.completedBookings; // Clean up the temporary bookings array
        delete week.cancelledBookings;
      });
    } else if (type === 'yearly') {
      // Group by months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsMap = months.reduce((acc, month, index) => {
        acc[index] = { 
          month, 
          sales: 0, 
          customers: 0, 
          cancelled: 0,
          completedBookings: [],
          cancelledBookings: []
        };
        return acc;
      }, {});

      completedBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const monthIndex = bookingDate.getMonth();
        monthsMap[monthIndex].sales += Number(booking.price) || 0;
        monthsMap[monthIndex].customers += 1;
        monthsMap[monthIndex].completedBookings.push(booking);
      });

      cancelledBookings.forEach(booking => {
        const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
        const monthIndex = bookingDate.getMonth();
        monthsMap[monthIndex].cancelled += 1;
        monthsMap[monthIndex].cancelledBookings.push(booking);
      });

      months.forEach((month, index) => {
        groupedData.push({
          month,
          sales: monthsMap[index].sales,
          customers: monthsMap[index].customers,
          cancelled: monthsMap[index].cancelled,
          avgDuration: calculateAverageDuration(monthsMap[index].completedBookings)
        });
      });
    }
    
    return groupedData;
  };

  // Calculate average rental duration for a set of bookings
  const calculateAverageDuration = (bookings) => {
    if (!bookings || bookings.length === 0) return 0;
    
    let totalDays = 0;
    let validBookings = 0;
    
    bookings.forEach(booking => {
      // Process pickup and dropoff dates
      const pickupDate = processDate(booking.pickupDate || booking.bookingDates?.start);
      const dropoffDate = processDate(booking.dropoffDate || booking.bookingDates?.end);
      
      if (pickupDate && dropoffDate) {
        const days = getDaysBetween(pickupDate, dropoffDate);
        if (days > 0) {
          totalDays += days;
          validBookings++;
        }
      }
    });
    
    if (validBookings === 0) return 0;
    return (totalDays / validBookings).toFixed(1);
  };

  // Helper function to handle date processing
  const processDate = (dateField) => {
    if (!dateField) return null;
    
    // Handle Firestore Timestamp objects
    if (dateField.toDate) {
      return dateField.toDate();
    }
    
    // Handle JS Date objects or date strings
    try {
      return new Date(dateField);
    } catch (e) {
      console.error("Invalid date:", dateField);
      return null;
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("No user logged in. Please log in and try again.");
        setLoading(false);
        return;
      }

      const { startDate, endDate } = getDateRange(timePeriod);
      
      // Query bookings collection for completed bookings
      const bookingsRef = collection(db, "bookings");
      const completedQuery = query(
        bookingsRef, 
        where("ownerId", "==", currentUser.uid),
        where("status", "==", "Completed")
      );
      
      // Query bookings collection for cancelled bookings
      const cancelledQuery = query(
        bookingsRef, 
        where("ownerId", "==", currentUser.uid),
        where("status", "==", "Cancelled")
      );
      
      const [completedSnapshot, cancelledSnapshot] = await Promise.all([
        getDocs(completedQuery),
        getDocs(cancelledQuery)
      ]);
      
      // Process the completed bookings
      let completedBookings = [];
      completedSnapshot.forEach(doc => {
        const bookingData = doc.data();
        
        // Convert Firestore Timestamps to JavaScript Date objects for pickup and dropoff dates
        const pickupDate = processDate(bookingData.pickupDate || bookingData.bookingDates?.start);
        const dropoffDate = processDate(bookingData.dropoffDate || bookingData.bookingDates?.end);
        
        // Add a bookingDate field that we'll use for report grouping
        // Use the updated timestamp or created at as fallback
        const bookingDate = processDate(bookingData.updatedAt || bookingData.createdAt || pickupDate);
        
        // Only include bookings with dates that fall within the selected date range
        if (bookingDate && bookingDate >= startDate && bookingDate <= endDate) {
          completedBookings.push({
            id: doc.id,
            ...bookingData,
            pickupDate,
            dropoffDate,
            bookingDate // Add this for grouping
          });
        }
      });

      // Process the cancelled bookings
      let cancelledBookings = [];
      cancelledSnapshot.forEach(doc => {
        const bookingData = doc.data();
        
        // Convert Firestore Timestamps to JavaScript Date objects for pickup and dropoff dates
        const pickupDate = processDate(bookingData.pickupDate || bookingData.bookingDates?.start);
        const dropoffDate = processDate(bookingData.dropoffDate || bookingData.bookingDates?.end);
        
        // Add a bookingDate field that we'll use for report grouping
        // Use the updated timestamp or created at as fallback
        const bookingDate = processDate(bookingData.updatedAt || bookingData.createdAt || pickupDate);
        
        // Only include bookings with dates that fall within the selected date range
        if (bookingDate && bookingDate >= startDate && bookingDate <= endDate) {
          cancelledBookings.push({
            id: doc.id,
            ...bookingData,
            pickupDate,
            dropoffDate,
            bookingDate // Add this for grouping
          });
        }
      });
      
      // Calculate totals
      const totalSales = completedBookings.reduce((sum, booking) => sum + (Number(booking.price) || 0), 0);
      const uniqueCustomers = new Set(completedBookings.map(booking => booking.email)).size;
      const totalCancelled = cancelledBookings.length;
      
      // Group data by time period for the chart
      const chartData = groupBookingsByTimePeriod(completedBookings, cancelledBookings, reportType, startDate, endDate);
      
      setReportData({
        sales: totalSales,
        customers: uniqueCustomers,
        rentals: completedBookings.length,
        cancelled: totalCancelled,
        dateRange: {
          start: formatDate(startDate),
          end: formatDate(endDate)
        },
        chartData
      });
      
    } catch (err) {
      console.error("Error generating report: ", err);
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle custom date range toggle
  const handleCustomDateToggle = () => {
    setUseCustomDateRange(!useCustomDateRange);
    setCustomStartDate('');
    setCustomEndDate('');
    setReportData(null); // Clear existing report data
  };

  // Function to set quick date ranges
  const setQuickDateRange = (days) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    setCustomStartDate(startDate.toISOString().split('T')[0]);
    setCustomEndDate(endDate.toISOString().split('T')[0]);
  };

  // PDF Export Function
  const downloadPDF = () => {
    if (!reportData) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rental Analytics Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .report-title {
              font-size: 20px;
              color: #666;
              margin-bottom: 5px;
            }
            .report-period {
              font-size: 14px;
              color: #888;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .summary-card {
              border: 1px solid #ddd;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }
            .table-container {
              margin-top: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .text-red {
              color: #dc2626;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Car Rental Analytics</div>
            <div class="report-title">${reportType === 'weekly' ? 'Weekly' : reportType === 'monthly' ? 'Monthly' : 'Yearly'} Report</div>
            <div class="report-period">${reportData.dateRange.start} - ${reportData.dateRange.end}</div>
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-label">Total Sales</div>
              <div class="summary-value">₱${reportData.sales.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Customers</div>
              <div class="summary-value">${reportData.customers}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Completed Rentals</div>
              <div class="summary-value">${reportData.rentals}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Cancelled Bookings</div>
              <div class="summary-value text-red">${reportData.cancelled}</div>
            </div>
          </div>

          <div class="table-container">
            <h3>Detailed Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>${reportType === 'weekly' ? 'Day' : reportType === 'monthly' ? 'Week' : 'Month'}</th>
                  <th class="text-right">Sales (₱)</th>
                  <th class="text-right">Customers</th>
                  <th class="text-right">Cancelled</th>
                  <th class="text-right">Avg. Duration (days)</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.chartData.map(row => `
                  <tr>
                    <td>${row.day || row.week || row.month}</td>
                    <td class="text-right">₱${(row.sales || 0).toLocaleString()}</td>
                    <td class="text-right">${row.customers || 0}</td>
                    <td class="text-right text-red">${row.cancelled || 0}</td>
                    <td class="text-right">${row.avgDuration || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>This report contains confidential business information</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // Excel Export Function
  const downloadExcel = () => {
    if (!reportData) return;

    // Create workbook structure
    const workbook = {
      SheetNames: ['Summary', 'Detailed Data'],
      Sheets: {}
    };

    // Summary Sheet
    const summaryData = [
      ['Rental Analytics Report'],
      [`Report Type: ${reportType === 'weekly' ? 'Weekly' : reportType === 'monthly' ? 'Monthly' : 'Yearly'}`],
      [`Period: ${reportData.dateRange.start} - ${reportData.dateRange.end}`],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['SUMMARY METRICS'],
      ['Metric', 'Value'],
      ['Total Sales', `₱${reportData.sales.toLocaleString()}`],
      ['Total Customers', reportData.customers],
      ['Completed Rentals', reportData.rentals],
      ['Cancelled Bookings', reportData.cancelled],
      [],
      ['PERFORMANCE INDICATORS'],
      ['Completion Rate', `${((reportData.rentals / (reportData.rentals + reportData.cancelled)) * 100 || 0).toFixed(1)}%`],
      ['Average Revenue per Customer', `₱${(reportData.sales / reportData.customers || 0).toLocaleString()}`]
    ];

    // Detailed Data Sheet
    const detailedHeaders = [
      reportType === 'weekly' ? 'Day' : reportType === 'monthly' ? 'Week' : 'Month',
      'Sales (₱)',
      'Customers',
      'Cancelled',
      'Avg Duration (days)'
    ];

    const detailedData = [
      detailedHeaders,
      ...reportData.chartData.map(row => [
        row.day || row.week || row.month,
        row.sales || 0,
        row.customers || 0,
        row.cancelled || 0,
        row.avgDuration || 0
      ])
    ];

    // Convert arrays to worksheet format
    const summaryWS = arrayToWorksheet(summaryData);
    const detailedWS = arrayToWorksheet(detailedData);

    workbook.Sheets['Summary'] = summaryWS;
    workbook.Sheets['Detailed Data'] = detailedWS;

    // Convert to Excel file and download
    const excelBuffer = workbookToExcel(workbook);
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `rental_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper function to convert array to worksheet (simplified Excel format)
  const arrayToWorksheet = (data) => {
    const ws = {};
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

    for (let R = 0; R < data.length; ++R) {
      for (let C = 0; C < data[R].length; ++C) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;

        const cell = { v: data[R][C] };
        if (cell.v == null) continue;

        const cellRef = encodeCell({ c: C, r: R });
        
        if (typeof cell.v === 'number') cell.t = 'n';
        else if (typeof cell.v === 'boolean') cell.t = 'b';
        else cell.t = 's';

        ws[cellRef] = cell;
      }
    }
    
    if (range.s.c < 10000000) ws['!ref'] = encodeRange(range);
    return ws;
  };

  // Helper function to encode cell reference
  const encodeCell = (cell) => {
    return String.fromCharCode(65 + cell.c) + (cell.r + 1);
  };

  // Helper function to encode range
  const encodeRange = (range) => {
    return encodeCell(range.s) + ':' + encodeCell(range.e);
  };

  // Simplified workbook to Excel conversion (creates CSV-like format)
  const workbookToExcel = (workbook) => {
    let csvContent = '';
    
    // Process Summary sheet
    csvContent += 'SUMMARY SHEET\n';
    const summarySheet = workbook.Sheets['Summary'];
    for (let row = 0; row < 20; row++) {
      let rowData = [];
      for (let col = 0; col < 5; col++) {
        const cellRef = String.fromCharCode(65 + col) + (row + 1);
        const cell = summarySheet[cellRef];
        rowData.push(cell ? cell.v : '');
      }
      if (rowData.some(cell => cell !== '')) {
        csvContent += rowData.join(',') + '\n';
      }
    }
    
    csvContent += '\n\nDETAILED DATA SHEET\n';
    const detailedSheet = workbook.Sheets['Detailed Data'];
    for (let row = 0; row < reportData.chartData.length + 2; row++) {
      let rowData = [];
      for (let col = 0; col < 5; col++) {
        const cellRef = String.fromCharCode(65 + col) + (row + 1);
        const cell = detailedSheet[cellRef];
        rowData.push(cell ? cell.v : '');
      }
      if (rowData.some(cell => cell !== '')) {
        csvContent += rowData.join(',') + '\n';
      }
    }
    
    return new TextEncoder().encode(csvContent);
  };

  const handleExportMenuClick = (event) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  useEffect(() => {
    // Check if user is logged in
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        navigate("/login");
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen">
    {/* Pass handleLogout to SidebarOwner */}
    <div className="h-screen overflow-y-auto w-64 bg-gray-800 text-white fixed">
      <SidebarOwner onLogout={handleLogout} />
    </div>

    {/* Main content (with left padding to accommodate fixed sidebar) */}
    <div className="flex-1 flex flex-col ml-64">
      <TopbarOwner onLogout={handleLogout} />
      <div className="p-6 overflow-y-auto">
          
          <Typography variant="h4" gutterBottom className="font-bold">
            Rental Report
          </Typography>
          <Typography variant="subtitle1" gutterBottom className="text-gray-600 mb-6">
            Generate reports to analyze sales, customer trends, and cancellations from all bookings
          </Typography>

          <Card sx={{ borderRadius: 2, boxShadow: 2, marginBottom: 4 }}>
            <CardContent className="p-4">
              <Typography variant="h6" gutterBottom className="font-semibold">
                Generate Report
              </Typography>
              <Box className="grid grid-cols-1 gap-4">
                {/* Report Type */}
                <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormControl fullWidth size="small">
                    <InputLabel>Report Type</InputLabel>
                    <Select
                      value={reportType}
                      label="Report Type"
                      onChange={(e) => setReportType(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="weekly">Weekly Report</MenuItem>
                      <MenuItem value="monthly">Monthly Report</MenuItem>
                      <MenuItem value="yearly">Yearly Report</MenuItem>
                    </Select>
                  </FormControl>

                  <Box className="flex items-center gap-2">
                    <Button
                      variant={useCustomDateRange ? "contained" : "outlined"}
                      size="small"
                      startIcon={<Calendar size={16} />}
                      onClick={handleCustomDateToggle}
                      disabled={loading}
                    >
                      {useCustomDateRange ? 'Using Custom Range' : 'Custom Date Range'}
                    </Button>
                  </Box>
                </Box>

                {/* Date Range Selection */}
                {useCustomDateRange ? (
                  <Box>
                    <Typography variant="subtitle2" className="mb-2 font-medium">
                      Custom Date Range
                    </Typography>
                    <Box className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <TextField
                        label="Start Date"
                        type="date"
                        size="small"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={loading}
                        fullWidth
                      />
                      <TextField
                        label="End Date"
                        type="date"
                        size="small"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={loading}
                        fullWidth
                      />
                    </Box>
                    <Box className="flex gap-2 flex-wrap">
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setQuickDateRange(7)}
                        disabled={loading}
                      >
                        Last 7 Days
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setQuickDateRange(30)}
                        disabled={loading}
                      >
                        Last 30 Days
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setQuickDateRange(90)}
                        disabled={loading}
                      >
                        Last 3 Months
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setQuickDateRange(365)}
                        disabled={loading}
                      >
                        Last Year
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel>Time Period</InputLabel>
                    <Select
                      value={timePeriod}
                      label="Time Period"
                      onChange={(e) => setTimePeriod(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="last-7">Last 7 Days</MenuItem>
                      <MenuItem value="last-30">Last 30 Days</MenuItem>
                      <MenuItem value="last-90">Last Quarter</MenuItem>
                      <MenuItem value="last-365">Last Year</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* Generate and Export Buttons */}
                <Box className="flex gap-2 items-center">
                  <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <BarChart2 size={18} />}
                    onClick={generateReport}
                    disabled={loading}
                  >
                    {loading ? 'Generating...' : 'Generate'}
                  </Button>
                  {reportData && (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<Download size={18} />}
                        onClick={handleExportMenuClick}
                        disabled={loading}
                      >
                        Export
                      </Button>
                      <Menu
                        anchorEl={exportMenuAnchor}
                        open={Boolean(exportMenuAnchor)}
                        onClose={handleExportMenuClose}
                      >
                        <MenuItem onClick={() => { downloadPDF(); handleExportMenuClose(); }}>
                          <ListItemIcon>
                            <FileText size={18} />
                          </ListItemIcon>
                          <ListItemText>Export as PDF</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { downloadExcel(); handleExportMenuClose(); }}>
                          <ListItemIcon>
                            <FileSpreadsheet size={18} />
                          </ListItemIcon>
                          <ListItemText>Export as Excel</ListItemText>
                        </MenuItem>
                      </Menu>
                    </>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {error && (
            <Card sx={{ borderRadius: 2, boxShadow: 2, marginBottom: 4, backgroundColor: 'error.light' }}>
              <CardContent>
                <Typography color="error">{error}</Typography>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : reportData ? (
            <>
              <Box className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" className="text-gray-500">TOTAL INCOME</Typography>
                    <Typography variant="h4" className="font-bold mt-2">₱{reportData.sales.toLocaleString()}</Typography>
                    <Typography variant="caption" className="text-gray-500">
                      {reportData.dateRange.start} - {reportData.dateRange.end}
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" className="text-gray-500">TOTAL CLIENTS</Typography>
                    <Typography variant="h4" className="font-bold mt-2">{reportData.customers}</Typography>
                    <Typography variant="caption" className="text-gray-500">
                      Unique customers in this period
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" className="text-gray-500">COMPLETED RENTALS</Typography>
                    <Typography variant="h4" className="font-bold mt-2">{reportData.rentals}</Typography>
                    <Typography variant="caption" className="text-gray-500">
                      Successfully completed bookings
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" className="text-gray-500">CANCELLED BOOKINGS</Typography>
                    <Typography variant="h4" className="font-bold mt-2 text-red-600">{reportData.cancelled}</Typography>
                    <Typography variant="caption" className="text-gray-500">
                      Cancelled in this period
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Card sx={{ borderRadius: 2, boxShadow: 2, marginBottom: 4 }}>
                <CardHeader
                  title={<Typography variant="h6" className="font-semibold">Detailed Breakdown</Typography>}
                />
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{reportType === 'weekly' ? 'Day' : reportType === 'monthly' ? 'Week' : 'Month'}</TableCell>
                        <TableCell align="right">Sales (₱)</TableCell>
                        <TableCell align="right">Customers</TableCell>
                        <TableCell align="right">Cancelled</TableCell>
                        <TableCell align="right">Avg. Rental Duration (days)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportData.chartData.length > 0 ? (
                        reportData.chartData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{row.day || row.week || row.month}</TableCell>
                            <TableCell align="right">₱{row.sales?.toLocaleString() || '0'}</TableCell>
                            <TableCell align="right">{row.customers || '0'}</TableCell>
                            <TableCell align="right" className="text-red-600">{row.cancelled || '0'}</TableCell>
                            <TableCell align="right">{row.avgDuration || '0'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            No data available for the selected period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </>
          ) : (
            <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
              <CardContent className="text-center py-16">
                <BarChart2 size={48} className="mx-auto text-gray-400 mb-4" />
                <Typography variant="body1" className="text-gray-500">
                  No report generated yet
                </Typography>
                <Typography variant="body2" className="text-gray-400 mt-2">
                  Select parameters and click "Generate" to create a report
                </Typography>
              </CardContent>
            </Card>
          )}
        </div>
        </div>
        </div>
  );
};

export default Reports;