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

export function AccountingTab({ user }: { user: any }) {
  const [subTab, setSubTab] = useState<
    'CASHBOOK' | 'BANKBOOK' | 'COA' | 'JOURNALS' | 'EXPENSES' | 'VOUCHERS' | 'GL' | 'TRIAL_BALANCE' | 'FIN_STATEMENTS'
  >('CASHBOOK');

  const [loading, setLoading] = useState(false);

  // Data states
  const [cashbook, setCashbook] = useState<any>(null);
  const [bankbook, setBankbook] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [finStatements, setFinStatements] = useState<any>(null);

  // General Ledger State
  const [selectedGlAccountId, setSelectedGlAccountId] = useState('');
  const [glData, setGlData] = useState<any>(null);

  // Modals
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [showClosePeriodModal, setShowClosePeriodModal] = useState(false);

  // Add Account Form (AC-16)
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'>('EXPENSE');
  const [accOpeningBalance, setAccOpeningBalance] = useState('0');

  // Add Expense Form (AC-18)
  const [expCategory, setExpCategory] = useState('Office Rent');
  const [expAmount, setExpAmount] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expInvoiceNo, setExpInvoiceNo] = useState('');
  const [expPaymentMode, setExpPaymentMode] = useState('CASH');
  const [expDescription, setExpDescription] = useState('');

  // Add Journal Form (AC-17)
  const [journalNarration, setJournalNarration] = useState('');
  const [journalDebitAccId, setJournalDebitAccId] = useState('');
  const [journalCreditAccId, setJournalCreditAccId] = useState('');
  const [journalAmount, setJournalAmount] = useState('');

  // Add Voucher Form (AC-19)
  const [voucherType, setVoucherType] = useState('RECEIPT');
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherNarration, setVoucherNarration] = useState('');
  const [voucherRefNo, setVoucherRefNo] = useState('');

  // Period Close Form (AC-31)
  const [closeYear, setCloseYear] = useState('2026');
  const [closeRemarks, setCloseRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTabContent = async (tab: string) => {
    try {
      setLoading(true);
      if (tab === 'CASHBOOK') {
        const res = await api.get('/accounting/cashbook');
        if (res.data.success) setCashbook(res.data.data);
      } else if (tab === 'BANKBOOK') {
        const res = await api.get('/accounting/bankbook');
        if (res.data.success) setBankbook(res.data.data);
      } else if (tab === 'COA') {
        const res = await api.get('/accounting/accounts');
        if (res.data.success) {
          setAccounts(res.data.data);
          if (res.data.data.length > 0 && !selectedGlAccountId) {
            setSelectedGlAccountId(res.data.data[0].id);
          }
        }
      } else if (tab === 'JOURNALS') {
        const [jRes, aRes] = await Promise.all([
          api.get('/accounting/journal-entries'),
          api.get('/accounting/accounts'),
        ]);
        if (jRes.data.success) setJournalEntries(jRes.data.data);
        if (aRes.data.success) {
          setAccounts(aRes.data.data);
          if (aRes.data.data.length >= 2) {
            setJournalDebitAccId(aRes.data.data[0].id);
            setJournalCreditAccId(aRes.data.data[1].id);
          }
        }
      } else if (tab === 'EXPENSES') {
        const res = await api.get('/accounting/expenses');
        if (res.data.success) setExpenses(res.data.data);
      } else if (tab === 'VOUCHERS') {
        const res = await api.get('/accounting/vouchers');
        if (res.data.success) setVouchers(res.data.data);
      } else if (tab === 'GL') {
        const aRes = await api.get('/accounting/accounts');
        if (aRes.data.success) {
          setAccounts(aRes.data.data);
          const targetId = selectedGlAccountId || (aRes.data.data.length > 0 ? aRes.data.data[0].id : '');
          if (targetId) {
            setSelectedGlAccountId(targetId);
            const glRes = await api.get(`/accounting/general-ledger/${targetId}`);
            if (glRes.data.success) setGlData(glRes.data.data);
          }
        }
      } else if (tab === 'TRIAL_BALANCE') {
        const res = await api.get('/accounting/trial-balance');
        if (res.data.success) setTrialBalance(res.data.data);
      } else if (tab === 'FIN_STATEMENTS') {
        const res = await api.get('/accounting/financial-statements');
        if (res.data.success) setFinStatements(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabContent(subTab);
  }, [subTab]);

  const loadGlForAccount = async (accId: string) => {
    setSelectedGlAccountId(accId);
    try {
      setLoading(true);
      const res = await api.get(`/accounting/general-ledger/${accId}`);
      if (res.data.success) setGlData(res.data.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  // AC-16: Create Account
  const handleCreateAccount = async () => {
    if (!accCode.trim() || !accName.trim()) {
      alert('Account code and name are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/accounting/accounts', {
        code: accCode.trim(),
        name: accName.trim(),
        type: accType,
        openingBalance: Number(accOpeningBalance),
      });
      if (res.data.success) {
        alert('Account created: ' + res.data.data.name);
        setShowAddAccountModal(false);
        setAccCode('');
        setAccName('');
        fetchTabContent('COA');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-18: Create Expense
  const handleCreateExpense = async () => {
    if (!expAmount || !expVendor.trim()) {
      alert('Amount and vendor are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/accounting/expenses', {
        category: expCategory,
        amount: Number(expAmount),
        vendor: expVendor.trim(),
        invoiceNumber: expInvoiceNo.trim() || undefined,
        paymentMode: expPaymentMode,
        description: expDescription.trim() || undefined,
      });
      if (res.data.success) {
        alert('Expense voucher recorded successfully');
        setShowAddExpenseModal(false);
        setExpAmount('');
        setExpVendor('');
        fetchTabContent('EXPENSES');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-17: Create Journal Entry
  const handleCreateJournal = async () => {
    if (!journalAmount || !journalNarration.trim() || !journalDebitAccId || !journalCreditAccId) {
      alert('Debit account, credit account, amount, and narration are required');
      return;
    }
    if (journalDebitAccId === journalCreditAccId) {
      alert('Debit and credit accounts must be different');
      return;
    }
    try {
      setSubmitting(true);
      const amt = Number(journalAmount);
      const res = await api.post('/accounting/journal-entries', {
        narration: journalNarration.trim(),
        lines: [
          { accountId: journalDebitAccId, type: 'DEBIT', amount: amt },
          { accountId: journalCreditAccId, type: 'CREDIT', amount: amt },
        ],
      });
      if (res.data.success) {
        alert('Balanced journal entry posted: ' + res.data.data.entryNo);
        setShowAddJournalModal(false);
        setJournalAmount('');
        setJournalNarration('');
        fetchTabContent('JOURNALS');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to post journal entry');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-19: Create Voucher
  const handleCreateVoucher = async () => {
    if (!voucherAmount || !voucherNarration.trim()) {
      alert('Amount and narration are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/accounting/vouchers', {
        voucherType,
        amount: Number(voucherAmount),
        narration: voucherNarration.trim(),
        referenceNo: voucherRefNo.trim() || undefined,
      });
      if (res.data.success) {
        alert('Voucher generated: ' + res.data.data.voucherNo);
        setShowAddVoucherModal(false);
        setVoucherAmount('');
        setVoucherNarration('');
        fetchTabContent('VOUCHERS');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to generate voucher');
    } finally {
      setSubmitting(false);
    }
  };

  // AC-31: Financial Closing
  const handleClosePeriod = async () => {
    try {
      setSubmitting(true);
      const res = await api.post('/accounting/close-period', {
        year: closeYear,
        notes: closeRemarks.trim() || undefined,
      });
      if (res.data.success) {
        alert(res.data.message);
        setShowClosePeriodModal(false);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Period close failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={mStyles.container}>
      {/* Header */}
      <View style={mStyles.headerRow}>
        <View>
          <Text style={mStyles.headerTitle}>📚 Comprehensive Accounting & Finance</Text>
          <Text style={mStyles.headerSubtitle}>
            AC-14 Cashbook, AC-15 Bankbook, AC-16 COA, AC-17 Journals, AC-18 Expenses, AC-20 GL, AC-21 Trial Balance & AC-22 Financials
          </Text>
        </View>
        <TouchableOpacity style={mStyles.dangerBtn} onPress={() => setShowClosePeriodModal(true)}>
          <Text style={mStyles.dangerBtnText}>🔒 Financial Closing (AC-31)</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Navigation Grid */}
      <View style={mStyles.subTabs}>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'CASHBOOK' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('CASHBOOK')}
        >
          <Text style={[mStyles.subTabText, subTab === 'CASHBOOK' && mStyles.subTabTextActive]}>
            💵 Cashbook (AC-14)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'BANKBOOK' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('BANKBOOK')}
        >
          <Text style={[mStyles.subTabText, subTab === 'BANKBOOK' && mStyles.subTabTextActive]}>
            🏦 Bankbook (AC-15)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'COA' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('COA')}
        >
          <Text style={[mStyles.subTabText, subTab === 'COA' && mStyles.subTabTextActive]}>
            🗂️ Chart of Accounts (AC-16)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'JOURNALS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('JOURNALS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'JOURNALS' && mStyles.subTabTextActive]}>
            ⚖️ Journal Entries (AC-17)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'EXPENSES' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('EXPENSES')}
        >
          <Text style={[mStyles.subTabText, subTab === 'EXPENSES' && mStyles.subTabTextActive]}>
            🧾 Expenses (AC-18)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'VOUCHERS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('VOUCHERS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'VOUCHERS' && mStyles.subTabTextActive]}>
            🎟️ Vouchers (AC-19)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'GL' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('GL')}
        >
          <Text style={[mStyles.subTabText, subTab === 'GL' && mStyles.subTabTextActive]}>
            📖 General Ledger (AC-20)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'TRIAL_BALANCE' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('TRIAL_BALANCE')}
        >
          <Text style={[mStyles.subTabText, subTab === 'TRIAL_BALANCE' && mStyles.subTabTextActive]}>
            📊 Trial Balance (AC-21)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'FIN_STATEMENTS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('FIN_STATEMENTS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'FIN_STATEMENTS' && mStyles.subTabTextActive]}>
            📈 Financial Statements (AC-22)
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
      ) : (
        <>
          {/* --- 1. CASHBOOK (AC-14) --- */}
          {subTab === 'CASHBOOK' && cashbook && (
            <View>
              <View style={mStyles.kpiRow}>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Opening Cash Float</Text>
                  <Text style={[mStyles.kpiVal, { color: '#64748B' }]}>
                    ₹{cashbook.summary?.openingCash?.toLocaleString()}
                  </Text>
                </View>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Cash Receipts (+)</Text>
                  <Text style={[mStyles.kpiVal, { color: '#16A34A' }]}>
                    +₹{cashbook.summary?.totalCashReceipts?.toLocaleString()}
                  </Text>
                </View>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Cash Expenses (-)</Text>
                  <Text style={[mStyles.kpiVal, { color: '#DC2626' }]}>
                    -₹{cashbook.summary?.totalCashExpenses?.toLocaleString()}
                  </Text>
                </View>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Closing Cash in Hand</Text>
                  <Text style={[mStyles.kpiVal, { color: '#0F2F52', fontWeight: '900' }]}>
                    ₹{cashbook.summary?.closingCashInHand?.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#0F172A' }}>
                Recent Cash Receipts & Inflows
              </Text>
              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Date</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Receipt #</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Subscriber</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Group</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Amount</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Recorded By</Text>
                </View>
                {cashbook.cashReceipts?.map((r: any) => (
                  <View key={r.id} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 120, fontWeight: '700', color: '#0284C7' }]}>
                      {r.receiptNo}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 140 }]}>{r.subscriber?.fullName}</Text>
                    <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>{r.group?.name}</Text>
                    <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700', color: '#16A34A' }]}>
                      ₹{r.amount.toLocaleString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>{r.recordedBy?.fullName}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* --- 2. BANKBOOK (AC-15) --- */}
          {subTab === 'BANKBOOK' && bankbook && (
            <View>
              <View style={mStyles.kpiRow}>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Digital Bank Receipts</Text>
                  <Text style={[mStyles.kpiVal, { color: '#16A34A' }]}>
                    ₹{bankbook.summary?.totalBankReceipts?.toLocaleString()}
                  </Text>
                </View>
                <View style={mStyles.kpiCard}>
                  <Text style={mStyles.kpiLabel}>Bank Payments & Payouts</Text>
                  <Text style={[mStyles.kpiVal, { color: '#DC2626' }]}>
                    ₹{bankbook.summary?.totalBankPayouts?.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#0F172A' }}>
                Bank Account Transaction Register
              </Text>
              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Date</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Receipt #</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Member</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Bank Ref / UTR</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Amount</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                </View>
                {bankbook.bankReceipts?.map((b: any) => (
                  <View key={b.id} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 100, fontSize: 12 }]}>
                      {new Date(b.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 120, fontWeight: '700', color: '#0284C7' }]}>
                      {b.receiptNo}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 130 }]}>{b.subscriber?.fullName}</Text>
                    <Text style={[mStyles.tableCell, { width: 130, fontSize: 12, color: '#475569' }]}>
                      {b.externalRef || 'N/A'}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 90, fontWeight: '700', color: '#16A34A' }]}>
                      ₹{b.amount.toLocaleString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>{b.verificationStatus}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* --- 3. CHART OF ACCOUNTS (AC-16) --- */}
          {subTab === 'COA' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
                <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowAddAccountModal(true)}>
                  <Text style={mStyles.primaryBtnText}>➕ Add Ledger Account (AC-16)</Text>
                </TouchableOpacity>
              </View>

              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Code</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 180 }]}>Account Name</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Classification</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Opening Bal</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Current Bal</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                </View>
                {accounts.map((acc) => (
                  <View key={acc.id} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 80, fontWeight: '700', color: '#0284C7' }]}>
                      {acc.code}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 180, fontWeight: '600' }]}>{acc.name}</Text>
                    <Text style={[mStyles.tableCell, { width: 120, fontSize: 12 }]}>{acc.type}</Text>
                    <Text style={[mStyles.tableCell, { width: 110 }]}>₹{acc.openingBalance?.toLocaleString()}</Text>
                    <Text style={[mStyles.tableCell, { width: 110, fontWeight: '700' }]}>
                      ₹{acc.currentBalance?.toLocaleString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { flex: 1, color: acc.isActive ? '#16A34A' : '#DC2626' }]}>
                      {acc.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* --- 4. JOURNAL ENTRIES (AC-17) --- */}
          {subTab === 'JOURNALS' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
                <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowAddJournalModal(true)}>
                  <Text style={mStyles.primaryBtnText}>➕ Post Balanced Journal Entry (AC-17)</Text>
                </TouchableOpacity>
              </View>

              {journalEntries.map((j) => (
                <View key={j.id} style={mStyles.card}>
                  <View style={mStyles.cardRow}>
                    <View>
                      <Text style={mStyles.cardTitle}>
                        {j.entryNo} • {new Date(j.date).toLocaleDateString()}
                      </Text>
                      <Text style={mStyles.cardSubtitle}>{j.narration}</Text>
                    </View>
                    <View style={[mStyles.badge, mStyles.badgeSuccess]}>
                      <Text style={[mStyles.badgeText, mStyles.badgeSuccessText]}>BALANCED</Text>
                    </View>
                  </View>

                  <View style={[mStyles.table, { marginTop: 10, marginBottom: 0 }]}>
                    <View style={mStyles.tableHeader}>
                      <Text style={[mStyles.tableHeaderCell, { width: 200 }]}>Account</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Type</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Debit</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Credit</Text>
                    </View>
                    {j.lines?.map((line: any) => (
                      <View key={line.id} style={mStyles.tableRow}>
                        <Text style={[mStyles.tableCell, { width: 200 }]}>
                          {line.account?.name} ({line.account?.code})
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 100, fontWeight: '700' }]}>{line.type}</Text>
                        <Text style={[mStyles.tableCell, { width: 120, color: '#0070BA', fontWeight: '700' }]}>
                          {line.type === 'DEBIT' ? `₹${line.amount?.toLocaleString()}` : '-'}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 120, color: '#16A34A', fontWeight: '700' }]}>
                          {line.type === 'CREDIT' ? `₹${line.amount?.toLocaleString()}` : '-'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* --- 5. EXPENSES (AC-18) --- */}
          {subTab === 'EXPENSES' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
                <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowAddExpenseModal(true)}>
                  <Text style={mStyles.primaryBtnText}>➕ Record Expense (AC-18)</Text>
                </TouchableOpacity>
              </View>

              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Date</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 130 }]}>Category</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Vendor / Payee</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Invoice #</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Mode</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Amount</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                </View>
                {expenses.map((exp) => (
                  <View key={exp.id} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 130, fontWeight: '700' }]}>{exp.category}</Text>
                    <Text style={[mStyles.tableCell, { width: 140 }]}>{exp.vendor || 'N/A'}</Text>
                    <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>{exp.invoiceNumber || 'N/A'}</Text>
                    <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>{exp.paymentMode}</Text>
                    <Text style={[mStyles.tableCell, { width: 100, fontWeight: '700', color: '#DC2626' }]}>
                      ₹{exp.amount?.toLocaleString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { flex: 1, color: '#16A34A', fontWeight: '700' }]}>
                      {exp.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* --- 6. VOUCHERS (AC-19) --- */}
          {subTab === 'VOUCHERS' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
                <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowAddVoucherModal(true)}>
                  <Text style={mStyles.primaryBtnText}>➕ Generate Voucher (AC-19)</Text>
                </TouchableOpacity>
              </View>

              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Voucher #</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Type</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Date</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Amount</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Narration & Reference</Text>
                </View>
                {vouchers.map((v) => (
                  <View key={v.id} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 120, fontWeight: '700', color: '#0284C7' }]}>
                      {v.voucherNo}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 100, fontWeight: '600' }]}>{v.voucherType}</Text>
                    <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>
                      {new Date(v.voucherDate).toLocaleDateString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 100, fontWeight: '800' }]}>
                      ₹{v.amount?.toLocaleString()}
                    </Text>
                    <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>
                      {v.narration} {v.referenceNo ? `(Ref: ${v.referenceNo})` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* --- 7. GENERAL LEDGER (AC-20) --- */}
          {subTab === 'GL' && (
            <View>
              <View style={{ marginBottom: 14 }}>
                <Text style={mStyles.label}>Select Ledger Account *</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[mStyles.chip, selectedGlAccountId === a.id && mStyles.chipActive]}
                      onPress={() => loadGlForAccount(a.id)}
                    >
                      <Text style={[mStyles.chipText, selectedGlAccountId === a.id && mStyles.chipTextActive]}>
                        {a.code} - {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {glData && (
                <View>
                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                      {glData.account?.name} [{glData.account?.code}] - Type: {glData.account?.type}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Opening Balance: ₹{glData.openingBalance?.toLocaleString()} • Current Balance: ₹{glData.currentBalance?.toLocaleString()}
                    </Text>
                  </View>

                  <View style={mStyles.table}>
                    <View style={mStyles.tableHeader}>
                      <Text style={[mStyles.tableHeaderCell, { width: 90 }]}>Date</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Ref / Entry</Text>
                      <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Narration</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Debit</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 100 }]}>Credit</Text>
                      <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Running Bal</Text>
                    </View>
                    {glData.entries?.map((row: any, idx: number) => (
                      <View key={idx} style={mStyles.tableRow}>
                        <Text style={[mStyles.tableCell, { width: 90, fontSize: 12 }]}>
                          {new Date(row.date).toLocaleDateString()}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 110, fontWeight: '600', color: '#0284C7' }]}>
                          {row.referenceNo}
                        </Text>
                        <Text style={[mStyles.tableCell, { flex: 1, fontSize: 12 }]}>{row.narration}</Text>
                        <Text style={[mStyles.tableCell, { width: 100, color: '#0070BA', fontWeight: '700' }]}>
                          {row.debit > 0 ? `₹${row.debit?.toLocaleString()}` : '-'}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 100, color: '#16A34A', fontWeight: '700' }]}>
                          {row.credit > 0 ? `₹${row.credit?.toLocaleString()}` : '-'}
                        </Text>
                        <Text style={[mStyles.tableCell, { width: 110, fontWeight: '800' }]}>
                          ₹{row.runningBalance?.toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* --- 8. TRIAL BALANCE (AC-21) --- */}
          {subTab === 'TRIAL_BALANCE' && trialBalance && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                  Period Trial Balance Summary
                </Text>
                <View
                  style={[
                    mStyles.badge,
                    trialBalance.isBalanced ? mStyles.badgeSuccess : mStyles.badgeDanger,
                  ]}
                >
                  <Text
                    style={[
                      mStyles.badgeText,
                      trialBalance.isBalanced ? mStyles.badgeSuccessText : mStyles.badgeDangerText,
                    ]}
                  >
                    {trialBalance.isBalanced ? '✓ VERIFIED BALANCED' : '✕ UNBALANCED'}
                  </Text>
                </View>
              </View>

              <View style={mStyles.table}>
                <View style={mStyles.tableHeader}>
                  <Text style={[mStyles.tableHeaderCell, { width: 80 }]}>Code</Text>
                  <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Account</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 110 }]}>Category</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Debit Bal (₹)</Text>
                  <Text style={[mStyles.tableHeaderCell, { width: 120 }]}>Credit Bal (₹)</Text>
                </View>
                {trialBalance.rows?.map((r: any) => (
                  <View key={r.accountId} style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { width: 80, fontWeight: '700' }]}>{r.code}</Text>
                    <Text style={[mStyles.tableCell, { flex: 1, fontWeight: '600' }]}>{r.name}</Text>
                    <Text style={[mStyles.tableCell, { width: 110, fontSize: 12 }]}>{r.type}</Text>
                    <Text style={[mStyles.tableCell, { width: 120, fontWeight: '700', color: '#0070BA' }]}>
                      {r.debitBalance > 0 ? `₹${r.debitBalance.toLocaleString()}` : '-'}
                    </Text>
                    <Text style={[mStyles.tableCell, { width: 120, fontWeight: '700', color: '#16A34A' }]}>
                      {r.creditBalance > 0 ? `₹${r.creditBalance.toLocaleString()}` : '-'}
                    </Text>
                  </View>
                ))}
                {/* Total Row */}
                <View style={[mStyles.tableRow, { backgroundColor: '#F8FAFC', borderTopWidth: 2, borderTopColor: '#0F2F52' }]}>
                  <Text style={[mStyles.tableCell, { flex: 1, fontWeight: '900', fontSize: 14 }]}>
                    GRAND TOTAL
                  </Text>
                  <Text style={[mStyles.tableCell, { width: 120, fontWeight: '900', color: '#0070BA', fontSize: 14 }]}>
                    ₹{trialBalance.totalDebits?.toLocaleString()}
                  </Text>
                  <Text style={[mStyles.tableCell, { width: 120, fontWeight: '900', color: '#16A34A', fontSize: 14 }]}>
                    ₹{trialBalance.totalCredits?.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* --- 9. FINANCIAL STATEMENTS (AC-22) --- */}
          {subTab === 'FIN_STATEMENTS' && finStatements && (
            <View>
              {/* Profit & Loss Statement */}
              <View style={[mStyles.card, { marginBottom: 20 }]}>
                <Text style={[mStyles.cardTitle, { color: '#0F2F52', fontSize: 17, marginBottom: 10 }]}>
                  📈 Profit & Loss Statement (P&L)
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Revenue / Operating Income</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Amount (₹)</Text>
                  </View>
                  <View style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { flex: 1 }]}>Foreman Commission Income (5% Contractual)</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '700', color: '#16A34A' }]}>
                      ₹{finStatements.profitAndLoss?.foremanCommissionIncome?.toLocaleString()}
                    </Text>
                  </View>
                  <View style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { flex: 1 }]}>Late Payment Penalty & Other Income</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '700', color: '#16A34A' }]}>
                      ₹{finStatements.profitAndLoss?.penaltyIncome?.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[mStyles.tableRow, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[mStyles.tableCell, { flex: 1, fontWeight: '800' }]}>Total Revenue</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '900', color: '#16A34A' }]}>
                      ₹{finStatements.profitAndLoss?.totalIncome?.toLocaleString()}
                    </Text>
                  </View>

                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Operating Expenses</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Amount (₹)</Text>
                  </View>
                  <View style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { flex: 1 }]}>Operating & Administrative Expenses</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '700', color: '#DC2626' }]}>
                      ₹{finStatements.profitAndLoss?.totalExpenses?.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[mStyles.tableRow, { backgroundColor: '#FEF2F2', borderTopWidth: 2, borderTopColor: '#0F2F52' }]}>
                    <Text style={[mStyles.tableCell, { flex: 1, fontWeight: '900', fontSize: 14 }]}>
                      NET OPERATING PROFIT / (LOSS)
                    </Text>
                    <Text
                      style={[
                        mStyles.tableCell,
                        {
                          width: 140,
                          fontWeight: '900',
                          fontSize: 16,
                          color: finStatements.profitAndLoss?.netProfit >= 0 ? '#16A34A' : '#DC2626',
                        },
                      ]}
                    >
                      ₹{finStatements.profitAndLoss?.netProfit?.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Balance Sheet */}
              <View style={mStyles.card}>
                <Text style={[mStyles.cardTitle, { color: '#0F2F52', fontSize: 17, marginBottom: 10 }]}>
                  🏛️ Balance Sheet Statement
                </Text>
                <View style={mStyles.table}>
                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Assets (Current & Non-Current)</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Amount (₹)</Text>
                  </View>
                  <View style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { flex: 1 }]}>Cash & Bank Balances + Receivables</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '800', color: '#0070BA' }]}>
                      ₹{finStatements.balanceSheet?.assets?.toLocaleString()}
                    </Text>
                  </View>

                  <View style={mStyles.tableHeader}>
                    <Text style={[mStyles.tableHeaderCell, { flex: 1 }]}>Liabilities & Net Equity</Text>
                    <Text style={[mStyles.tableHeaderCell, { width: 140 }]}>Amount (₹)</Text>
                  </View>
                  <View style={mStyles.tableRow}>
                    <Text style={[mStyles.tableCell, { flex: 1 }]}>Prize Payouts Payable & Capital</Text>
                    <Text style={[mStyles.tableCell, { width: 140, fontWeight: '800' }]}>
                      ₹{finStatements.balanceSheet?.liabilitiesAndEquity?.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* --- MODAL 1: ADD ACCOUNT (AC-16) --- */}
      <Modal visible={showAddAccountModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Add Ledger Account (AC-16)</Text>
              <TouchableOpacity onPress={() => setShowAddAccountModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Account Code *</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="e.g. 5007"
                    value={accCode}
                    onChangeText={setAccCode}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Account Classification *</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[mStyles.chip, accType === t && mStyles.chipActive]}
                        onPress={() => setAccType(t)}
                      >
                        <Text style={[mStyles.chipText, accType === t && mStyles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={mStyles.label}>Account Name *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Software & Cloud Subscriptions"
                value={accName}
                onChangeText={setAccName}
              />

              <Text style={mStyles.label}>Opening Balance (₹)</Text>
              <TextInput
                style={mStyles.input}
                keyboardType="numeric"
                placeholder="0"
                value={accOpeningBalance}
                onChangeText={setAccOpeningBalance}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAddAccountModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateAccount}
                >
                  <Text style={mStyles.primaryBtnText}>✓ Save Account</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: ADD EXPENSE (AC-18) --- */}
      <Modal visible={showAddExpenseModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>➕ Record Operating Expense (AC-18)</Text>
              <TouchableOpacity onPress={() => setShowAddExpenseModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={mStyles.label}>Expense Category *</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {['Office Rent', 'Salaries & Wages', 'Utilities & Electricity', 'Legal & Audit Fees', 'Travel & Fuel', 'Stationary & Printing', 'Miscellaneous'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[mStyles.chip, expCategory === c && mStyles.chipActive]}
                    onPress={() => setExpCategory(c)}
                  >
                    <Text style={[mStyles.chipText, expCategory === c && mStyles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Amount (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 15000"
                    value={expAmount}
                    onChangeText={setExpAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Vendor / Payee *</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="Vendor Name"
                    value={expVendor}
                    onChangeText={setExpVendor}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Invoice / Bill Number</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="INV-99881"
                    value={expInvoiceNo}
                    onChangeText={setExpInvoiceNo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Payment Method</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="CASH / BANK_TRANSFER"
                    value={expPaymentMode}
                    onChangeText={setExpPaymentMode}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Description / Purpose</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Monthly office maintenance and internet..."
                value={expDescription}
                onChangeText={setExpDescription}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAddExpenseModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateExpense}
                >
                  <Text style={mStyles.primaryBtnText}>✓ Post Expense</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 3: POST BALANCED JOURNAL (AC-17) --- */}
      <Modal visible={showAddJournalModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>⚖️ Post Balanced Double-Entry Journal (AC-17)</Text>
              <TouchableOpacity onPress={() => setShowAddJournalModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={mStyles.label}>Debit Account *</Text>
              <View style={{ maxHeight: 120, marginBottom: 12 }}>
                <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={{
                        padding: 8,
                        backgroundColor: journalDebitAccId === a.id ? '#E0F2FE' : '#FFF',
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                      }}
                      onPress={() => setJournalDebitAccId(a.id)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: journalDebitAccId === a.id ? '700' : '400', color: '#0F172A' }}>
                        DR: {a.code} - {a.name} ({a.type})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={mStyles.label}>Credit Account *</Text>
              <View style={{ maxHeight: 120, marginBottom: 12 }}>
                <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={{
                        padding: 8,
                        backgroundColor: journalCreditAccId === a.id ? '#DCFCE7' : '#FFF',
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                      }}
                      onPress={() => setJournalCreditAccId(a.id)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: journalCreditAccId === a.id ? '700' : '400', color: '#0F172A' }}>
                        CR: {a.code} - {a.name} ({a.type})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={mStyles.label}>Amount (₹) *</Text>
              <TextInput
                style={mStyles.input}
                keyboardType="numeric"
                placeholder="Balanced amount e.g. 25000"
                value={journalAmount}
                onChangeText={setJournalAmount}
              />

              <Text style={mStyles.label}>Narration / Legal Evidence *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="e.g. Depreciation adjustment / prize settlement transfer"
                value={journalNarration}
                onChangeText={setJournalNarration}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAddJournalModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateJournal}
                >
                  <Text style={mStyles.primaryBtnText}>✓ Post Balanced Entry</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 4: ADD VOUCHER (AC-19) --- */}
      <Modal visible={showAddVoucherModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>🎟️ Generate Financial Voucher (AC-19)</Text>
              <TouchableOpacity onPress={() => setShowAddVoucherModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={mStyles.label}>Voucher Type *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'].map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[mStyles.chip, voucherType === vt && mStyles.chipActive]}
                    onPress={() => setVoucherType(vt)}
                  >
                    <Text style={[mStyles.chipText, voucherType === vt && mStyles.chipTextActive]}>{vt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>Amount (₹) *</Text>
                  <TextInput
                    style={mStyles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 50000"
                    value={voucherAmount}
                    onChangeText={setVoucherAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.label}>External Reference #</Text>
                  <TextInput
                    style={mStyles.input}
                    placeholder="Cheque # / UTR"
                    value={voucherRefNo}
                    onChangeText={setVoucherRefNo}
                  />
                </View>
              </View>

              <Text style={mStyles.label}>Narration / Justification *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="Payment voucher for monthly branch rent / contra transfer..."
                value={voucherNarration}
                onChangeText={setVoucherNarration}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowAddVoucherModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.primaryBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleCreateVoucher}
                >
                  <Text style={mStyles.primaryBtnText}>✓ Issue Voucher</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 5: FINANCIAL CLOSING (AC-31) --- */}
      <Modal visible={showClosePeriodModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>🔒 Financial Period Closing (AC-31)</Text>
              <TouchableOpacity onPress={() => setShowClosePeriodModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <Text style={{ fontWeight: '700', color: '#92400E' }}>
                  Statutory Period Reconciliation Lock
                </Text>
                <Text style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                  Closing locks period books, generates trial balance signoff, and logs compliance confirmation in the permanent audit register.
                </Text>
              </View>

              <Text style={mStyles.label}>Closing Financial Year *</Text>
              <TextInput
                style={mStyles.input}
                placeholder="2026"
                value={closeYear}
                onChangeText={setCloseYear}
              />

              <Text style={mStyles.label}>Auditor & Accountant Signoff Remarks</Text>
              <TextInput
                style={[mStyles.input, { height: 70, textAlignVertical: 'top' }]}
                multiline
                placeholder="All general ledgers, trial balances, and bank statements reconciled without discrepancies..."
                value={closeRemarks}
                onChangeText={setCloseRemarks}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowClosePeriodModal(false)}>
                  <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleClosePeriod}
                >
                  <Text style={mStyles.dangerBtnText}>✓ Execute Period Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
