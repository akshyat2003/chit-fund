import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { api } from '../../services/api';
import { mStyles } from './commonStyles';

export function MembersTab({ user }: { user: any }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED'>('ALL');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);

  // Selected Member Context
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [outstandingData, setOutstandingData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Form states for Registration (AC-01)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [branchId, setBranchId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for KYC Review (AC-02)
  const [kycStatus, setKycStatus] = useState<'VERIFIED' | 'REJECTED' | 'PENDING'>('VERIFIED');
  const [kycNotes, setKycNotes] = useState('');

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const [subRes, branchRes] = await Promise.all([
        api.get('/subscribers'),
        api.get('/branches'),
      ]);
      if (subRes.data.success) {
        setSubscribers(subRes.data.data || []);
      }
      if (branchRes.data.success) {
        setBranches(branchRes.data.data || []);
        if (branchRes.data.data.length > 0 && !branchId) {
          setBranchId(branchRes.data.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  // AC-01: Member Registration
  const handleRegisterMember = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim() || !branchId) {
      alert('Please fill all mandatory fields: Full Name, Phone, Address, and Branch');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/subscribers', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        aadhaarNumber: aadhaarNumber.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        nomineeName: nomineeName.trim() || undefined,
        nomineeRelation: nomineeRelation.trim() || undefined,
        branchId,
      });

      if (res.data.success) {
        alert('Member registered successfully with Member Code: ' + res.data.data.subscriberCode);
        setShowRegisterModal(false);
        // Reset form
        setFullName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setAadhaarNumber('');
        setPanNumber('');
        setNomineeName('');
        setNomineeRelation('');
        fetchSubscribers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register member');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-02: KYC Review
  const handleVerifyKyc = async () => {
    if (!selectedMember) return;
    try {
      setSubmitting(true);
      const res = await api.patch(`/subscribers/${selectedMember.id}/kyc`, {
        kycStatus,
        notes: kycNotes,
      });
      if (res.data.success) {
        alert(`Member KYC marked as ${kycStatus}`);
        setShowKycModal(false);
        fetchSubscribers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update KYC');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-04: View Member Ledger
  const handleOpenLedger = async (member: any) => {
    setSelectedMember(member);
    setShowLedgerModal(true);
    try {
      setModalLoading(true);
      const res = await api.get(`/subscribers/${member.id}/ledger`);
      if (res.data.success) {
        setLedgerData(res.data.data);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to fetch ledger');
    } finally {
      setModalLoading(false);
    }
  };

  // AC-29: View Member Statement
  const handleOpenStatement = async (member: any) => {
    setSelectedMember(member);
    setShowStatementModal(true);
    try {
      setModalLoading(true);
      const res = await api.get(`/subscribers/${member.id}/statement`);
      if (res.data.success) {
        setStatementData(res.data.data);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to fetch statement');
    } finally {
      setModalLoading(false);
    }
  };

  // AC-30: Outstanding & Arrears Analysis
  const handleOpenOutstanding = async () => {
    setShowOutstandingModal(true);
    try {
      setModalLoading(true);
      const res = await api.get('/subscribers/outstanding');
      if (res.data.success) {
        setOutstandingData(res.data.data || []);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to fetch outstanding arrears');
    } finally {
      setModalLoading(false);
    }
  };

  const filtered = subscribers.filter((s) => {
    const matchesSearch =
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.subscriberCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search);
    const matchesKyc = kycFilter === 'ALL' || s.kycStatus === kycFilter;
    return matchesSearch && matchesKyc;
  });

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>👥 Members & KYC Verification</Text>
          <Text style={mStyles.headerSubtitle}>
            AC-01 Member Registry, AC-02 KYC Workflow, AC-04 Ledgers, AC-29 Statements & AC-30 Arrears
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <TouchableOpacity style={mStyles.secondaryBtn} onPress={handleOpenOutstanding}>
            <Text style={mStyles.secondaryBtnText}>⚠️ Arrears & Late Fees (AC-30)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowRegisterModal(true)}>
            <Text style={mStyles.primaryBtnText}>➕ Register Member (AC-01)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Counters */}
      <View style={mStyles.kpiRow}>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Total Members</Text>
          <Text style={[mStyles.kpiVal, { color: '#0F2F52' }]}>{subscribers.length}</Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>KYC Verified</Text>
          <Text style={[mStyles.kpiVal, { color: '#16A34A' }]}>
            {subscribers.filter((s) => s.kycStatus === 'VERIFIED').length}
          </Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Pending Review</Text>
          <Text style={[mStyles.kpiVal, { color: '#D97706' }]}>
            {subscribers.filter((s) => s.kycStatus === 'PENDING').length}
          </Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Enrolled In Groups</Text>
          <Text style={[mStyles.kpiVal, { color: '#2563EB' }]}>
            {subscribers.reduce((acc, s) => acc + (s.memberships?.length || 0), 0)}
          </Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={mStyles.filterRow}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="Search by name, member code or phone..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['ALL', 'VERIFIED', 'PENDING', 'REJECTED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[mStyles.chip, kycFilter === status && mStyles.chipActive]}
              onPress={() => setKycFilter(status)}
            >
              <Text style={[mStyles.chipText, kycFilter === status && mStyles.chipTextActive]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Subscriber List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ color: '#64748B', fontSize: 15 }}>No members found matching filter criteria.</Text>
        </View>
      ) : (
        filtered.map((member) => (
          <View key={member.id} style={mStyles.card}>
            <View style={mStyles.cardRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={mStyles.cardTitle}>{member.fullName}</Text>
                  <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>
                    [{member.subscriberCode}]
                  </Text>
                  <View
                    style={[
                      mStyles.badge,
                      member.kycStatus === 'VERIFIED'
                        ? mStyles.badgeSuccess
                        : member.kycStatus === 'REJECTED'
                        ? mStyles.badgeDanger
                        : mStyles.badgeWarning,
                    ]}
                  >
                    <Text
                      style={[
                        mStyles.badgeText,
                        member.kycStatus === 'VERIFIED'
                          ? mStyles.badgeSuccessText
                          : member.kycStatus === 'REJECTED'
                          ? mStyles.badgeDangerText
                          : mStyles.badgeWarningText,
                      ]}
                    >
                      KYC: {member.kycStatus}
                    </Text>
                  </View>
                </View>
                <Text style={mStyles.cardSubtitle}>
                  📞 {member.phone} • ✉️ {member.email || 'N/A'} • 🏛️ {member.branch?.name || 'Branch Main'}
                </Text>
                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  📍 {member.address} • Aadhaar: {member.aadhaarNumber || 'Pending'} • PAN: {member.panNumber || 'Pending'}
                </Text>
                {member.nomineeName && (
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Nominee: {member.nomineeName} ({member.nomineeRelation || 'Relation N/A'})
                  </Text>
                )}
              </View>
            </View>

            {/* Action Bar */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={mStyles.secondaryBtn}
                onPress={() => {
                  setSelectedMember(member);
                  setKycStatus(member.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'VERIFIED');
                  setKycNotes(member.kycNotes || '');
                  setShowKycModal(true);
                }}
              >
                <Text style={mStyles.secondaryBtnText}>🔍 KYC Review (AC-02)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={mStyles.secondaryBtn}
                onPress={() => handleOpenLedger(member)}
              >
                <Text style={mStyles.secondaryBtnText}>📖 Ledger (AC-04)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={mStyles.secondaryBtn}
                onPress={() => handleOpenStatement(member)}
              >
                <Text style={mStyles.secondaryBtnText}>📄 Statement (AC-29)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* --- MODAL 1: REGISTER MEMBER (AC-01) --- */}
      <Modal visible={showRegisterModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Register New Member (AC-01)</Text>
              <TouchableOpacity onPress={() => setShowRegisterModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={mStyles.label}>Full Legal Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Ramesh Kumar Sharma"
                value={fullName}
                onChangeText={setFullName}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Phone Number *</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="10-digit mobile"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Email Address</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Residential Address *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Full address with pincode"
                value={address}
                onChangeText={setAddress}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Aadhaar Number</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="12-digit Aadhaar"
                    value={aadhaarNumber}
                    onChangeText={setAadhaarNumber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>PAN Card</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="10-digit PAN"
                    value={panNumber}
                    onChangeText={setPanNumber}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Nominee Name</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="Nominee full name"
                    value={nomineeName}
                    onChangeText={setNomineeName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Nominee Relationship</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="e.g. Spouse / Son"
                    value={nomineeRelation}
                    onChangeText={setNomineeRelation}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Assigned Branch *</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {branches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[mStyles.chip, branchId === b.id && mStyles.chipActive]}
                    onPress={() => setBranchId(b.id)}
                  >
                    <Text style={[mStyles.chipText, branchId === b.id && mStyles.chipTextActive]}>
                      🏛️ {b.name} ({b.code})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowRegisterModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleRegisterMember}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={mStyles.primaryBtnText}>✓ Complete Registration</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: KYC REVIEW (AC-02) --- */}
      <Modal visible={showKycModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>🔍 KYC Verification Review (AC-02)</Text>
              <TouchableOpacity onPress={() => setShowKycModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 10, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#0F172A' }}>
                    {selectedMember.fullName} ({selectedMember.subscriberCode})
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Aadhaar: {selectedMember.aadhaarNumber || 'Not submitted'} • PAN: {selectedMember.panNumber || 'Not submitted'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Address: {selectedMember.address}
                  </Text>
                </View>

                <Text style={mStyles.label}>Verification Decision *</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  {(['VERIFIED', 'PENDING', 'REJECTED'] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        mStyles.chip,
                        kycStatus === st && mStyles.chipActive,
                        st === 'VERIFIED' && kycStatus === st && { backgroundColor: '#16A34A', borderColor: '#16A34A' },
                        st === 'REJECTED' && kycStatus === st && { backgroundColor: '#DC2626', borderColor: '#DC2626' },
                      ]}
                      onPress={() => setKycStatus(st)}
                    >
                      <Text
                        style={[
                          mStyles.chipText,
                          kycStatus === st && mStyles.chipTextActive,
                        ]}
                      >
                        {st === 'VERIFIED' ? '✓ VERIFIED' : st === 'REJECTED' ? '✕ REJECTED' : '⏳ PENDING'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={mStyles.label}>Review Notes / Missing Info</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Record identity check details, address verification, or reasons for rejection..."
                  value={kycNotes}
                  onChangeText={setKycNotes}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowKycModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleVerifyKyc}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.primaryBtnText}>Save KYC Record</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 3: MEMBER LEDGER (AC-04) --- */}
      <Modal visible={showLedgerModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 850 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📖 Member Account Ledger (AC-04)</Text>
              <TouchableOpacity onPress={() => setShowLedgerModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 30 }} />
            ) : ledgerData ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#0F172A' }}>
                    {ledgerData.subscriber?.fullName} [{ledgerData.subscriber?.subscriberCode}]
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    Phone: {ledgerData.subscriber?.phone} • Branch: {ledgerData.subscriber?.branch?.name}
                  </Text>
                </View>

                {ledgerData.groupLedgers?.map((gl: any, idx: number) => (
                  <View key={idx} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: '800', fontSize: 14, color: '#0284C7' }}>
                        Chit Group: {gl.groupName} ({gl.groupCode}) • Ticket #{gl.membership?.ticketNo || 'N/A'}
                      </Text>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: '#16A34A' }}>
                        Paid: ₹{gl.totalPaid?.toLocaleString()} / ₹{gl.chitValue?.toLocaleString()}
                      </Text>
                    </View>

                    {/* Ledger Table */}
                    <View style={mStyles.table}>
                      <View style={mStyles.tableHeader}>
                        <Text style={[mStyles.tableHeaderCell, { width: 50 }]}>#</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Due Date</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Installment</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Dividend</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Net Payable</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Paid</Text>
                        <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Balance</Text>
                        <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Receipt / Status</Text>
                      </View>
                      {gl.ledgerLines?.map((line: any) => (
                        <View key={line.installmentNo} style={mStyles.tableRow}>
                          <Text style={[mStyles.tableCell, { width: 50, fontWeight: '700' }]}>
                            {line.installmentNo}
                          </Text>
                          <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>
                            {line.dueDate}
                          </Text>
                          <Text style={[mStyles.tableCell, { width: 90 }]}>₹{line.grossInstallment}</Text>
                          <Text style={[mStyles.tableCell, { width: 90, color: '#16A34A' }]}>
                            -₹{line.dividendDiscount}
                          </Text>
                          <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700' }]}>
                            ₹{line.netPayable}
                          </Text>
                          <Text style={[mStyles.tableCell, { width: 90, color: '#0070BA' }]}>
                            ₹{line.paidAmount}
                          </Text>
                          <Text
                            style={[
                              mStyles.tableCell,
                              { width: 90, color: line.balance > 0 ? '#DC2626' : '#16A34A', fontWeight: '700' },
                            ]}
                          >
                            ₹{line.balance}
                          </Text>
                          <Text style={[mStyles.tableCell, { flex: 1, fontSize: 11 }]}>
                            {line.receiptNo ? `${line.receiptNo} (${line.paymentMode})` : line.status}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 4: MEMBER STATEMENT (AC-29) --- */}
      <Modal visible={showStatementModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 800 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📄 Member Statement of Account (AC-29)</Text>
              <TouchableOpacity onPress={() => setShowStatementModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 30 }} />
            ) : statementData ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#0F2F52', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
                    {statementData.subscriber?.fullName}
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                    ID: {statementData.subscriber?.subscriberCode} • Phone: {statementData.subscriber?.phone}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                    <View>
                      <Text style={{ color: '#CBD5E1', fontSize: 11, textTransform: 'uppercase' }}>Total Paid</Text>
                      <Text style={{ color: '#4ADE80', fontSize: 18, fontWeight: '800' }}>
                        ₹{statementData.summary?.totalPaid?.toLocaleString()}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: '#CBD5E1', fontSize: 11, textTransform: 'uppercase' }}>Transactions</Text>
                      <Text style={{ color: '#38BDF8', fontSize: 18, fontWeight: '800' }}>
                        {statementData.summary?.transactionCount}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#0F172A' }}>
                  Payment History & Receipts
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Date</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Receipt #</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Group</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 50 }]}>Inst #</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Mode</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Amount</Text>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                  </View>
                  {statementData.transactions?.map((t: any) => (
                    <View key={t.id} style={mStyles.tableRow}>
                      <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={[mStyles.tableCell, { width: 110, fontWeight: '700', color: '#0284C7' }]}>
                        {t.receiptNo}
                      </Text>
                      <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>{t.group?.name}</Text>
                      <Text style={[mStyles.tableCell, { width: 50 }]}>{t.installmentNo}</Text>
                      <Text style={[mStyles.tableCell, { width: 80, fontSize: 12 }]}>{t.paymentMode}</Text>
                      <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700' }]}>
                        ₹{t.amount.toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          mStyles.tableCell,
                          {
                            flex: 1,
                            fontSize: 11,
                            color: t.isReversed ? '#DC2626' : '#16A34A',
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {t.isReversed ? 'REVERSED' : t.verificationStatus}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 5: ARREARS & OUTSTANDING (AC-30) --- */}
      <Modal visible={showOutstandingModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 850 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>⚠️ Arrears & Late Fee Calculation (AC-30)</Text>
              <TouchableOpacity onPress={() => setShowOutstandingModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  Automated computation of member arrears based on overdue installment schedules plus configured 2% statutory late charge fee.
                </Text>

                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Member</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Code</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Overdue Inst.</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Principal Arrears</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Late Fee (2%)</Text>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Total Outstanding</Text>
                  </View>
                  {outstandingData.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#16A34A', fontWeight: '700' }}>
                        ✓ No arrears! All members are up to date.
                      </Text>
                    </View>
                  ) : (
                    outstandingData.map((row) => (
                      <View key={row.subscriberId} style={mStyles.tableRow}>
                        <Text style={[mStyles.tableCell, { width: 130, fontWeight: '700' }]}>
                          {row.subscriberName}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 100, color: '#0284C7' }]}>
                          {row.subscriberCode}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 100 }]}>{row.overdueInstallmentsCount} months</Text>
                        <Text style={[mStyles.tableCell, { width: 100, color: '#D97706', fontWeight: '700' }]}>
                          ₹{row.totalPrincipalArrears?.toLocaleString()}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 90, color: '#DC2626' }]}>
                          ₹{row.totalLateCharges?.toLocaleString()}
                        </Text>
                        <Text style={[mStyles.tableCell, { flex: 1, fontWeight: '800', color: '#B91C1C' }]}>
                          ₹{row.grandTotalOutstanding?.toLocaleString()}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
