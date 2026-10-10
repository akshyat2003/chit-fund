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
import { api } from './src/services/api';

// --- MAIN APP CONTROLLER ---
function MainApp() {
  const { user, login, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'companies' | 'admins' | 'subscribers' | 'groups' | 'payments' | 'auctions' | 'reconciliation'>('dashboard');
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2540" />
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{user.company?.name?.toUpperCase() || 'CHITKART'}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {user.role.replace('_', ' ')} • {user.fullName}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setShowProfileModal(true)}>
              <Text style={styles.profileBtnText}>👤 Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Role Navigation Bar with Responsive Horizontal Scroll for Mobiles/Tablets/Desktops */}
      <View style={styles.navBarWrapper}>
        <View style={styles.navBarInner}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.navScroll}
            contentContainerStyle={styles.navContentContainer}
          >
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>📊 Dashboard</Text>
            </TouchableOpacity>

            {user.role === 'SUPER_ADMIN' && (
              <>
                <TouchableOpacity
                  style={[styles.navItem, activeTab === 'companies' && styles.navItemActive]}
                  onPress={() => setActiveTab('companies')}
                >
                  <Text style={[styles.navText, activeTab === 'companies' && styles.navTextActive]}>🏢 Companies</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.navItem, activeTab === 'admins' && styles.navItemActive]}
                  onPress={() => setActiveTab('admins')}
                >
                  <Text style={[styles.navText, activeTab === 'admins' && styles.navTextActive]}>🛡️ Super Admins</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'subscribers' && styles.navItemActive]}
              onPress={() => setActiveTab('subscribers')}
            >
              <Text style={[styles.navText, activeTab === 'subscribers' && styles.navTextActive]}>👥 Subscribers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'groups' && styles.navItemActive]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={[styles.navText, activeTab === 'groups' && styles.navTextActive]}>💰 Chit Groups</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'payments' && styles.navItemActive]}
              onPress={() => setActiveTab('payments')}
            >
              <Text style={[styles.navText, activeTab === 'payments' && styles.navTextActive]}>💳 Collect</Text>
            </TouchableOpacity>

            {user.role !== 'COLLECTION_STAFF' && (
              <TouchableOpacity
                style={[styles.navItem, activeTab === 'auctions' && styles.navItemActive]}
                onPress={() => setActiveTab('auctions')}
              >
                <Text style={[styles.navText, activeTab === 'auctions' && styles.navTextActive]}>🏷 Auctions</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'reconciliation' && styles.navItemActive]}
              onPress={() => setActiveTab('reconciliation')}
            >
              <Text style={[styles.navText, activeTab === 'reconciliation' && styles.navTextActive]}>💼 Cash Handover</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Responsive Content Area Centered up to 1280px */}
      <View style={styles.contentArea}>
        <View style={styles.contentInner}>
          <View style={{ flex: 1, display: activeTab === 'dashboard' ? 'flex' : 'none' }}>
            <DashboardTab user={user} onNavigateTab={setActiveTab} />
          </View>
          {user.role === 'SUPER_ADMIN' && (
            <>
              <View style={{ flex: 1, display: activeTab === 'companies' ? 'flex' : 'none' }}>
                <CompaniesTab user={user} />
              </View>
              <View style={{ flex: 1, display: activeTab === 'admins' ? 'flex' : 'none' }}>
                <SuperAdminsTab user={user} />
              </View>
            </>
          )}
          <View style={{ flex: 1, display: activeTab === 'subscribers' ? 'flex' : 'none' }}>
            <SubscribersTab user={user} />
          </View>
          <View style={{ flex: 1, display: activeTab === 'groups' ? 'flex' : 'none' }}>
            <ChitGroupsTab user={user} />
          </View>
          <View style={{ flex: 1, display: activeTab === 'payments' ? 'flex' : 'none' }}>
            <CollectPaymentTab user={user} />
          </View>
          {user.role !== 'COLLECTION_STAFF' && (
            <View style={{ flex: 1, display: activeTab === 'auctions' ? 'flex' : 'none' }}>
              <AuctionsTab user={user} />
            </View>
          )}
          <View style={{ flex: 1, display: activeTab === 'reconciliation' ? 'flex' : 'none' }}>
            <ReconciliationTab user={user} />
          </View>
        </View>
      </View>

      {/* Profile & Security Modal */}
      <ProfileModal
        visible={showProfileModal}
        user={user}
        onClose={() => setShowProfileModal(false)}
        onRefreshUser={refreshUser}
      />
    </SafeAreaView>
  );
}

