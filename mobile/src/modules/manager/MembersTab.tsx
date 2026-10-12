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
  const [platformUsers, setPlatformUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);

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
      const [subRes, branchRes, usersRes] = await Promise.all([
        api.get('/subscribers'),
        api.get('/branches').catch(() => ({ data: { data: [] } })),
        api.get('/auth/users').catch(() => ({ data: { data: [] } })),
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
      if (usersRes.data.success) {
        setPlatformUsers(usersRes.data.data || []);
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

  const handleSelectUser = (u: any) => {
    setSelectedUserId(u.id);
    setFullName(u.fullName || '');
    setPhone(u.phone || '');
    setEmail(u.email || '');
    setAddress(u.address || '');
    setAadhaarNumber(u.aadhaarNo || '');
    setPanNumber(u.panNo || '');
    setShowUserPicker(false);
  };

  // AC-01: Member Registration (both staff & manager)
  const handleRegisterMember = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      alert('Please fill mandatory fields: Full Name, Phone, and Residential Address');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/subscribers', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        aadhaarNo: aadhaarNumber.trim() || undefined,
        panNo: panNumber.trim().toUpperCase() || undefined,
        nomineeName: nomineeName.trim() || undefined,
        nomineeRelation: nomineeRelation.trim() || undefined,
        branchId: branchId || user.branchId || branches[0]?.id || undefined,
        userId: selectedUserId || undefined,
      });

      if (res.data.success) {
        alert('Member registered successfully with Member Code: ' + res.data.data.subscriberCode);
        setShowRegisterModal(false);
        // Reset form
        setSelectedUserId(null);
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
    const q = search.toLowerCase();
    const matchesSearch =
      s.fullName?.toLowerCase().includes(q) ||
      s.subscriberCode?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.aadhaarNo && s.aadhaarNo.includes(q)) ||
      (s.aadhaarNumber && s.aadhaarNumber.includes(q)) ||
      (s.panNo && s.panNo.toLowerCase().includes(q)) ||
      (s.panNumber && s.panNumber.toLowerCase().includes(q)) ||
      (s.user && s.user.username?.toLowerCase().includes(q)) ||
      (s.memberships && s.memberships.some((m: any) => m.group?.name?.toLowerCase().includes(q) || m.group?.groupCode?.toLowerCase().includes(q)));
    const matchesKyc = kycFilter === 'ALL' || s.kycStatus === kycFilter;
    return matchesSearch && matchesKyc;
  });

  const isManagerOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'MANAGER';

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>👥 Members & KYC Verification</Text>
          <Text style={mStyles.headerSubtitle}>
            Member Registry (Name, Phone, Aadhaar, PAN, Address), Multi-Group Enrollment & User Accounts
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowRegisterModal(true)}>
            <Text style={mStyles.primaryBtnText}>➕ Register Member</Text>
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
          <Text style={mStyles.kpiLabel}>Total Group Enrollments</Text>
          <Text style={[mStyles.kpiVal, { color: '#2563EB' }]}>
            {subscribers.reduce((acc, s) => acc + (s.memberships?.length || 0), 0)}
          </Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={mStyles.filterRow}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="Search by name, code, phone, aadhaar, PAN, or group..."
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

                  {/* Linked User Account Badge */}
                  {member.user && (
                    <View style={[mStyles.badge, { backgroundColor: '#EDE9FE' }]}>
                      <Text style={[mStyles.badgeText, { color: '#6D28D9' }]}>
                        👤 User Account: @{member.user.username} ({member.user.role?.replace('_', ' ')})
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={mStyles.cardSubtitle}>
                  📞 {member.phone} • ✉️ {member.email || 'N/A'} • 🏛️ {member.branch?.name || 'Main Branch'}
                </Text>

                {/* Address, Aadhaar & PAN details */}
                <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 12, color: '#334155' }}>
                    📍 <Text style={{ fontWeight: '600' }}>Address:</Text> {member.address || 'Address not provided'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      🪪 <Text style={{ fontWeight: '600' }}>Aadhaar:</Text> {member.aadhaarNo || member.aadhaarNumber || 'Not provided'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      💳 <Text style={{ fontWeight: '600' }}>PAN:</Text> {member.panNo || member.panNumber || 'Not provided'}
                    </Text>
                    {member.nomineeName && (
                      <Text style={{ fontSize: 12, color: '#475569' }}>
                        👥 <Text style={{ fontWeight: '600' }}>Nominee:</Text> {member.nomineeName} ({member.nomineeRelation || 'N/A'})
                      </Text>
                    )}
                  </View>
                </View>

                {/* Multi-Group Enrollment Status */}
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                    💰 ENROLLED CHIT GROUPS ({member.memberships?.length || 0}):
                  </Text>
                  {(!member.memberships || member.memberships.length === 0) ? (
                    <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                      Not enrolled in any chit groups yet. Member can be enrolled in any active group.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {member.memberships.map((m: any) => (
                        <View
                          key={m.id || m.groupId}
                          style={{
                            backgroundColor: '#EFF6FF',
                            borderColor: '#BFDBFE',
                            borderWidth: 1,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>
                            {m.group?.groupCode || 'GRP'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#1E40AF' }}>
                            {m.group?.name}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#6B7280' }}>
                            (₹{(m.group?.monthlyInstallment || 0).toLocaleString('en-IN')}/mo)
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Action Bar */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {isManagerOrAdmin && (
                <TouchableOpacity
                  style={mStyles.secondaryBtn}
                  onPress={() => {
                    setSelectedMember(member);
                    setKycStatus(member.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'VERIFIED');
                    setKycNotes(member.kycNotes || '');
                    setShowKycModal(true);
                  }}
                >
                  <Text style={mStyles.secondaryBtnText}>🔍 KYC Review</Text>
                </TouchableOpacity>
              )}

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
              <Text style={mStyles.modalTitle}>➕ Register New Member</Text>
              <TouchableOpacity onPress={() => setShowRegisterModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Option to link an existing user */}
              <View style={{ backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369A1' }}>
                    👤 Link from Existing User Account?
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                    onPress={() => setShowUserPicker(true)}
                  >
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
                      {selectedUserId ? '🔄 Change User' : '🔍 Select User'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {selectedUserId ? (
                  <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#BAE6FD' }}>
                    <Text style={{ fontSize: 12, color: '#0369A1' }}>
                      ✓ Linked: <Text style={{ fontWeight: '700' }}>{fullName}</Text> (@{platformUsers.find(u => u.id === selectedUserId)?.username})
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedUserId(null)}>
                      <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>✕ Unlink</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: '#0284C7', marginTop: 4 }}>
                    Any staff, manager, or existing user account can also be registered as a chit fund member.
                  </Text>
                )}
              </View>

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
                placeholder="Full address with street, city, pincode"
                value={address}
                onChangeText={setAddress}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Aadhaar Number (12 digits)</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="12-digit Aadhaar"
                    value={aadhaarNumber}
                    onChangeText={setAadhaarNumber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>PAN Card (10 characters)</Text>
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

      {/* --- MODAL FOR SELECTING EXISTING PLATFORM USER --- */}
      <Modal visible={showUserPicker} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxHeight: '80%' }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>👤 Select Existing Platform User</Text>
              <TouchableOpacity onPress={() => setShowUserPicker(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Choose a platform user (Staff, Manager, Client) to register as a chit group member:
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {platformUsers.length === 0 ? (
                <Text style={{ color: '#94A3B8', textAlign: 'center', marginVertical: 20 }}>No users found.</Text>
              ) : (
                platformUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={{
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onPress={() => handleSelectUser(u)}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }}>
                        {u.fullName || u.username}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        @{u.username} • {u.role?.replace('_', ' ')} • 📞 {u.phone || 'No phone'}
                      </Text>
                      {u.address && (
                        <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                          📍 {u.address}
                        </Text>
                      )}
                      {(u.aadhaarNo || u.panNo) && (
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          🪪 Aadhaar: {u.aadhaarNo || '—'} • 💳 PAN: {u.panNo || '—'}
                        </Text>
                      )}
                    </View>
                    <View style={[mStyles.badge, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[mStyles.badgeText, { color: '#0369A1' }]}>Select ➔</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
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
