import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { api } from '../../services/api';
import { mStyles } from './commonStyles';

export function KhataBookTab({ user }: { user: any }) {
  const isManager = user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
  const isStaff = user?.role === 'COLLECTION_STAFF';

  // Businesses State
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Business Modal States
  const [showBusinessSwitcher, setShowBusinessSwitcher] = useState(false);
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [allStaffCandidates, setAllStaffCandidates] = useState<any[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [assigningStaff, setAssigningStaff] = useState(false);

  // New Business Form State
  const [newBizName, setNewBizName] = useState('');
  const [newBizCategory, setNewBizCategory] = useState('General Store');
  const [newBizPhone, setNewBizPhone] = useState('');
  const [newBizAddress, setNewBizAddress] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);

  // Customer List & Summary State
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalYouWillGet: 0,
    totalYouWillGive: 0,
    netBalance: 0,
    totalCustomers: 0,
  });
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'YOU_WILL_GET' | 'YOU_WILL_GIVE' | 'SETTLED'>('ALL');

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custOpeningBal, setCustOpeningBal] = useState('');
  const [custOpeningType, setCustOpeningType] = useState<'YOU_WILL_GET' | 'YOU_WILL_GIVE'>('YOU_WILL_GET');
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Selected Customer Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Add Transaction Modal State (You Gave / You Got)
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'GAVE' | 'GOT'>('GAVE');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMode, setTxPaymentMode] = useState('CASH');
  const [submittingTx, setSubmittingTx] = useState(false);

  // Initial load
  useEffect(() => {
    fetchBusinesses();
  }, []);

  // Fetch customers whenever selected business changes
  useEffect(() => {
    if (selectedBusiness?.id) {
      fetchCustomers(selectedBusiness.id);
    } else {
      setCustomers([]);
      setSummary({ totalYouWillGet: 0, totalYouWillGive: 0, netBalance: 0, totalCustomers: 0 });
    }
  }, [selectedBusiness?.id]);

  const fetchBusinesses = async () => {
    setLoadingBusinesses(true);
    try {
      const res = await api.get('/khata/businesses');
      if (res.data?.success) {
        const list = res.data.data || [];
        setBusinesses(list);
        if (list.length > 0) {
          // Keep current if still exists, else pick first
          setSelectedBusiness((prev: any) => {
            const found = list.find((b: any) => b.id === prev?.id);
            return found || list[0];
          });
        } else {
          setSelectedBusiness(null);
        }
      }
    } catch (e: any) {
      console.error('Error fetching businesses:', e);
      Alert.alert('Notice', 'Failed to load businesses. Please pull to refresh.');
    } finally {
      setLoadingBusinesses(false);
      setRefreshing(false);
    }
  };

  const fetchCustomers = async (businessId: string) => {
    setLoadingCustomers(true);
    try {
      const res = await api.get(`/khata/businesses/${businessId}/customers`);
      if (res.data?.success) {
        setCustomers(res.data.data.customers || []);
        setSummary(res.data.data.summary || { totalYouWillGet: 0, totalYouWillGive: 0, netBalance: 0, totalCustomers: 0 });
      }
    } catch (e: any) {
      console.error('Error fetching customers:', e);
    } finally {
      setLoadingCustomers(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusinesses();
  };

  // Open Staff Management
  const handleOpenAssignStaff = async () => {
    if (!selectedBusiness) return;
    try {
      const res = await api.get(`/khata/businesses/${selectedBusiness.id}/staff`);
      if (res.data?.success) {
        setAllStaffCandidates(res.data.data || []);
        const assignedIds = (res.data.data || [])
          .filter((s: any) => s.isAssigned)
          .map((s: any) => s.id);
        setSelectedStaffIds(assignedIds);
        setShowAssignStaffModal(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not load staff list');
    }
  };

  const handleSaveStaffAssignments = async () => {
    if (!selectedBusiness) return;
    setAssigningStaff(true);
    try {
      const res = await api.post(`/khata/businesses/${selectedBusiness.id}/assign-staff`, {
        staffIds: selectedStaffIds,
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Staff assigned to this business successfully!');
        setShowAssignStaffModal(false);
        fetchBusinesses();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update staff assignments');
    } finally {
      setAssigningStaff(false);
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // Create Business
  const handleCreateBusiness = async () => {
    if (!newBizName.trim()) {
      Alert.alert('Required', 'Please enter business / shop name');
      return;
    }
    setCreatingBusiness(true);
    try {
      const res = await api.post('/khata/businesses', {
        name: newBizName.trim(),
        category: newBizCategory.trim(),
        phone: newBizPhone.trim() || undefined,
        address: newBizAddress.trim() || undefined,
      });
      if (res.data?.success) {
        Alert.alert('Success', `Business "${newBizName}" created successfully!`);
        setShowAddBusinessModal(false);
        setNewBizName('');
        setNewBizPhone('');
        setNewBizAddress('');
        await fetchBusinesses();
        if (res.data.data?.id) {
          setSelectedBusiness(res.data.data);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create business');
    } finally {
      setCreatingBusiness(false);
    }
  };

  // Add Customer
  const handleAddCustomer = async () => {
    if (!custName.trim()) {
      Alert.alert('Required', 'Please enter customer name');
      return;
    }
    if (!selectedBusiness) {
      Alert.alert('Notice', 'Please select or create a business first');
      return;
    }
    setAddingCustomer(true);
    try {
      const res = await api.post(`/khata/businesses/${selectedBusiness.id}/customers`, {
        name: custName.trim(),
        phone: custPhone.trim() || undefined,
        address: custAddress.trim() || undefined,
        openingBalance: Number(custOpeningBal) || 0,
        openingType: custOpeningType,
      });
      if (res.data?.success) {
        Alert.alert('Success', `Customer "${custName}" added to Khatabook!`);
        setShowAddCustomerModal(false);
        setCustName('');
        setCustPhone('');
        setCustAddress('');
        setCustOpeningBal('');
        fetchCustomers(selectedBusiness.id);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to add customer');
    } finally {
      setAddingCustomer(false);
    }
  };

  // Open Customer Ledger
  const handleOpenCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const res = await api.get(`/khata/customers/${cust.id}`);
      if (res.data?.success) {
        setCustomerDetails(res.data.data);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to load customer ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleRefreshLedger = async () => {
    if (!selectedCustomer?.id) return;
    setLoadingLedger(true);
    try {
      const res = await api.get(`/khata/customers/${selectedCustomer.id}`);
      if (res.data?.success) {
        setCustomerDetails(res.data.data);
      }
      if (selectedBusiness?.id) {
        fetchCustomers(selectedBusiness.id);
      }
    } catch (e: any) {
      console.error('Error refreshing ledger:', e);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Submit Transaction
  const handleSubmitTransaction = async () => {
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0');
      return;
    }
    if (!customerDetails?.id) return;

    setSubmittingTx(true);
    try {
      const res = await api.post(`/khata/customers/${customerDetails.id}/transactions`, {
        type: txType,
        amount: amt,
        description: txDescription.trim() || undefined,
        paymentMode: txPaymentMode,
      });
      if (res.data?.success) {
        setShowTxModal(false);
        setTxAmount('');
        setTxDescription('');
        handleRefreshLedger();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to record entry');
    } finally {
      setSubmittingTx(false);
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = (txId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this transaction from the ledger?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/khata/transactions/${txId}`);
              if (res.data?.success) {
                handleRefreshLedger();
              }
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q)
      );
    }
    if (filterType === 'YOU_WILL_GET') {
      list = list.filter((c) => c.netBalance > 0);
    } else if (filterType === 'YOU_WILL_GIVE') {
      list = list.filter((c) => c.netBalance < 0);
    } else if (filterType === 'SETTLED') {
      list = list.filter((c) => c.netBalance === 0);
    }
    return list;
  }, [customers, searchQuery, filterType]);

  // Communication Handlers
  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No phone number is registered for this customer.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer.');
    });
  };

  const handleWhatsApp = (phone: string, name: string, netBalance: number) => {
    if (!phone) {
      Alert.alert('No Phone', 'No phone number is registered for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let msg = `Dear ${name}, `;
    if (netBalance > 0) {
      msg += `your pending balance at ${selectedBusiness?.name || 'our shop'} is ₹${netBalance.toLocaleString('en-IN')}. Please clear it at your earliest convenience. Thank you!`;
    } else {
      msg += `greeting from ${selectedBusiness?.name || 'our shop'}. We value your business with us!`;
    }
    const url = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`).catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp.');
      });
    });
  };

  return (
    <ScrollView
      style={kbStyles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />}
    >
      {/* Top Header Card with Shop Selector */}
      <View style={kbStyles.headerCard}>
        <View style={kbStyles.shopHeaderRow}>
          <TouchableOpacity
            style={kbStyles.shopDropdownBtn}
            onPress={() => setShowBusinessSwitcher(true)}
            activeOpacity={0.8}
          >
            <View style={kbStyles.shopIconBadge}>
              <Text style={{ fontSize: 18 }}>🏪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={kbStyles.shopTitle} numberOfLines={1}>
                {selectedBusiness?.name || (loadingBusinesses ? 'Loading Shop...' : 'No Business Selected')}
              </Text>
              <Text style={kbStyles.shopSubtitle} numberOfLines={1}>
                {selectedBusiness?.category || 'Tap to switch shop'} •{' '}
                {selectedBusiness?.staffCount !== undefined ? `${selectedBusiness.staffCount} Staff` : 'Shop'}
              </Text>
            </View>
            <Text style={{ fontSize: 18, color: '#FFFFFF', marginLeft: 4 }}>▾</Text>
          </TouchableOpacity>

          {isManager && (
            <TouchableOpacity
              style={kbStyles.addShopIconBtn}
              onPress={() => setShowAddBusinessModal(true)}
            >
              <Text style={kbStyles.addShopIconBtnText}>+ Shop</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedBusiness && isManager && (
          <View style={kbStyles.managerBarRow}>
            <TouchableOpacity
              style={kbStyles.staffAssignBtn}
              onPress={handleOpenAssignStaff}
            >
              <Text style={kbStyles.staffAssignBtnText}>👥 Assign Staff ({selectedBusiness.staffCount || 0})</Text>
            </TouchableOpacity>
            {selectedBusiness.address ? (
              <Text style={kbStyles.shopAddressText} numberOfLines={1}>
                📍 {selectedBusiness.address}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Khatabook Net Summary Cards */}
      {selectedBusiness ? (
        <View style={kbStyles.summaryContainer}>
          <View style={kbStyles.summaryRow}>
            {/* You will get (Receivable / Green) */}
            <View style={[kbStyles.summaryCard, kbStyles.cardGet]}>
              <Text style={kbStyles.summaryLabel}>YOU WILL GET</Text>
              <Text style={[kbStyles.summaryAmount, { color: '#059669' }]} numberOfLines={1}>
                ₹{(summary.totalYouWillGet || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={kbStyles.summarySubText}>From customer credit</Text>
            </View>

            {/* You will give (Payable / Red) */}
            <View style={[kbStyles.summaryCard, kbStyles.cardGive]}>
              <Text style={kbStyles.summaryLabel}>YOU WILL GIVE</Text>
              <Text style={[kbStyles.summaryAmount, { color: '#DC2626' }]} numberOfLines={1}>
                ₹{(summary.totalYouWillGive || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={kbStyles.summarySubText}>Customer advances</Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={kbStyles.quickMetricsBar}>
            <Text style={kbStyles.metricItem}>
              👥 Customers: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{customers.length}</Text>
            </Text>
            <Text style={kbStyles.metricItem}>
              ⚖️ Net: <Text style={{ fontWeight: '700', color: summary.netBalance >= 0 ? '#059669' : '#DC2626' }}>
                ₹{Math.abs(summary.netBalance || 0).toLocaleString('en-IN')} {summary.netBalance >= 0 ? 'Surplus' : 'Payable'}
              </Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* Main Content Area */}
      {loadingBusinesses ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0070BA" />
          <Text style={{ marginTop: 12, color: '#64748B' }}>Loading shops and businesses...</Text>
        </View>
      ) : !selectedBusiness ? (
        <View style={kbStyles.emptyBusinessBox}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🏬</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B' }}>No Business / Shop Found</Text>
          <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
            {isManager
              ? 'Create your first shop or business to start maintaining Khatabook ledger and customer udhar accounts.'
              : 'You have not been assigned to any shop yet. Please ask your manager to assign you.'}
          </Text>
          {isManager && (
            <TouchableOpacity
              style={mStyles.primaryBtn}
              onPress={() => setShowAddBusinessModal(true)}
            >
              <Text style={mStyles.primaryBtnText}>+ Create New Business</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          {/* Action Row: Search & Add Customer */}
          <View style={kbStyles.searchRow}>
            <View style={kbStyles.searchBox}>
              <Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={kbStyles.searchInput}
                placeholder="Search customer name or phone..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={{ color: '#94A3B8', fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={kbStyles.addCustomerBtn}
              onPress={() => setShowAddCustomerModal(true)}
            >
              <Text style={kbStyles.addCustomerBtnText}>+ Add Customer</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={kbStyles.filterScrollView}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          >
            {[
              { key: 'ALL', label: `All (${customers.length})` },
              { key: 'YOU_WILL_GET', label: 'You Will Get (Udhar)' },
              { key: 'YOU_WILL_GIVE', label: 'You Will Give (Advance)' },
              { key: 'SETTLED', label: 'Settled (₹0)' },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  kbStyles.filterChip,
                  filterType === f.key && kbStyles.filterChipActive,
                ]}
                onPress={() => setFilterType(f.key as any)}
              >
                <Text
                  style={[
                    kbStyles.filterChipText,
                    filterType === f.key && kbStyles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Customer Cards List */}
          {loadingCustomers ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#0070BA" />
              <Text style={{ marginTop: 8, color: '#64748B' }}>Loading customer ledgers...</Text>
            </View>
          ) : filteredCustomers.length === 0 ? (
            <View style={kbStyles.emptyCustomerBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {searchQuery ? 'No matching customers found' : 'No customers yet in this shop'}
              </Text>
              <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                {searchQuery
                  ? 'Try searching with another name or phone number.'
                  : 'Add your first customer to record sales on credit (You Gave) or payments (You Got).'}
              </Text>
              <TouchableOpacity
                style={kbStyles.addCustomerBtn}
                onPress={() => setShowAddCustomerModal(true)}
              >
                <Text style={kbStyles.addCustomerBtnText}>+ Add Customer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {filteredCustomers.map((cust) => {
                const isReceivable = cust.netBalance > 0;
                const isPayable = cust.netBalance < 0;
                const isZero = cust.netBalance === 0;

                return (
                  <TouchableOpacity
                    key={cust.id}
                    style={kbStyles.customerCard}
                    activeOpacity={0.7}
                    onPress={() => handleOpenCustomer(cust)}
                  >
                    <View style={kbStyles.custAvatar}>
                      <Text style={kbStyles.custAvatarText}>
                        {cust.name ? cust.name.charAt(0).toUpperCase() : 'C'}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={kbStyles.custName} numberOfLines={1}>
                        {cust.name}
                      </Text>
                      <Text style={kbStyles.custPhone} numberOfLines={1}>
                        {cust.phone ? `📱 ${cust.phone}` : 'No phone registered'}
                      </Text>
                      {cust.lastTransaction ? (
                        <Text style={kbStyles.custLastTx} numberOfLines={1}>
                          {cust.lastTransaction.type === 'GAVE' ? '🔴 Gave' : '🟢 Got'} ₹
                          {cust.lastTransaction.amount.toLocaleString('en-IN')} •{' '}
                          {new Date(cust.lastTransaction.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      ) : (
                        <Text style={kbStyles.custLastTx}>No transactions yet</Text>
                      )}
                    </View>

                    {/* Balance Column */}
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text
                        style={[
                          kbStyles.custBalanceText,
                          isReceivable && { color: '#059669' },
                          isPayable && { color: '#DC2626' },
                          isZero && { color: '#64748B' },
                        ]}
                      >
                        ₹{Math.abs(cust.netBalance).toLocaleString('en-IN')}
                      </Text>
                      <Text
                        style={[
                          kbStyles.custBalanceLabel,
                          isReceivable && { color: '#059669', backgroundColor: '#ECFDF5' },
                          isPayable && { color: '#DC2626', backgroundColor: '#FEF2F2' },
                          isZero && { color: '#64748B', backgroundColor: '#F1F5F9' },
                        ]}
                      >
                        {isReceivable ? 'YOU WILL GET' : isPayable ? 'YOU WILL GIVE' : 'SETTLED'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ================================================================= */}
      {/* 1. SWITCH BUSINESS MODAL                                         */}
      {/* ================================================================= */}
      <Modal visible={showBusinessSwitcher} transparent animationType="slide">
        <View style={kbStyles.modalOverlay}>
          <View style={kbStyles.bottomSheetContent}>
            <View style={kbStyles.sheetHeader}>
              <Text style={kbStyles.sheetTitle}>Select Shop / Business</Text>
              <TouchableOpacity onPress={() => setShowBusinessSwitcher(false)}>
                <Text style={kbStyles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {businesses.map((b) => {
                const isCurrent = b.id === selectedBusiness?.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[kbStyles.businessOptionItem, isCurrent && kbStyles.businessOptionActive]}
                    onPress={() => {
                      setSelectedBusiness(b);
                      setShowBusinessSwitcher(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[kbStyles.businessOptionTitle, isCurrent && { color: '#0070BA' }]}>
                        {b.name}
                      </Text>
                      <Text style={kbStyles.businessOptionSub}>
                        {b.category || 'Shop'} • {b.customerCount || 0} Customers
                        {b.address ? ` • 📍 ${b.address}` : ''}
                      </Text>
                    </View>
                    {isCurrent && <Text style={{ color: '#0070BA', fontSize: 18, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {isManager && (
              <TouchableOpacity
                style={[mStyles.primaryBtn, { marginTop: 16 }]}
                onPress={() => {
                  setShowBusinessSwitcher(false);
                  setShowAddBusinessModal(true);
                }}
              >
                <Text style={mStyles.primaryBtnText}>+ Add Another Shop / Business</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* 2. ADD BUSINESS MODAL                                            */}
      {/* ================================================================= */}
      <Modal visible={showAddBusinessModal} transparent animationType="slide">
        <View style={kbStyles.modalOverlay}>
          <View style={kbStyles.modalCard}>
            <View style={kbStyles.sheetHeader}>
              <Text style={kbStyles.sheetTitle}>Create New Shop / Business</Text>
              <TouchableOpacity onPress={() => setShowAddBusinessModal(false)}>
                <Text style={kbStyles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={kbStyles.inputLabel}>Business / Shop Name *</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. Sharma Kirana Store, Balaji Electronics"
                value={newBizName}
                onChangeText={setNewBizName}
              />

              <Text style={kbStyles.inputLabel}>Category / Industry</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. Grocery, Electronics, Clothing, Wholesale"
                value={newBizCategory}
                onChangeText={setNewBizCategory}
              />

              <Text style={kbStyles.inputLabel}>Contact Phone Number</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                value={newBizPhone}
                onChangeText={setNewBizPhone}
              />

              <Text style={kbStyles.inputLabel}>Shop Address / Location</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. Shop #12, Main Market, City Center"
                value={newBizAddress}
                onChangeText={setNewBizAddress}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[mStyles.secondaryBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setShowAddBusinessModal(false)}
              >
                <Text style={mStyles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.primaryBtn, { flex: 2, justifyContent: 'center' }]}
                disabled={creatingBusiness}
                onPress={handleCreateBusiness}
              >
                {creatingBusiness ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={mStyles.primaryBtnText}>Create Shop</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* 3. ASSIGN STAFF MODAL                                            */}
      {/* ================================================================= */}
      <Modal visible={showAssignStaffModal} transparent animationType="slide">
        <View style={kbStyles.modalOverlay}>
          <View style={kbStyles.modalCard}>
            <View style={kbStyles.sheetHeader}>
              <View>
                <Text style={kbStyles.sheetTitle}>Assign Staff to Shop</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {selectedBusiness?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignStaffModal(false)}>
                <Text style={kbStyles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              Select which staff members can view this shop, add customers, and record daily transactions:
            </Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {allStaffCandidates.length === 0 ? (
                <Text style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>
                  No collection staff registered in your company.
                </Text>
              ) : (
                allStaffCandidates.map((staff) => {
                  const isSelected = selectedStaffIds.includes(staff.id);
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={[
                        kbStyles.staffCheckRow,
                        isSelected && kbStyles.staffCheckRowSelected,
                      ]}
                      onPress={() => toggleStaffSelection(staff.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={kbStyles.staffName}>{staff.fullName}</Text>
                        <Text style={kbStyles.staffSub}>📱 {staff.phone || 'No phone'}</Text>
                      </View>
                      <View
                        style={[
                          kbStyles.checkboxSquare,
                          isSelected && kbStyles.checkboxSquareActive,
                        ]}
                      >
                        {isSelected && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[mStyles.secondaryBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setShowAssignStaffModal(false)}
              >
                <Text style={mStyles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.primaryBtn, { flex: 2, justifyContent: 'center' }]}
                disabled={assigningStaff}
                onPress={handleSaveStaffAssignments}
              >
                {assigningStaff ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={mStyles.primaryBtnText}>Save Assignments</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* 4. ADD CUSTOMER MODAL                                            */}
      {/* ================================================================= */}
      <Modal visible={showAddCustomerModal} transparent animationType="slide">
        <View style={kbStyles.modalOverlay}>
          <View style={kbStyles.modalCard}>
            <View style={kbStyles.sheetHeader}>
              <View>
                <Text style={kbStyles.sheetTitle}>Add New Customer</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  Shop: {selectedBusiness?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddCustomerModal(false)}>
                <Text style={kbStyles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={kbStyles.inputLabel}>Customer Name *</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. Ramesh Kumar, Sunita Devi"
                value={custName}
                onChangeText={setCustName}
              />

              <Text style={kbStyles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                value={custPhone}
                onChangeText={setCustPhone}
              />

              <Text style={kbStyles.inputLabel}>Address / Colony / Village</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="e.g. Near Shiv Mandir, Ward #4"
                value={custAddress}
                onChangeText={setCustAddress}
              />

              <Text style={kbStyles.inputLabel}>Opening Balance (Optional)</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder="0"
                keyboardType="numeric"
                value={custOpeningBal}
                onChangeText={setCustOpeningBal}
              />

              {custOpeningBal && parseFloat(custOpeningBal) > 0 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Balance Type:</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[
                        kbStyles.balTypeChip,
                        custOpeningType === 'YOU_WILL_GET' && kbStyles.balTypeChipActiveGet,
                      ]}
                      onPress={() => setCustOpeningType('YOU_WILL_GET')}
                    >
                      <Text
                        style={[
                          kbStyles.balTypeChipText,
                          custOpeningType === 'YOU_WILL_GET' && { color: '#059669', fontWeight: '700' },
                        ]}
                      >
                        You Will Get (Udhar)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        kbStyles.balTypeChip,
                        custOpeningType === 'YOU_WILL_GIVE' && kbStyles.balTypeChipActiveGive,
                      ]}
                      onPress={() => setCustOpeningType('YOU_WILL_GIVE')}
                    >
                      <Text
                        style={[
                          kbStyles.balTypeChipText,
                          custOpeningType === 'YOU_WILL_GIVE' && { color: '#DC2626', fontWeight: '700' },
                        ]}
                      >
                        You Will Give (Advance)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[mStyles.secondaryBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setShowAddCustomerModal(false)}
              >
                <Text style={mStyles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.primaryBtn, { flex: 2, justifyContent: 'center' }]}
                disabled={addingCustomer}
                onPress={handleAddCustomer}
              >
                {addingCustomer ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={mStyles.primaryBtnText}>Save Customer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* 5. CUSTOMER LEDGER / KHATABOOK DETAIL MODAL                       */}
      {/* ================================================================= */}
      <Modal visible={showLedgerModal} animationType="slide">
        <View style={kbStyles.ledgerFullContainer}>
          {/* Header */}
          <View style={kbStyles.ledgerHeader}>
            <TouchableOpacity
              style={kbStyles.backBtn}
              onPress={() => {
                setShowLedgerModal(false);
                setSelectedCustomer(null);
                setCustomerDetails(null);
              }}
            >
              <Text style={{ fontSize: 20, color: '#FFFFFF', fontWeight: '800' }}>←</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={kbStyles.ledgerCustName} numberOfLines={1}>
                {customerDetails?.name || selectedCustomer?.name}
              </Text>
              <Text style={kbStyles.ledgerCustSub} numberOfLines={1}>
                {customerDetails?.phone ? `📱 ${customerDetails.phone}` : 'No phone registered'}
              </Text>
            </View>

            {/* Call & WhatsApp Reminders */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {customerDetails?.phone && (
                <>
                  <TouchableOpacity
                    style={kbStyles.contactActionBtn}
                    onPress={() => handleCall(customerDetails.phone)}
                  >
                    <Text style={{ fontSize: 16 }}>📞</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={kbStyles.contactActionBtn}
                    onPress={() =>
                      handleWhatsApp(
                        customerDetails.phone,
                        customerDetails.name,
                        customerDetails.netBalance
                      )
                    }
                  >
                    <Text style={{ fontSize: 16 }}>💬</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Customer Running Balance Banner */}
          {customerDetails && (
            <View style={kbStyles.ledgerBalanceBanner}>
              <View style={{ flex: 1 }}>
                <Text style={kbStyles.ledgerBalanceTitle}>
                  {customerDetails.netBalance > 0
                    ? 'YOU WILL GET (Maine Lene Hain)'
                    : customerDetails.netBalance < 0
                    ? 'YOU WILL GIVE (Maine Dene Hain)'
                    : 'ACCOUNT SETTLED'}
                </Text>
                <Text
                  style={[
                    kbStyles.ledgerBalanceBig,
                    customerDetails.netBalance > 0 && { color: '#059669' },
                    customerDetails.netBalance < 0 && { color: '#DC2626' },
                    customerDetails.netBalance === 0 && { color: '#64748B' },
                  ]}
                >
                  ₹{Math.abs(customerDetails.netBalance).toLocaleString('en-IN')}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: '#64748B' }}>Opening: ₹{Math.abs(customerDetails.openingBalance || 0)}</Text>
                <Text style={{ fontSize: 11, color: '#059669' }}>Total Got: ₹{(customerDetails.totalGot || 0).toLocaleString('en-IN')}</Text>
                <Text style={{ fontSize: 11, color: '#DC2626' }}>Total Gave: ₹{(customerDetails.totalGave || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}

          {/* Ledger Entries List */}
          {loadingLedger ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0070BA" />
              <Text style={{ marginTop: 12, color: '#64748B' }}>Loading entries...</Text>
            </View>
          ) : !customerDetails?.transactions || customerDetails.transactions.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>No Transactions Yet</Text>
              <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 6 }}>
                Record sales on credit by tapping "YOU GAVE ₹" or record repayments by tapping "YOU GOT ₹".
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1, padding: 12 }}>
              <View style={kbStyles.ledgerTableHeader}>
                <Text style={[kbStyles.ledgerHeaderCell, { flex: 1.2 }]}>DATE & NOTE</Text>
                <Text style={[kbStyles.ledgerHeaderCell, { flex: 1, textAlign: 'right', color: '#DC2626' }]}>
                  YOU GAVE
                </Text>
                <Text style={[kbStyles.ledgerHeaderCell, { flex: 1, textAlign: 'right', color: '#059669' }]}>
                  YOU GOT
                </Text>
              </View>

              {customerDetails.transactions.map((tx: any) => {
                const isGave = tx.type === 'GAVE';
                const isGot = tx.type === 'GOT';
                return (
                  <View key={tx.id} style={kbStyles.txRow}>
                    {/* Left: Date, Description, Mode */}
                    <View style={{ flex: 1.2 }}>
                      <Text style={kbStyles.txDate}>
                        {new Date(tx.transactionDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}{' '}
                        • {new Date(tx.transactionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={kbStyles.txDesc} numberOfLines={2}>
                        {tx.description || (isGave ? 'Credit purchase' : 'Payment received')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={kbStyles.txModeBadge}>{tx.paymentMode}</Text>
                        {tx.recordedBy?.fullName && (
                          <Text style={kbStyles.txUserText}>by {tx.recordedBy.fullName}</Text>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteTransaction(tx.id)}
                          style={{ paddingHorizontal: 4 }}
                        >
                          <Text style={{ color: '#94A3B8', fontSize: 11 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Middle: You Gave (Red) */}
                    <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                      {isGave ? (
                        <Text style={[kbStyles.txAmount, { color: '#DC2626' }]}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </Text>
                      ) : (
                        <Text style={kbStyles.txAmountEmpty}>-</Text>
                      )}
                    </View>

                    {/* Right: You Got (Green) */}
                    <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                      {isGot ? (
                        <Text style={[kbStyles.txAmount, { color: '#059669' }]}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </Text>
                      ) : (
                        <Text style={kbStyles.txAmountEmpty}>-</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Sticky Bottom Action Buttons (Khatabook Signature) */}
          <View style={kbStyles.ledgerBottomBar}>
            <TouchableOpacity
              style={[kbStyles.khatabookActionBtn, kbStyles.btnGave]}
              onPress={() => {
                setTxType('GAVE');
                setShowTxModal(true);
              }}
            >
              <Text style={kbStyles.btnIcon}>🔴</Text>
              <View>
                <Text style={kbStyles.btnTitle}>YOU GAVE ₹</Text>
                <Text style={kbStyles.btnSubtitle}>Maine Diye (Udhar)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[kbStyles.khatabookActionBtn, kbStyles.btnGot]}
              onPress={() => {
                setTxType('GOT');
                setShowTxModal(true);
              }}
            >
              <Text style={kbStyles.btnIcon}>🟢</Text>
              <View>
                <Text style={kbStyles.btnTitle}>YOU GOT ₹</Text>
                <Text style={kbStyles.btnSubtitle}>Mujhe Mile (Jama)</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* 6. ADD TRANSACTION MODAL (Maine Diye / Mujhe Mile)              */}
      {/* ================================================================= */}
      <Modal visible={showTxModal} transparent animationType="slide">
        <View style={kbStyles.modalOverlay}>
          <View style={kbStyles.modalCard}>
            <View style={kbStyles.sheetHeader}>
              <View>
                <Text
                  style={[
                    kbStyles.sheetTitle,
                    txType === 'GAVE' ? { color: '#DC2626' } : { color: '#059669' },
                  ]}
                >
                  {txType === 'GAVE' ? '🔴 Record "You Gave" (Maine Diye)' : '🟢 Record "You Got" (Mujhe Mile)'}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  Customer: {customerDetails?.name || selectedCustomer?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTxModal(false)}>
                <Text style={kbStyles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={kbStyles.inputLabel}>Amount (₹) *</Text>
              <TextInput
                style={[
                  kbStyles.formInput,
                  { fontSize: 24, fontWeight: '700', textAlign: 'center', height: 56 },
                  txType === 'GAVE' ? { color: '#DC2626', borderColor: '#FECACA' } : { color: '#059669', borderColor: '#A7F3D0' },
                ]}
                placeholder="₹ 0"
                keyboardType="numeric"
                autoFocus
                value={txAmount}
                onChangeText={setTxAmount}
              />

              <Text style={kbStyles.inputLabel}>Item Notes / Bill Description</Text>
              <TextInput
                style={kbStyles.formInput}
                placeholder={txType === 'GAVE' ? 'e.g. Atta, Oil, Sugar or Bill #104' : 'e.g. Cash payment or GPay transfer'}
                value={txDescription}
                onChangeText={setTxDescription}
              />

              <Text style={kbStyles.inputLabel}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      kbStyles.modeChip,
                      txPaymentMode === mode && kbStyles.modeChipActive,
                    ]}
                    onPress={() => setTxPaymentMode(mode)}
                  >
                    <Text
                      style={[
                        kbStyles.modeChipText,
                        txPaymentMode === mode && kbStyles.modeChipTextActive,
                      ]}
                    >
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[mStyles.secondaryBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => setShowTxModal(false)}
              >
                <Text style={mStyles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  mStyles.primaryBtn,
                  { flex: 2, justifyContent: 'center' },
                  txType === 'GAVE' ? { backgroundColor: '#DC2626' } : { backgroundColor: '#059669' },
                ]}
                disabled={submittingTx}
                onPress={handleSubmitTransaction}
              >
                {submittingTx ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={mStyles.primaryBtnText}>
                    {txType === 'GAVE' ? 'Save Debit (Diye)' : 'Save Credit (Mile)'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ==========================================
// STYLES
// ==========================================
const kbStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    backgroundColor: '#0A2540',
    padding: 16,
    paddingTop: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  shopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shopDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  shopIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  shopSubtitle: {
    fontSize: 12,
    color: '#93C5FD',
    marginTop: 1,
  },
  addShopIconBtn: {
    backgroundColor: '#0070BA',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addShopIconBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  managerBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  staffAssignBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  staffAssignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  shopAddressText: {
    color: '#93C5FD',
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    marginTop: -8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  cardGet: {
    borderColor: '#A7F3D0',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  cardGive: {
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4,
  },
  summarySubText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quickMetricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    fontSize: 12,
    color: '#64748B',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  addCustomerBtn: {
    backgroundColor: '#0070BA',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  filterScrollView: {
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  custAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  custAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0369A1',
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  custPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  custLastTx: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  custBalanceText: {
    fontSize: 16,
    fontWeight: '800',
  },
  custBalanceLabel: {
    fontSize: 9,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 3,
    overflow: 'hidden',
  },
  emptyBusinessBox: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCustomerBox: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetClose: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    padding: 4,
  },
  businessOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  businessOptionActive: {
    borderColor: '#0070BA',
    backgroundColor: '#F0F9FF',
  },
  businessOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  businessOptionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  balTypeChip: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  balTypeChipActiveGet: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  balTypeChipActiveGive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  balTypeChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  staffCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  staffCheckRowSelected: {
    borderColor: '#0070BA',
    backgroundColor: '#F0F9FF',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  staffSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareActive: {
    backgroundColor: '#0070BA',
    borderColor: '#0070BA',
  },
  ledgerFullContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  ledgerHeader: {
    backgroundColor: '#0A2540',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
  },
  ledgerCustName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ledgerCustSub: {
    fontSize: 12,
    color: '#93C5FD',
    marginTop: 1,
  },
  contactActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledgerBalanceBanner: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    margin: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  ledgerBalanceTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  ledgerBalanceBig: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  ledgerTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  ledgerHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  txDesc: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 2,
  },
  txModeBadge: {
    fontSize: 10,
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 3,
    fontWeight: '700',
  },
  txUserText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txAmountEmpty: {
    fontSize: 15,
    color: '#CBD5E1',
  },
  ledgerBottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  khatabookActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    gap: 8,
  },
  btnGave: {
    backgroundColor: '#DC2626',
  },
  btnGot: {
    backgroundColor: '#059669',
  },
  btnIcon: {
    fontSize: 18,
  },
  btnTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  btnSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
});