// --- 1. LOGIN SCREEN (MATCHING REFERENCE DESIGN) ---
function LoginView({ onLogin }: { onLogin: (u: string, p: string) => Promise<any> }) {
  const { inactivityMessage, clearInactivityMessage } = useAuth();
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

  const handleResendOtp = async () => {
    if (!forgotInput.trim()) {
      setForgotError('Please enter your registered email or username');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotOtp('');
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
        setForgotSuccess('New 6-digit verification code sent immediately to your email!');
      } else {
        setForgotError(res.data.message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.message || err.message || 'Failed to resend OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const cleanOtp = forgotOtp.replace(/[^0-9]/g, '').trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError('Please enter the 6-digit numeric OTP code');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setForgotError('Password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setForgotError('Password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setForgotError('Password must contain at least one number (0-9)');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) {
      setForgotError('Password must contain at least one special character (!@#$%^&*...)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('New password and confirmation do not match');
      return;
    }

    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        emailOrUsername: forgotInput.trim(),
        otp: cleanOtp,
        newPassword,
      });

      if (res.data.success) {
        setShowForgotModal(false);
        setUsername(forgotInput.trim());
        setPassword('');
        setError('');
        setSuccessMsg('Password updated in database! Please log in with your new password.');
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

        {inactivityMessage ? (
          <View style={[styles.errorBadge, { backgroundColor: 'rgba(217, 119, 6, 0.28)', borderColor: '#F59E0B', borderWidth: 1 }]}>
            <Text style={[styles.errorBadgeText, { color: '#FDE68A', fontWeight: '700' }]}>
              ⏳ {inactivityMessage}
            </Text>
          </View>
        ) : null}

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
              <Text style={styles.forgotModalTitle}>
                {forgotStep === 1 ? 'Reset Password' : 'Enter Verification Code'}
              </Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                  style={{ marginTop: 22, alignSelf: 'center', padding: 8 }}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={{ color: '#C8FF00', fontSize: 15, fontWeight: '700' }}>← Back to Login</Text>
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
                    onChangeText={(val) => setForgotOtp(val.replace(/[^0-9]/g, ''))}
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
                    placeholder="New Password (min 8 chars, Aa1@)"
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

                {/* Real-time Password Requirements Checklist */}
                <View style={{ marginTop: 8, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#E4ECD8', fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                    Password must contain:
                  </Text>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 12, color: newPassword.length >= 8 ? '#C8FF00' : '#94A3B8', fontWeight: newPassword.length >= 8 ? '700' : '500' }}>
                      {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                    </Text>
                    <Text style={{ fontSize: 12, color: /[A-Z]/.test(newPassword) ? '#C8FF00' : '#94A3B8', fontWeight: /[A-Z]/.test(newPassword) ? '700' : '500' }}>
                      {/[A-Z]/.test(newPassword) ? '✓' : '○'} At least one uppercase letter (A-Z)
                    </Text>
                    <Text style={{ fontSize: 12, color: /[a-z]/.test(newPassword) ? '#C8FF00' : '#94A3B8', fontWeight: /[a-z]/.test(newPassword) ? '700' : '500' }}>
                      {/[a-z]/.test(newPassword) ? '✓' : '○'} At least one lowercase letter (a-z)
                    </Text>
                    <Text style={{ fontSize: 12, color: /[0-9]/.test(newPassword) ? '#C8FF00' : '#94A3B8', fontWeight: /[0-9]/.test(newPassword) ? '700' : '500' }}>
                      {/[0-9]/.test(newPassword) ? '✓' : '○'} At least one number (0-9)
                    </Text>
                    <Text style={{ fontSize: 12, color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword) ? '#C8FF00' : '#94A3B8', fontWeight: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword) ? '700' : '500' }}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword) ? '✓' : '○'} At least one special character (!@#$...)
                    </Text>
                  </View>
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
                    <Text style={styles.limeBtnText}>Reset Password & Update in Database</Text>
                  )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                  <TouchableOpacity onPress={() => setForgotStep(1)}>
                    <Text style={{ color: '#E4ECD8', fontSize: 13 }}>← Change Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResendOtp} disabled={forgotLoading} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                    <Text style={{ color: '#C8FF00', fontSize: 13, fontWeight: '700' }}>
                      {forgotLoading ? 'Resending OTP...' : '⚡ Resend Code'}
                    </Text>
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
function DashboardTab({ user, onNavigateTab }: { user: any; onNavigateTab?: (tab: any) => void }) {
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
        <View>
          <View style={styles.gridRow}>
            <MetricCard title="Active Companies" value={stats.activeCompanies || 0} color="#0070BA" />
            <MetricCard title="Active Branches" value={stats.activeBranches || 0} color="#27AE60" />
            <MetricCard title="Total Subscribers" value={stats.totalSubscribers || 0} color="#8E44AD" />
            <MetricCard title="Active Chit Groups" value={stats.activeGroups || 0} color="#D35400" />
            <MetricCard title="Total Platform Users" value={stats.totalUsers || 0} color="#2563EB" />
            <MetricCard title="System Engine Status" value={stats.systemStatus || 'ONLINE'} color="#16A34A" />
          </View>

          {/* Super Admin Control Center Card */}
          <View style={styles.superAdminPanelCard}>
            <Text style={styles.superAdminPanelTitle}>🛡️ Super Admin Management Center (SA-01 to SA-22)</Text>
            <Text style={styles.superAdminPanelSub}>
              Database: Supabase PostgreSQL (Tokyo ap-northeast-1) • Email: Yahoo SMTP Verified • Immutable Financial Logs (FR-SA-018)
            </Text>

            <View style={styles.saControlsGrid}>
              <View style={styles.saControlItem}>
                <Text style={styles.saControlItemTitle}>🏢 Company Setup & SaaS (SA-02, FR-SA-002)</Text>
                <Text style={styles.saControlItemDesc}>Create & configure companies, branch limits, and provision Initial Admin cum Manager accounts.</Text>
              </View>
              <View style={styles.saControlItem}>
                <Text style={styles.saControlItemTitle}>🔐 Audit & Immutable Ledger (SA-11, FR-SA-018)</Text>
                <Text style={styles.saControlItemDesc}>Full audit logs on security, authentication, and guaranteed prohibition of transaction tampering.</Text>
              </View>
              <View style={styles.saControlItem}>
                <Text style={styles.saControlItemTitle}>⚖️ Compliance & Statutory (SA-12)</Text>
                <Text style={styles.saControlItemDesc}>State Chit Funds Act compliance registration, foreman security deposits, and KYC audits.</Text>
              </View>
              <View style={styles.saControlItem}>
                <Text style={styles.saControlItemTitle}>💾 Backup & Disaster Recovery (SA-15)</Text>
                <Text style={styles.saControlItemDesc}>Continuous Write-Ahead Log (WAL) with 30-day Point-In-Time Recovery in Tokyo AWS region.</Text>
              </View>
            </View>

            {onNavigateTab && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#38BDF8', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8 }}
                  onPress={() => onNavigateTab('admins')}
                >
                  <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 12 }}>
                    👥 CREATE & MANAGE SUPER ADMINS
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8 }}
                  onPress={() => onNavigateTab('companies')}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>
                    🏢 ONBOARD COMPANIES
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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

