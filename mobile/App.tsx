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
  Modal,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { api, API_BASE_URL, setCustomBaseUrl } from './src/services/api';

// --- MAIN APP CONTROLLER ---
function MainApp() {
  const { user, login, logout } = useAuth();
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
          <Text style={styles.headerTitle}>{user.company?.name?.toUpperCase() || 'CHITKART'}</Text>
          <Text style={styles.headerSubtitle}>
            {user.role.replace('_', ' ')} • {user.fullName}
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
          <Text style={[styles.navText, activeTab === 'reconciliation' && styles.navTextActive]}>Cash Handover</Text>
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

// --- 1. LOGIN SCREEN (MATCHING REFERENCE DESIGN) ---
function LoginView({ onLogin }: { onLogin: (u: string, p: string) => Promise<any> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter your email or username and password');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    const res = await onLogin(username.trim(), password.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Invalid credentials');
    }
  };

  const openForgotModal = () => {
    setForgotInput(username.trim());
    setForgotStep(1);
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  const handleSendOtp = async () => {
    if (!forgotInput.trim()) {
      setForgotError('Please enter your registered email or username');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', {
        emailOrUsername: forgotInput.trim(),
      });
      if (res.data.success) {
        setMaskedEmail(res.data.maskedEmail || forgotInput.trim());
        if (res.data.otp) {
          setForgotOtp(res.data.otp);
        }
        setForgotStep(2);
        setForgotSuccess(res.data.message || 'Verification OTP code sent to your email!');
      } else {
        setForgotError(res.data.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.message || err.message || 'Network error sending OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotOtp.trim()) {
      setForgotError('Please enter the 6-digit OTP code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        emailOrUsername: forgotInput.trim(),
        otp: forgotOtp.trim(),
        newPassword,
      });

      if (res.data.success) {
        setShowForgotModal(false);
        setUsername(forgotInput.trim());
        setPassword('');
        setError('');
        setSuccessMsg('Password reset successfully! Please login with your new password.');
      } else {
        setForgotError(res.data.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.refContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#324124" />

      <ScrollView contentContainerStyle={styles.refContentContainer} keyboardShouldPersistTaps="handled">
        {/* Title Section */}
        <View style={styles.refHeader}>
          <Text style={styles.chitKartBrand}>CHITKART</Text>
          <Text style={styles.refTitle}>Welcome Back!</Text>
          <Text style={styles.refSubtitle}>Sign in with your account</Text>
        </View>

        {successMsg ? (
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>{successMsg}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBadge}>
            <Text style={styles.errorBadgeText}>{error}</Text>
          </View>
        ) : null}

        {/* Input Fields Container */}
        <View style={styles.refForm}>
          {/* Username / Email Field */}
          <View style={styles.pillInputWrapper}>
            <TextInput
              style={styles.pillInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Email or Username"
              placeholderTextColor="#9AA0A6"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Field with Show/Hide toggle */}
          <View style={styles.pillInputWrapper}>
            <TextInput
              style={[styles.pillInput, { paddingRight: 50 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9AA0A6"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={{ fontSize: 18, color: '#757575' }}>
                {showPassword ? '👁' : '👁‍🗨'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lime Green Login Button */}
          <TouchableOpacity
            style={styles.limeBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#111" size="small" />
            ) : (
              <Text style={styles.limeBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <View style={styles.linkGroup}>
            <TouchableOpacity onPress={openForgotModal}>
              <Text style={styles.refLinkText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.forgotCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {forgotStep === 1 ? 'Reset Password' : 'Enter Verification Code'}
              </Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {forgotError ? (
              <View style={[styles.errorBadge, { width: '100%', marginBottom: 14 }]}>
                <Text style={styles.errorBadgeText}>{forgotError}</Text>
              </View>
            ) : null}

            {forgotSuccess ? (
              <View style={[styles.successBadge, { width: '100%', marginBottom: 14 }]}>
                <Text style={styles.successBadgeText}>{forgotSuccess}</Text>
              </View>
            ) : null}

            {forgotStep === 1 ? (
              /* STEP 1: Enter Email / Username */
              <View>
                <Text style={styles.modalSubtext}>
                  Enter your registered email address or username. We will send a 6-digit OTP code to verify your identity.
                </Text>

                <View style={styles.pillInputWrapper}>
                  <TextInput
                    style={styles.pillInput}
                    value={forgotInput}
                    onChangeText={setForgotInput}
                    placeholder="Email or Username"
                    placeholderTextColor="#9AA0A6"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={styles.limeBtn}
                  onPress={handleSendOtp}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#111" size="small" />
                  ) : (
                    <Text style={styles.limeBtnText}>Send Verification OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 18, alignSelf: 'center' }}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={{ color: '#E4ECD8', fontSize: 14 }}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* STEP 2: Enter OTP & New Password */
              <View>
                <Text style={styles.modalSubtext}>
                  A 6-digit OTP was sent to <Text style={{ color: '#C8FF00', fontWeight: '700' }}>{maskedEmail}</Text>. Enter it below with your new password.
                </Text>

                {/* OTP Input */}
                <View style={styles.pillInputWrapper}>
                  <TextInput
                    style={[styles.pillInput, { letterSpacing: 6, fontWeight: '700', fontSize: 18, textAlign: 'center' }]}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    placeholder="6-Digit OTP"
                    placeholderTextColor="#9AA0A6"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                {/* New Password */}
                <View style={styles.pillInputWrapper}>
                  <TextInput
                    style={[styles.pillInput, { paddingRight: 50 }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New Password (min. 6 chars)"
                    placeholderTextColor="#9AA0A6"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Text style={{ fontSize: 18, color: '#757575' }}>
                      {showNewPassword ? '👁' : '👁‍🗨'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Confirm New Password */}
                <View style={styles.pillInputWrapper}>
                  <TextInput
                    style={[styles.pillInput, { paddingRight: 50 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm New Password"
                    placeholderTextColor="#9AA0A6"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.limeBtn}
                  onPress={handleResetPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#111" size="small" />
                  ) : (
                    <Text style={styles.limeBtnText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
                  <TouchableOpacity onPress={() => setForgotStep(1)}>
                    <Text style={{ color: '#E4ECD8', fontSize: 13 }}>← Change Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendOtp} disabled={forgotLoading}>
                    <Text style={{ color: '#C8FF00', fontSize: 13, fontWeight: '700' }}>Resend Code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
      <Text style={styles.sectionTitle}>Dashboard ({stats?.role || user.role})</Text>

      {stats?.role === 'SUPER_ADMIN' && (
        <View style={styles.gridRow}>
          <MetricCard title="Active Companies" value={stats.activeCompanies || 0} color="#0070BA" />
          <MetricCard title="Active Branches" value={stats.activeBranches || 0} color="#27AE60" />
          <MetricCard title="Total Subscribers" value={stats.totalSubscribers || 0} color="#8E44AD" />
          <MetricCard title="Active Chit Groups" value={stats.activeGroups || 0} color="#D35400" />
        </View>
      )}

      {stats?.role === 'MANAGER' && (
        <View style={styles.gridRow}>
          <MetricCard title="Today's Collections" value={`₹${(stats.todayTotalCollected || 0).toLocaleString()}`} color="#27AE60" />
          <MetricCard title="Cash Collected" value={`₹${(stats.todayCashCollected || 0).toLocaleString()}`} color="#0070BA" />
          <MetricCard title="Bank/UPI Collections" value={`₹${(stats.todayBankUpiCollected || 0).toLocaleString()}`} color="#D35400" />
          <MetricCard title="Active Chit Groups" value={stats.activeGroups || 0} color="#8E44AD" />
          <MetricCard title="Active Subscribers" value={stats.activeSubscribers || 0} color="#2D3748" />
          <MetricCard title="Pending Payouts" value={stats.pendingPayouts || 0} color="#C0392B" />
        </View>
      )}

      {stats?.role === 'COLLECTION_STAFF' && (
        <View style={styles.gridRow}>
          <MetricCard title="Assigned Subscribers" value={stats.assignedSubscribers || 0} color="#0070BA" />
          <MetricCard title="Today's Collections Count" value={stats.todayCollectionsCount || 0} color="#8E44AD" />
          <MetricCard title="Amount Collected" value={`₹${(stats.todayAmountCollected || 0).toLocaleString()}`} color="#27AE60" />
          <MetricCard title="Cash in Hand" value={`₹${(stats.cashInHand || 0).toLocaleString()}`} color="#D35400" />
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
  const [showAddModal, setShowAddModal] = useState(false);

  // New Subscriber Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [idProofType, setIdProofType] = useState('AADHAAR');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSubscribers();
  }, [search]);

  const loadSubscribers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/subscribers?search=${encodeURIComponent(search)}`);
      setSubscribers(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscriber = async () => {
    if (!fullName.trim() || !phone.trim()) {
      alert('Full name and mobile number are required');
      return;
    }

    try {
      setSubmitting(true);
      const branchId = user.branch?.id || (await api.get('/chit-groups')).data.data[0]?.branchId;
      await api.post('/subscribers', {
        branchId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        idProofType,
        idProofNumber: idProofNumber.trim() || undefined,
        nomineeName: nomineeName.trim() || undefined,
      });

      alert('Subscriber registered successfully!');
      setShowAddModal(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setIdProofNumber('');
      setNomineeName('');
      loadSubscribers();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to register subscriber');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.tabContainer}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}
          placeholder="Search by name, code or phone..."
          value={search}
          onChangeText={setSearch}
        />
        {user.role !== 'COLLECTION_STAFF' && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#0A2540" />
      ) : subscribers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No subscribers found.</Text>
          <Text style={styles.emptySubText}>Tap "+ ADD" to register a new subscriber.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {subscribers.map((s) => (
            <View key={s.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemHeader}>{s.fullName} ({s.subscriberCode})</Text>
                <Text style={styles.itemSub}>Phone: {s.phone} | KYC: {s.kycStatus}</Text>
                <Text style={styles.itemSub}>Branch: {s.branch?.name || 'Main'}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{s.status}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Subscriber Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register New Subscriber</Text>
            <ScrollView>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="e.g. Rahul Sharma" />

              <Text style={styles.label}>Mobile Number *</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. 9876543210" />

              <Text style={styles.label}>Email Address</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="e.g. rahul@example.com" />

              <Text style={styles.label}>Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Residential address" />

              <Text style={styles.label}>ID Proof Type</Text>
              <View style={styles.quickRow}>
                {['AADHAAR', 'PAN', 'VOTER_ID'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.modeBtn, idProofType === type && styles.modeBtnActive]}
                    onPress={() => setIdProofType(type)}
                  >
                    <Text style={idProofType === type ? styles.modeTextActive : styles.modeText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>ID Proof Number</Text>
              <TextInput style={styles.input} value={idProofNumber} onChangeText={setIdProofNumber} placeholder="Identification number" />

              <Text style={styles.label}>Nominee Name</Text>
              <TextInput style={styles.input} value={nomineeName} onChangeText={setNomineeName} placeholder="Nominee full name" />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={handleCreateSubscriber} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>SAVE</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- 4. CHIT GROUPS TAB ---
function ChitGroupsTab({ user }: { user: any }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Chit Group Form State
  const [groupName, setGroupName] = useState('');
  const [chitValue, setChitValue] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/chit-groups');
      setGroups(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !chitValue || !maxMembers || !totalMonths || !startDate) {
      alert('Please fill all group configuration fields');
      return;
    }

    try {
      setSubmitting(true);
      const branchId = user.branch?.id || (await api.get('/branches')).data?.data?.[0]?.id || user.company?.id;
      await api.post('/chit-groups', {
        branchId,
        name: groupName.trim(),
        chitValue: Number(chitValue),
        maxMembers: Number(maxMembers),
        totalMonths: Number(totalMonths),
        startDate: startDate.trim(),
      });

      alert('Chit Group created with installment schedules!');
      setShowAddModal(false);
      setGroupName('');
      setChitValue('');
      setMaxMembers('');
      setTotalMonths('');
      setStartDate('');
      loadGroups();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create chit group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>Chit Groups</Text>
        {user.role !== 'COLLECTION_STAFF' && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ NEW GROUP</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#0A2540" />
      ) : groups.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No chit groups created yet.</Text>
          <Text style={styles.emptySubText}>Tap "+ NEW GROUP" to configure a chit group.</Text>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.id} style={styles.groupCard}>
            <Text style={styles.groupCode}>{g.groupCode}</Text>
            <Text style={styles.groupName}>{g.name}</Text>
            <View style={styles.groupGrid}>
              <Text style={styles.groupStat}>Chit Value: ₹{(g.chitValue || 0).toLocaleString()}</Text>
              <Text style={styles.groupStat}>Monthly Dues: ₹{(g.monthlyInstallment || 0).toLocaleString()}</Text>
              <Text style={styles.groupStat}>Members: {g.members?.length || 0} / {g.maxMembers}</Text>
              <Text style={styles.groupStat}>Duration: {g.totalMonths} Months</Text>
              <Text style={styles.groupStat}>Start Date: {g.startDate}</Text>
            </View>
          </View>
        ))
      )}

      {/* Add Chit Group Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configure New Chit Group</Text>
            <ScrollView>
              <Text style={styles.label}>Chit Group Name *</Text>
              <TextInput style={styles.input} value={groupName} onChangeText={setGroupName} placeholder="e.g. 1 Lakh 20 Months Group" />

              <Text style={styles.label}>Total Chit Value (₹) *</Text>
              <TextInput style={styles.input} value={chitValue} onChangeText={setChitValue} keyboardType="numeric" placeholder="e.g. 100000" />

              <Text style={styles.label}>Total Members *</Text>
              <TextInput style={styles.input} value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric" placeholder="e.g. 20" />

              <Text style={styles.label}>Duration (Months) *</Text>
              <TextInput style={styles.input} value={totalMonths} onChangeText={setTotalMonths} keyboardType="numeric" placeholder="e.g. 20" />

              <Text style={styles.label}>Start Date (YYYY-MM-DD) *</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="e.g. 2026-05-01" />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={handleCreateGroup} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>CREATE</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// --- 5. COLLECT PAYMENT TAB ---
function CollectPaymentTab({ user }: { user: any }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [installmentNo, setInstallmentNo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [externalRef, setExternalRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      const sRes = await api.get('/subscribers');
      const gRes = await api.get('/chit-groups');
      setSubscribers(sRes.data.data || []);
      setGroups(gRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedSub || !selectedGroup || !installmentNo.trim() || !amount.trim()) {
      alert('Please fill all payment details');
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
        externalRef: externalRef.trim() || undefined,
        idempotencyKey: `TXN-${Date.now()}`,
      });

      setReceipt(res.data.data);
      alert(`Receipt ${res.data.data.receiptNo} generated successfully!`);
      setInstallmentNo('');
      setAmount('');
      setExternalRef('');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (subscribers.length === 0 || groups.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Cannot record payments yet.</Text>
        <Text style={styles.emptySubText}>
          {subscribers.length === 0 ? 'Please add subscribers first.' : 'Please create a chit group first.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Record Payment & Issue Receipt</Text>

      <Text style={styles.label}>Select Subscriber *</Text>
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

      <Text style={styles.label}>Select Chit Group *</Text>
      <View style={styles.pickerBox}>
        {groups.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.pickerItem, selectedGroup === g.id && styles.pickerItemActive]}
            onPress={() => {
              setSelectedGroup(g.id);
              if (g.monthlyInstallment) setAmount(String(g.monthlyInstallment));
            }}
          >
            <Text style={selectedGroup === g.id ? styles.pickerTextActive : styles.pickerText}>
              {g.name} ({g.groupCode})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Installment Month Number *</Text>
      <TextInput
        style={styles.input}
        value={installmentNo}
        onChangeText={setInstallmentNo}
        keyboardType="numeric"
        placeholder="e.g. 1"
      />

      <Text style={styles.label}>Amount Received (₹) *</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="Amount received"
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
            placeholder="e.g. UPI/123456789/HDFC"
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
          <Text style={styles.receiptSub}>Payment Mode: {receipt.paymentMode}</Text>
          <Text style={styles.receiptSub}>Verification Status: {receipt.verificationStatus}</Text>
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
  const [installmentNo, setInstallmentNo] = useState('');
  const [winningDiscount, setWinningDiscount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const gRes = await api.get('/chit-groups');
      const sRes = await api.get('/subscribers');
      setGroups(gRes.data.data || []);
      setSubscribers(sRes.data.data || []);
      if (gRes.data.data?.length > 0) setSelectedGroup(gRes.data.data[0].id);
      if (sRes.data.data?.length > 0) setWinnerSub(sRes.data.data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmAuction = async () => {
    if (!selectedGroup || !winnerSub || !installmentNo.trim() || !winningDiscount.trim()) {
      alert('Please fill all auction details');
      return;
    }

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
      setWinningDiscount('');
      setInstallmentNo('');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to confirm auction');
    } finally {
      setLoading(false);
    }
  };

  if (groups.length === 0 || subscribers.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No chit groups or subscribers available for auction.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>Record Monthly Auction & Dividend</Text>

      <Text style={styles.label}>Select Chit Group *</Text>
      <View style={styles.pickerBox}>
        {groups.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.pickerItem, selectedGroup === g.id && styles.pickerItemActive]}
            onPress={() => setSelectedGroup(g.id)}
          >
            <Text style={selectedGroup === g.id ? styles.pickerTextActive : styles.pickerText}>
              {g.name} ({g.groupCode})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Auction Installment Month Number *</Text>
      <TextInput
        style={styles.input}
        value={installmentNo}
        onChangeText={setInstallmentNo}
        keyboardType="numeric"
        placeholder="e.g. 1"
      />

      <Text style={styles.label}>Winning Subscriber *</Text>
      <View style={styles.pickerBox}>
        {subscribers.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.pickerItem, winnerSub === s.id && styles.pickerItemActive]}
            onPress={() => setWinnerSub(s.id)}
          >
            <Text style={winnerSub === s.id ? styles.pickerTextActive : styles.pickerText}>
              {s.fullName} ({s.subscriberCode})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Winning Bid Discount Offered (₹) *</Text>
      <TextInput
        style={styles.input}
        value={winningDiscount}
        onChangeText={setWinningDiscount}
        keyboardType="numeric"
        placeholder="Discount amount surrendered"
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmAuction} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>CONFIRM AUCTION & AUTO-CALCULATE DIVIDENDS</Text>}
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
    if (!actualCash.trim()) {
      alert('Please enter actual cash amount');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/reconciliation/handover', {
        handoverDate: new Date().toISOString().split('T')[0],
        actualCash: Number(actualCash),
        notes: notes.trim() || undefined,
      });
      alert(`Handover Submitted! Status: ${res.data.data.status}`);
      setActualCash('');
      setNotes('');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Handover submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabScroll}>
      <Text style={styles.sectionTitle}>End-Of-Day Cash Handover</Text>
      <Text style={styles.label}>Actual Cash Count Handed Over (₹) *</Text>
      <TextInput
        style={styles.input}
        value={actualCash}
        onChangeText={setActualCash}
        keyboardType="numeric"
        placeholder="Counted cash amount"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Handover remarks or denomination breakdown"
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
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
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
  loginCard: { backgroundColor: '#FFF', width: '100%', maxWidth: 420, borderRadius: 12, padding: 24, elevation: 5 },
  logoBadge: { backgroundColor: '#0070BA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12 },
  logoBadgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  loginTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A202C' },
  loginSub: { fontSize: 13, color: '#718096', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#2D3748', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#EDF2F7', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1A202C' },
  primaryBtn: { backgroundColor: '#0070BA', borderRadius: 8, paddingVertical: 14, marginTop: 20, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 },
  errorText: { color: '#E53E3E', fontSize: 12, marginBottom: 10 },
  tabScroll: { flex: 1, padding: 16 },
  tabContainer: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A202C', marginBottom: 16 },
  gridRow: { gap: 12 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, elevation: 2, marginBottom: 10 },
  cardTitle: { fontSize: 12, color: '#718096', fontWeight: '600' },
  cardValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  searchBar: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, marginBottom: 12, elevation: 1 },
  addBtn: { backgroundColor: '#27AE60', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  listItem: { backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemHeader: { fontSize: 14, fontWeight: 'bold', color: '#2D3748' },
  itemSub: { fontSize: 12, color: '#718096', marginTop: 2 },
  statusBadge: { backgroundColor: '#C6F6D5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#22543D', fontSize: 10, fontWeight: 'bold' },
  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#718096' },
  emptySubText: { fontSize: 12, color: '#A0AEC0', marginTop: 4 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', maxWidth: 450, maxHeight: '90%', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A202C', marginBottom: 14 },
  cancelBtn: { backgroundColor: '#CBD5E0', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#2D3748', fontWeight: 'bold', fontSize: 13 },

  // --- REFERENCE DESIGN STYLES ---
  refContainer: {
    flex: 1,
    backgroundColor: '#3E5030', // Deep olive green background matching reference image
  },
  dynamicIsland: {
    width: 110,
    height: 30,
    backgroundColor: '#000',
    borderRadius: 18,
    alignSelf: 'center',
    marginTop: 8,
  },
  refContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 30,
  },
  refHeader: {
    alignItems: 'center',
    marginBottom: 44,
  },
  chitKartBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#C8FF00',
    letterSpacing: 4,
    marginBottom: 8,
  },
  refTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  refSubtitle: {
    fontSize: 16,
    color: '#D8E2CB',
    marginTop: 8,
    fontWeight: '400',
    textAlign: 'center',
  },
  refForm: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  pillInputWrapper: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  pillInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeBtn: {
    padding: 6,
  },
  limeBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#C8FF00', // Electric neon lime green
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#C8FF00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  limeBtnText: {
    color: '#1C2414',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  linkGroup: {
    alignItems: 'center',
    marginTop: 26,
  },
  refLinkText: {
    color: '#E4ECD8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 44,
  },
  socialBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  errorBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: 'center',
    maxWidth: 360,
  },
  errorBadgeText: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  forgotCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#2A3A21',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseText: {
    fontSize: 22,
    color: '#C8FF00',
    fontWeight: '700',
    padding: 4,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#D1DFC3',
    lineHeight: 20,
    marginBottom: 20,
  },
  successBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: 'center',
    maxWidth: 360,
  },
  successBadgeText: {
    color: '#86EFAC',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
