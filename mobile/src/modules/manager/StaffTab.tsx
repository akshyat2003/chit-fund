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

export function StaffTab({
  user,
  initialOpenCreate = false,
  onModalDismissed,
}: {
  user: any;
  initialOpenCreate?: boolean;
  onModalDismissed?: () => void;
}) {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Create / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [inspectingStaff, setInspectingStaff] = useState<any | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [panNo, setPanNo] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick Password Generator
  const generateStrongPassword = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generated = `Staff@${randomNum}!`;
    setPassword(generated);
    setShowPassword(true);
    setFormError('');
  };

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      const usersRes = await api.get('/auth/users?role=COLLECTION_STAFF');

      if (usersRes.data.success) {
        setStaffList(usersRes.data.data || []);
      }
    } catch (e: any) {
      console.error('Failed to load staff list:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  useEffect(() => {
    if (initialOpenCreate) {
      openCreateModal();
    }
  }, [initialOpenCreate]);

  const closeModal = () => {
    setModalVisible(false);
    onModalDismissed?.();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedStaffId(null);
    setFullName('');
    setUsername('');
    setPhone('');
    setEmail('');
    setAadhaarNo('');
    setPanNo('');
    setAddress('');
    setEmergencyContact('');
    setDateOfBirth('');
    generateStrongPassword();
    setFormError('');
    setFormSuccess('');
    setModalVisible(true);
  };

  const openEditModal = (staff: any) => {
    setModalMode('edit');
    setSelectedStaffId(staff.id);
    setFullName(staff.fullName || '');
    setUsername(staff.username || '');
    setPhone(staff.phone || '');
    setEmail(staff.email || '');
    setAadhaarNo(staff.aadhaarNo || '');
    setPanNo(staff.panNo || '');
    setAddress(staff.address || '');
    setEmergencyContact(staff.emergencyContact || '');
    setDateOfBirth(staff.dateOfBirth || '');
    setPassword('');
    setShowPassword(false);
    setFormError('');
    setFormSuccess('');
    setModalVisible(true);
  };

  const handleSaveStaff = async () => {
    setFormError('');
    setFormSuccess('');

    if (!fullName.trim() || !username.trim() || !phone.trim()) {
      setFormError('Please enter Full Name, Username, and Phone Number.');
      return;
    }

    if (modalMode === 'create' && !password.trim()) {
      setFormError('Please provide or generate a password for the staff member.');
      return;
    }

    // Password validation policy check if password is provided
    if (password.trim()) {
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setFormError('Password must contain at least one uppercase letter (A-Z).');
        return;
      }
      if (!/[a-z]/.test(password)) {
        setFormError('Password must contain at least one lowercase letter (a-z).');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setFormError('Password must contain at least one number (0-9).');
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
        setFormError('Password must contain at least one special character (!@#$%^&*...).');
        return;
      }
    }

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        const payload: any = {
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          role: 'COLLECTION_STAFF',
          companyId: user.company?.id,
          aadhaarNo: aadhaarNo.trim() || undefined,
          panNo: panNo.trim().toUpperCase() || undefined,
          address: address.trim() || undefined,
          emergencyContact: emergencyContact.trim() || undefined,
          dateOfBirth: dateOfBirth.trim() || undefined,
        };

        const res = await api.post('/auth/users', payload);
        if (res.data.success) {
          setFormSuccess('Staff credentials created successfully! The staff can now log in.');
          setTimeout(() => {
            closeModal();
            fetchStaffData();
          }, 1200);
        } else {
          setFormError(res.data.message || 'Failed to create staff account.');
        }
      } else {
        // Edit Mode
        const payload: any = {
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          aadhaarNo: aadhaarNo.trim() || null,
          panNo: panNo.trim().toUpperCase() || null,
          address: address.trim() || null,
          emergencyContact: emergencyContact.trim() || null,
          dateOfBirth: dateOfBirth.trim() || null,
        };
        if (password.trim()) {
          payload.password = password.trim();
        }

        const res = await api.put(`/auth/users/${selectedStaffId}`, payload);
        if (res.data.success) {
          setFormSuccess('Staff details updated successfully!');
          setTimeout(() => {
            closeModal();
            fetchStaffData();
          }, 1000);
        } else {
          setFormError(res.data.message || 'Failed to update staff account.');
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: any) => {
    const newStatus = staff.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.patch(`/auth/users/${staff.id}/status`, { status: newStatus });
      if (res.data.success) {
        fetchStaffData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update staff status');
    }
  };

  const handleRevokeSessions = async (staff: any) => {
    try {
      const res = await api.post(`/auth/users/${staff.id}/revoke-sessions`);
      if (res.data.success) {
        alert(`Successfully terminated all active sessions for ${staff.fullName}.`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke sessions');
    }
  };

  // Filtered List
  const filteredStaff = staffList.filter((s) => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeStaffCount = staffList.filter((s) => s.status === 'ACTIVE').length;
  const suspendedStaffCount = staffList.filter((s) => s.status === 'SUSPENDED').length;

  return (
    <ScrollView style={mStyles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header Row */}
      <View style={mStyles.headerRow}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={mStyles.headerTitle}>🛡️ Staff & Field Officer Credentials</Text>
          <Text style={mStyles.headerSubtitle}>
            Create login accounts for Collection Staff so they can access their dashboard and collect payments
          </Text>
        </View>
        <TouchableOpacity style={mStyles.primaryBtn} onPress={openCreateModal}>
          <Text style={mStyles.primaryBtnText}>+ Add New Staff</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Row */}
      <View style={mStyles.kpiRow}>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Total Staff</Text>
          <Text style={[mStyles.kpiVal, { color: '#0070BA' }]}>{staffList.length}</Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Active Officers</Text>
          <Text style={[mStyles.kpiVal, { color: '#16A34A' }]}>{activeStaffCount}</Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Suspended Staff</Text>
          <Text style={[mStyles.kpiVal, { color: '#DC2626' }]}>{suspendedStaffCount}</Text>
        </View>
      </View>

      {/* Search & Filter Row */}
      <View style={mStyles.filterRow}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="🔍 Search staff by name, phone, or username..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[mStyles.chip, statusFilter === st && mStyles.chipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[mStyles.chipText, statusFilter === st && mStyles.chipTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Staff List Cards */}
      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : filteredStaff.length === 0 ? (
        <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🏃</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>No Staff Members Found</Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16, textAlign: 'center' }}>
            {search ? 'No staff member matched your search query.' : 'Create your first staff account so they can log in to collect payments.'}
          </Text>
          <TouchableOpacity style={mStyles.primaryBtn} onPress={openCreateModal}>
            <Text style={mStyles.primaryBtnText}>+ Create Staff Credentials</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredStaff.map((staff) => {
          const hasKyc = Boolean(staff.aadhaarNo && staff.panNo);
          return (
            <View key={staff.id} style={mStyles.card}>
              <View style={mStyles.cardRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <Text style={mStyles.cardTitle}>{staff.fullName}</Text>
                    <View style={[mStyles.badge, mStyles.badgeInfo]}>
                      <Text style={[mStyles.badgeText, mStyles.badgeInfoText]}>COLLECTION STAFF</Text>
                    </View>
                    <View
                      style={[
                        mStyles.badge,
                        staff.status === 'ACTIVE' ? mStyles.badgeSuccess : mStyles.badgeDanger,
                      ]}
                    >
                      <Text
                        style={[
                          mStyles.badgeText,
                          staff.status === 'ACTIVE' ? mStyles.badgeSuccessText : mStyles.badgeDangerText,
                        ]}
                      >
                        {staff.status}
                      </Text>
                    </View>
                    <View
                      style={[
                        mStyles.badge,
                        hasKyc ? mStyles.badgeSuccess : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          mStyles.badgeText,
                          hasKyc ? mStyles.badgeSuccessText : { color: '#B45309' },
                        ]}
                      >
                        {hasKyc ? '✓ KYC COMPLETE' : '⚠️ KYC PENDING'}
                      </Text>
                    </View>
                  </View>

                  <Text style={mStyles.cardSubtitle}>
                    👤 Username: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{staff.username}</Text>
                    {'  '}•{'  '}📱 Phone: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{staff.phone}</Text>
                    {staff.email ? `  •  ✉️ ${staff.email}` : ''}
                  </Text>


                  {/* KYC & Personal Identification Summary */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      🪪 <Text style={{ fontWeight: '700', color: '#1E293B' }}>Aadhaar:</Text> {staff.aadhaarNo || 'Not provided'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      💳 <Text style={{ fontWeight: '700', color: '#1E293B' }}>PAN:</Text> {staff.panNo || 'Not provided'}
                    </Text>
                    {staff.emergencyContact ? (
                      <Text style={{ fontSize: 12, color: '#475569' }}>
                        🚨 <Text style={{ fontWeight: '700', color: '#1E293B' }}>Emergency:</Text> {staff.emergencyContact}
                      </Text>
                    ) : null}
                    {staff.address ? (
                      <Text style={{ fontSize: 12, color: '#475569', width: '100%' }} numberOfLines={1}>
                        🏠 <Text style={{ fontWeight: '700', color: '#1E293B' }}>Address:</Text> {staff.address}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#0284C7' }]}
                    onPress={() => setInspectingStaff(staff)}
                  >
                    <Text style={[mStyles.primaryBtnText, { fontSize: 12 }]}>📋 View Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[mStyles.secondaryBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}
                    onPress={() => openEditModal(staff)}
                  >
                    <Text style={mStyles.secondaryBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      staff.status === 'ACTIVE' ? mStyles.dangerBtn : mStyles.successBtn,
                      { paddingVertical: 6, paddingHorizontal: 10 },
                    ]}
                    onPress={() => handleToggleStatus(staff)}
                  >
                    <Text style={staff.status === 'ACTIVE' ? mStyles.dangerBtnText : mStyles.successBtnText}>
                      {staff.status === 'ACTIVE' ? '🔒 Suspend' : '🔓 Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[mStyles.secondaryBtn, { paddingVertical: 6, paddingHorizontal: 8 }]}
                    onPress={() => handleRevokeSessions(staff)}
                    accessibilityLabel="Force Logout / Revoke Sessions"
                  >
                    <Text style={{ fontSize: 13 }}>🚪</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* INSPECT STAFF FULL DETAILS MODAL */}
      <Modal visible={!!inspectingStaff} transparent animationType="fade" onRequestClose={() => setInspectingStaff(null)}>
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 560 }]}>
            <View style={mStyles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0284C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 18 }}>
                    {inspectingStaff?.fullName ? inspectingStaff.fullName[0].toUpperCase() : 'S'}
                  </Text>
                </View>
                <View>
                  <Text style={mStyles.modalTitle}>{inspectingStaff?.fullName || 'Staff Member'}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Login: @{inspectingStaff?.username}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setInspectingStaff(null)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {/* Badges Row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <View style={[mStyles.badge, mStyles.badgeInfo]}>
                  <Text style={[mStyles.badgeText, mStyles.badgeInfoText]}>COLLECTION STAFF</Text>
                </View>
                <View style={[mStyles.badge, inspectingStaff?.status === 'ACTIVE' ? mStyles.badgeSuccess : mStyles.badgeDanger]}>
                  <Text style={[mStyles.badgeText, inspectingStaff?.status === 'ACTIVE' ? mStyles.badgeSuccessText : mStyles.badgeDangerText]}>
                    STATUS: {inspectingStaff?.status}
                  </Text>
                </View>
                <View style={[mStyles.badge, inspectingStaff?.aadhaarNo && inspectingStaff?.panNo ? mStyles.badgeSuccess : { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[mStyles.badgeText, inspectingStaff?.aadhaarNo && inspectingStaff?.panNo ? mStyles.badgeSuccessText : { color: '#B45309' }]}>
                    {inspectingStaff?.aadhaarNo && inspectingStaff?.panNo ? '✓ KYC VERIFIED' : '⚠️ KYC PENDING'}
                  </Text>
                </View>
              </View>

              {/* Section 1: Contact Details */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                📞 Contact & Communication
              </Text>
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Primary Mobile Phone</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{inspectingStaff?.phone || '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Email Address</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{inspectingStaff?.email || 'Not provided'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Emergency Contact Phone</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: inspectingStaff?.emergencyContact ? '#0F172A' : '#94A3B8' }}>
                    {inspectingStaff?.emergencyContact || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Section 2: KYC & Government Identification */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                🪪 Government Identification & KYC
              </Text>
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Aadhaar Number</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: inspectingStaff?.aadhaarNo ? '#0F172A' : '#EF4444' }}>
                    {inspectingStaff?.aadhaarNo || '⚠️ Not provided'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>PAN Card Number</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: inspectingStaff?.panNo ? '#0F172A' : '#EF4444' }}>
                    {inspectingStaff?.panNo || '⚠️ Not provided'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Date of Birth</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    {inspectingStaff?.dateOfBirth || 'Not provided'}
                  </Text>
                </View>
                <View style={{ paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 2 }}>Residential Address</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A', lineHeight: 18 }}>
                    {inspectingStaff?.address || 'Not provided'}
                  </Text>
                </View>
              </View>

              {/* Section 3: Employment */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                💼 Employment Details
              </Text>
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Account Created</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    {inspectingStaff?.createdAt ? new Date(inspectingStaff.createdAt).toLocaleDateString() : '-'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: '#64748B' }}>Staff User ID</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{inspectingStaff?.id}</Text>
                </View>
              </View>

              {/* Action Buttons inside Inspector */}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  style={mStyles.secondaryBtn}
                  onPress={() => setInspectingStaff(null)}
                >
                  <Text style={mStyles.secondaryBtnText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mStyles.primaryBtn, { backgroundColor: '#0284C7' }]}
                  onPress={() => {
                    const st = inspectingStaff;
                    setInspectingStaff(null);
                    openEditModal(st);
                  }}
                >
                  <Text style={mStyles.primaryBtnText}>✏️ Edit Staff Details</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create / Edit Staff Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>
                {modalMode === 'create' ? '🏃 Create New Staff Credentials' : '✏️ Edit Staff & Reset Password'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              {formError ? (
                <View
                  style={{
                    backgroundColor: '#FEE2E2',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 14,
                    borderColor: '#EF4444',
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>⚠️ {formError}</Text>
                </View>
              ) : null}

              {formSuccess ? (
                <View
                  style={{
                    backgroundColor: '#DCFCE7',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 14,
                    borderColor: '#16A34A',
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: '#166534', fontWeight: '700', fontSize: 13 }}>✓ {formSuccess}</Text>
                </View>
              ) : null}

              {/* Full Name */}
              <Text style={mStyles.label}>Full Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
              />

              {/* Username */}
              <Text style={mStyles.label}>Login Username * (Staff uses this to log in)</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. ramesh_staff"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />

              {/* Phone Number */}
              <Text style={mStyles.label}>Phone Number * (Can also be used to log in)</Text>
              <TextInput
                style={mStyles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              {/* Email */}
              <Text style={mStyles.label}>Email Address (Optional)</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. staff@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />


              {/* KYC & Identity Section Header */}
              <View style={{ marginTop: 8, marginBottom: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                  🪪 Personal & KYC Details (Aadhaar, PAN, Address)
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Official government identification for compliance & verification.
                </Text>
              </View>

              {/* Aadhaar Number */}
              <Text style={mStyles.label}>Aadhaar Card Number</Text>
              <TextInput
                style={mStyles.input}
                placeholder="12-digit Aadhaar number (e.g. 1234 5678 9012)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={14}
                value={aadhaarNo}
                onChangeText={setAadhaarNo}
              />

              {/* PAN Number */}
              <Text style={mStyles.label}>PAN Card Number</Text>
              <TextInput
                style={mStyles.input}
                placeholder="10-digit PAN (e.g. ABCDE1234F)"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                maxLength={10}
                value={panNo}
                onChangeText={(text) => setPanNo(text.toUpperCase())}
              />

              {/* Residential Address */}
              <Text style={mStyles.label}>Full Residential Address</Text>
              <TextInput
                style={[mStyles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Street address, City, State, PIN Code"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                value={address}
                onChangeText={setAddress}
              />

              {/* Emergency Contact */}
              <Text style={mStyles.label}>Emergency Contact Phone</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Emergency phone number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={emergencyContact}
                onChangeText={setEmergencyContact}
              />

              {/* Date of Birth */}
              <Text style={mStyles.label}>Date of Birth</Text>
              <TextInput
                style={mStyles.input}
                placeholder="YYYY-MM-DD (e.g. 1995-08-15)"
                placeholderTextColor="#94A3B8"
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
              />

              {/* Password Section */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 }}>
                <Text style={mStyles.label}>
                  {modalMode === 'create' ? 'Staff Login Password *' : 'Reset Password (Leave blank to keep unchanged)'}
                </Text>
                <TouchableOpacity onPress={generateStrongPassword}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0070BA' }}>⚡ Auto-Generate</Text>
                </TouchableOpacity>
              </View>

              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[mStyles.input, { paddingRight: 48 }]}
                  placeholder={modalMode === 'create' ? 'Enter strong password (e.g. Staff@2026!)' : 'New password...'}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 12, top: 12 }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={{ fontSize: 16 }}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, color: '#64748B', marginTop: -8, marginBottom: 18 }}>
                Must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 digit, and 1 special symbol.
              </Text>

              {/* Submit Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity
                  style={mStyles.secondaryBtn}
                  onPress={closeModal}
                  disabled={submitting}
                >
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mStyles.primaryBtn, { minWidth: 120, justifyContent: 'center' }]}
                  onPress={handleSaveStaff}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={mStyles.primaryBtnText}>
                      {modalMode === 'create' ? 'Create Staff' : 'Save Changes'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
