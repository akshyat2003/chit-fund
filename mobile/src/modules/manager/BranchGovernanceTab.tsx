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

export function BranchGovernanceTab({ user }: { user: any }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);

  // Form states
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const bRes = await api.get('/branches');
      if (bRes.data.success) {
        setBranches(bRes.data.data || []);
      }
      if (user.company?.id) {
        // Fetch company governance settings
        const cRes = await api.get(`/super-admin/companies/${user.company.id}`).catch(() => null);
        if (cRes?.data?.success) {
          setCompanyDetails(cRes.data.data);
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

  // FR-COMP-003, FR-COMP-004, FR-COMP-005: Create Branch
  const handleCreateBranch = async () => {
    if (!branchCode.trim() || !branchName.trim() || !location.trim()) {
      alert('Branch Code, Name, and Location are mandatory');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/super-admin/branches', {
        companyId: user.company?.id,
        code: branchCode.trim(),
        name: branchName.trim(),
        location: location.trim(),
        phone: phone.trim() || undefined,
        managerUserId: user.id,
      });

      if (res.data.success) {
        alert('Branch created successfully: ' + res.data.data.name);
        setShowAddBranchModal(false);
        setBranchCode('');
        setBranchName('');
        setLocation('');
        setPhone('');
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  // FR-COMP-009, FR-COMP-010: Deactivate Branch
  const handleDeactivateBranch = async () => {
    if (!selectedBranch || !closureReason.trim()) {
      alert('Mandatory closure reason required for branch deactivation');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.delete(`/super-admin/branches/${selectedBranch.id}?reason=${encodeURIComponent(closureReason.trim())}`);
      if (res.data.success) {
        alert(res.data.message || 'Branch deactivated while preserving historical records.');
        setShowDeactivateModal(false);
        setClosureReason('');
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Branch deactivation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = branches.filter((b) => {
    const matchesSearch =
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.code?.toLowerCase().includes(search.toLowerCase()) ||
      b.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>🏛️ Multi-Branch & Company Governance</Text>
          <Text style={mStyles.headerSubtitle}>
            FR-COMP-001 Legal Entity, FR-COMP-003/004 Branches, FR-COMP-008 Scoping & FR-COMP-011 Settings
          </Text>
        </View>
        <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowAddBranchModal(true)}>
          <Text style={mStyles.primaryBtnText}>➕ Add Branch (FR-COMP-003)</Text>
        </TouchableOpacity>
      </View>

      {/* FR-COMP-001 & FR-COMP-011: Company Legal Identity & Receipt Prefix Card */}
      <View style={[mStyles.card, { backgroundColor: '#0F2F52', borderColor: '#1E40AF', marginBottom: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <View>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              FR-COMP-001 Legal Entity Profile
            </Text>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 2 }}>
              {companyDetails?.name || user.company?.name || 'CHIT FUND ENTERPRISES'}
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 13, marginTop: 2 }}>
              Legal ID: {user.company?.id} • Code: [{user.company?.code}] • Registration: {companyDetails?.registrationNo || 'REG-MH-2024-8891'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              📍 Registered Office: {companyDetails?.address || 'Corporate Headquarters'} • 📞 {companyDetails?.phone || user.phone}
            </Text>
          </View>

          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 12 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
              FR-COMP-011 Business Settings
            </Text>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
              Receipt Prefix: <Text style={{ color: '#38BDF8' }}>{companyDetails?.receiptPrefix || 'REC'}</Text>
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 11, marginTop: 2 }}>
              Autonomous Serial: [PREFIX]-YYYY-00001
            </Text>
            <View style={[mStyles.badge, mStyles.badgeSuccess, { marginTop: 6 }]}>
              <Text style={[mStyles.badgeText, mStyles.badgeSuccessText]}>Operating: ACTIVE</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Row */}
      <View style={mStyles.filterRow}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="Search branches by name, unique code, or city..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[mStyles.chip, statusFilter === st && mStyles.chipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[mStyles.chipText, statusFilter === st && mStyles.chipTextActive]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Branch Cards */}
      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ color: '#64748B' }}>No branches found.</Text>
        </View>
      ) : (
        filtered.map((b) => (
          <View key={b.id} style={mStyles.card}>
            <View style={mStyles.cardRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={mStyles.cardTitle}>{b.name}</Text>
                  <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>
                    [{b.code}]
                  </Text>
                  <View
                    style={[
                      mStyles.badge,
                      b.status === 'ACTIVE' ? mStyles.badgeSuccess : mStyles.badgeDanger,
                    ]}
                  >
                    <Text
                      style={[
                        mStyles.badgeText,
                        b.status === 'ACTIVE' ? mStyles.badgeSuccessText : mStyles.badgeDangerText,
                      ]}
                    >
                      {b.status}
                    </Text>
                  </View>
                </View>
                <Text style={mStyles.cardSubtitle}>
                  📍 {b.location} • 📞 {b.phone || 'Phone N/A'} • Manager ID: {b.managerUserId || user.id}
                </Text>
                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  👥 Subscribers: {b._count?.subscribers || 0} • Chit Groups: {b._count?.chitGroups || 0} • Staff: {b._count?.users || 0}
                </Text>
                {b.closureReason && (
                  <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>
                    Deactivation Closure Reason: {b.closureReason} (Historical audit retained)
                  </Text>
                )}
              </View>

              {b.status === 'ACTIVE' && (
                <TouchableOpacity
                  style={mStyles.dangerBtn}
                  onPress={() => {
                    setSelectedBranch(b);
                    setShowDeactivateModal(true);
                  }}
                >
                  <Text style={[mStyles.dangerBtnText, { fontSize: 12 }]}>⚠️ Deactivate (FR-COMP-009)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      {/* --- MODAL 1: ADD BRANCH (FR-COMP-003, FR-COMP-004) --- */}
      <Modal visible={showAddBranchModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Create Branch Record (FR-COMP-003)</Text>
              <TouchableOpacity onPress={() => setShowAddBranchModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Unique Branch Code *</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="e.g. BR-MUM-01"
                    value={branchCode}
                    onChangeText={setBranchCode}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Contact Phone</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="phone-pad"
                    placeholder="Branch phone"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Branch Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Mumbai Andheri Branch"
                value={branchName}
                onChangeText={setBranchName}
              />

              <Text style={mStyles.label}>Physical Location / Address *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Complete street, area, city, pincode"
                value={location}
                onChangeText={setLocation}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAddBranchModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateBranch}
                >
                  <Text style={mStyles.primaryBtnText}>✓ Save & Activate Branch</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: DEACTIVATE BRANCH (FR-COMP-009, FR-COMP-010) --- */}
      <Modal visible={showDeactivateModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>⚠️ Branch Deactivation (FR-COMP-009/010)</Text>
              <TouchableOpacity onPress={() => setShowDeactivateModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedBranch && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>
                    Deactivating: {selectedBranch.name} ({selectedBranch.code})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    In accordance with FR-COMP-009 and FR-COMP-010, historical ledgers, transactions, and subscriber registrations are permanently preserved. Deactivation prevents new enrollments while preserving audit integrity.
                  </Text>
                </View>

                <Text style={mStyles.label}>Mandatory Closure Reason *</Text>
                <TextInput
                  style={[mStyles.input, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Official closure justification e.g. Branch consolidation, area relocation..."
                  value={closureReason}
                  onChangeText={setClosureReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowDeactivateModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleDeactivateBranch}
                  >
                    <Text style={mStyles.dangerBtnText}>✓ Confirm Safe Deactivation</Text>
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
