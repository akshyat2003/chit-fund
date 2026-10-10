import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { api } from './src/services/api';

// --- MAIN APP CONTROLLER ---
function MainApp() {
  const { user, token, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subscribers' | 'groups' | 'payments' | 'auctions' | 'reconciliation'>('dashboard');

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2540" />
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>APEX CHIT FUNDS</Text>
          <Text style={styles.headerSubtitle}>
            {user.role.replace('_', ' ')} | {user.fullName}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Role Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'subscribers' && styles.navItemActive]}
          onPress={() => setActiveTab('subscribers')}
        >
          <Text style={[styles.navText, activeTab === 'subscribers' && styles.navTextActive]}>Subscribers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'groups' && styles.navItemActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.navText, activeTab === 'groups' && styles.navTextActive]}>Chit Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'payments' && styles.navItemActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.navText, activeTab === 'payments' && styles.navTextActive]}>Collect</Text>
        </TouchableOpacity>

        {user.role !== 'COLLECTION_STAFF' && (
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'auctions' && styles.navItemActive]}
            onPress={() => setActiveTab('auctions')}
          >
            <Text style={[styles.navText, activeTab === 'auctions' && styles.navTextActive]}>Auctions</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'reconciliation' && styles.navItemActive]}
          onPress={() => setActiveTab('reconciliation')}
        >
          <Text style={[styles.navText, activeTab === 'reconciliation' && styles.navTextActive]}>Cash</Text>
        </TouchableOpacity>
      </View>

      {/* Active Tab Screen Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && <DashboardTab user={user} />}
        {activeTab === 'subscribers' && <SubscribersTab user={user} />}
        {activeTab === 'groups' && <ChitGroupsTab user={user} />}
        {activeTab === 'payments' && <CollectPaymentTab user={user} />}
        {activeTab === 'auctions' && <AuctionsTab user={user} />}
        {activeTab === 'reconciliation' && <ReconciliationTab user={user} />}
      </View>
    </SafeAreaView>
  );
}

// --- 1. LOGIN SCREEN ---
function LoginView({ onLogin }: { onLogin: (u: string, p: string) => Promise<any> }) {
  const [username, setUsername] = useState('manager1');
  const [password, setPassword] = useState('manager123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (usr: string, pwd: string) => {
    setError('');
    setLoading(true);
    const res = await onLogin(usr, pwd);
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Login failed');
    }
  };

  return (
    <SafeAreaView style={styles.loginContainer}>
      <View style={styles.loginCard}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>₹ APEX</Text>
        </View>
        <Text style={styles.loginTitle}>Chit Fund Platform</Text>
        <Text style={styles.loginSub}>Enterprise Chit Management System</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Username or Phone</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. manager1 or staff1"
          placeholderTextColor="#999"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => handleLogin(username, password)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>SIGN IN TO DASHBOARD</Text>
          )}
        </TouchableOpacity>

        {/* Demo Quick Logins */}
        <View style={styles.quickLoginBox}>
          <Text style={styles.quickTitle}>Quick Demo Switcher:</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBadge}
              onPress={() => { setUsername('superadmin'); setPassword('admin123'); handleLogin('superadmin', 'admin123'); }}
            >
              <Text style={styles.quickText}>Super Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBadge}
              onPress={() => { setUsername('manager1'); setPassword('manager123'); handleLogin('manager1', 'manager123'); }}
            >
              <Text style={styles.quickText}>Manager</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBadge}
              onPress={() => { setUsername('staff1'); setPassword('staff123'); handleLogin('staff1', 'staff123'); }}
            >
              <Text style={styles.quickText}>Field Staff</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// --- 2. DASHBOARD TAB ---
