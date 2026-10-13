import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { api } from '../../services/api';
import { mStyles } from './commonStyles';

export function CollectionsTab({ user }: { user: any }) {
  const isStaff = user?.role === 'COLLECTION_STAFF';
  const isManager = user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const [subTab, setSubTab] = useState<'RECORD' | 'TRANSACTIONS' | 'RECONCILIATION'>('RECORD');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    digitalCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    cashCount: number;
  }>({
    digitalCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    cashCount: 0,
  });
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'DIGITAL' | 'CASH'>('ALL');

  // Payment Recording Form (AC-08, AC-09, AC-10)
  const [installmentType, setInstallmentType] = useState<'REGULAR' | 'ADVANCE' | 'BACKLOG'>('REGULAR');
  const [selectedSubscriberId, setSelectedSubscriberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [installmentNo, setInstallmentNo] = useState('1');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI'>('CASH');
  const [externalRef, setExternalRef] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Reconciliation Multi-Select (AC-12)
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, subRes, grpRes] = await Promise.all([
        api.get('/collections/transactions'),
        api.get('/subscribers'),
        api.get('/chit-groups'),
      ]);

      if (txRes.data.success) {
        setTransactions(txRes.data.data || []);
        if (txRes.data.stats) {
          setStats(txRes.data.stats);
        } else {
          // Fallback stats computation
          const txs = txRes.data.data || [];
          const digitalCount = txs.filter((t: any) => t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI').length;
          const pendingCount = txs.filter(
            (t: any) => (t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI') && t.verificationStatus === 'PENDING_VERIFICATION'
          ).length;
          const approvedCount = txs.filter(
            (t: any) => (t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI') && t.verificationStatus === 'VERIFIED'
          ).length;
          const rejectedCount = txs.filter(
            (t: any) => (t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI') && t.verificationStatus === 'REJECTED'
          ).length;
          const cashCount = txs.filter((t: any) => t.paymentMode === 'CASH').length;
          setStats({ digitalCount, pendingCount, approvedCount, rejectedCount, cashCount });
        }
      }

      if (subRes.data.success) {
        setSubscribers(subRes.data.data || []);
      }
      if (grpRes.data.success) {
        setGroups(grpRes.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When a member is selected, automatically detect chit group, next installment number, and amount
  const handleSelectMember = (subscriber: any) => {
    setSelectedSubscriberId(subscriber.id);

    // Look up the member's memberships
    const memberGroupList = (subscriber.memberships || [])
      .map((m: any) => m.group)
      .filter(Boolean);

    // If memberships exist, pick the first group or match in global groups
    let targetGroup = memberGroupList.length > 0 ? memberGroupList[0] : null;

    if (!targetGroup) {
      // Look up if any group contains this member
      targetGroup = groups.find((g: any) =>
        (g.members || []).some((m: any) => m.subscriber?.id === subscriber.id || m.subscriberId === subscriber.id)
      );
    }

    if (targetGroup) {
      setSelectedGroupId(targetGroup.id);
      setAmount(String(targetGroup.monthlyInstallment || ''));

      // Calculate next installment number from previous transactions for this subscriber & group
      const prevTransactions = transactions.filter(
        (t: any) => t.subscriberId === subscriber.id && t.groupId === targetGroup.id && !t.isReversed
      );
      if (prevTransactions.length > 0) {
        const maxInst = Math.max(...prevTransactions.map((t: any) => Number(t.installmentNo) || 1));
        setInstallmentNo(String(maxInst + 1));
      } else {
        setInstallmentNo('1');
      }
    } else if (groups.length > 0) {
      // Fallback: pick first available group
      const fallbackGroup = groups[0];
      setSelectedGroupId(fallbackGroup.id);
      setAmount(String(fallbackGroup.monthlyInstallment || ''));
      setInstallmentNo('1');
    }
  };

  // When chit group changes manually
  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g: any) => g.id === groupId);
    if (grp) {
      setAmount(String(grp.monthlyInstallment || ''));
      if (selectedSubscriberId) {
        const prevTransactions = transactions.filter(
          (t: any) => t.subscriberId === selectedSubscriberId && t.groupId === groupId && !t.isReversed
        );
        if (prevTransactions.length > 0) {
          const maxInst = Math.max(...prevTransactions.map((t: any) => Number(t.installmentNo) || 1));
          setInstallmentNo(String(maxInst + 1));
        } else {
          setInstallmentNo('1');
        }
      }
    }
  };

  // Photo file picker using HTML input
  const handlePickReceiptImage = () => {
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEvent: any) => {
            setReceiptPhoto(uploadEvent.target.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      alert('File upload is not supported in this environment.');
    }
  };

  // Demo receipt proof attachment
  const handleAttachDemoReceipt = () => {
    const demoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="100%" height="100%" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="20" y="40" font-family="sans-serif" font-size="16" font-weight="bold" fill="%230f172a">DIGITAL PAYMENT RECEIPT PROOF</text><text x="20" y="75" font-family="sans-serif" font-size="13" fill="%23475569">UTR / Txn Ref: ${externalRef || 'UPI-984729184'}</text><text x="20" y="105" font-family="sans-serif" font-size="13" fill="%23475569">Amount: ₹${amount || '5000'}</text><text x="20" y="135" font-family="sans-serif" font-size="13" fill="%23475569">Mode: ${paymentMode}</text><text x="20" y="165" font-family="sans-serif" font-size="13" fill="%2316a34a">Status: SUCCESSFUL TRANSFER</text><text x="20" y="210" font-family="sans-serif" font-size="11" fill="%2394a3b8">Verified Bank Gateway Slip</text></svg>`;
    setReceiptPhoto(demoSvg);
  };

  // Record or Submit Payment
  const handleRecordPayment = async () => {
    if (!selectedSubscriberId) {
      alert('Please select a member from your assigned group.');
      return;
    }
    if (!selectedGroupId) {
      alert('Please select or verify the member chit group.');
      return;
    }
    if (!installmentNo || Number(installmentNo) <= 0) {
      alert('Please enter a valid installment number.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid installment amount.');
      return;
    }

    if (paymentMode !== 'CASH' && (!externalRef || !externalRef.trim())) {
      alert('Please enter the Bank / UPI / QR Transaction Reference ID (UTR).');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/collections/pay', {
        subscriberId: selectedSubscriberId,
        groupId: selectedGroupId,
        installmentNo: Number(installmentNo),
        amount: Number(amount),
        paymentMode,
        installmentType,
        externalRef: externalRef.trim() || undefined,
        receiptPhoto: receiptPhoto || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.data.success) {
        const isPending = res.data.data?.verificationStatus === 'PENDING_VERIFICATION';
        alert(
          isPending
            ? `Receipt submitted successfully!\nReceipt No: ${res.data.data.receipt?.receiptNo || res.data.data.receiptNo}\nForwarded to manager for digital verification.`
            : `Payment recorded successfully!\nReceipt No: ${res.data.data.receipt?.receiptNo || res.data.data.receiptNo}`
        );

        setAmount('');
        setExternalRef('');
        setReceiptPhoto('');
        setNotes('');
        fetchData();
        setSubTab('TRANSACTIONS');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Manager: Approve Staff Digital Receipt
  const handleApproveTransaction = async (txId: string) => {
    try {
      setLoading(true);
      const res = await api.post(`/collections/${txId}/approve`);
      if (res.data.success) {
        alert(res.data.message || 'Transaction approved and verified successfully!');
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to approve transaction');
    } finally {
      setLoading(false);
    }
  };

  // Manager: Reject Staff Digital Receipt
  const handleRejectTransaction = async () => {
    if (!selectedTx || !rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/collections/${selectedTx.id}/reject`, {
        reason: rejectionReason.trim(),
      });
      if (res.data.success) {
        alert(res.data.message || 'Transaction rejected.');
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedTx(null);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reject transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-11: Reprint Receipt
  const handleReprint = async (receiptNo: string) => {
    try {
      const res = await api.post(`/collections/receipts/${receiptNo}/reprint`);
      if (res.data.success) {
        alert(`Receipt Reprint Triggered!\nPrint Count: ${res.data.data.printedCount}`);
        fetchData();
        if (selectedTx) {
          setSelectedTx({
            ...selectedTx,
            receipt: {
              ...selectedTx.receipt,
              printedCount: res.data.data.printedCount,
            },
          });
        }
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reprint receipt');
    }
  };

  // AC-12: Bulk Reconcile Payments (Manager / Super Admin)
  const handleBulkReconcile = async (status: 'VERIFIED' | 'REJECTED') => {
    if (selectedTxIds.length === 0) {
      alert('Please select at least one transaction to reconcile');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/collections/reconcile', {
        transactionIds: selectedTxIds,
        status,
        notes: `Reconciled by ${user.fullName}`,
      });
      if (res.data.success) {
        alert(`Successfully marked ${res.data.count} transactions as ${status}`);
        setSelectedTxIds([]);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  // AC-13: Process Payment Reversal
  const handleReversePayment = async () => {
    if (!selectedTx || !reversalReason.trim()) {
      alert('Reversal reason is mandatory');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/collections/${selectedTx.id}/reverse`, {
        reason: reversalReason.trim(),
      });
      if (res.data.success) {
        alert('Transaction reversed successfully. Original record preserved for audit trail.');
        setShowReversalModal(false);
        setReversalReason('');
        setSelectedTx(null);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reverse payment');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectTx = (id: string) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(selectedTxIds.filter((t) => t !== id));
    } else {
      setSelectedTxIds([...selectedTxIds, id]);
    }
  };

  // Filtered members list
  const filteredSubscribers = subscribers.filter((s: any) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.subscriberCode?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  });

  // Selected subscriber object
  const selectedSubscriber = subscribers.find((s: any) => s.id === selectedSubscriberId);
  const selectedGroup = groups.find((g: any) => g.id === selectedGroupId);

  // Filtered transactions list
  const filteredTx = transactions.filter((t: any) => {
    const matchesSearch =
      !search ||
      t.receiptNo?.toLowerCase().includes(search.toLowerCase()) ||
      t.subscriber?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      t.externalRef?.toLowerCase().includes(search.toLowerCase()) ||
      t.group?.name?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'PENDING') return t.verificationStatus === 'PENDING_VERIFICATION';
    if (statusFilter === 'VERIFIED') return t.verificationStatus === 'VERIFIED';
    if (statusFilter === 'REJECTED') return t.verificationStatus === 'REJECTED';
    if (statusFilter === 'DIGITAL') return t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI';
    if (statusFilter === 'CASH') return t.paymentMode === 'CASH';

    return true;
  });

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>
            💳 {isStaff ? 'Staff Collection Receipts' : 'Collections, Receipts & Approvals'}
          </Text>
          <Text style={mStyles.headerSubtitle}>
            {isStaff
              ? 'Collect member installments, generate digital receipts, attach payment proof, and track approvals.'
              : 'AC-08 Collection Entry, AC-09/10 Advance & Backlog, AC-11 Receipts, Manager Approvals & Reconciliation'}
          </Text>
        </View>
      </View>

      {/* Sub Tabs: Notice Reconciliation Center is REMOVED for Staff */}
      <View style={mStyles.subTabs}>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'RECORD' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('RECORD')}
        >
          <Text style={[mStyles.subTabText, subTab === 'RECORD' && mStyles.subTabTextActive]}>
            💵 1. Record Collection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'TRANSACTIONS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('TRANSACTIONS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'TRANSACTIONS' && mStyles.subTabTextActive]}>
            🧾 2. Receipts & Transactions ({transactions.length})
          </Text>
        </TouchableOpacity>

        {/* Removed Reconciliation Center in Staff Module */}
        {!isStaff && (
          <TouchableOpacity
            style={[mStyles.subTabItem, subTab === 'RECONCILIATION' && mStyles.subTabItemActive]}
            onPress={() => setSubTab('RECONCILIATION')}
          >
            <Text style={[mStyles.subTabText, subTab === 'RECONCILIATION' && mStyles.subTabTextActive]}>
              🔄 3. Reconciliation Center
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- SUB TAB 1: RECORD COLLECTION --- */}
      {subTab === 'RECORD' && (
        <View style={mStyles.card}>
          <Text style={[mStyles.cardTitle, { marginBottom: 12 }]}>
            {isStaff ? 'Collect Installment From Assigned Group Member' : 'Record Member Chit Installment Collection'}
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
            Select a member from your assigned group. The chit group, current installment number, and amount will be automatically determined.
          </Text>

          {/* 1. Installment Type Selector */}
          <Text style={mStyles.label}>Installment Collection Type *</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { id: 'REGULAR', label: '🔵 Regular Installment' },
              { id: 'ADVANCE', label: '🟢 Advance Payment' },
              { id: 'BACKLOG', label: '🔴 Backlog / Arrears' },
            ].map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[mStyles.chip, installmentType === type.id && mStyles.chipActive]}
                onPress={() => setInstallmentType(type.id as any)}
              >
                <Text style={[mStyles.chipText, installmentType === type.id && mStyles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 2. Select Member of Own Group */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={mStyles.label}>
                Select Member of Your Group * ({filteredSubscribers.length} Members Available)
              </Text>
            </View>

            <TextInput
              style={[mStyles.searchBar, { marginBottom: 8 }]}
              placeholder="🔍 Search member by name, code, or phone..."
              value={memberSearch}
              onChangeText={setMemberSearch}
            />

            {selectedSubscriber && (
              <View style={{ backgroundColor: '#F0F9FF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>
                    ✓ Selected Member: {selectedSubscriber.fullName} [{selectedSubscriber.subscriberCode}]
                  </Text>
                  <Text style={{ fontSize: 11, color: '#0C4A6E', marginTop: 2 }}>
                    Phone: {selectedSubscriber.phone} • Branch: {selectedSubscriber.branch?.name || 'Main Branch'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSubscriberId('')}>
                  <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '800' }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ maxHeight: 150 }}>
              <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                {filteredSubscribers.length === 0 ? (
                  <Text style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>
                    No members found in your assigned group.
                  </Text>
                ) : (
                  filteredSubscribers.map((s: any) => {
                    const isSelected = selectedSubscriberId === s.id;
                    const enrolledGroups = (s.memberships || []).map((m: any) => m.group?.name).filter(Boolean).join(', ');
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={{
                          padding: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: '#F1F5F9',
                          backgroundColor: isSelected ? '#E0F2FE' : '#FFF',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onPress={() => handleSelectMember(s)}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0369A1' : '#0F172A', fontSize: 13 }}>
                            {s.fullName} [{s.subscriberCode}]
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                            📞 {s.phone} {enrolledGroups ? `• Chit: ${enrolledGroups}` : ''}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: isSelected ? '#0284C7' : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#FFF' : '#475569' }}>
                            {isSelected ? 'SELECTED' : 'SELECT'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>

          {/* 3. Auto-Displayed Details Banner: Chit Group, Installment Number, Amount */}
          {selectedSubscriber && (
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 8, letterSpacing: 0.5 }}>
                ⚡ AUTOMATICALLY COMPUTED INSTALLMENT DETAILS
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {/* Chit Group Auto-Display */}
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Chit Group *</Text>
                  <View style={{ maxHeight: 110 }}>
                    <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFF' }}>
                      {groups.map((g: any) => {
                        const isSelected = selectedGroupId === g.id;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={{
                              padding: 8,
                              borderBottomWidth: 1,
                              borderBottomColor: '#F1F5F9',
                              backgroundColor: isSelected ? '#E0F2FE' : '#FFF',
                            }}
                            onPress={() => handleSelectGroup(g.id)}
                          >
                            <Text style={{ fontWeight: isSelected ? '800' : '500', fontSize: 12, color: isSelected ? '#0369A1' : '#0F172A' }}>
                              {g.name} [{g.groupCode}] - ₹{g.monthlyInstallment}/mo
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>

                {/* Installment Number Auto-Display */}
                <View style={{ width: 140 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Installment # *</Text>
                  <TextInput
                    style={[mStyles.input, { fontWeight: '800', color: '#0284C7', backgroundColor: '#FFF' }]}
                    keyboardType="numeric"
                    placeholder="1"
                    value={installmentNo}
                    onChangeText={setInstallmentNo}
                  />
                  <Text style={{ fontSize: 10, color: '#64748B', marginTop: -6 }}>Next in sequence</Text>
                </View>

                {/* Amount Auto-Display */}
                <View style={{ width: 150 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Amount (₹) *</Text>
                  <TextInput
                    style={[mStyles.input, { fontWeight: '800', color: '#16A34A', fontSize: 15, backgroundColor: '#FFF' }]}
                    keyboardType="numeric"
                    placeholder="Amount e.g. 5000"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <Text style={{ fontSize: 10, color: '#64748B', marginTop: -6 }}>Monthly Chit Rate</Text>
                </View>
              </View>
            </View>
          )}

          {/* 4. Payment Method Selection */}
          <Text style={mStyles.label}>Payment Method *</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {(['CASH', 'BANK_TRANSFER', 'UPI'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[mStyles.chip, paymentMode === mode && mStyles.chipActive]}
                onPress={() => setPaymentMode(mode)}
              >
                <Text style={[mStyles.chipText, paymentMode === mode && mStyles.chipTextActive]}>
                  {mode === 'CASH' ? '💵 Cash' : mode === 'UPI' ? '📱 UPI / QR Code' : '🏦 Bank Transfer'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 5. Bank / UPI Mandatory Details: Transaction ID + Receipt Photo */}
          {paymentMode !== 'CASH' && (
            <View style={{ backgroundColor: '#EFF6FF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>ℹ️</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF' }}>
                  Digital Transfer Details (Forwarded to Manager for Verification)
                </Text>
              </View>

              {/* Transaction ID / UTR */}
              <View>
                <Text style={[mStyles.label, { color: '#1E3A8A' }]}>
                  Transaction ID / UTR Reference Number *
                </Text>
                <TextInput
                  style={[mStyles.input, { backgroundColor: '#FFF', borderColor: '#93C5FD' }]}
                  placeholder="e.g. UPI Ref / IMPS-98472918491 / UTR-0921820"
                  value={externalRef}
                  onChangeText={setExternalRef}
                />
              </View>

              {/* Receipt Photo Proof */}
              <View>
                <Text style={[mStyles.label, { color: '#1E3A8A' }]}>
                  Photo of Payment Receipt / Transfer Slip *
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, { backgroundColor: '#2563EB' }]}
                    onPress={handlePickReceiptImage}
                  >
                    <Text style={mStyles.primaryBtnText}>📷 Upload Receipt Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[mStyles.secondaryBtn, { backgroundColor: '#FFF', borderColor: '#93C5FD' }]}
                    onPress={handleAttachDemoReceipt}
                  >
                    <Text style={[mStyles.secondaryBtnText, { color: '#1D4ED8' }]}>
                      ⚡ Attach Sample Receipt Proof
                    </Text>
                  </TouchableOpacity>

                  {receiptPhoto ? (
                    <TouchableOpacity
                      onPress={() => setShowPhotoModal(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#86EFAC' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
                        ✓ Photo Attached (Click to Preview)
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      (Upload photo of receipt or payment screen)
                    </Text>
                  )}
                </View>

                {receiptPhoto ? (
                  <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Image
                      source={{ uri: receiptPhoto }}
                      style={{ width: 80, height: 60, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity onPress={() => setReceiptPhoto('')}>
                      <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>✕ Remove Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Notes Input */}
          <Text style={mStyles.label}>Notes / Remarks (Optional)</Text>
          <TextInput
            style={[mStyles.input, { marginBottom: 18 }]}
            placeholder="e.g. Received from member at branch counter / Collection agent note"
            value={notes}
            onChangeText={setNotes}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              mStyles.primaryBtn,
              {
                paddingVertical: 14,
                paddingHorizontal: 26,
                backgroundColor: isStaff && paymentMode !== 'CASH' ? '#2563EB' : '#0070BA',
              },
            ]}
            disabled={submitting}
            onPress={handleRecordPayment}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={[mStyles.primaryBtnText, { fontSize: 14, fontWeight: '800' }]}>
                {isStaff && paymentMode !== 'CASH'
                  ? '🚀 Submit Receipt & Send to Manager for Approval'
                  : '✓ Save Record & Generate Official Receipt'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* --- SUB TAB 2: TRANSACTIONS & RECEIPTS --- */}
      {subTab === 'TRANSACTIONS' && (
        <View>
          {/* DIGITAL TRANSFER STATS SUMMARY FOR STAFF & MANAGER */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, minWidth: 140, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E40AF' }}>📱 DIGITAL SENT</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1D4ED8', marginTop: 4 }}>
                {stats.digitalCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#3B82F6', marginTop: 2 }}>UPI & Bank Transfers</Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>⏳ PENDING APPROVAL</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#B45309', marginTop: 4 }}>
                {stats.pendingCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>Awaiting Manager</Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: '#DCFCE7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#86EFAC' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>✅ APPROVED</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#15803D', marginTop: 4 }}>
                {stats.approvedCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#16A34A', marginTop: 2 }}>Verified by Manager</Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>❌ REJECTED</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#DC2626', marginTop: 4 }}>
                {stats.rejectedCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>Flagged Mismatches</Text>
            </View>

            <View style={{ flex: 1, minWidth: 140, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>💵 CASH TRANSACTIONS</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>
                {stats.cashCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Direct Cash Collections</Text>
            </View>
          </View>

          {/* Search & Filter Row */}
          <View style={mStyles.filterRow}>
            <TextInput
              style={mStyles.searchBar}
              placeholder="Search receipt # (REC-...), member, UTR or chit group..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />

            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Receipts' },
                { id: 'PENDING', label: `⏳ Pending (${stats.pendingCount})` },
                { id: 'VERIFIED', label: '✅ Approved' },
                { id: 'REJECTED', label: '❌ Rejected' },
                { id: 'DIGITAL', label: '📱 Digital' },
                { id: 'CASH', label: '💵 Cash' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[mStyles.chip, statusFilter === f.id && mStyles.chipActive]}
                  onPress={() => setStatusFilter(f.id as any)}
                >
                  <Text style={[mStyles.chipText, statusFilter === f.id && mStyles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
          ) : filteredTx.length === 0 ? (
            <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>No collection receipts match the criteria.</Text>
            </View>
          ) : (
            <View style={mStyles.table}>
              <View style={mStyles.tableHeader}>
                <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Receipt #</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Member</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Group</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 60 }]}>Inst #</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Mode & Ref</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 85 }]}>Amount</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Status</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Proof</Text>
                <Text style={[mStyles.tableHeaderCell, { flex: 1, minWidth: 160 }]}>Actions</Text>
              </View>

              {filteredTx.map((tx: any) => {
                const isPending = tx.verificationStatus === 'PENDING_VERIFICATION';
                const isVerified = tx.verificationStatus === 'VERIFIED';
                const isRejected = tx.verificationStatus === 'REJECTED';

                return (
                  <View key={tx.id} style={mStyles.tableRow}>
                    {/* Receipt No */}
                    <Text style={[mStyles.tableCell, { width: 110, fontWeight: '700', color: '#0284C7' }]}>
                      {tx.receiptNo}
                    </Text>

                    {/* Member */}
                    <View style={{ width: 140, paddingRight: 6 }}>
                      <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>
                        {tx.subscriber?.fullName}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748B' }}>
                        {tx.subscriber?.subscriberCode}
                      </Text>
                    </View>

                    {/* Group */}
                    <Text style={[mStyles.tableCell, { width: 100, fontSize: 11 }]}>
                      {tx.group?.name}
                    </Text>

                    {/* Installment # & Type */}
                    <View style={{ width: 60 }}>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: '#0F172A' }}>
                        #{tx.installmentNo}
                      </Text>
                      {tx.installmentType && tx.installmentType !== 'REGULAR' && (
                        <Text style={{ fontSize: 9, color: tx.installmentType === 'ADVANCE' ? '#16A34A' : '#DC2626', fontWeight: '800' }}>
                          {tx.installmentType}
                        </Text>
                      )}
                    </View>

                    {/* Mode & UTR */}
                    <View style={{ width: 90 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>
                        {tx.paymentMode === 'CASH' ? '💵 Cash' : tx.paymentMode === 'UPI' ? '📱 UPI/QR' : '🏦 Bank'}
                      </Text>
                      {tx.externalRef ? (
                        <Text style={{ fontSize: 9, color: '#64748B' }} numberOfLines={1}>
                          {tx.externalRef}
                        </Text>
                      ) : null}
                    </View>

                    {/* Amount */}
                    <Text style={[mStyles.tableCell, { width: 85, fontWeight: '800', color: '#0F172A' }]}>
                      ₹{tx.amount.toLocaleString()}
                    </Text>

                    {/* Status Badge */}
                    <View style={{ width: 120 }}>
                      <View
                        style={[
                          mStyles.badge,
                          tx.isReversed
                            ? mStyles.badgeDanger
                            : isVerified
                            ? mStyles.badgeSuccess
                            : isPending
                            ? mStyles.badgeWarning
                            : mStyles.badgeDanger,
                        ]}
                      >
                        <Text
                          style={[
                            mStyles.badgeText,
                            tx.isReversed
                              ? mStyles.badgeDangerText
                              : isVerified
                              ? mStyles.badgeSuccessText
                              : isPending
                              ? mStyles.badgeWarningText
                              : mStyles.badgeDangerText,
                            { fontSize: 10 },
                          ]}
                        >
                          {tx.isReversed
                            ? 'REVERSED'
                            : isVerified
                            ? '✓ APPROVED'
                            : isPending
                            ? '⏳ PENDING APPROVAL'
                            : '✕ REJECTED'}
                        </Text>
                      </View>

                      {isRejected && tx.rejectionReason && (
                        <Text style={{ fontSize: 9, color: '#DC2626', marginTop: 2 }} numberOfLines={2}>
                          Reason: {tx.rejectionReason}
                        </Text>
                      )}
                    </View>

                    {/* Photo Proof */}
                    <View style={{ width: 80 }}>
                      {tx.receiptPhoto ? (
                        <TouchableOpacity
                          style={{ backgroundColor: '#E0F2FE', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 4, alignItems: 'center' }}
                          onPress={() => {
                            setSelectedTx(tx);
                            setShowPhotoModal(true);
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#0284C7' }}>
                            📷 View
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>None</Text>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={{ flex: 1, minWidth: 160, flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[mStyles.secondaryBtn, { paddingVertical: 5, paddingHorizontal: 8 }]}
                        onPress={() => {
                          setSelectedTx(tx);
                          setShowReceiptModal(true);
                        }}
                      >
                        <Text style={[mStyles.secondaryBtnText, { fontSize: 10 }]}>🖨️ Receipt</Text>
                      </TouchableOpacity>

                      {/* Manager: Approve / Reject Controls for Digital Receipts */}
                      {isManager && isPending && (
                        <>
                          <TouchableOpacity
                            style={[mStyles.successBtn, { paddingVertical: 5, paddingHorizontal: 8 }]}
                            onPress={() => handleApproveTransaction(tx.id)}
                          >
                            <Text style={[mStyles.successBtnText, { fontSize: 10 }]}>✓ Approve</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[mStyles.dangerBtn, { paddingVertical: 5, paddingHorizontal: 8 }]}
                            onPress={() => {
                              setSelectedTx(tx);
                              setShowRejectModal(true);
                            }}
                          >
                            <Text style={[mStyles.dangerBtnText, { fontSize: 10 }]}>✕ Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Manager: Payment Reversal for verified transactions */}
                      {isManager && !tx.isReversed && isVerified && (
                        <TouchableOpacity
                          style={[mStyles.dangerBtn, { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 5, paddingHorizontal: 8 }]}
                          onPress={() => {
                            setSelectedTx(tx);
                            setShowReversalModal(true);
                          }}
                        >
                          <Text style={{ color: '#DC2626', fontSize: 10, fontWeight: '700' }}>↩️ Reverse</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* --- SUB TAB 3: RECONCILIATION CENTER (MANAGER / SUPER ADMIN ONLY) --- */}
      {!isStaff && subTab === 'RECONCILIATION' && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <Text style={{ fontSize: 13, color: '#64748B' }}>
              Match digital payments (UPI/IMPS/NEFT) and cash records against bank book and issue verification.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={mStyles.successBtn}
                onPress={() => handleBulkReconcile('VERIFIED')}
              >
                <Text style={mStyles.successBtnText}>✓ Verify Selected ({selectedTxIds.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={mStyles.dangerBtn}
                onPress={() => handleBulkReconcile('REJECTED')}
              >
                <Text style={mStyles.dangerBtnText}>✕ Flag Mismatch ({selectedTxIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={mStyles.table}>
            <View style={mStyles.tableHeader}>
              <Text style={[mStyles.tableHeaderCell, { width: 50 }]}>Select</Text>
              <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Receipt #</Text>
              <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Member</Text>
              <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Ref / UTR</Text>
              <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Mode</Text>
              <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Amount</Text>
              <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Status</Text>
            </View>
            {transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  mStyles.tableRow,
                  selectedTxIds.includes(tx.id) && { backgroundColor: '#F0F9FF' },
                ]}
                onPress={() => toggleSelectTx(tx.id)}
              >
                <Text style={[mStyles.tableCell, { width: 50, fontWeight: '700' }]}>
                  {selectedTxIds.includes(tx.id) ? '☑️' : '⬜'}
                </Text>
                <Text style={[mStyles.tableCell, { width: 110, fontWeight: '700', color: '#0284C7' }]}>
                  {tx.receiptNo}
                </Text>
                <Text style={[mStyles.tableCell, { width: 130 }]}>{tx.subscriber?.fullName}</Text>
                <Text style={[mStyles.tableCell, { width: 110, fontSize: 11, color: '#475569' }]}>
                  {tx.externalRef || 'N/A (Cash)'}
                </Text>
                <Text style={[mStyles.tableCell, { width: 80, fontSize: 12 }]}>{tx.paymentMode}</Text>
                <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700' }]}>
                  ₹{tx.amount.toLocaleString()}
                </Text>
                <Text
                  style={[
                    mStyles.tableCell,
                    {
                      flex: 1,
                      fontSize: 11,
                      color:
                        tx.verificationStatus === 'VERIFIED'
                          ? '#16A34A'
                          : tx.verificationStatus === 'REJECTED'
                          ? '#DC2626'
                          : '#D97706',
                      fontWeight: '700',
                    },
                  ]}
                >
                  {tx.verificationStatus}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* --- RECEIPT MODAL (AC-11) --- */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 550 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>🧾 Official Chit Payment Receipt</Text>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderWidth: 2,
                    borderColor: '#0F2F52',
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F2F52' }}>
                      {user.company?.name || 'CHIT FUND COMPANY'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Official Chit Subscriber Payment Receipt
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0284C7', marginTop: 6 }}>
                      RECEIPT NO: {selectedTx.receiptNo}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                      Status: {selectedTx.verificationStatus} • Print Count: {selectedTx.receipt?.printedCount || 1}
                    </Text>
                  </View>

                  <View style={{ gap: 6, marginVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Member Name: </Text>
                      {selectedTx.subscriber?.fullName}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Member Code: </Text>
                      {selectedTx.subscriber?.subscriberCode}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Chit Group: </Text>
                      {selectedTx.group?.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Installment: </Text>#{selectedTx.installmentNo}
                      {selectedTx.installmentType ? ` (${selectedTx.installmentType})` : ''}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Payment Mode: </Text>
                      {selectedTx.paymentMode} {selectedTx.externalRef ? `(Ref: ${selectedTx.externalRef})` : ''}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Recorded By: </Text>
                      {selectedTx.recordedBy?.fullName || 'Staff / Manager'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Date & Time: </Text>
                      {new Date(selectedTx.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: '#CBD5E1',
                      marginTop: 10,
                      paddingTop: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>AMOUNT RECEIVED:</Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#16A34A' }}>
                      ₹{selectedTx.amount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowReceiptModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={mStyles.primaryBtn}
                    onPress={() => handleReprint(selectedTx.receiptNo)}
                  >
                    <Text style={mStyles.primaryBtnText}>🖨️ Reprint Official Copy</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- PHOTO PROOF PREVIEW MODAL --- */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 500 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📷 Digital Payment Receipt Proof</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              {selectedTx?.receiptPhoto || receiptPhoto ? (
                <Image
                  source={{ uri: selectedTx?.receiptPhoto || receiptPhoto }}
                  style={{ width: '100%', height: 300, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#64748B' }}>No photo attached</Text>
              )}
            </View>

            <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowPhotoModal(false)}>
              <Text style={mStyles.primaryBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- REJECT TRANSACTION MODAL (MANAGER ONLY) --- */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>❌ Reject Staff Digital Receipt</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>
                    Receipt #{selectedTx.receiptNo} • ₹{selectedTx.amount.toLocaleString()} ({selectedTx.paymentMode})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    Member: {selectedTx.subscriber?.fullName} • Ref: {selectedTx.externalRef || 'None'}
                  </Text>
                </View>

                <Text style={mStyles.label}>Reason for Rejection *</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. UTR number not matching bank statement, incorrect installment amount, blurry photo..."
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowRejectModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleRejectTransaction}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>✕ Reject Receipt</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- REVERSAL MODAL (AC-13) --- */}
      <Modal visible={showReversalModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>↩️ Authorize Payment Reversal (AC-13)</Text>
              <TouchableOpacity onPress={() => setShowReversalModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>
                    Reversing Receipt: {selectedTx.receiptNo} (₹{selectedTx.amount.toLocaleString()})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    Member: {selectedTx.subscriber?.fullName} • Original record will remain immutable with reversal status and audit timestamp.
                  </Text>
                </View>

                <Text style={mStyles.label}>Mandatory Reason for Reversal *</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Specify correction reason e.g. Wrong member account selected, duplicate entry, cheque bounce..."
                  value={reversalReason}
                  onChangeText={setReversalReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowReversalModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleReversePayment}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>✓ Execute Reversal</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
