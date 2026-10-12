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
  const isManagerOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
  const isStaff = user?.role === 'COLLECTION_STAFF';
  const [assignmentScope, setAssignmentScope] = useState<'ALL' | 'ASSIGNED_TO_ME'>(isStaff ? 'ASSIGNED_TO_ME' : 'ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupToDelete, setGroupToDelete] = useState<any>(null);
  const [assignGroup, setAssignGroup] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Available staff members for assignment
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [createStaffIds, setCreateStaffIds] = useState<string[]>([]);
  const [editStaffIds, setEditStaffIds] = useState<string[]>([]);
  const [modalStaffIds, setModalStaffIds] = useState<string[]>([]);

  // Quick Member Registration state inside Enroll Modal
  const [isQuickRegistering, setIsQuickRegistering] = useState(false);
  const [quickFullName, setQuickFullName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickAadhaar, setQuickAadhaar] = useState('');
  const [quickPan, setQuickPan] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [quickRegistering, setQuickRegistering] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Create Group Form (AC-05, AC-06)
  const actualToday = new Date().toISOString().split('T')[0];
  const [groupName, setGroupName] = useState('');
  const [durationMonths, setDurationMonths] = useState('20');
  const [monthlyInstallment, setMonthlyInstallment] = useState('5000');
  const [maxMembers, setMaxMembers] = useState('20');
  const [foremanCommissionRate, setForemanCommissionRate] = useState('5');
  const [startDate] = useState(actualToday); // Actual date, fixed and cannot be changed
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
      const [gRes, sRes, bRes, staffRes] = await Promise.all([
        api.get('/chit-groups'),
        api.get('/subscribers'),
        api.get('/branches').catch(() => ({ data: { data: [] } })),
        api.get('/auth/users?role=COLLECTION_STAFF').catch(() => ({ data: { data: [] } })),
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
      if (staffRes.data.success) {
        setStaffMembers(staffRes.data.data || []);
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

  // AC-05: Create Chit Group (commencement date locked to actual date)
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
        startDate: actualToday, // Fixed to current actual date - cannot be changed
        branchId: selectedBranchId || branches[0]?.id || user.branchId || undefined,
        assignedStaffIds: createStaffIds,
        assignedStaffId: createStaffIds[0] || null,
      });

      if (res.data.success) {
        alert('Chit group created successfully: ' + res.data.data.name);
        setShowCreateModal(false);
        setGroupName('');
        setCreateStaffIds([]);
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
    setEditStartDate(grp.startDate || actualToday);
    setEditStatus(grp.status || 'ACTIVE');
    setEditBranchId(grp.branchId || branches[0]?.id || '');

    // Collect currently assigned staff IDs
    const assignedIds: string[] = [];
    if (grp.staffAssignments && Array.isArray(grp.staffAssignments)) {
      grp.staffAssignments.forEach((sa: any) => {
        if (sa.staffId && !assignedIds.includes(sa.staffId)) assignedIds.push(sa.staffId);
        else if (sa.staff?.id && !assignedIds.includes(sa.staff.id)) assignedIds.push(sa.staff.id);
      });
    }
    if (grp.assignedStaffId && !assignedIds.includes(grp.assignedStaffId)) {
      assignedIds.push(grp.assignedStaffId);
    }
    setEditStaffIds(assignedIds);
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
        status: editStatus,
        branchId: editBranchId || undefined,
        assignedStaffIds: editStaffIds,
        assignedStaffId: editStaffIds[0] || null,
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

  // Open Quick Staff Assignment Modal
  const handleOpenAssignStaff = (grp: any) => {
    setAssignGroup(grp);
    const assignedIds: string[] = [];
    if (grp.staffAssignments && Array.isArray(grp.staffAssignments)) {
      grp.staffAssignments.forEach((sa: any) => {
        if (sa.staffId && !assignedIds.includes(sa.staffId)) assignedIds.push(sa.staffId);
        else if (sa.staff?.id && !assignedIds.includes(sa.staff.id)) assignedIds.push(sa.staff.id);
      });
    }
    if (grp.assignedStaffId && !assignedIds.includes(grp.assignedStaffId)) {
      assignedIds.push(grp.assignedStaffId);
    }
    setModalStaffIds(assignedIds);
    setShowAssignModal(true);
  };

  // Save Staff Assignments for Group
  const handleSaveAssignStaff = async () => {
    if (!assignGroup) return;
    try {
      setAssigning(true);
      const res = await api.post(`/chit-groups/${assignGroup.id}/assign-staff`, {
        staffIds: modalStaffIds,
      });
      if (res.data.success) {
        alert(res.data.message || `Staff assignment updated successfully for group "${assignGroup.name}".`);
        setShowAssignModal(false);
        setAssignGroup(null);
        fetchGroups();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to assign staff to chit group');
    } finally {
      setAssigning(false);
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

  const isGroupAssignedToUser = (grp: any) => {
    if (!user?.id) return false;
    if (grp.assignedStaffId === user.id) return true;
    if (grp.staffAssignments && Array.isArray(grp.staffAssignments)) {
      return grp.staffAssignments.some((sa: any) => sa.staffId === user.id || sa.staff?.id === user.id);
    }
    return false;
  };

  const handleQuickRegisterAndEnroll = async () => {
    if (!selectedGroup) return;
    setQuickError('');
    if (!quickFullName.trim() || !quickPhone.trim()) {
      setQuickError('Full Name and Phone Number are required.');
      return;
    }
    try {
      setQuickRegistering(true);
      // 1. Create Subscriber
      const subRes = await api.post('/subscribers', {
        fullName: quickFullName.trim(),
        phone: quickPhone.trim(),
        address: quickAddress.trim() || undefined,
        aadhaarNo: quickAadhaar.trim() || undefined,
        panNo: quickPan.trim().toUpperCase() || undefined,
        branchId: selectedGroup.branchId || branches[0]?.id || user.branchId || undefined,
      });

      const newSubscriber = subRes.data?.data;
      if (!newSubscriber?.id) {
        throw new Error('Could not retrieve created member record');
      }

      // 2. Enroll Subscriber into the Chit Group
      await api.post('/chit-groups/enroll', {
        groupId: selectedGroup.id,
        subscriberId: newSubscriber.id,
        ticketNo: ticketNo ? Number(ticketNo) : undefined,
      });

      alert(`Member "${newSubscriber.fullName}" (${newSubscriber.subscriberCode}) registered and enrolled into group "${selectedGroup.name}"!`);
      setShowEnrollModal(false);
      setIsQuickRegistering(false);
      setQuickFullName('');
      setQuickPhone('');
      setQuickAadhaar('');
      setQuickPan('');
      setQuickAddress('');
      fetchGroups();
    } catch (e: any) {
      setQuickError(e.response?.data?.message || e.message || 'Failed to register and enroll member');
    } finally {
      setQuickRegistering(false);
    }
  };

  const filtered = groups.filter((g) => {
    const matchesSearch =
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.groupCode?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter;
    const matchesScope = assignmentScope === 'ALL' || isGroupAssignedToUser(g);
    return matchesSearch && matchesStatus && matchesScope;
  });

  const myAssignedCount = groups.filter(isGroupAssignedToUser).length;

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={mStyles.headerTitle}>
            {isStaff ? '💰 Assigned Chit Groups & Schemes' : '💰 Chit Groups & Scheme Management'}
          </Text>
          <Text style={mStyles.headerSubtitle}>
            {isStaff
              ? 'View your assigned chit groups, inspect member rosters, check schedules, and enroll new members'
              : 'Create schemes, edit configuration parameters, enroll members, assign staff, and manage installment schedules'}
          </Text>
        </View>
        {isManagerOrAdmin && (
          <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={mStyles.primaryBtnText}>➕ Create Chit Group</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Staff Assignment Scope Pills (if Collection Staff or Manager wants to toggle) */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <TouchableOpacity
          style={[
            {
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: assignmentScope === 'ASSIGNED_TO_ME' ? '#0284C7' : '#E2E8F0',
            },
          ]}
          onPress={() => setAssignmentScope('ASSIGNED_TO_ME')}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: assignmentScope === 'ASSIGNED_TO_ME' ? '#FFF' : '#334155',
            }}
          >
            🏃 Assigned to Me ({myAssignedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            {
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: assignmentScope === 'ALL' ? '#0F2F52' : '#E2E8F0',
            },
          ]}
          onPress={() => setAssignmentScope('ALL')}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: assignmentScope === 'ALL' ? '#FFF' : '#334155',
            }}
          >
            🌐 All Groups ({groups.length})
          </Text>
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
                    {isGroupAssignedToUser(grp) && (
                      <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#86EFAC' }}>
                        <Text style={{ fontSize: 11, color: '#166534', fontWeight: '800' }}>⭐ Assigned to You</Text>
                      </View>
                    )}
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
                    👥 Enrolled: {enrolledCount} / {grp.maxMembers} Members {isFull ? '(FULL CAPACITY)' : ''} • 🔒 Commencement Date: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{grp.startDate}</Text> (Fixed) • Commission: {grp.foremanCommissionPct ?? grp.foremanCommissionRate ?? 5}%
                  </Text>

                  {/* Assigned Collection Staff Display */}
                  {(() => {
                    const assignedList: any[] = [];
                    if (grp.staffAssignments && Array.isArray(grp.staffAssignments)) {
                      grp.staffAssignments.forEach((sa: any) => {
                        if (sa.staff && !assignedList.some((s) => s.id === sa.staff.id)) {
                          assignedList.push(sa.staff);
                        }
                      });
                    }
                    if (grp.assignedStaff && !assignedList.some((s) => s.id === grp.assignedStaff.id)) {
                      assignedList.push(grp.assignedStaff);
                    }

                    return (
                      <View style={{ marginTop: 8, padding: 8, backgroundColor: '#F0F9FF', borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#0369A1' }}>
                            🏃 Assigned Staff ({assignedList.length}):
                          </Text>
                          <Text style={{ fontSize: 10, color: '#0284C7' }}>
                            (Multi-group assignment enabled)
                          </Text>
                        </View>
                        {assignedList.length === 0 ? (
                          <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>⚠️ No staff currently assigned. Click "👥 Assign Staff" below to assign.</Text>
                        ) : (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {assignedList.map((stf: any) => (
                              <View key={stf.id} style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1' }}>
                                  👤 {stf.fullName || stf.username} (@{stf.username})
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Action Buttons: Enroll (Staff & Manager), Schedule (Both), Manager Only (Assign Staff, Edit, Delete) */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, { paddingVertical: 8, paddingHorizontal: 12 }, isFull && { opacity: 0.5 }]}
                  disabled={isFull}
                  onPress={() => {
                    setSelectedGroup(grp);
                    setTicketNo(String(enrolledCount + 1));
                    setIsQuickRegistering(false);
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

                {isManagerOrAdmin && (
                  <>
                    <TouchableOpacity
                      style={[mStyles.secondaryBtn, { paddingVertical: 8, paddingHorizontal: 12, borderColor: '#0284C7', backgroundColor: '#F0F9FF' }]}
                      onPress={() => handleOpenAssignStaff(grp)}
                    >
                      <Text style={[mStyles.secondaryBtnText, { color: '#0369A1', fontWeight: '700' }]}>👥 Assign Staff</Text>
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
                  </>
                )}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={mStyles.label}>Commencement Date (Actual Date) *</Text>
                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>🔒 FIXED TO ACTUAL DATE</Text>
                  </View>
                </View>
                <View style={[mStyles.input, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', justifyContent: 'center' }]}>
                  <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 14 }}>
                    📅 {actualToday}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  The commencement date is automatically locked to the actual inception date ({actualToday}) and cannot be changed.
                </Text>
              </View>

              {/* Staff Assignment on Create */}
              <View style={{ marginBottom: 14 }}>
                <Text style={mStyles.label}>Assign Staff to this Chit Group</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                  Select one or more collection staff. A single staff member can manage multiple chit groups.
                </Text>
                {staffMembers.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No staff members available. You can assign staff later.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {staffMembers.map((stf) => {
                      const isSelected = createStaffIds.includes(stf.id);
                      return (
                        <TouchableOpacity
                          key={stf.id}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isSelected ? '#0284C7' : '#CBD5E1',
                            backgroundColor: isSelected ? '#E0F2FE' : '#FFF',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onPress={() => {
                            setCreateStaffIds((prev) =>
                              prev.includes(stf.id) ? prev.filter((id) => id !== stf.id) : [...prev, stf.id]
                            );
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#0369A1' : '#475569' }}>
                            {isSelected ? '✓ ' : '+ '} {stf.fullName || stf.username} (@{stf.username})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={mStyles.label}>Commencement Date</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>🔒 FIXED</Text>
                  </View>
                  <View style={[mStyles.input, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', justifyContent: 'center' }]}>
                    <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>
                      📅 {editStartDate || actualToday} (Cannot be changed)
                    </Text>
                  </View>
                </View>
              </View>

              {/* Staff Assignment on Edit */}
              <View style={{ marginBottom: 14 }}>
                <Text style={mStyles.label}>Assigned Staff Members</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                  Select staff members to handle collections for this group (single staff can be assigned to multiple groups).
                </Text>
                {staffMembers.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No staff members available.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {staffMembers.map((stf) => {
                      const isSelected = editStaffIds.includes(stf.id);
                      return (
                        <TouchableOpacity
                          key={stf.id}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isSelected ? '#0284C7' : '#CBD5E1',
                            backgroundColor: isSelected ? '#E0F2FE' : '#FFF',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onPress={() => {
                            setEditStaffIds((prev) =>
                              prev.includes(stf.id) ? prev.filter((id) => id !== stf.id) : [...prev, stf.id]
                            );
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#0369A1' : '#475569' }}>
                            {isSelected ? '✓ ' : '+ '} {stf.fullName || stf.username} (@{stf.username})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
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
                    Chit Value: ₹{(selectedGroup.chitValue ?? selectedGroup.totalChitValue)?.toLocaleString()} • Monthly: ₹{(selectedGroup.monthlyInstallment)?.toLocaleString()} • Enrolled: {(selectedGroup.members?.length ?? selectedGroup.memberships?.length ?? 0)} / {selectedGroup.maxMembers}
                  </Text>
                </View>

                {/* Mode Selector: Choose Existing vs Quick Register New */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 8,
                      alignItems: 'center',
                      backgroundColor: !isQuickRegistering ? '#0284C7' : '#F1F5F9',
                    }}
                    onPress={() => setIsQuickRegistering(false)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: !isQuickRegistering ? '#FFF' : '#475569' }}>
                      👤 Select Member
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 8,
                      alignItems: 'center',
                      backgroundColor: isQuickRegistering ? '#0284C7' : '#F1F5F9',
                    }}
                    onPress={() => setIsQuickRegistering(true)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isQuickRegistering ? '#FFF' : '#475569' }}>
                      ➕ Register & Enroll
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isQuickRegistering ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={mStyles.label}>Select Registered Member *</Text>
                      <Text style={{ fontSize: 11, color: '#0284C7', fontStyle: 'italic' }}>
                        (Members can join multiple chit groups)
                      </Text>
                    </View>

                    <View style={{ maxHeight: 220, marginBottom: 14 }}>
                      <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                        {subscribers.map((sub) => {
                          const isAlreadyEnrolled =
                            selectedGroup.members?.some((m: any) => m.subscriberId === sub.id) ||
                            selectedGroup.memberships?.some((m: any) => m.subscriberId === sub.id);
                          const isSelected = selectedSubscriberId === sub.id;

                          return (
                            <TouchableOpacity
                              key={sub.id}
                              disabled={isAlreadyEnrolled}
                              style={{
                                padding: 10,
                                borderBottomWidth: 1,
                                borderBottomColor: '#F1F5F9',
                                backgroundColor: isAlreadyEnrolled ? '#F8FAFC' : isSelected ? '#E0F2FE' : '#FFF',
                                opacity: isAlreadyEnrolled ? 0.6 : 1,
                              }}
                              onPress={() => !isAlreadyEnrolled && setSelectedSubscriberId(sub.id)}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontWeight: isSelected ? '700' : '500', fontSize: 13, color: isAlreadyEnrolled ? '#94A3B8' : '#0F172A' }}>
                                  {sub.fullName} [{sub.subscriberCode}]
                                </Text>
                                {isAlreadyEnrolled ? (
                                  <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>ALREADY ENROLLED</Text>
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>
                                    {sub.memberships?.length ? `In ${sub.memberships.length} other group(s)` : 'Available'}
                                  </Text>
                                )}
                              </View>
                              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                📱 {sub.phone} {sub.address ? `• 📍 ${sub.address}` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
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

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
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
                  </>
                ) : (
                  <>
                    {quickError ? (
                      <View style={{ backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 12 }}>
                        <Text style={{ fontSize: 12, color: '#B91C1C', fontWeight: '600' }}>⚠️ {quickError}</Text>
                      </View>
                    ) : null}

                    <Text style={mStyles.label}>Full Legal Name *</Text>
                    <TextInput
                      style={mStyles.input}
                      placeholder="e.g. Anand Verma"
                      value={quickFullName}
                      onChangeText={setQuickFullName}
                    />

                    <Text style={mStyles.label}>Mobile Phone Number *</Text>
                    <TextInput
                      style={mStyles.input}
                      keyboardType="phone-pad"
                      placeholder="10-digit mobile number"
                      value={quickPhone}
                      onChangeText={setQuickPhone}
                    />

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={mStyles.label}>Aadhaar Card No</Text>
                        <TextInput
                          style={mStyles.input}
                          keyboardType="numeric"
                          placeholder="12-digit Aadhaar"
                          value={quickAadhaar}
                          onChangeText={setQuickAadhaar}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={mStyles.label}>PAN Card No</Text>
                        <TextInput
                          style={mStyles.input}
                          autoCapitalize="characters"
                          placeholder="10-char PAN"
                          value={quickPan}
                          onChangeText={(t) => setQuickPan(t.toUpperCase())}
                        />
                      </View>
                    </View>

                    <Text style={mStyles.label}>Residential Address</Text>
                    <TextInput
                      style={mStyles.input}
                      placeholder="House / Street, City, State, PIN"
                      value={quickAddress}
                      onChangeText={setQuickAddress}
                    />

                    <Text style={mStyles.label}>Assigned Ticket / Membership Number</Text>
                    <TextInput
                      style={mStyles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 1, 2, 3..."
                      value={ticketNo}
                      onChangeText={setTicketNo}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                      <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowEnrollModal(false)}>
                        <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[mStyles.primaryBtn, quickRegistering && { opacity: 0.7 }]}
                        disabled={quickRegistering}
                        onPress={handleQuickRegisterAndEnroll}
                      >
                        {quickRegistering ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={mStyles.primaryBtnText}>✓ Register & Enroll</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
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

      {/* --- MODAL 6: QUICK ASSIGN STAFF TO CHIT GROUP --- */}
      <Modal visible={showAssignModal} transparent animationType="fade" onRequestClose={() => setShowAssignModal(false)}>
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 540 }]}>
            <View style={mStyles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={mStyles.modalTitle}>👥 Assign Staff to Chit Group</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {assignGroup && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#F0F9FF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 14 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: '#0369A1' }}>
                    {assignGroup.name} [{assignGroup.groupCode}]
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Chit Value: ₹{(assignGroup.chitValue ?? assignGroup.totalChitValue)?.toLocaleString()} • Commencement: {assignGroup.startDate} (Fixed)
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                  Select Staff Members ({modalStaffIds.length} Selected)
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  Click on staff names to assign or remove. Note: A single staff member can be assigned to multiple chit groups simultaneously.
                </Text>

                {staffMembers.length === 0 ? (
                  <View style={{ padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#64748B', fontSize: 13 }}>No staff accounts registered yet. Create staff from the Staff tab first.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginBottom: 18 }}>
                    {staffMembers.map((stf) => {
                      const isAssigned = modalStaffIds.includes(stf.id);
                      return (
                        <TouchableOpacity
                          key={stf.id}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isAssigned ? '#0284C7' : '#E2E8F0',
                            backgroundColor: isAssigned ? '#F0F9FF' : '#FFF',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            setModalStaffIds((prev) =>
                              prev.includes(stf.id) ? prev.filter((id) => id !== stf.id) : [...prev, stf.id]
                            );
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: isAssigned ? '#0369A1' : '#0F172A' }}>
                              {stf.fullName || stf.username}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>
                              @{stf.username} • 📱 {stf.phone || '-'}
                            </Text>
                            {stf.address ? (
                              <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }} numberOfLines={1}>
                                🏠 {stf.address}
                              </Text>
                            ) : null}
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 20,
                              backgroundColor: isAssigned ? '#0284C7' : '#F1F5F9',
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isAssigned ? '#FFF' : '#64748B' }}>
                              {isAssigned ? '✓ Assigned' : '+ Assign'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAssignModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, assigning && { opacity: 0.7 }]}
                    disabled={assigning}
                    onPress={handleSaveAssignStaff}
                  >
                    {assigning ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.primaryBtnText}>✓ Save Assignments</Text>
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