function DashboardTab({ user }: { user: any }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      setStats(res.data.data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#0A2540" />;
  }

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>System Overview ({stats?.role})</Text>

      {stats?.role === 'SUPER_ADMIN' && (
        <View style={styles.gridRow}>
          <MetricCard title="Active Companies" value={stats.activeCompanies} color="#0070BA" />
          <MetricCard title="Active Branches" value={stats.activeBranches} color="#27AE60" />
          <MetricCard title="Total Subscribers" value={stats.totalSubscribers} color="#8E44AD" />
          <MetricCard title="System Health" value={stats.systemStatus} color="#2D3748" />
        </View>
      )}

      {stats?.role === 'MANAGER' && (
        <View style={styles.gridRow}>
          <MetricCard title="Today's Total" value={`₹${stats.todayTotalCollected.toLocaleString()}`} color="#27AE60" />
          <MetricCard title="Cash Collected" value={`₹${stats.todayCashCollected.toLocaleString()}`} color="#0070BA" />
          <MetricCard title="Bank/UPI Payments" value={`₹${stats.todayBankUpiCollected.toLocaleString()}`} color="#D35400" />
          <MetricCard title="Active Chit Groups" value={stats.activeGroups} color="#8E44AD" />
          <MetricCard title="Active Subscribers" value={stats.activeSubscribers} color="#2D3748" />
          <MetricCard title="Pending Payouts" value={stats.pendingPayouts} color="#C0392B" />
        </View>
      )}

      {stats?.role === 'COLLECTION_STAFF' && (
        <View style={styles.gridRow}>
          <MetricCard title="Assigned Subscribers" value={stats.assignedSubscribers} color="#0070BA" />
          <MetricCard title="Today's Collections" value={stats.todayCollectionsCount} color="#8E44AD" />
          <MetricCard title="Total Amount" value={`₹${stats.todayAmountCollected.toLocaleString()}`} color="#27AE60" />
          <MetricCard title="Cash in Hand" value={`₹${stats.cashInHand.toLocaleString()}`} color="#D35400" />
        </View>
      )}
    </ScrollView>
  );
}

function MetricCard({ title, value, color }: { title: string; value: any; color: string }) {
  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 5 }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </View>
  );
}

