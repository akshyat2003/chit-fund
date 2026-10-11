import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { api } from '../../services/api';
import { mStyles } from './commonStyles';

export function CollectionsTab({ user }: { user: any }) {
  const [subTab, setSubTab] = useState<'RECORD' | 'TRANSACTIONS' | 'RECONCILIATION'>('RECORD');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Payment Recording Form (AC-08, AC-09, AC-10)
  const [selectedSubscriberId, setSelectedSubscriberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [installmentNo, setInstallmentNo] = useState('1');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI'>('CASH');
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');

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
      if (txRes.data.success) setTransactions(txRes.data.data || []);
      if (subRes.data.success) {
        setSubscribers(subRes.data.data || []);
        if (subRes.data.data.length > 0 && !selectedSubscriberId) {
          setSelectedSubscriberId(subRes.data.data[0].id);
        }
      }
      if (grpRes.data.success) {
        setGroups(grpRes.data.data || []);
        if (grpRes.data.data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(grpRes.data.data[0].id);
        }
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

  // AC-08: Record Payment
  const handleRecordPayment = async () => {
    if (!selectedSubscriberId || !selectedGroupId || !installmentNo || !amount) {
      alert('Please fill member, chit group, installment number, and amount');
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
        externalRef: externalRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.data.success) {
        alert(`Payment recorded successfully!\nReceipt No: ${res.data.data.receipt?.receiptNo || res.data.data.receiptNo}`);
        setAmount('');
        setExternalRef('');
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

  // AC-12: Bulk Reconcile Payments
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

  const filteredTx = transactions.filter((t) =>
    t.receiptNo?.toLowerCase().includes(search.toLowerCase()) ||
    t.subscriber?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    t.externalRef?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>💳 Collections, Receipts & Reconciliation</Text>
          <Text style={mStyles.headerSubtitle}>
            AC-08 Collection Entry, AC-09/10 Part & Adv, AC-11 Receipts, AC-12 Reconciliation & AC-13 Reversals
          </Text>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={mStyles.subTabs}>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'RECORD' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('RECORD')}
        >
          <Text style={[mStyles.subTabText, subTab === 'RECORD' && mStyles.subTabTextActive]}>
            💵 1. Record Collection (AC-08/09/10)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'TRANSACTIONS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('TRANSACTIONS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'TRANSACTIONS' && mStyles.subTabTextActive]}>
            🧾 2. Receipts & Transactions (AC-11/13)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'RECONCILIATION' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('RECONCILIATION')}
        >
          <Text style={[mStyles.subTabText, subTab === 'RECONCILIATION' && mStyles.subTabTextActive]}>
            🔄 3. Reconciliation Center (AC-12)
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- SUB TAB 1: RECORD COLLECTION --- */}
      {subTab === 'RECORD' && (
        <View style={mStyles.card}>
          <Text style={[mStyles.cardTitle, { marginBottom: 16 }]}>
            Record Member Chit Installment Collection
          </Text>

          <Text style={mStyles.label}>Select Member *</Text>
          <View style={{ maxHeight: 160, marginBottom: 14 }}>
            <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
              {subscribers.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={{
                    padding: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                    backgroundColor: selectedSubscriberId === s.id ? '#E0F2FE' : '#FFF',
                  }}
                  onPress={() => setSelectedSubscriberId(s.id)}
                >
                  <Text style={{ fontWeight: selectedSubscriberId === s.id ? '700' : '500', color: '#0F172A', fontSize: 13 }}>
                    {s.fullName} [{s.subscriberCode}] - 📞 {s.phone}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={mStyles.label}>Chit Group *</Text>
              <View style={{ maxHeight: 120, marginBottom: 14 }}>
                <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                  {groups.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={{
                        padding: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                        backgroundColor: selectedGroupId === g.id ? '#E0F2FE' : '#FFF',
                      }}
                      onPress={() => {
                        setSelectedGroupId(g.id);
                        setAmount(String(g.monthlyInstallment || ''));
                      }}
                    >
                      <Text style={{ fontWeight: selectedGroupId === g.id ? '700' : '400', fontSize: 12, color: '#0F172A' }}>
                        {g.name} (₹{g.monthlyInstallment}/mo)
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={mStyles.label}>Installment Number *</Text>
              <TextInput
                style={mStyles.input}
                keyboardType="numeric"
                placeholder="1"
                value={installmentNo}
                onChangeText={setInstallmentNo}
              />

              <Text style={mStyles.label}>Amount Paid (₹) *</Text>
              <TextInput
                style={mStyles.input}
                keyboardType="numeric"
                placeholder="Amount e.g. 5000"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          <Text style={mStyles.label}>Payment Method *</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {(['CASH', 'BANK_TRANSFER', 'UPI'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[mStyles.chip, paymentMode === mode && mStyles.chipActive]}
                onPress={() => setPaymentMode(mode)}
              >
                <Text style={[mStyles.chipText, paymentMode === mode && mStyles.chipTextActive]}>
                  {mode === 'CASH' ? '💵 Cash' : mode === 'UPI' ? '📱 UPI / QR' : '🏦 Bank Transfer'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {paymentMode !== 'CASH' && (
            <View>
              <Text style={mStyles.label}>Bank / UPI Reference ID *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. UPI Ref / IMPS-98472918"
                value={externalRef}
                onChangeText={setExternalRef}
              />
            </View>
          )}

          <Text style={mStyles.label}>Notes / Partial / Advance Allocation Remarks</Text>
          <TextInput
            style={mStyles.input}
            placeholder="e.g. Regular payment / Advance installment 2 of 20..."
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[mStyles.primaryBtn, { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 24 }]}
            disabled={submitting}
            onPress={handleRecordPayment}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={[mStyles.primaryBtnText, { fontSize: 14 }]}>
                ✓ Record Collection & Generate Official Receipt
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* --- SUB TAB 2: TRANSACTIONS & RECEIPTS --- */}
      {subTab === 'TRANSACTIONS' && (
        <View>
          <View style={mStyles.filterRow}>
            <TextInput
              style={mStyles.searchBar}
              placeholder="Search receipt number (e.g. REC-2026-0001), member or ref..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
          ) : filteredTx.length === 0 ? (
            <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
              <Text style={{ color: '#64748B' }}>No payment transactions found.</Text>
            </View>
          ) : (
            <View style={mStyles.table}>
              <View style={mStyles.tableHeader}>
                <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Receipt #</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Member</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Group</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 50 }]}>Inst #</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Mode</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Amount</Text>
                <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Status</Text>
                <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Actions</Text>
              </View>
              {filteredTx.map((tx) => (
                <View key={tx.id} style={mStyles.tableRow}>
                  <Text style={[mStyles.tableCell, { width: 110, fontWeight: '700', color: '#0284C7' }]}>
                    {tx.receiptNo}
                  </Text>
                  <Text style={[mStyles.tableCell, { width: 130, fontWeight: '600' }]}>
                    {tx.subscriber?.fullName}
                  </Text>
                  <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>{tx.group?.name}</Text>
                  <Text style={[mStyles.tableCell, { width: 50 }]}>#{tx.installmentNo}</Text>
                  <Text style={[mStyles.tableCell, { width: 80, fontSize: 12 }]}>{tx.paymentMode}</Text>
                  <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700' }]}>
                    ₹{tx.amount.toLocaleString()}
                  </Text>
                  <View style={{ width: 100 }}>
                    <View
                      style={[
                        mStyles.badge,
                        tx.isReversed
                          ? mStyles.badgeDanger
                          : tx.verificationStatus === 'VERIFIED'
                          ? mStyles.badgeSuccess
                          : mStyles.badgeWarning,
                      ]}
                    >
                      <Text
                        style={[
                          mStyles.badgeText,
                          tx.isReversed
                            ? mStyles.badgeDangerText
                            : tx.verificationStatus === 'VERIFIED'
                            ? mStyles.badgeSuccessText
                            : mStyles.badgeWarningText,
                        ]}
                      >
                        {tx.isReversed ? 'REVERSED' : tx.verificationStatus}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={mStyles.secondaryBtn}
                      onPress={() => {
                        setSelectedTx(tx);
                        setShowReceiptModal(true);
                      }}
                    >
                      <Text style={[mStyles.secondaryBtnText, { fontSize: 11 }]}>🖨️ Receipt (AC-11)</Text>
                    </TouchableOpacity>

                    {!tx.isReversed && (
                      <TouchableOpacity
                        style={mStyles.dangerBtn}
                        onPress={() => {
                          setSelectedTx(tx);
                          setShowReversalModal(true);
                        }}
                      >
                        <Text style={[mStyles.dangerBtnText, { fontSize: 11 }]}>↩️ Reverse (AC-13)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* --- SUB TAB 3: RECONCILIATION CENTER --- */}
      {subTab === 'RECONCILIATION' && (
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
              <Text style={mStyles.modalTitle}>🧾 Official Chit Payment Receipt (AC-11)</Text>
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
                      Print Count: {selectedTx.receipt?.printedCount || 1}
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
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      <Text style={{ fontWeight: '700' }}>Payment Mode: </Text>
                      {selectedTx.paymentMode} {selectedTx.externalRef ? `(${selectedTx.externalRef})` : ''}
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
                    <Text style={mStyles.primaryBtnText}>🖨️ Reprint Official Copy (AC-11)</Text>
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
