import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
  Dimensions,
  Platform
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Responsive scaling functions
const scale = (size) => (width / 375) * size;
const verticalScale = (size) => (height / 812) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

const ExpenseEntry = () => {
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [pettyCashRecords, setPettyCashRecords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [details, setDetails] = useState([]);
  const [expenses, setExpenses] = useState({});
  const [formData, setFormData] = useState({
    pd_id: "",
    site_id: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    petty_cash_id: null,
    project_name: "",
    site_name: "",
    assign_date: "",
    expense_category_id: "",
    expense_detail_id: "",
    amount: "",
    total_amount: 0,
    member_count: "",
    image: null,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [showAmountWarning, setShowAmountWarning] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [expandedRecords, setExpandedRecords] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [orientation, setOrientation] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height ? 'LANDSCAPE' : 'PORTRAIT'
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setOrientation(window.width > window.height ? 'LANDSCAPE' : 'PORTRAIT');
    });
    return () => subscription?.remove();
  }, []);

  // Request permissions on component mount
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Sorry, we need camera roll permissions to upload receipts.');
      }
    })();
  }, []);

  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://103.118.158.33/api/material/projects");
      setProjects(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError("Failed to load projects. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSites = async (pd_id) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://103.118.158.33/api/material/sites/${pd_id}`);
      setSites(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error("Error fetching sites:", error);
      setError("Failed to load sites. Please try again.");
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPettyCash = async (site_id) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      
      const response = await axios.post(
        "http://103.118.158.33/api/expense/fetch-petty-cash-by-site",
        { site_id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const records = Array.isArray(response.data.data)
        ? response.data.data.map((record) => ({
            ...record,
            amount: parseFloat(record.amount),
            previous_remaining_amount: parseFloat(record.previous_remaining_amount) || 0,
            total_expenses: parseFloat(record.total_expenses) || 0,
            assign_date: formatDisplayDate(record.assign_date),
          }))
        : [];
      setPettyCashRecords(records);

      // Fetch expenses for each record
      const expensesPromises = records.map((record) =>
        axios.post(
          "http://103.118.158.33/api/expense/fetch-expenses-by-petty-cash",
          { petty_cash_id: record.id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
      );

      const expensesResponses = await Promise.all(expensesPromises);
      const allExpenses = expensesResponses.map((res) =>
        Array.isArray(res.data.data) ? res.data.data : []
      );

      const expensesMap = {};
      records.forEach((record, index) => {
        expensesMap[record.id] = allExpenses[index];
      });
      setExpenses(expensesMap);
    } catch (error) {
      console.error("Error fetching petty cash:", error);
      setError("Failed to load petty cash records. Please try again.");
      setPettyCashRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get("http://103.118.158.33/api/expense/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCategories(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("Failed to load expense categories. Please try again.");
    }
  };

  const fetchDetails = async (exp_category_id) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      const response = await axios.post(
        "http://103.118.158.33/api/expense/fetch-details",
        { exp_category_id: parseInt(exp_category_id) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setDetails(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error("Error fetching details:", error);
      setError("Failed to load expense details. Please try again.");
      setDetails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (formData.pd_id) {
      fetchSites(formData.pd_id);
    } else {
      setSites([]);
      setPettyCashRecords([]);
    }
  }, [formData.pd_id]);

  useEffect(() => {
    if (formData.site_id) {
      fetchPettyCash(formData.site_id);
    } else {
      setPettyCashRecords([]);
    }
  }, [formData.site_id]);

  useEffect(() => {
    if (expenseForm.expense_category_id) {
      fetchDetails(expenseForm.expense_category_id);
    } else {
      setDetails([]);
    }
  }, [expenseForm.expense_category_id]);

  useEffect(() => {
    if (expenseForm.amount) {
      const enteredAmount = parseFloat(expenseForm.amount);
      const remaining = expenseForm.total_amount - enteredAmount;
      setRemainingAmount(remaining);
      setShowAmountWarning(remaining < 0);
    } else {
      setShowAmountWarning(false);
    }
  }, [expenseForm.amount, expenseForm.total_amount]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "pd_id" ? { site_id: "" } : {}),
    }));
  };

  const handleExpenseInputChange = (name, value) => {
    setExpenseForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "expense_category_id" ? { expense_detail_id: "", member_count: "" } : {}),
    }));
  };

  const openExpenseModal = (record) => {
    setExpenseForm({
      petty_cash_id: record.id,
      project_name: record.project_name,
      site_name: record.site_name,
      assign_date: formatDisplayDate(record.assign_date),
      expense_category_id: "",
      expense_detail_id: "",
      amount: "",
      total_amount: record.amount,
      member_count: "",
      image: null,
    });
    setIsExpenseModalOpen(true);
    setShowAmountWarning(false);
  };

  const pickImage = async () => {
    try {
      // Check permissions first
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permission denied', 'Cannot access photos without permission.');
          return;
        }
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setExpenseForm(prev => ({ 
          ...prev, 
          image: result.assets[0] 
        }));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (imageAsset) => {
    try {
      setUploadingImage(true);
      
      // Create form data for file upload
      const formData = new FormData();
      formData.append('image', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: 'expense_image.jpg'
      });

      const token = await AsyncStorage.getItem("token");
      
      const response = await axios.post(
        "http://103.118.158.33/api/expense/upload-image",
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.success) {
        return response.data.imageUrl;
      } else {
        throw new Error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleExpenseSubmit = async () => {
    try {
      setLoading(true);
      const { petty_cash_id, expense_category_id, expense_detail_id, amount, member_count, image } = expenseForm;
      const token = await AsyncStorage.getItem("token");

      console.log("Form data:", {
        petty_cash_id,
        expense_category_id,
        expense_detail_id,
        amount,
        member_count,
        hasImage: !!image
      });

      // Enhanced validation
      if (!expense_category_id || !expense_detail_id || !amount) {
        throw new Error("All fields are required");
      }
      
      // Parse and validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Check if amount is a valid number
      if (amount.trim() === "" || amount === "0") {
        throw new Error("Please enter a valid amount");
      }

      // Check if member count is required
      const selectedCategory = categories.find(cat => cat.id === parseInt(expense_category_id));
      const requiresMemberCount = selectedCategory && 
        (selectedCategory.exp_category.toLowerCase().includes('room rent') || 
         selectedCategory.exp_category.toLowerCase().includes('labour food') || 
         selectedCategory.exp_category.toLowerCase().includes('site er food'));
      
      if (requiresMemberCount && (!member_count || parseInt(member_count) <= 0)) {
        throw new Error("Please enter a valid member count");
      }

      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage(image);
      }

      const requestData = {
        petty_cash_id,
        expense_category_id: parseInt(expense_category_id),
        expense_detail_id: parseInt(expense_detail_id),
        amount: parsedAmount,
        member_count: requiresMemberCount ? parseInt(member_count) : null,
        image_url: imageUrl
      };

      console.log("Sending request data:", requestData);

      const response = await axios.post(
        "http://103.118.158.33/api/expense/add-siteincharge-expense",
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Server response:", response.data);

      // Refresh data
      if (formData.site_id) {
        fetchPettyCash(formData.site_id);
      }

      setIsExpenseModalOpen(false);
      setExpenseForm({
        petty_cash_id: null,
        project_name: "",
        site_name: "",
        assign_date: "",
        expense_category_id: "",
        expense_detail_id: "",
        amount: "",
        total_amount: 0,
        member_count: "",
        image: null,
      });

      Alert.alert("Success!", "Expense entry added successfully!");
    } catch (error) {
      console.error("Full error:", error);
      console.error("Error response:", error.response?.data);
      Alert.alert("Error!", error.response?.data?.message || error.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false);
    setExpenseForm({
      petty_cash_id: null,
      project_name: "",
      site_name: "",
      assign_date: "",
      expense_category_id: "",
      expense_detail_id: "",
      amount: "",
      total_amount: 0,
      member_count: "",
      image: null,
    });
    setError(null);
    setShowAmountWarning(false);
  };

  const calculateRemainingAmount = (record) => {
    return record.amount - (record.total_expenses || 0);
  };

  const calculateReceivedAmount = (record) => {
    return record.amount + (record.previous_remaining_amount || 0);
  };

  const totalRemainingAmount = useMemo(() => {
    return pettyCashRecords.reduce((sum, record) => sum + calculateRemainingAmount(record), 0);
  }, [pettyCashRecords]);

  const toggleRecordExpansion = (recordId) => {
    setExpandedRecords((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (formData.site_id) {
      fetchPettyCash(formData.site_id).then(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [formData.site_id]);

  const renderPettyCashRecord = ({ item: record }) => {
    const isExpenseDisabled = calculateRemainingAmount(record) <= 0;
    const recordExpenses = expenses[record.id] || [];
    const isExpanded = expandedRecords[record.id];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardDate}>Date: {record.assign_date}</Text>
            <Text style={styles.cardAmount}>Received: ₹{calculateReceivedAmount(record).toFixed(2)}</Text>
            <Text style={styles.cardAmount}>Expensed: ₹{(record.total_expenses || 0).toFixed(2)}</Text>
          </View>
          <TouchableOpacity onPress={() => toggleRecordExpansion(record.id)}>
            <Icon name={isExpanded ? "expand-less" : "expand-more"} size={moderateScale(24)} color="#666" />
          </TouchableOpacity>
        </View>
        
        <View style={[
          styles.remainingAmount, 
          calculateRemainingAmount(record) <= 0 ? styles.remainingAmountNegative : styles.remainingAmountPositive
        ]}>
          <Text style={styles.remainingAmountText}>
            Remaining: ₹{calculateRemainingAmount(record).toFixed(2)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.addButton,
            isExpenseDisabled && styles.addButtonDisabled
          ]}
          onPress={() => openExpenseModal(record)}
          disabled={isExpenseDisabled}
        >
          <Icon name="add-circle" size={moderateScale(20)} color={isExpenseDisabled ? "#999" : "#fff"} />
          <Text style={[
            styles.addButtonText,
            isExpenseDisabled && styles.addButtonTextDisabled
          ]}>
            Add Expense
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expensesContainer}>
            {recordExpenses.length > 0 ? (
              recordExpenses.map((expense) => (
                <View key={`${record.id}-${expense.id}`} style={styles.expenseItem}>
                  <Text style={styles.expenseCategory}>Category: {expense.exp_category || "N/A"}</Text>
                  <Text style={styles.expenseDetail}>Detail: {expense.details || "N/A"}</Text>
                  <Text style={styles.expenseAmount}>Amount: ₹{parseFloat(expense.amount).toFixed(2)}</Text>
                  {expense.member_count && (
                    <Text style={styles.expenseMemberCount}>Members: {expense.member_count}</Text>
                  )}
                  {expense.image_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(expense.image_url)}>
                      <Text style={styles.expenseImageLink}>View Receipt</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.expenseDate}>
                    Date: {new Date(expense.amount_created_at).toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noExpensesText}>No expenses recorded</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const requiresMemberCount = () => {
    if (!expenseForm.expense_category_id) return false;
    const selectedCategory = categories.find(cat => cat.id === parseInt(expenseForm.expense_category_id));
    return selectedCategory && 
      (selectedCategory.exp_category.toLowerCase().includes('room rent') || 
       selectedCategory.exp_category.toLowerCase().includes('labour food') || 
       selectedCategory.exp_category.toLowerCase().includes('site er food'));
  };

  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Expense Entry</Text>
      </View> */}

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={moderateScale(20)} color="#d32f2f" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Icon name="close" size={moderateScale(20)} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      )}

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Project and Site</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Project</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.pd_id}
                onValueChange={(value) => handleInputChange("pd_id", value)}
                style={styles.picker}
              >
                <Picker.Item label="Select a project" value="" />
                {projects.map((project) => (
                  <Picker.Item 
                    key={project.pd_id} 
                    value={project.pd_id} 
                    label={project.project_name} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Site</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.site_id}
                onValueChange={(value) => handleInputChange("site_id", value)}
                style={styles.picker}
                enabled={!!formData.pd_id}
              >
                <Picker.Item label="Select a site" value="" />
                {sites.map((site) => (
                  <Picker.Item 
                    key={site.site_id} 
                    value={site.site_id} 
                    label={`${site.site_name} ${site.po_number ? `(PO: ${site.po_number})` : ""}`} 
                  />
                ))}
              </Picker>
            </View>
            {formData.site_id && (
              <Text style={styles.poText}>
                PO: {sites.find((site) => site.site_id === formData.site_id)?.po_number || "N/A"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.sectionHeader, orientation === 'LANDSCAPE' && styles.sectionHeaderLandscape]}>
            <Text style={styles.sectionTitle}>Petty Cash Allocations & Expenses</Text>
            <View style={styles.totalAmountContainer}>
              <Text style={styles.totalAmountLabel}>Cash in Hand</Text>
              <Text style={styles.totalAmountValue}>₹{totalRemainingAmount.toFixed(2)}</Text>
            </View>
          </View>

          {pettyCashRecords.length > 0 ? (
            <FlatList
              data={pettyCashRecords}
              renderItem={renderPettyCashRecord}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {formData.site_id
                  ? "No petty cash allocations found for this site."
                  : "Please select a site to view petty cash allocations."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Expense Modal */}
      <Modal
        visible={isExpenseModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={closeExpenseModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeExpenseModal}
        >
          <View style={[styles.modalContent, orientation === 'LANDSCAPE' && styles.modalContentLandscape]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={closeExpenseModal}>
                <Icon name="close" size={moderateScale(24)} color="#666" />
              </TouchableOpacity>
            </View>

            {showAmountWarning && (
              <View style={styles.warningContainer}>
                <Icon name="warning" size={moderateScale(20)} color="#ff9800" />
                <View>
                  <Text style={styles.warningTitle}>Warning</Text>
                  <Text style={styles.warningText}>
                    You are exceeding the allocated amount by ₹{Math.abs(remainingAmount).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Total Allocated Amount</Text>
              <Text style={styles.amountValue}>₹{expenseForm.total_amount.toFixed(2)}</Text>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Project</Text>
                <Text style={styles.readOnlyValue}>{expenseForm.project_name || "N/A"}</Text>
              </View>

              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Site</Text>
                <Text style={styles.readOnlyValue}>{expenseForm.site_name || "N/A"}</Text>
              </View>

              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Date</Text>
                <Text style={styles.readOnlyValue}>{expenseForm.assign_date}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={expenseForm.expense_category_id}
                    onValueChange={(value) => handleExpenseInputChange("expense_category_id", value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a category" value="" />
                    {categories.map((category) => (
                      <Picker.Item 
                        key={category.id} 
                        value={category.id} 
                        label={category.exp_category} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expense Detail</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={expenseForm.expense_detail_id}
                    onValueChange={(value) => handleExpenseInputChange("expense_detail_id", value)}
                    style={styles.picker}
                    enabled={!!expenseForm.expense_category_id}
                  >
                    <Picker.Item label="Select a detail" value="" />
                    {details.map((detail) => (
                      <Picker.Item 
                        key={detail.id} 
                        value={detail.id} 
                        label={detail.details} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {requiresMemberCount() && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Number of Members</Text>
                  <TextInput
                    style={styles.input}
                    value={expenseForm.member_count}
                    onChangeText={(value) => handleExpenseInputChange("member_count", value)}
                    placeholder="Enter number of members"
                    keyboardType="numeric"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                    style={[styles.input, showAmountWarning && styles.inputWarning]}
                    value={expenseForm.amount}
                    onChangeText={(value) => {
                      // Allow only numbers and decimal point
                      const formattedValue = value.replace(/[^0-9.]/g, '');
                      handleExpenseInputChange("amount", formattedValue);
                    }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                  {showAmountWarning && (
                    <Text style={styles.warningTextSmall}>
                      Exceeding by ₹{Math.abs(remainingAmount).toFixed(2)}
                    </Text>
                  )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Upload Receipt (Optional)</Text>
                <View style={styles.imageButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.imageButton}
                    onPress={pickImage}
                  >
                    <Icon name="photo-library" size={moderateScale(20)} color="#4f46e5" />
                    <Text style={styles.imageButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
                
                {expenseForm.image && (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: expenseForm.image.uri }} 
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setExpenseForm(prev => ({ ...prev, image: null }))}
                    >
                      <Icon name="close" size={moderateScale(16)} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={closeExpenseModal}
              >
                <Text style={[styles.buttonText, {color: "#374151"}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.submitButton, (loading || uploadingImage) && styles.submitButtonDisabled]} 
                onPress={handleExpenseSubmit}
                disabled={loading || uploadingImage}
              >
                {(loading || uploadingImage) ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.buttonText, {color: "#fff"}]}>Add Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Responsive Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  // header: {
  //   backgroundColor: "#8346e5ff",
  //   padding: verticalScale(15),
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  // headerTitle: {
  //   color: "#fff",
  //   fontSize: moderateScale(18),
  //   fontWeight: "bold",
  // },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: scale(10),
    margin: scale(15),
    borderRadius: scale(8),
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    color: "#d32f2f",
    marginLeft: scale(5),
    flex: 1,
    fontSize: moderateScale(14),
  },
  loadingContainer: {
    padding: scale(20),
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    margin: scale(15),
    borderRadius: scale(12),
    padding: scale(15),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(10),
    flexWrap: "wrap",
  },
  sectionHeaderLandscape: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "bold",
    color: "#333",
    marginBottom: width > 500 ? 0 : verticalScale(5),
    flex: width > 500 ? 1 : 0,
  },
  totalAmountContainer: {
    backgroundColor: "#eef2ff",
    padding: scale(10),
    borderRadius: scale(8),
    alignItems: "flex-end",
    minWidth: scale(120),
  },
  totalAmountLabel: {
    fontSize: moderateScale(12),
    color: "#4f46e5",
    fontWeight: "500",
  },
  totalAmountValue: {
    fontSize: moderateScale(14),
    fontWeight: "bold",
    color: "#4f46e5",
  },
  inputGroup: {
    marginBottom: verticalScale(10),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#374151",
    marginBottom: verticalScale(5),
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: scale(8),
    overflow: "hidden",
  },
  picker: {
    height: verticalScale(50),
  },
  poText: {
    fontSize: moderateScale(12),
    color: "#6b7280",
    marginTop: verticalScale(2),
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: scale(8),
    padding: scale(15),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(5),
  },
  cardDate: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#374151",
  },
  cardAmount: {
    fontSize: moderateScale(12),
    color: "#6b7280",
    marginTop: verticalScale(2),
  },
  remainingAmount: {
    padding: scale(8),
    borderRadius: scale(20),
    alignSelf: "flex-start",
    marginBottom: verticalScale(10),
  },
  remainingAmountPositive: {
    backgroundColor: "#dcfce7",
  },
  remainingAmountNegative: {
    backgroundColor: "#fee2e2",
  },
  remainingAmountText: {
    fontSize: moderateScale(12),
    fontWeight: "500",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    padding: scale(10),
    borderRadius: scale(8),
  },
  addButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: scale(5),
    fontSize: moderateScale(14),
  },
  addButtonTextDisabled: {
    color: "#9ca3af",
  },
  expensesContainer: {
    marginTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: verticalScale(10),
  },
  expenseItem: {
    backgroundColor: "#fff",
    padding: scale(10),
    borderRadius: scale(8),
    marginBottom: verticalScale(5),
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  expenseCategory: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: "#374151",
  },
  expenseDetail: {
    fontSize: moderateScale(12),
    color: "#6b7280",
    marginTop: verticalScale(2),
  },
  expenseAmount: {
    fontSize: moderateScale(12),
    color: "#059669",
    fontWeight: "500",
    marginTop: verticalScale(2),
  },
  expenseMemberCount: {
    fontSize: moderateScale(12),
    color: "#6366f1",
    marginTop: verticalScale(2),
  },
  expenseImageLink: {
    fontSize: moderateScale(12),
    color: "#3b82f6",
    marginTop: verticalScale(2),
    textDecorationLine: "underline",
  },
  expenseDate: {
    fontSize: moderateScale(10),
    color: "#9ca3af",
    marginTop: verticalScale(2),
  },
  noExpensesText: {
    fontSize: moderateScale(12),
    color: "#9ca3af",
    fontStyle: "italic",
    textAlign: "center",
  },
  emptyState: {
    padding: scale(20),
    alignItems: "center",
  },
  emptyStateText: {
    color: "#6b7280",
    textAlign: "center",
    fontSize: moderateScale(14),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: scale(12),
    width: "90%",
    maxHeight: "80%",
    maxWidth: scale(500),
  },
   modalContentLandscape: {
    width: "70%",
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: scale(15),
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: "#374151",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    padding: scale(12),
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
    margin: scale(15),
    borderRadius: scale(4),
  },
  warningTitle: {
    fontSize: moderateScale(14),
    fontWeight: "bold",
    color: "#856404",
    marginLeft: scale(8),
  },
  warningText: {
    fontSize: moderateScale(12),
    color: "#856404",
    marginLeft: scale(8),
  },
  amountContainer: {
    backgroundColor: "#f0f9ff",
    padding: scale(15),
    margin: scale(15),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  amountLabel: {
    fontSize: moderateScale(12),
    color: "#0369a1",
    fontWeight: "500",
  },
  amountValue: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: "#0369a1",
    marginTop: verticalScale(5),
  },
  modalBody: {
    maxHeight: verticalScale(400),
    padding: scale(15),
  },
  readOnlyField: {
    marginBottom: verticalScale(10),
    padding: scale(10),
    backgroundColor: "#f9fafb",
    borderRadius: scale(8),
  },
  readOnlyLabel: {
    fontSize: moderateScale(12),
    color: "#6b7280",
    marginBottom: verticalScale(2),
  },
  readOnlyValue: {
    fontSize: moderateScale(14),
    color: "#374151",
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: scale(8),
    padding: scale(12),
    fontSize: moderateScale(14),
    color: "#374151",
  },
  imageButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(10),
  },
  imageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    padding: scale(12),
    borderRadius: scale(8),
    flex: 1,
    marginRight: scale(5),
    justifyContent: "center",
  },
  imageButtonText: {
    color: "#4f46e5",
    marginLeft: scale(5),
    fontSize: moderateScale(12),
    fontWeight: "500",
  },
  imagePreviewContainer: {
    position: "relative",
    marginTop: verticalScale(10),
    alignSelf: "center",
  },
  imagePreview: {
    width: scale(150),
    height: scale(150),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  removeImageButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ef4444",
    borderRadius: scale(12),
    width: scale(24),
    height: scale(24),
    alignItems: "center",
    justifyContent: "center",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: scale(15),
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  button: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    marginLeft: scale(10),
    minWidth: scale(100),
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  submitButton: {
    backgroundColor: "#4f46e5",
  },
  buttonText: {
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
});

export default ExpenseEntry;