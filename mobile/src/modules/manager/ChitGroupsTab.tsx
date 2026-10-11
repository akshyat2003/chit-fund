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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Create Group Form (AC-05, AC-06)
  const [groupName, setGroupName] = useState('');
  const [chitValue, setChitValue] = useState('100000');
  const [durationMonths, setDurationMonths] = useState('20');
  const [monthlyInstallment, setMonthlyInstallment] = useState('5000');
  const [maxMembers, setMaxMembers] = useState('20');
  const [foremanCommissionRate, setForemanCommissionRate] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Enroll Member Form (AC-03)
  const [selectedSubscriberId, setSelectedSubscriberId] = useState('');
  const [ticketNo, setTicketNo] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const [gRes, sRes] = await Promise.all([
        api.get('/chit-groups'),
        api.get('/subscribers'),
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // AC-05: Create Chit Group
  const handleCreateGroup = async () => {
    if (!groupName.trim() || !chitValue || !durationMonths || !monthlyInstallment) {
      alert('Please fill all mandatory group configuration fields');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/chit-groups', {
        name: groupName.trim(),
        totalChitValue: Number(chitValue),
        durationMonths: Number(durationMonths),
        monthlyInstallment: Number(monthlyInstallment),
        maxMembers: Number(maxMembers),
        foremanCommissionRate: Number(foremanCommissionRate),
        startDate,
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
        alert(`Member successfully enrolled with Ticket #${res.data.data.ticketNo}`);
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

  const filtered = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.groupCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>💰 Chit Groups & Scheme Management</Text>
          <Text style={mStyles.headerSubtitle}>
            AC-03 Member Enrollment, AC-05 Group Creation, AC-06 Configuration & AC-07 Installment Schedules
          </Text>
        </View>
        <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={mStyles.primaryBtnText}>➕ Create Chit Group (AC-05)</Text>
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
            ₹{groups.reduce((acc, g) => acc + (g.totalChitValue || 0), 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={mStyles.filterRow}>
        <TextInput
          style={mStyles.searchBar}
          placeholder="Search by group name or code (e.g. GRP-2026-001)..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Group Cards */}
      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Text style={{ color: '#64748B', fontSize: 15 }}>No chit groups found.</Text>
        </View>
      ) : (
        filtered.map((grp) => {
          const enrolledCount = grp.memberships?.length || grp._count?.memberships || 0;
          const isFull = enrolledCount >= grp.maxMembers;
          return (
            <View key={grp.id} style={mStyles.card}>
              <View style={mStyles.cardRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={mStyles.cardTitle}>{grp.name}</Text>
                    <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>
                      [{grp.groupCode}]
                    </Text>
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
                    Chit Value: ₹{(grp.totalChitValue || 0).toLocaleString()} • Monthly: ₹{(grp.monthlyInstallment || 0).toLocaleString()} • Duration: {grp.durationMonths} Months
                  </Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    👥 Enrolled: {enrolledCount} / {grp.maxMembers} Members {isFull ? '(FULL CAPACITY)' : ''} • Current Installment: #{grp.currentInstallmentNo || 1} • Foreman Commission: {grp.foremanCommissionRate || 5}%
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[mStyles.secondaryBtn, isFull && { opacity: 0.5 }]}
                  disabled={isFull}
                  onPress={() => {
                    setSelectedGroup(grp);
                    setTicketNo(String(enrolledCount + 1));
                    setShowEnrollModal(true);
                  }}
                >
                  <Text style={mStyles.secondaryBtnText}>👤 Enroll Member (AC-03)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={mStyles.secondaryBtn}
                  onPress={() => handleOpenSchedule(grp)}
                >
                  <Text style={mStyles.secondaryBtnText}>📅 Installment Schedule (AC-07)</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* --- MODAL 1: CREATE CHIT GROUP (AC-05, AC-06) --- */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Create Chit Group (AC-05, AC-06)</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={mStyles.label}>Group Scheme Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Gold Chit Scheme - Batch A"
                value={groupName}
                onChangeText={setGroupName}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Total Chit Value (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="100000"
                    value={chitValue}
                    onChangeText={setChitValue}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Duration (Months) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="20"
                    value={durationMonths}
                    onChangeText={setDurationMonths}
                  />
                </View>
              </View>

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
                  <Text style={mStyles.label}>Member Capacity *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="20"
                    value={maxMembers}
                    onChangeText={setMaxMembers}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
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
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Commencement Date</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
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

      {/* --- MODAL 2: ENROLL MEMBER (AC-03) --- */}
      <Modal visible={showEnrollModal} transparent animationType="fade">
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
                    Chit Value: ₹{selectedGroup.totalChitValue?.toLocaleString()} • Monthly: ₹{selectedGroup.monthlyInstallment?.toLocaleString()}
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

      {/* --- MODAL 3: INSTALLMENT SCHEDULE (AC-07) --- */}
      <Modal visible={showScheduleModal} transparent animationType="fade">
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
                    Chit Value: ₹{scheduleData.totalChitValue?.toLocaleString()} • Monthly Installment: ₹{scheduleData.monthlyInstallment?.toLocaleString()} • Duration: {scheduleData.durationMonths} Months
                  </Text>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#0F172A' }}>
                  Enrolled Members ({scheduleData.memberships?.length || 0} / {scheduleData.maxMembers})
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { width: 70 }]}>Ticket #</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Member Name</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Code</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Phone</Text>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Prize Status</Text>
                  </View>
                  {scheduleData.memberships?.map((m: any) => (
                    <View key={m.id} style={mStyles.tableRow}>
                      <Text style={[mStyles.tableCell, { width: 70, fontWeight: '700', color: '#0284C7' }]}>
                        #{m.ticketNo}
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
                      <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>{a.winningSubscriber?.fullName || 'N/A'}</Text>
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