// --- 2.5 COMPANIES TAB (SUPER ADMIN) ---
function CompaniesTab({ user }: { user: any }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // New Company & Admin Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stateRegistrationNo, setStateRegistrationNo] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState('plan_pro');

  // Initial Admin State
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, [search, statusFilter]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      let url = `/super-admin/companies?search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      const res = await api.get(url);
      setCompanies(res.data.data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    setFormError('');
    if (!name.trim() || !code.trim()) {
      setFormError('Company name and unique company code are required.');
      return;
    }
    if (!adminFullName.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      setFormError('Initial Admin Full Name, Username, and Password are required.');
      return;
    }
    if (adminPassword.length < 8 || !/[A-Za-z]/.test(adminPassword) || !/[0-9]/.test(adminPassword)) {
      setFormError('Admin password must be at least 8 characters and contain both letters and numbers.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        stateRegistrationNo: stateRegistrationNo.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        planId,
        initialAdmin: {
          fullName: adminFullName.trim(),
          username: adminUsername.trim(),
          password: adminPassword,
          phone: adminPhone.trim() || phone.trim() || '0000000000',
          email: adminEmail.trim() || email.trim() || undefined,
        },
      };

      const res = await api.post('/super-admin/companies', payload);
      alert(`Company "${res.data.data.company.name}" (${res.data.data.company.code}) and Initial Admin "${adminUsername.trim()}" created successfully!`);
      setShowAddModal(false);
      // Reset form
      setCode('');
      setName('');
      setStateRegistrationNo('');
      setAddress('');
      setPhone('');
      setEmail('');
      setAdminFullName('');
      setAdminUsername('');
      setAdminPassword('');
      setAdminPhone('');
      setAdminEmail('');
      loadCompanies();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (comp: any) => {
    const newStatus = comp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = comp.status === 'ACTIVE'
      ? `Are you sure you want to suspend "${comp.name}"? Active user sessions for this company will be revoked.`
      : `Re-activate company "${comp.name}"?`;
    if (!window.confirm ? !confirm(confirmMsg) : !window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      await api.patch(`/super-admin/companies/${comp.id}/status`, {
        status: newStatus,
        reason: newStatus === 'SUSPENDED' ? 'Administrative suspension by Super Admin' : undefined,
      });
      loadCompanies();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update company status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={styles.tabContainer}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}
          placeholder="Search by company name, code or email..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ CREATE COMPANY</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((st) => (
          <TouchableOpacity
            key={st}
            style={[
              styles.filterChip,
              statusFilter === st && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(st)}
          >
            <Text style={statusFilter === st ? styles.filterChipTextActive : styles.filterChipText}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#0A2540" />
      ) : companies.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No companies found.</Text>
          <Text style={styles.emptySubText}>Tap "+ CREATE COMPANY" to onboard a new chit fund company.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.cardsGrid}>
            {companies.map((c) => (
              <View key={c.id} style={styles.companyCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.companyCodeBadge}>{c.code}</Text>
                  <View style={c.status === 'ACTIVE' ? styles.statusBadgeActive : styles.statusBadgeSuspended}>
                    <Text style={c.status === 'ACTIVE' ? styles.statusTextActive : styles.statusTextSuspended}>
                      {c.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.companyNameText}>{c.name}</Text>
                {c.stateRegistrationNo ? (
                  <Text style={styles.companyMetaText}>Reg: {c.stateRegistrationNo}</Text>
                ) : null}
                <Text style={styles.companyMetaText}>Email: {c.email || 'N/A'} | Phone: {c.phone || 'N/A'}</Text>
                {c.address ? <Text style={styles.companyMetaText}>Addr: {c.address}</Text> : null}

                <View style={styles.companyStatsRow}>
                  <Text style={styles.companyStatPill}>🏛 {c.stats?.branchesCount || 0} Branches</Text>
                  <Text style={styles.companyStatPill}>👤 {c.stats?.usersCount || 0} Users</Text>
                  <Text style={styles.companyStatPill}>👥 {c.stats?.subscribersCount || 0} Subs</Text>
                  <Text style={styles.companyStatPill}>💰 {c.stats?.groupsCount || 0} Groups</Text>
                </View>

                <View style={{ marginTop: 8, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>
                    PLAN: {c.subscription?.planName || 'Professional'} (Max Subs: {c.subscription?.limits?.maxSubscribers || 1000})
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.statusToggleBtn,
                    {
                      borderColor: c.status === 'ACTIVE' ? '#EF4444' : '#16A34A',
                      backgroundColor: c.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(22, 163, 74, 0.08)',
                    },
                  ]}
                  onPress={() => handleToggleStatus(c)}
                  disabled={actionLoading}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: c.status === 'ACTIVE' ? '#EF4444' : '#16A34A',
                    }}
                  >
                    {c.status === 'ACTIVE' ? 'Suspend Company Account' : 'Reactivate Company Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Create Company & Admin Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 640 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Onboard Company & Admin</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 22, color: '#64748B', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={[styles.errorBadge, { width: '100%', marginBottom: 12 }]}>
                <Text style={styles.errorBadgeText}>{formError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F2F52', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                1. Company Profile
              </Text>

              <Text style={styles.label}>Company Legal Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Apex Chit Funds Pvt Ltd"
              />

              <Text style={styles.label}>Company Code * (Unique Acronym)</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                placeholder="e.g. APEX"
              />

              <Text style={styles.label}>State Registration Number</Text>
              <TextInput
                style={styles.input}
                value={stateRegistrationNo}
                onChangeText={setStateRegistrationNo}
                placeholder="e.g. REG/2026/TN/0987"
              />

              <Text style={styles.label}>Official Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
              />

              <Text style={styles.label}>Official Contact Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="e.g. contact@apexchits.com"
              />

              <Text style={styles.label}>Registered Head Office Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. 12 Anna Salai, Chennai, TN"
              />

              <Text style={styles.label}>Subscription Plan Tier</Text>
              <View style={styles.quickRow}>
                {[
                  { id: 'plan_starter', name: 'Starter (100 Subs)' },
                  { id: 'plan_pro', name: 'Pro (1,000 Subs)' },
                  { id: 'plan_enterprise', name: 'Enterprise' },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.modeBtn, planId === p.id && styles.modeBtnActive]}
                    onPress={() => setPlanId(p.id)}
                  >
                    <Text style={planId === p.id ? styles.modeTextActive : styles.modeText}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 18 }} />

              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F2F52', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                2. Initial Admin cum Manager Account
              </Text>

              <Text style={styles.label}>Admin Full Name *</Text>
              <TextInput
                style={styles.input}
                value={adminFullName}
                onChangeText={setAdminFullName}
                placeholder="e.g. Rajesh Kumar"
              />

              <Text style={styles.label}>Admin Login Username / Email *</Text>
              <TextInput
                style={styles.input}
                value={adminUsername}
                onChangeText={setAdminUsername}
                autoCapitalize="none"
                placeholder="e.g. rajesh.admin or rajesh@apexchits.com"
              />

              <Text style={styles.label}>Admin Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={adminPhone}
                onChangeText={setAdminPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
              />

              <Text style={styles.label}>Initial Password * (min. 8 chars, letters & numbers)</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry={!showAdminPassword}
                  autoCapitalize="none"
                  placeholder="Strong initial password"
                />
                <TouchableOpacity onPress={() => setShowAdminPassword(!showAdminPassword)} style={styles.eyeBtn}>
                  <Text>{showAdminPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2, marginTop: 0 }]}
                  onPress={handleCreateCompany}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>CREATE COMPANY & ADMIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- 2.8 SUPER ADMINS TAB (MANAGE CO-SUPER ADMIN CREDENTIALS) ---
function SuperAdminsTab({ user }: { user: any }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const res = await api.get('/super-admin/admins');
      setAdmins(res.data.data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    setFormError('');
    if (!fullName.trim() || !username.trim() || !phone.trim() || !password) {
      setFormError('Please fill Full Name, Username, Mobile Phone, and Password.');
      return;
    }
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
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/super-admin/admins', {
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password,
      });

      alert(res.data.message || 'Super Admin account created successfully!');
      setShowAddModal(false);
      setFullName('');
      setUsername('');
      setPhone('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      loadAdmins();
    } catch (e: any) {
      setFormError(e.response?.data?.message || e.message || 'Failed to create Super Admin account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.sectionTitle}>🛡️ Super Admin Credentials</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
            Provision and manage Super Administrator accounts with full platform dashboard access
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ CREATE SUPER ADMIN</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#0A2540" />
      ) : admins.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No additional Super Admins found.</Text>
          <Text style={styles.emptySubText}>Tap "+ CREATE SUPER ADMIN" to provision a new Super Admin credential.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.cardsGrid}>
            {admins.map((adm) => (
              <View key={adm.id} style={[styles.companyCard, { borderTopColor: '#0F2F52' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.companyCodeBadge, { color: '#0F2F52' }]}>SUPER ADMIN</Text>
                  <View style={adm.status === 'ACTIVE' ? styles.statusBadgeActive : styles.statusBadgeSuspended}>
                    <Text style={adm.status === 'ACTIVE' ? styles.statusTextActive : styles.statusTextSuspended}>
                      {adm.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.companyNameText}>{adm.fullName}</Text>
                <Text style={styles.companyMetaText}>Username: @{adm.username}</Text>
                <Text style={styles.companyMetaText}>Email: {adm.email || 'Not specified'}</Text>
                <Text style={styles.companyMetaText}>Phone: {adm.phone}</Text>

                <View style={{ marginTop: 12, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>
                    ✓ Full Platform Dashboard & SaaS Administration Access
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Created: {new Date(adm.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Create Super Admin Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 580 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.modalTitle}>Create Super Admin Credential</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 22, color: '#64748B', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 14 }}>
                This user will have identical full administrative permissions across all companies, branches, and platform audit records.
              </Text>

              {formError ? (
                <View style={[styles.errorBadge, { width: '100%', marginBottom: 12 }]}>
                  <Text style={styles.errorBadgeText}>{formError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Priyanshu Sharma"
              />

              <Text style={styles.label}>Username *</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="e.g. priyanshu_admin"
              />

              <Text style={styles.label}>Mobile Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
              />

              <Text style={styles.label}>Email Address (Recommended for OTP recovery)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="e.g. priyanshu@chitkart.com"
              />

              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Min 8 chars, uppercase, lowercase, number, special"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Text>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              {/* Real-time Checklist */}
              <View style={{ marginVertical: 8, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 4 }}>
                <Text style={{ fontSize: 11, color: password.length >= 8 ? '#16A34A' : '#94A3B8', fontWeight: '600' }}>
                  {password.length >= 8 ? '✓' : '○'} At least 8 characters
                </Text>
                <Text style={{ fontSize: 11, color: /[A-Z]/.test(password) ? '#16A34A' : '#94A3B8', fontWeight: '600' }}>
                  {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase letter (A-Z)
                </Text>
                <Text style={{ fontSize: 11, color: /[a-z]/.test(password) ? '#16A34A' : '#94A3B8', fontWeight: '600' }}>
                  {/[a-z]/.test(password) ? '✓' : '○'} Lowercase letter (a-z)
                </Text>
                <Text style={{ fontSize: 11, color: /[0-9]/.test(password) ? '#16A34A' : '#94A3B8', fontWeight: '600' }}>
                  {/[0-9]/.test(password) ? '✓' : '○'} Number (0-9)
                </Text>
                <Text style={{ fontSize: 11, color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? '#16A34A' : '#94A3B8', fontWeight: '600' }}>
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? '✓' : '○'} Special character (!@#$%^&*...)
                </Text>
              </View>

              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Re-type password"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 10 }}>
                <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 2, marginTop: 0, backgroundColor: '#0F2F52' }]}
                  onPress={handleCreateAdmin}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>CREATE SUPER ADMIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
          <View style={styles.subscriberGrid}>
            {subscribers.map((s) => (
              <View key={s.id} style={styles.listItem}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.itemHeader} numberOfLines={1}>{s.fullName} ({s.subscriberCode})</Text>
                  <Text style={styles.itemSub} numberOfLines={1}>Phone: {s.phone} | KYC: {s.kycStatus}</Text>
                  <Text style={styles.itemSub} numberOfLines={1}>Branch: {s.branch?.name || 'Main'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{s.status}</Text>
                </View>
              </View>
            ))}
          </View>
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
        <View style={styles.cardsGrid}>
          {groups.map((g) => (
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
          ))}
        </View>
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
      const [sRes, gRes] = await Promise.all([
        api.get('/subscribers'),
        api.get('/chit-groups'),
      ]);
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
      <View style={styles.formContainer}>
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
      </View>
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
      const [gRes, sRes] = await Promise.all([
        api.get('/chit-groups'),
        api.get('/subscribers'),
      ]);
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
      <View style={styles.formContainer}>
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
      </View>
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
      <View style={styles.formContainer}>
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
      </View>
    </ScrollView>
  );
}

// --- 8. PROFILE & SECURITY MODAL ---
function ProfileModal({
  visible,
  user,
  onClose,
  onRefreshUser,
}: {
  visible: boolean;
  user: any;
  onClose: () => void;
  onRefreshUser: () => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('New password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('New password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('New password must contain at least one number (0-9)');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) {
      setError('New password must contain at least one special character (!@#$%...)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess(res.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onRefreshUser) await onRefreshUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 620 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.modalTitle}>User Profile & Security</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, color: '#64748B', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* User Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileHeaderRow}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.profileFullName}>{user?.fullName || 'User'}</Text>
                  <Text style={styles.profileRoleBadge}>{user?.role?.replace('_', ' ') || 'USER'}</Text>
                </View>
              </View>

              <View style={styles.profileDetailsGrid}>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Username</Text>
                  <Text style={styles.profileDetailValue}>{user?.username || '-'}</Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Email</Text>
                  <Text style={styles.profileDetailValue}>{user?.email || 'akshyatraj@yahoo.com'}</Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Mobile Phone</Text>
                  <Text style={styles.profileDetailValue}>{user?.phone || '-'}</Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Company</Text>
                  <Text style={styles.profileDetailValue}>
                    {user?.company ? `${user.company.name} (${user.company.code})` : 'Platform Level'}
                  </Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Branch</Text>
                  <Text style={styles.profileDetailValue}>
                    {user?.branch ? `${user.branch.name} (${user.branch.code})` : 'All Branches / HQ'}
                  </Text>
                </View>
                <View style={styles.profileDetailItem}>
                  <Text style={styles.profileDetailLabel}>Account Status</Text>
                  <Text style={[styles.profileDetailValue, { color: '#16A34A', fontWeight: '700' }]}>ACTIVE</Text>
                </View>
              </View>
            </View>

            {/* Change Password Section */}
            <View style={styles.changePasswordSection}>
              <Text style={styles.subSectionTitle}>🔐 Update Password</Text>
              <Text style={styles.subSectionDesc}>
                Protect your account. Minimum 8 characters with at least one letter and one number.
              </Text>

              {error ? (
                <View style={[styles.errorBadge, { width: '100%', marginBottom: 12 }]}>
                  <Text style={styles.errorBadgeText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={[styles.successBadge, { width: '100%', marginBottom: 12 }]}>
                  <Text style={styles.successBadgeText}>{success}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Current Password *</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder="Enter current password"
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeBtn}>
                  <Text>{showCurrentPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>New Password *</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  placeholder="Min 8 chars, letter + number"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                  <Text>{showNewPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm New Password *</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showNewPassword}
                  placeholder="Re-type new password"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#16A34A' }]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>UPDATE PASSWORD</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#0A2540',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  headerInner: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  logoutText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  navBarWrapper: {
    backgroundColor: '#0F2F52',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
    overflow: 'hidden',
  },
  navBarInner: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  navScroll: {
    width: '100%',
  },
  navContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  navItemActive: {
    backgroundColor: '#2563EB',
  },
  navText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  navTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
    width: '100%',
  },
  contentInner: {
    flex: 1,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  tabScroll: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  tabContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    width: '100%',
    flexBasis: 260,
    flexGrow: 1,
    borderLeftWidth: 5,
  },
  cardTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  groupCard: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    flexBasis: 300,
    flexGrow: 1,
    borderTopWidth: 4,
    borderTopColor: '#2563EB',
  },
  groupCode: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 6,
  },
  groupGrid: {
    marginTop: 8,
    gap: 6,
  },
  groupStat: {
    fontSize: 13,
    color: '#475569',
  },
  searchBar: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  subscriberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexBasis: 320,
    flexGrow: 1,
  },
  itemHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  formContainer: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 22,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  pickerBox: {
    maxHeight: 180,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    backgroundColor: '#F8FAFC',
  },
  pickerItem: {
    padding: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerItemActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  pickerText: {
    color: '#334155',
    fontSize: 13,
  },
  pickerTextActive: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modeBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeBtnActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  modeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  receiptBox: {
    marginTop: 22,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    padding: 18,
    borderRadius: 12,
  },
  receiptTitle: {
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 6,
  },
  receiptSub: {
    color: '#0F172A',
    fontSize: 13,
    marginTop: 3,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  emptySubText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  // --- REFERENCE DESIGN STYLES FOR LOGIN ---
  refContainer: {
    flex: 1,
    backgroundColor: '#3E5030',
  },
  refContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  refHeader: {
    alignItems: 'center',
    marginBottom: 36,
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
    maxWidth: 400,
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
    backgroundColor: '#C8FF00',
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
    maxWidth: 440,
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
  forgotModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#C8FF00',
    fontWeight: '700',
    padding: 4,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#E5EEDD',
    lineHeight: 22,
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
  profileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  profileBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileFullName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  profileDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  profileDetailItem: {
    flexBasis: 160,
    flexGrow: 1,
  },
  profileDetailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileDetailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    marginTop: 2,
  },
  changePasswordSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subSectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 10,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F2F52',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  companyCard: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    flexBasis: 320,
    flexGrow: 1,
    borderTopWidth: 4,
    borderTopColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  companyCodeBadge: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  companyNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 4,
  },
  companyMetaText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  companyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  companyStatPill: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextActive: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeSuspended: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextSuspended: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  statusToggleBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  superAdminPanelCard: {
    backgroundColor: '#0F2F52',
    borderRadius: 14,
    padding: 20,
    marginTop: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  superAdminPanelTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  superAdminPanelSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  saControlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  saControlItem: {
    flexBasis: 260,
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  saControlItemTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  saControlItemDesc: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
});