// --- 3. SUBSCRIBERS TAB ---
function SubscribersTab({ user }: { user: any }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscribers();
  }, [search]);

  const loadSubscribers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/subscribers?search=${search}`);
      setSubscribers(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.tabContainer}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search subscriber by name, code or phone..."
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator size="small" color="#0A2540" />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {subscribers.map((s) => (
            <View key={s.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemHeader}>{s.fullName} ({s.subscriberCode})</Text>
                <Text style={styles.itemSub}>Phone: {s.phone} | KYC: {s.kycStatus}</Text>
                <Text style={styles.itemSub}>Branch: {s.branch.name}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{s.status}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// --- 4. CHIT GROUPS TAB ---
function ChitGroupsTab({ user }: { user: any }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/chit-groups');
      setGroups(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Active Chit Groups</Text>
      {groups.map((g) => (
        <View key={g.id} style={styles.groupCard}>
          <Text style={styles.groupCode}>{g.groupCode}</Text>
          <Text style={styles.groupName}>{g.name}</Text>
          <View style={styles.groupGrid}>
            <Text style={styles.groupStat}>Chit Value: ₹{g.chitValue.toLocaleString()}</Text>
            <Text style={styles.groupStat}>Monthly Dues: ₹{g.monthlyInstallment.toLocaleString()}</Text>
            <Text style={styles.groupStat}>Members: {g.members.length} / {g.maxMembers}</Text>
            <Text style={styles.groupStat}>Duration: {g.totalMonths} Months</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// --- 5. COLLECT PAYMENT TAB ---
function CollectPaymentTab({ user }: { user: any }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [installmentNo, setInstallmentNo] = useState('1');
  const [amount, setAmount] = useState('25000');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [externalRef, setExternalRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    const sRes = await api.get('/subscribers');
    const gRes = await api.get('/chit-groups');
    setSubscribers(sRes.data.data);
    setGroups(gRes.data.data);
    if (sRes.data.data.length > 0) setSelectedSub(sRes.data.data[0].id);
    if (gRes.data.data.length > 0) setSelectedGroup(gRes.data.data[0].id);
  };

  const handleRecordPayment = async () => {
    if (!selectedSub || !selectedGroup || !amount) {
      alert('Please fill all payment fields');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/collections/pay', {
        subscriberId: selectedSub,
        groupId: selectedGroup,
        installmentNo: Number(installmentNo),
        amount: Number(amount),
        paymentMode,
        externalRef,
        idempotencyKey: `TXN-${Date.now()}`,
      });

      setReceipt(res.data.data);
      alert(`Receipt ${res.data.data.receiptNo} generated successfully!`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Record Field Payment & Issue Receipt</Text>

      <Text style={styles.label}>Select Subscriber</Text>
      <View style={styles.pickerBox}>
        {subscribers.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.pickerItem, selectedSub === s.id && styles.pickerItemActive]}
            onPress={() => setSelectedSub(s.id)}
          >
            <Text style={selectedSub === s.id ? styles.pickerTextActive : styles.pickerText}>
              {s.fullName} ({s.subscriberCode})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Installment Month Number</Text>
      <TextInput
        style={styles.input}
        value={installmentNo}
        onChangeText={setInstallmentNo}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Amount Received (₹)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Payment Method</Text>
      <View style={styles.quickRow}>
        {['CASH', 'UPI', 'BANK_TRANSFER'].map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeBtn, paymentMode === mode && styles.modeBtnActive]}
            onPress={() => setPaymentMode(mode)}
          >
            <Text style={paymentMode === mode ? styles.modeTextActive : styles.modeText}>{mode}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {paymentMode !== 'CASH' && (
        <>
          <Text style={styles.label}>UPI / Bank Reference Transaction ID</Text>
          <TextInput
            style={styles.input}
            value={externalRef}
            onChangeText={setExternalRef}
            placeholder="e.g. UPI/123456789/ICICI"
          />
        </>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={handleRecordPayment} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>RECORD PAYMENT & ISSUE RECEIPT</Text>}
      </TouchableOpacity>

      {receipt && (
        <View style={styles.receiptBox}>
          <Text style={styles.receiptTitle}>OFFICIAL RECEIPT: {receipt.receiptNo}</Text>
          <Text style={styles.receiptSub}>Subscriber: {receipt.subscriberName}</Text>
          <Text style={styles.receiptSub}>Amount Paid: ₹{receipt.amount}</Text>
          <Text style={styles.receiptSub}>Mode: {receipt.paymentMode}</Text>
          <Text style={styles.receiptSub}>Status: {receipt.verificationStatus}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// --- 6. AUCTIONS TAB ---
function AuctionsTab({ user }: { user: any }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [winnerSub, setWinnerSub] = useState('');
  const [installmentNo, setInstallmentNo] = useState('1');
  const [winningDiscount, setWinningDiscount] = useState('50000');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const gRes = await api.get('/chit-groups');
    const sRes = await api.get('/subscribers');
    setGroups(gRes.data.data);
    setSubscribers(sRes.data.data);
    if (gRes.data.data.length > 0) setSelectedGroup(gRes.data.data[0].id);
    if (sRes.data.data.length > 0) setWinnerSub(sRes.data.data[0].id);
  };

  const handleConfirmAuction = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auctions/confirm', {
        groupId: selectedGroup,
        installmentNo: Number(installmentNo),
        auctionDate: new Date().toISOString().split('T')[0],
        winningBidDiscount: Number(winningDiscount),
        winnerSubscriberId: winnerSub,
      });

      alert(
        `Auction Confirmed!\nForeman Commission: ₹${res.data.data.foremanCommission}\nDividend Per Member: ₹${res.data.data.dividendPerMember}`
      );
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to confirm auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Record Monthly Auction & Dividend</Text>

      <Text style={styles.label}>Winning Bid Discount Offered (₹)</Text>
      <TextInput
        style={styles.input}
        value={winningDiscount}
        onChangeText={setWinningDiscount}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmAuction} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>CONFIRM WINNING BID & AUTO-CALCULATE DIVIDENDS</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- 7. RECONCILIATION TAB ---
function ReconciliationTab({ user }: { user: any }) {
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitHandover = async () => {
    if (!actualCash) return alert('Enter cash amount');
    setLoading(true);
    try {
      const res = await api.post('/reconciliation/handover', {
        handoverDate: new Date().toISOString().split('T')[0],
        actualCash: Number(actualCash),
        notes,
      });
      alert(`Handover Submitted! Status: ${res.data.data.status}`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Handover submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>End-Of-Day Cash Handover Submission</Text>
      <Text style={styles.label}>Actual Cash Count Handed Over (₹)</Text>
      <TextInput
        style={styles.input}
        value={actualCash}
        onChangeText={setActualCash}
        keyboardType="numeric"
        placeholder="e.g. 25000"
      />
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmitHandover} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>SUBMIT CASH HANDOVER REPORT</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    backgroundColor: '#0A2540',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  headerSubtitle: { color: '#A0AEC0', fontSize: 12, marginTop: 2 },
  logoutBtn: { backgroundColor: '#E53E3E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  navBar: {
    backgroundColor: '#1A365D',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  navItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  navItemActive: { backgroundColor: '#2B6CB0' },
  navText: { color: '#CBD5E0', fontSize: 12, fontWeight: '500' },
  navTextActive: { color: '#FFF', fontWeight: '700' },
  loginContainer: { flex: 1, backgroundColor: '#0A2540', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 400, borderRadius: 12, padding: 24, elevation: 5 },
  logoBadge: { backgroundColor: '#0070BA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12 },
  logoBadgeText: { color: '#FFF', fontWeight: 'bold' },
  loginTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A202C' },
  loginSub: { fontSize: 13, color: '#718096', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#2D3748', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#EDF2F7', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1A202C' },
  primaryBtn: { backgroundColor: '#0070BA', borderRadius: 8, paddingVertical: 14, marginTop: 20, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 },
  quickLoginBox: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  quickTitle: { fontSize: 12, color: '#718096', marginBottom: 8 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBadge: { backgroundColor: '#EDF2F7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  quickText: { fontSize: 11, color: '#2B6CB0', fontWeight: '600' },
  errorText: { color: '#E53E3E', fontSize: 12, marginBottom: 10 },
  tabScroll: { flex: 1, padding: 16 },
  tabContainer: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A202C', marginBottom: 16 },
  gridRow: { gap: 12 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, elevation: 2, marginBottom: 10 },
  cardTitle: { fontSize: 12, color: '#718096', fontWeight: '600' },
  cardValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  searchBar: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, marginBottom: 12, elevation: 1 },
  listItem: { backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemHeader: { fontSize: 14, fontWeight: 'bold', color: '#2D3748' },
  itemSub: { fontSize: 12, color: '#718096', marginTop: 2 },
  statusBadge: { backgroundColor: '#C6F6D5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#22543D', fontSize: 10, fontWeight: 'bold' },
  groupCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginBottom: 12, elevation: 2 },
  groupCode: { fontSize: 12, color: '#0070BA', fontWeight: 'bold' },
  groupName: { fontSize: 16, fontWeight: 'bold', color: '#1A202C', marginVertical: 4 },
  groupGrid: { marginTop: 8, gap: 4 },
  groupStat: { fontSize: 12, color: '#4A5568' },
  pickerBox: { gap: 6, marginBottom: 12 },
  pickerItem: { padding: 10, backgroundColor: '#EDF2F7', borderRadius: 6 },
  pickerItemActive: { backgroundColor: '#2B6CB0' },
  pickerText: { color: '#2D3748', fontSize: 12 },
  pickerTextActive: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  modeBtn: { flex: 1, padding: 10, backgroundColor: '#EDF2F7', borderRadius: 6, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#27AE60' },
  modeText: { color: '#2D3748', fontSize: 12 },
  modeTextActive: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  receiptBox: { marginTop: 20, backgroundColor: '#EBF8FF', borderColor: '#3182CE', borderWidth: 1, padding: 16, borderRadius: 8 },
  receiptTitle: { color: '#2B6CB0', fontWeight: 'bold', fontSize: 14, marginBottom: 6 },
  receiptSub: { color: '#2D3748', fontSize: 12, marginTop: 2 },
});
