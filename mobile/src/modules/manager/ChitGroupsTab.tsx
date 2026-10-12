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

export function ChitGroupsTab({ user }: { user: any }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'CLOSED'>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupToDelete, setGroupToDelete] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create Group Form (AC-05, AC-06)
  const [groupName, setGroupName] = useState('');
  const [durationMonths, setDurationMonths] = useState('20');
  const [monthlyInstallment, setMonthlyInstallment] = useState('5000');
  const [maxMembers, setMaxMembers] = useState('20');
  const [foremanCommissionRate, setForemanCommissionRate] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Edit Group Form
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editChitValue, setEditChitValue] = useState('');
  const [editDurationMonths, setEditDurationMonths] = useState('');
  const [editMonthlyInstallment, setEditMonthlyInstallment] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState('');
  const [editForemanCommissionRate, setEditForemanCommissionRate] = useState('5');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editBranchId, setEditBranchId] = useState('');

  // Enroll Member Form (AC-03)
  const [selectedSubscriberId, setSelectedSubscriberId] = useState('');
  const [ticketNo, setTicketNo] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const [gRes, sRes, bRes] = await Promise.all([
        api.get('/chit-groups'),
        api.get('/subscribers'),
        api.get('/branches').catch(() => ({ data: { data: [] } })),
      ]);
      if (gRes.data.success) {
        setGroups(gRes.data.data || []);
      }
      if (sRes.data.success) {
        setSubscribers(sRes.data.data || []);
        if (sRes.data.data.length > 0 && !selectedSubscriberId) {
          setSelectedSubscriberId(sRes.data.data[0].id);
        }
      }
      if (bRes.data.success) {
        setBranches(bRes.data.data || []);
        if (bRes.data.data.length > 0 && !selectedBranchId) {
          setSelectedBranchId(bRes.data.data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching chit group data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const updateCreateDuration = (val: string) => {
    setDurationMonths(val);
    setMaxMembers(val); // default maxMembers to duration
  };

  // Auto-calculate monthly installment on edit
  const updateEditChitValue = (val: string) => {
    setEditChitValue(val);
    const cv = Number(val) || 0;
    const dm = Number(editDurationMonths) || 1;
    if (dm > 0) setEditMonthlyInstallment(String(Math.round(cv / dm)));
  };

  const updateEditDuration = (val: string) => {
    setEditDurationMonths(val);
    const cv = Number(editChitValue) || 0;
    const dm = Number(val) || 1;
    if (dm > 0) setEditMonthlyInstallment(String(Math.round(cv / dm)));
  };

  // AC-05: Create Chit Group
  const handleCreateGroup = async () => {
    if (!groupName.trim() || !durationMonths || !monthlyInstallment) {
      alert('Please fill all mandatory group configuration fields');
      return;
    }
    const computedPoolValue = (Number(monthlyInstallment) || 0) * (Number(durationMonths) || 0);
    try {
      setSubmitting(true);
      const res = await api.post('/chit-groups', {
        name: groupName.trim(),
        chitValue: computedPoolValue,
        totalMonths: Number(durationMonths),
        monthlyInstallment: Number(monthlyInstallment),
        maxMembers: Number(maxMembers || durationMonths),
        foremanCommissionPct: Number(foremanCommissionRate),
        startDate,
        branchId: selectedBranchId || branches[0]?.id || user.branchId || undefined,
      });

      if (res.data.success) {
        alert('Chit group created successfully: ' + res.data.data.name);
        setShowCreateModal(false);
        setGroupName('');
        fetchGroups();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create chit group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (grp: any) => {
    setEditGroupId(grp.id);
    setEditGroupName(grp.name || '');
    setEditChitValue(String(grp.chitValue ?? grp.totalChitValue ?? 100000));
    setEditDurationMonths(String(grp.totalMonths ?? grp.durationMonths ?? 20));
    setEditMonthlyInstallment(String(grp.monthlyInstallment ?? 5000));
    setEditMaxMembers(String(grp.maxMembers ?? 20));
    setEditForemanCommissionRate(String(grp.foremanCommissionPct ?? grp.foremanCommissionRate ?? 5));
    setEditStartDate(grp.startDate || new Date().toISOString().split('T')[0]);
    setEditStatus(grp.status || 'ACTIVE');
    setEditBranchId(grp.branchId || branches[0]?.id || '');
    setShowEditModal(true);
  };

  // Update Chit Group
  const handleUpdateGroup = async () => {
    if (!editGroupId || !editGroupName.trim() || !editChitValue || !editDurationMonths) {
      alert('Please fill all required group configuration fields');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.put(`/chit-groups/${editGroupId}`, {
        name: editGroupName.trim(),
        chitValue: Number(editChitValue),
        totalMonths: Number(editDurationMonths),
        monthlyInstallment: Number(editMonthlyInstallment),
        maxMembers: Number(editMaxMembers),
        foremanCommissionPct: Number(editForemanCommissionRate),
        startDate: editStartDate,
        status: editStatus,
        branchId: editBranchId || undefined,
      });

      if (res.data.success) {
        alert('Chit group updated successfully: ' + res.data.data.name);
        setShowEditModal(false);
        fetchGroups();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update chit group');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (grp: any) => {
    setGroupToDelete(grp);
    setShowDeleteModal(true);
  };

  // Confirm Delete Chit Group
  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    try {
      setSubmitting(true);
      const res = await api.delete(`/chit-groups/${groupToDelete.id}`);
      if (res.data.success) {
        alert(res.data.message || `Chit group '${groupToDelete.name}' deleted successfully.`);
        setShowDeleteModal(false);
        setGroupToDelete(null);
        fetchGroups();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete chit group');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-03: Enroll Member
  const handleEnrollMember = async () => {
    if (!selectedGroup || !selectedSubscriberId) {
      alert('Please select both a subscriber and ticket number');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/chit-groups/enroll', {
        groupId: selectedGroup.id,
        subscriberId: selectedSubscriberId,
        ticketNo: ticketNo ? Number(ticketNo) : undefined,
      });

      if (res.data.success) {
        alert(`Member successfully enrolled with Ticket #${res.data.data.ticketNumber || res.data.data.ticketNo}`);
        setShowEnrollModal(false);
        setTicketNo('');
        fetchGroups();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to enroll member');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-07: View Installment Schedule
  const handleOpenSchedule = async (grp: any) => {
    setSelectedGroup(grp);
    setShowScheduleModal(true);
    try {
      setModalLoading(true);
      const res = await api.get(`/chit-groups/${grp.id}`);
      if (res.data.success) {
        setScheduleData(res.data.data);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to fetch schedule');
    } finally {
      setModalLoading(false);
    }
  };

  const filtered = groups.filter((g) => {
    const matchesSearch =
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.groupCode?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>💰 Chit Groups & Scheme Management</Text>
          <Text style={mStyles.headerSubtitle}>
            Create schemes, edit configuration parameters, enroll members, and manage installment schedules
          </Text>
        </View>
        <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={mStyles.primaryBtnText}>➕ Create Chit Group</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Counters */}
      <View style={mStyles.kpiRow}>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Total Groups</Text>
          <Text style={[mStyles.kpiVal, { color: '#0F2F52' }]}>{groups.length}</Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Active Groups</Text>
          <Text style={[mStyles.kpiVal, { color: '#16A34A' }]}>
            {groups.filter((g) => g.status === 'ACTIVE').length}
          </Text>
        </View>
        <View style={mStyles.kpiCard}>
          <Text style={mStyles.kpiLabel}>Total Scheme Value</Text>
          <Text style={[mStyles.kpiVal, { color: '#0070BA' }]}>
            ₹{groups.reduce((acc, g) => acc + (g.chitValue || g.totalChitValue || 0), 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={[mStyles.filterRow, { alignItems: 'center', gap: 10, marginBottom: 16 }]}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="Search by scheme name or code (e.g. CG-2026, Gold Chit)..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED', 'CLOSED'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[
                {
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: statusFilter === st ? '#0A2540' : '#E2E8F0',
                },
              ]}
              onPress={() => setStatusFilter(st)}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: statusFilter === st ? '#FFF' : '#475569',
                }}
              >
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Group Cards */}
      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ color: '#64748B', fontSize: 15 }}>No chit groups found matching your criteria.</Text>
        </View>
      ) : (
        filtered.map((grp) => {
          const enrolledCount = grp.members?.length ?? grp.memberships?.length ?? grp._count?.members ?? 0;
          const isFull = enrolledCount >= (grp.maxMembers || 20);
          const poolValue = grp.chitValue ?? grp.totalChitValue ?? 0;
          const monthly = grp.monthlyInstallment ?? Math.round(poolValue / (grp.totalMonths || 20));
          const duration = grp.totalMonths ?? grp.durationMonths ?? 20;

          return (
            <View key={grp.id} style={mStyles.card}>
              <View style={mStyles.cardRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={mStyles.cardTitle}>{grp.name}</Text>
                    <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>
                      [{grp.groupCode}]
                    </Text>
                    {grp.branch?.name && (
                      <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>🏛️ {grp.branch.name}</Text>
                      </View>
                    )}
                    <View
                      style={[
                        mStyles.badge,
                        grp.status === 'ACTIVE'
                          ? mStyles.badgeSuccess
                          : grp.status === 'COMPLETED'
                          ? mStyles.badgeInfo
                          : mStyles.badgeNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          mStyles.badgeText,
                          grp.status === 'ACTIVE'
                            ? mStyles.badgeSuccessText
                            : grp.status === 'COMPLETED'
                            ? mStyles.badgeInfoText
                            : mStyles.badgeNeutralText,
                        ]}
                      >
                        {grp.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={mStyles.cardSubtitle}>
                    Chit Value: ₹{poolValue.toLocaleString()} • Monthly: ₹{monthly.toLocaleString()} • Duration: {duration} Months
                  </Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    👥 Enrolled: {enrolledCount} / {grp.maxMembers} Members {isFull ? '(FULL CAPACITY)' : ''} • Start Date: {grp.startDate} • Commission: {grp.foremanCommissionPct ?? grp.foremanCommissionRate ?? 5}%
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Enroll, Schedule, Edit, Delete */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, { paddingVertical: 8, paddingHorizontal: 12 }, isFull && { opacity: 0.5 }]}
                  disabled={isFull}
                  onPress={() => {
                    setSelectedGroup(grp);
                    setTicketNo(String(enrolledCount + 1));
                    setShowEnrollModal(true);
                  }}
                >
                  <Text style={mStyles.primaryBtnText}>👤 Enroll Member</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mStyles.secondaryBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={() => handleOpenSchedule(grp)}
                >
                  <Text style={mStyles.secondaryBtnText}>📅 Schedules</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mStyles.secondaryBtn, { paddingVertical: 8, paddingHorizontal: 12, borderColor: '#0284C7', backgroundColor: '#F0F9FF' }]}
                  onPress={() => handleOpenEdit(grp)}
                >
                  <Text style={[mStyles.secondaryBtnText, { color: '#0369A1', fontWeight: '700' }]}>✏️ Edit Group</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mStyles.dangerBtn, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FEF2F2', borderColor: '#F87171', borderWidth: 1 }]}
                  onPress={() => handleOpenDelete(grp)}
                >
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* --- MODAL 1: CREATE CHIT GROUP --- */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Create New Chit Group</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={mStyles.label}>Group Scheme Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Gold Chit Scheme - Batch A"
                value={groupName}
                onChangeText={setGroupName}
              />

              {branches.length > 0 && (
                <>
                  <Text style={mStyles.label}>Branch Office *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {branches.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: selectedBranchId === b.id ? '#0284C7' : '#CBD5E1',
                          backgroundColor: selectedBranchId === b.id ? '#E0F2FE' : '#FFF',
                        }}
                        onPress={() => setSelectedBranchId(b.id)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: selectedBranchId === b.id ? '#0369A1' : '#334155' }}>
                          {b.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Monthly Installment (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="5000"
                    value={monthlyInstallment}
                    onChangeText={setMonthlyInstallment}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Duration (Months) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="20"
                    value={durationMonths}
                    onChangeText={updateCreateDuration}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Member Capacity *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="20"
                    value={maxMembers}
                    onChangeText={setMaxMembers}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Foreman Commission (%) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="5"
                    value={foremanCommissionRate}
                    onChangeText={setForemanCommissionRate}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={mStyles.label}>Commencement Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={mStyles.input}
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              {/* Auto-calculated pool value summary card */}
              <View
                style={{
                  backgroundColor: '#F0F9FF',
                  borderColor: '#BAE6FD',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '700', textTransform: 'uppercase' }}>
                      Calculated Total Scheme Value
                    </Text>
                    <Text style={{ fontSize: 18, color: '#0284C7', fontWeight: '800', marginTop: 2 }}>
                      ₹{((Number(monthlyInstallment) || 0) * (Number(durationMonths) || 0)).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    ₹{Number(monthlyInstallment || 0).toLocaleString()} × {durationMonths || 0} mos
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowCreateModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateGroup}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={mStyles.primaryBtnText}>✓ Create & Launch Group</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: EDIT CHIT GROUP --- */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>✏️ Edit Chit Group Configuration</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={mStyles.label}>Group Scheme Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Scheme Name"
                value={editGroupName}
                onChangeText={setEditGroupName}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Total Chit Value (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    value={editChitValue}
                    onChangeText={updateEditChitValue}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Duration (Months) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    value={editDurationMonths}
                    onChangeText={updateEditDuration}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Monthly Installment (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    value={editMonthlyInstallment}
                    onChangeText={setEditMonthlyInstallment}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Member Capacity *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    value={editMaxMembers}
                    onChangeText={setEditMaxMembers}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Foreman Commission (%)</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    value={editForemanCommissionRate}
                    onChangeText={setEditForemanCommissionRate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Commencement Date</Text>
                  <TextInput
                    style={mStyles.input}
                    value={editStartDate}
                    onChangeText={setEditStartDate}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Group Status *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['ACTIVE', 'UPCOMING', 'COMPLETED', 'CLOSED'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: editStatus === st ? '#0284C7' : '#CBD5E1',
                      backgroundColor: editStatus === st ? '#E0F2FE' : '#FFF',
                    }}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: editStatus === st ? '#0369A1' : '#475569' }}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowEditModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleUpdateGroup}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={mStyles.primaryBtnText}>✓ Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 3: DELETE CHIT GROUP CONFIRMATION --- */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 480 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={[mStyles.modalTitle, { color: '#DC2626' }]}>🗑️ Delete Chit Group</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {groupToDelete && (
              <View style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: 14, color: '#1E293B', marginBottom: 10, lineHeight: 20 }}>
                  Are you sure you want to delete the chit group{' '}
                  <Text style={{ fontWeight: '800' }}>"{groupToDelete.name}"</Text> (
                  <Text style={{ color: '#0284C7', fontWeight: '700' }}>{groupToDelete.groupCode}</Text>)?
                </Text>
                <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 18 }}>
                    ⚠️ Note: Groups with recorded financial transactions or auctions cannot be deleted to preserve audit compliance.
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowDeleteModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleConfirmDelete}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>Yes, Delete Group</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 4: ENROLL MEMBER (AC-03) --- */}
      <Modal visible={showEnrollModal} transparent animationType="fade" onRequestClose={() => setShowEnrollModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>👤 Enroll Member into Chit Group (AC-03)</Text>
              <TouchableOpacity onPress={() => setShowEnrollModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedGroup && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }}>
                    Group: {selectedGroup.name} ({selectedGroup.groupCode})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    Chit Value: ₹{(selectedGroup.chitValue ?? selectedGroup.totalChitValue)?.toLocaleString()} • Monthly: ₹{(selectedGroup.monthlyInstallment)?.toLocaleString()}
                  </Text>
                </View>

                <Text style={mStyles.label}>Select Eligible Member *</Text>
                <View style={{ maxHeight: 200, marginBottom: 14 }}>
                  <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                    {subscribers.map((sub) => (
                      <TouchableOpacity
                        key={sub.id}
                        style={{
                          padding: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: '#F1F5F9',
                          backgroundColor: selectedSubscriberId === sub.id ? '#E0F2FE' : '#FFF',
                        }}
                        onPress={() => setSelectedSubscriberId(sub.id)}
                      >
                        <Text style={{ fontWeight: selectedSubscriberId === sub.id ? '700' : '400', fontSize: 13, color: '#0F172A' }}>
                          {sub.fullName} [{sub.subscriberCode}] - {sub.phone}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>
                          KYC: {sub.kycStatus}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <Text style={mStyles.label}>Assigned Ticket / Membership Number *</Text>
                <TextInput
                  style={mStyles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 1, 2, 3..."
                  value={ticketNo}
                  onChangeText={setTicketNo}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowEnrollModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleEnrollMember}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.primaryBtnText}>✓ Confirm Enrollment</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 5: INSTALLMENT SCHEDULE (AC-07) --- */}
      <Modal visible={showScheduleModal} transparent animationType="fade" onRequestClose={() => setShowScheduleModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 850 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📅 Installment Schedule & Member Roster (AC-07)</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 30 }} />
            ) : scheduleData ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: '#0F172A' }}>
                    {scheduleData.name} [{scheduleData.groupCode}]
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Chit Value: ₹{(scheduleData.chitValue ?? scheduleData.totalChitValue)?.toLocaleString()} • Monthly Installment: ₹{(scheduleData.monthlyInstallment)?.toLocaleString()} • Duration: {scheduleData.totalMonths ?? scheduleData.durationMonths} Months
                  </Text>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#0F172A' }}>
                  Enrolled Members ({scheduleData.members?.length ?? scheduleData.memberships?.length ?? 0} / {scheduleData.maxMembers})
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { width: 70 }]}>Ticket #</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Member Name</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Code</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Phone</Text>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Prize Status</Text>
                  </View>
                  {(scheduleData.members || scheduleData.memberships)?.map((m: any) => (
                    <View key={m.id} style={mStyles.tableRow}>
                      <Text style={[mStyles.tableCell, { width: 70, fontWeight: '700', color: '#0284C7' }]}>
                        #{m.ticketNumber ?? m.ticketNo}
                      </Text>
                      <Text style={[mStyles.tableCell, { width: 140, fontWeight: '600' }]}>
                        {m.subscriber?.fullName}
                      </Text>
                      <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>
                        {m.subscriber?.subscriberCode}
                      </Text>
                      <Text style={[mStyles.tableCell, { width: 110, fontSize: 12 }]}>
                        {m.subscriber?.phone}
                      </Text>
                      <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12, color: m.isPrized ? '#16A34A' : '#64748B' }]}>
                        {m.isPrized ? `PRIZED (Inst #${m.prizedInstallmentNo})` : 'Non-prized (Active bidder)'}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 8, color: '#0F172A' }}>
                  Completed & Upcoming Auctions
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { width: 60 }]}>Inst #</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Date</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Bid Discount</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Commission</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Dividend / Mem</Text>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Winner</Text>
                  </View>
                  {scheduleData.auctions?.map((a: any) => (
                    <View key={a.id} style={mStyles.tableRow}>
                      <Text style={[mStyles.tableCell, { width: 60, fontWeight: '700' }]}>#{a.installmentNo}</Text>
                      <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>{a.auctionDate}</Text>
                      <Text style={[mStyles.tableCell, { width: 100, color: '#D97706' }]}>₹{a.winningBidDiscount?.toLocaleString()}</Text>
                      <Text style={[mStyles.tableCell, { width: 100, color: '#2563EB' }]}>₹{a.foremanCommission?.toLocaleString()}</Text>
                      <Text style={[mStyles.tableCell, { width: 100, color: '#16A34A', fontWeight: '700' }]}>₹{a.dividendPerSubscriber?.toLocaleString()}</Text>
                      <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>{a.winnerSubscriber?.fullName || a.winningSubscriber?.fullName || 'N/A'}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
