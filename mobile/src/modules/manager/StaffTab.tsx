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
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Create / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branchId, setBranchId] = useState('');
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
      const [usersRes, branchesRes] = await Promise.all([
        api.get('/auth/users?role=COLLECTION_STAFF'),
        api.get('/branches').catch(() => ({ data: { data: [] } })),
      ]);

      if (usersRes.data.success) {
        setStaffList(usersRes.data.data || []);
      }
      if (branchesRes.data.success) {
        setBranches(branchesRes.data.data || []);
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
    setBranchId(branches[0]?.id || user.branchId || '');
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
    setBranchId(staff.branchId || '');
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
        const payload = {
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          role: 'COLLECTION_STAFF',
          companyId: user.company?.id,
          branchId: branchId || undefined,
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
          branchId: branchId || null,
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
        filteredStaff.map((staff) => (
          <View key={staff.id} style={mStyles.card}>
            <View style={mStyles.cardRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                </View>
                <Text style={mStyles.cardSubtitle}>
                  👤 Username: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{staff.username}</Text>
                  {'  '}•{'  '}📱 Phone: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{staff.phone}</Text>
                  {staff.email ? `  •  ✉️ ${staff.email}` : ''}
                </Text>
                {staff.branch?.name && (
                  <Text style={[mStyles.cardSubtitle, { marginTop: 4, color: '#0284C7' }]}>
                    🏛️ Branch: {staff.branch.name} ({staff.branch.code || ''})
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[mStyles.secondaryBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}
                  onPress={() => openEditModal(staff)}
                >
                  <Text style={mStyles.secondaryBtnText}>✏️ Edit / Reset PW</Text>
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
        ))
      )}

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

              {/* Branch Selection */}
              {branches.length > 0 && (
                <>
                  <Text style={mStyles.label}>Assigned Branch</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {branches.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          mStyles.chip,
                          branchId === b.id && mStyles.chipActive,
                          { paddingVertical: 8, paddingHorizontal: 12 },
                        ]}
                        onPress={() => setBranchId(b.id)}
                      >
                        <Text style={[mStyles.chipText, branchId === b.id && mStyles.chipTextActive]}>
                          🏛️ {b.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Password Section */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
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
