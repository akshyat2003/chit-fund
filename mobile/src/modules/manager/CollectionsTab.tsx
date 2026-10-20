import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../services/api';
import { mStyles } from './commonStyles';

export function CollectionsTab({ user }: { user: any }) {
  const isStaff = user?.role === 'COLLECTION_STAFF';
  const isManager = user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const [subTab, setSubTab] = useState<'RECORD' | 'TRANSACTIONS' | 'RECONCILIATION' | 'SURRENDERS'>('RECORD');
  const [refunds, setRefunds] = useState<any[]>([]);
  const [showStaffCollectModal, setShowStaffCollectModal] = useState(false);
  const [showRejectModalForRefund, setShowRejectModalForRefund] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [staffCollectNotes, setStaffCollectNotes] = useState('');
  const [refundRejectReason, setRefundRejectReason] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    digitalCount: number;
    pendingCount: number;
    pendingAmount?: number;
    approvedCount: number;
    approvedAmount?: number;
    rejectedCount: number;
    rejectedAmount?: number;
    cashCount: number;
    approvedCashAmount?: number;
  }>({
    digitalCount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    rejectedCount: 0,
    rejectedAmount: 0,
    cashCount: 0,
    approvedCashAmount: 0,
  });
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'DIGITAL' | 'CASH'>('ALL');

  // --- Payment Recording Form State ---
  // Payment Methods / Types (Installment, Advance, Arrears, etc.)
  const [installmentType, setInstallmentType] = useState<'REGULAR' | 'ADVANCE' | 'ARREARS' | 'PENALTY' | 'OTHER'>('REGULAR');
  const [selectedSubscriberId, setSelectedSubscriberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [installmentNo, setInstallmentNo] = useState('1');
  const [amount, setAmount] = useState('');

  // Payment Modes (Cash, UPI, Bank Transfer, Half Cash & Half Online Split, Cheque)
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'SPLIT' | 'CHEQUE'>('CASH');

  // Split Payment Inputs (Half Cash & Half Online)
  const [cashPortion, setCashPortion] = useState('');
  const [onlinePortion, setOnlinePortion] = useState('');
  const [splitOnlineMode, setSplitOnlineMode] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');

  // Digital reference & Proof
  const [externalRef, setExternalRef] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');

  // Mandatory Notes / Remarks
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showStaffSubmittedModal, setShowStaffSubmittedModal] = useState(false);
  const [submittedTxData, setSubmittedTxData] = useState<any>(null);

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Reconciliation Multi-Select (AC-12)
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, subRes, grpRes, refRes] = await Promise.all([
        api.get('/collections/transactions'),
        api.get('/subscribers'),
        api.get('/chit-groups'),
        api.get('/refunds').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (refRes?.data?.success) {
        setRefunds(refRes.data.data || []);
      }

      if (txRes.data.success) {
        const txs = txRes.data.data || [];
        setTransactions(txs);
        if (txRes.data.stats) {
          setStats(txRes.data.stats);
        } else {
          const approvedTx = txs.filter((t: any) => t.verificationStatus === 'VERIFIED' && !t.isReversed);
          const pendingTx = txs.filter((t: any) => t.verificationStatus === 'PENDING_VERIFICATION');
          const rejectedTx = txs.filter((t: any) => t.verificationStatus === 'REJECTED');
          const approvedAmount = approvedTx.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
          const pendingAmount = pendingTx.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
          const rejectedAmount = rejectedTx.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
          const approvedCashAmount = approvedTx.filter((t: any) => t.paymentMode === 'CASH').reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
          const digitalCount = approvedTx.filter((t: any) => t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI' || t.paymentMode === 'SPLIT').length;
          const cashCount = approvedTx.filter((t: any) => t.paymentMode === 'CASH').length;
          setStats({
            digitalCount,
            pendingCount: pendingTx.length,
            pendingAmount,
            approvedCount: approvedTx.length,
            approvedAmount,
            rejectedCount: rejectedTx.length,
            rejectedAmount,
            cashCount,
            approvedCashAmount,
          });
        }
      }

      if (subRes.data.success) {
        setSubscribers(subRes.data.data || []);
      }
      if (grpRes.data.success) {
        setGroups(grpRes.data.data || []);
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

  const pendingStaffSurrenders = refunds.filter((r) => r.status === 'ASSIGNED_TO_STAFF').length;
  const pendingManagerSurrenders = refunds.filter((r) => r.status === 'SUBMITTED_TO_MANAGER').length;
  const pendingSurrendersCount = isStaff ? pendingStaffSurrenders : pendingManagerSurrenders;

  const handleProcessRefundInCollections = async (
    refundId: string,
    status: 'SUBMITTED_TO_MANAGER' | 'APPROVED' | 'DISBURSED' | 'REJECTED',
    extra?: { notes?: string; rejectionReason?: string }
  ) => {
    try {
      setRefundProcessing(true);
      const res = await api.patch(`/refunds/${refundId}/process`, {
        status,
        notes: extra?.notes,
        rejectionReason: extra?.rejectionReason,
      });
      if (res.data.success) {
        if (status === 'APPROVED') {
          alert(
            '✓ Surrender Approved!\n\nThe member has been surrendered from the chit group. Upcoming monthly installment dues and arrears calculations have stopped for this group.'
          );
        } else if (status === 'REJECTED') {
          alert(
            '✕ Surrender Rejected.\n\nThe member remains active in the chit group, and standard monthly installment calculations will continue.'
          );
        } else if (status === 'SUBMITTED_TO_MANAGER') {
          alert('✓ Surrender collection submitted to manager for approval.');
        } else {
          alert(`Refund marked as ${status}`);
        }
        setShowStaffCollectModal(false);
        setShowRejectModalForRefund(false);
        setSelectedRefund(null);
        setStaffCollectNotes('');
        setRefundRejectReason('');
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to process refund');
    } finally {
      setRefundProcessing(false);
    }
  };

  // Update remarks helper when mode or split changes
  const applyQuickRemark = (remarkText: string) => {
    setNotes(remarkText);
  };

  // Auto calculate total when split portions change
  const handleSplitCashChange = (val: string) => {
    setCashPortion(val);
    const c = parseFloat(val) || 0;
    const o = parseFloat(onlinePortion) || 0;
    if (c + o > 0) {
      setAmount(String(c + o));
    }
    setNotes(`Half Cash & Online: Cash ₹${c}, ${splitOnlineMode} ₹${o}${externalRef ? ' (Ref: ' + externalRef + ')' : ''}`);
  };

  const handleSplitOnlineChange = (val: string) => {
    setOnlinePortion(val);
    const c = parseFloat(cashPortion) || 0;
    const o = parseFloat(val) || 0;
    if (c + o > 0) {
      setAmount(String(c + o));
    }
    setNotes(`Half Cash & Online: Cash ₹${c}, ${splitOnlineMode} ₹${o}${externalRef ? ' (Ref: ' + externalRef + ')' : ''}`);
  };

  // When a member is selected, automatically detect chit group, next installment number, and amount
  const handleSelectMember = (subscriber: any) => {
    setSelectedSubscriberId(subscriber.id);

    const memberGroupList = (subscriber.memberships || [])
      .map((m: any) => m.group)
      .filter(Boolean);

    let targetGroup = memberGroupList.length > 0 ? memberGroupList[0] : null;

    if (!targetGroup) {
      targetGroup = groups.find((g: any) =>
        (g.members || []).some((m: any) => m.subscriber?.id === subscriber.id || m.subscriberId === subscriber.id)
      );
    }

    if (targetGroup) {
      setSelectedGroupId(targetGroup.id);
      setAmount(String(targetGroup.monthlyInstallment || ''));

      const prevTransactions = transactions.filter(
        (t: any) => t.subscriberId === subscriber.id && t.groupId === targetGroup.id && !t.isReversed && t.verificationStatus === 'VERIFIED'
      );
      if (prevTransactions.length > 0) {
        const maxInst = Math.max(...prevTransactions.map((t: any) => Number(t.installmentNo) || 1));
        setInstallmentNo(String(maxInst + 1));
      } else {
        setInstallmentNo('1');
      }
    } else if (groups.length > 0) {
      const fallbackGroup = groups[0];
      setSelectedGroupId(fallbackGroup.id);
      setAmount(String(fallbackGroup.monthlyInstallment || ''));
      setInstallmentNo('1');
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = groups.find((g: any) => g.id === groupId);
    if (grp) {
      setAmount(String(grp.monthlyInstallment || ''));
      if (selectedSubscriberId) {
        const prevTransactions = transactions.filter(
          (t: any) => t.subscriberId === selectedSubscriberId && t.groupId === groupId && !t.isReversed && t.verificationStatus === 'VERIFIED'
        );
        if (prevTransactions.length > 0) {
          const maxInst = Math.max(...prevTransactions.map((t: any) => Number(t.installmentNo) || 1));
          setInstallmentNo(String(maxInst + 1));
        } else {
          setInstallmentNo('1');
        }
      }
    }
  };

  // Compress raw base64 / dataUrl via Canvas on Web, or return as is
  const processImageUri = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof document !== 'undefined' && dataUrl.startsWith('data:image')) {
        try {
          const img = document.createElement('img');
          img.onload = () => {
            const maxDim = 1200;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.75));
            } else {
              resolve(dataUrl);
            }
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
          return;
        } catch (e) {
          resolve(dataUrl);
          return;
        }
      }
      resolve(dataUrl);
    });
  };

  // Convert local file URI to Base64 Data URL reliably
  const uriToDataUrl = async (uri: string): Promise<string> => {
    if (!uri) return '';
    if (uri.startsWith('data:image')) return uri;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve((reader.result as string) || uri);
        };
        reader.onerror = () => resolve(uri);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      return uri;
    }
  };

  // 1. Pick screenshot from phone gallery or computer files
  const handlePickReceiptImage = async (targetTx?: any) => {
    try {
      // Direct launchImageLibraryAsync handles native picker on Android & iOS
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });

      // If permissions needed on older Android/iOS, explicitly request permission and retry
      if (!result) {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.granted) {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.5,
            base64: true,
          });
        }
      }

      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let photoUri = '';
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          photoUri = `data:${mime};base64,${asset.base64}`;
        } else if (asset.uri) {
          photoUri = await uriToDataUrl(asset.uri);
        }

        if (photoUri) {
          const processed = await processImageUri(photoUri);
          if (targetTx) {
            await savePhotoToTransaction(targetTx.id, processed);
          } else {
            setReceiptPhoto(processed);
            Alert.alert('Photo Attached', 'Payment screenshot selected successfully!');
          }
          return;
        }
      }
    } catch (pickerErr) {
      console.warn('ImagePicker error, trying DOM fallback:', pickerErr);
    }

    // Web DOM fallback
    if (typeof document !== 'undefined') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (uploadEvent: any) => {
              const rawData = uploadEvent.target.result as string;
              const processed = await processImageUri(rawData);
              if (targetTx) {
                await savePhotoToTransaction(targetTx.id, processed);
              } else {
                setReceiptPhoto(processed);
                Alert.alert('Photo Attached', 'Payment screenshot selected successfully!');
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      } catch (e) {
        console.warn('DOM file input error:', e);
      }
    }
  };

  // 2. Take live photo with camera
  const handleTakePhoto = async (targetTx?: any) => {
    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== 'granted') {
        const req = await ImagePicker.requestCameraPermissionsAsync();
        if (req.status !== 'granted') {
          Alert.alert('Camera Permission Required', 'Please enable camera permission in your phone settings to capture receipt photos.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let photoUri = '';
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          photoUri = `data:${mime};base64,${asset.base64}`;
        } else if (asset.uri) {
          photoUri = await uriToDataUrl(asset.uri);
        }

        if (photoUri) {
          const processed = await processImageUri(photoUri);
          if (targetTx) {
            await savePhotoToTransaction(targetTx.id, processed);
          } else {
            setReceiptPhoto(processed);
            Alert.alert('Photo Attached', 'Receipt photo captured successfully!');
          }
        }
      }
    } catch (e: any) {
      console.warn('Camera error:', e);
      Alert.alert('Camera Error', e?.message || 'Could not launch camera');
    }
  };

  // Save screenshot to an existing transaction
  const savePhotoToTransaction = async (txId: string, photo: string) => {
    try {
      setLoading(true);
      const res = await api.patch(`/collections/${txId}/photo`, { receiptPhoto: photo });
      if (res.data.success) {
        Alert.alert('Success', 'Payment screenshot attached to receipt successfully!');
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to attach screenshot to transaction');
    } finally {
      setLoading(false);
    }
  };

  // --- RECORD PAYMENT ---
  const handleRecordPayment = async () => {
    if (!selectedSubscriberId) {
      alert('Please select a member from your assigned group.');
      return;
    }
    if (!selectedGroupId) {
      alert('Please select or verify the member chit group.');
      return;
    }
    if (!installmentNo || Number(installmentNo) <= 0) {
      alert('Please enter a valid installment number.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }

    // MANDATORY REMARK VALIDATION (Cash, UPI, Bank Transfer, Split, etc.)
    if (!notes || !notes.trim()) {
      alert(
        'Mandatory Remark Required:\n\nPlease enter a collection remark. For cash, state cash details (e.g. "Cash collected in hand at counter"); for UPI, Bank Transfer or Split payments, specify payment references and breakdown.'
      );
      return;
    }

    // Digital Reference requirement
    if ((paymentMode === 'UPI' || paymentMode === 'BANK_TRANSFER' || paymentMode === 'SPLIT') && (!externalRef || !externalRef.trim())) {
      alert('Please enter the Bank / UPI / QR Transaction Reference ID (UTR).');
      return;
    }

    // Split payment validation
    if (paymentMode === 'SPLIT') {
      const c = parseFloat(cashPortion) || 0;
      const o = parseFloat(onlinePortion) || 0;
      if (c <= 0 || o <= 0) {
        alert('For Half Cash & Half Online payments, please enter both Cash portion and Online portion amounts.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await api.post('/collections/pay', {
        subscriberId: selectedSubscriberId,
        groupId: selectedGroupId,
        installmentNo: Number(installmentNo),
        amount: Number(amount),
        paymentMode,
        installmentType,
        externalRef: externalRef.trim() || undefined,
        receiptPhoto: receiptPhoto || undefined,
        notes: notes.trim(),
      });

      if (res.data.success) {
        const txData = res.data.data;
        const isPending = txData.verificationStatus === 'PENDING_VERIFICATION';

        if (isStaff && isPending) {
          // Show dedicated modal for staff to forward receipt to manager
          setSubmittedTxData(txData);
          setShowStaffSubmittedModal(true);
        } else {
          alert(
            `Payment Recorded & Approved Successfully!\nReceipt No: ${txData.receipt?.receiptNo || txData.receiptNo}\nAmount: ₹${txData.amount}`
          );
        }

        // Reset form
        setAmount('');
        setExternalRef('');
        setReceiptPhoto('');
        setNotes('');
        setCashPortion('');
        setOnlinePortion('');
        fetchData();
        if (!isStaff) {
          setSubTab('TRANSACTIONS');
        }
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // --- MANAGER: APPROVE STAFF RECEIPT ---
  const handleApproveTransaction = async (txId: string) => {
    try {
      setLoading(true);
      const res = await api.post(`/collections/${txId}/approve`);
      if (res.data.success) {
        alert(res.data.message || 'Transaction approved and verified successfully!');
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to approve transaction');
    } finally {
      setLoading(false);
    }
  };

  // --- MANAGER: REJECT STAFF RECEIPT ---
  const handleRejectTransaction = async () => {
    if (!selectedTx || !rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/collections/${selectedTx.id}/reject`, {
        reason: rejectionReason.trim(),
      });
      if (res.data.success) {
        alert(res.data.message || 'Transaction rejected.');
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedTx(null);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reject transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // --- REPRINT RECEIPT ---
  const handleReprint = async (receiptNo: string) => {
    try {
      const res = await api.post(`/collections/receipts/${receiptNo}/reprint`);
      if (res.data.success) {
        alert(`Receipt Reprint Triggered!\nPrint Count: ${res.data.data.printedCount}`);
        fetchData();
        if (selectedTx) {
          setSelectedTx({
            ...selectedTx,
            receipt: {
              ...selectedTx.receipt,
              printedCount: res.data.data.printedCount,
            },
          });
        }
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reprint receipt');
    }
  };

  // --- BULK RECONCILE (MANAGER ONLY) ---
  const handleBulkReconcile = async (status: 'VERIFIED' | 'REJECTED') => {
    if (selectedTxIds.length === 0) {
      alert('Please select at least one transaction to reconcile');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/collections/reconcile', {
        transactionIds: selectedTxIds,
        status,
        notes: `Reconciled by ${user.fullName}`,
      });
      if (res.data.success) {
        alert(`Successfully marked ${res.data.count} transactions as ${status}`);
        setSelectedTxIds([]);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  // --- REVERSE PAYMENT (MANAGER ONLY) ---
  const handleReversePayment = async () => {
    if (!selectedTx || !reversalReason.trim()) {
      alert('Reversal reason is mandatory');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/collections/${selectedTx.id}/reverse`, {
        reason: reversalReason.trim(),
      });
      if (res.data.success) {
        alert('Transaction reversed successfully. Original record preserved for audit trail.');
        setShowReversalModal(false);
        setReversalReason('');
        setSelectedTx(null);
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to reverse payment');
    } finally {
      setSubmitting(false);
    }
  };

  // --- RECEIPT SHARING HELPERS ---
  const getReceiptShareText = (tx: any, forManagerApproval: boolean = false) => {
    const rNo = tx.receipt?.receiptNo || tx.receiptNo;
    const sName = tx.subscriber?.fullName || tx.subscriberName || 'Subscriber';
    const sCode = tx.subscriber?.subscriberCode || tx.subscriberCode || '';
    const gName = tx.group?.name || tx.groupName || 'Chit Group';
    const instNo = tx.installmentNo;
    const instType = tx.installmentType || 'REGULAR';
    const amt = Number(tx.amount || 0).toLocaleString();
    const mode = tx.paymentMode;
    const ref = tx.externalRef ? `\nRef/UTR: ${tx.externalRef}` : '';
    const rmk = tx.notes ? `\nRemark: ${tx.notes}` : '';
    const staffName = tx.recordedBy?.fullName || user.fullName;
    const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : new Date().toLocaleString();

    if (forManagerApproval) {
      return `🔔 *COLLECTION RECEIPT FOR APPROVAL - CHITKART*\n----------------------------------------\nReceipt No: *${rNo}*\nDate: ${dateStr}\nMember: *${sName}* (${sCode})\nChit Group: *${gName}*\nInstallment: *#${instNo}* (${instType})\nAmount Collected: *₹${amt}*\nPayment Mode: *${mode}*${ref}${rmk}\nCollected By: *${staffName}*\nStatus: ⏳ *PENDING MANAGER APPROVAL*\n----------------------------------------\nPlease review and approve in ChitKart app.`;
    }

    return `🧾 *OFFICIAL PAYMENT RECEIPT - CHITKART*\n----------------------------------------\nReceipt No: *${rNo}*\nDate: ${dateStr}\nMember: *${sName}* (${sCode})\nChit Group: *${gName}*\nInstallment: *#${instNo}* (${instType})\nAmount Paid: *₹${amt}*\nPayment Mode: *${mode}*${ref}${rmk}\nStatus: *${tx.verificationStatus === 'VERIFIED' ? '✅ APPROVED & VERIFIED' : '⏳ PENDING APPROVAL'}*\nReceived By: *${staffName}*\n----------------------------------------\nThank you for choosing ChitKart!`;
  };

  const handleShareWhatsApp = (tx: any, forManager: boolean = false) => {
    const text = getReceiptShareText(tx, forManager);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      alert(text);
    }
  };

  const handleCopyReceiptText = async (tx: any, forManager: boolean = false) => {
    const text = getReceiptShareText(tx, forManager);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        alert('Receipt text copied to clipboard!');
      } catch (err) {
        alert(text);
      }
    } else {
      alert(text);
    }
  };

  const handlePrintReceipt = () => {
    if (typeof window !== 'undefined') {
      window.print();
    } else {
      alert('Printing is only supported in browser mode.');
    }
  };

  const toggleSelectTx = (id: string) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(selectedTxIds.filter((t) => t !== id));
    } else {
      setSelectedTxIds([...selectedTxIds, id]);
    }
  };

  // Filtered members list
  const filteredSubscribers = subscribers.filter((s: any) => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.subscriberCode?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  });

  const selectedSubscriber = subscribers.find((s: any) => s.id === selectedSubscriberId);

  // Filtered transactions list
  const filteredTx = transactions.filter((t: any) => {
    const matchesSearch =
      !search ||
      t.receiptNo?.toLowerCase().includes(search.toLowerCase()) ||
      t.subscriber?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      t.externalRef?.toLowerCase().includes(search.toLowerCase()) ||
      t.notes?.toLowerCase().includes(search.toLowerCase()) ||
      t.group?.name?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'PENDING') return t.verificationStatus === 'PENDING_VERIFICATION';
    if (statusFilter === 'VERIFIED') return t.verificationStatus === 'VERIFIED';
    if (statusFilter === 'REJECTED') return t.verificationStatus === 'REJECTED';
    if (statusFilter === 'DIGITAL') return t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI' || t.paymentMode === 'SPLIT';
    if (statusFilter === 'CASH') return t.paymentMode === 'CASH';

    return true;
  });

  return (
    <ScrollView style={mStyles.container}>
      {/* Header Bar */}
      <View style={mStyles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B' }}
            resizeMode="contain"
          />
          <View>
            <Text style={mStyles.headerTitle}>
              {isStaff ? 'Staff Collection Center' : 'Collections, Approvals & Receipts'}
            </Text>
            <Text style={mStyles.headerSubtitle}>
              {isStaff
                ? 'Collect cash, UPI, bank or split payments, attach remarks, and submit collection receipts to manager for approval.'
                : 'Collect & approve member installments, review staff collection receipts, manage cash/digital remarks, and send receipts.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={mStyles.subTabs}>
        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'RECORD' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('RECORD')}
        >
          <Text style={[mStyles.subTabText, subTab === 'RECORD' && mStyles.subTabTextActive]}>
            💵 1. Collect Payment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'TRANSACTIONS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('TRANSACTIONS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'TRANSACTIONS' && mStyles.subTabTextActive]}>
            🧾 2. Receipts & Approvals ({transactions.length})
          </Text>
        </TouchableOpacity>

        {!isStaff && (
          <TouchableOpacity
            style={[mStyles.subTabItem, subTab === 'RECONCILIATION' && mStyles.subTabItemActive]}
            onPress={() => setSubTab('RECONCILIATION')}
          >
            <Text style={[mStyles.subTabText, subTab === 'RECONCILIATION' && mStyles.subTabTextActive]}>
              🔄 3. Reconciliation Center
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[mStyles.subTabItem, subTab === 'SURRENDERS' && mStyles.subTabItemActive]}
          onPress={() => setSubTab('SURRENDERS')}
        >
          <Text style={[mStyles.subTabText, subTab === 'SURRENDERS' && mStyles.subTabTextActive]}>
            🔄 {isStaff ? '3. Surrender Requests' : '4. Surrenders & Refunds'} {pendingSurrendersCount > 0 ? `(${pendingSurrendersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* --- SUB TAB 1: RECORD COLLECTION --- */}
      {/* ========================================================================= */}
      {subTab === 'RECORD' && (
        <View style={mStyles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View>
              <Text style={mStyles.cardTitle}>
                {isStaff ? 'Collect Installment & Submit to Manager' : 'Record Member Payment Collection'}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                {isStaff
                  ? '⚠️ Staff collections are sent to Manager for digital approval before final clearance.'
                  : 'Direct manager collection is instantly verified and ready to send to the subscriber.'}
              </Text>
            </View>
            <View
              style={[
                localStyles.roleBadge,
                { backgroundColor: isStaff ? '#EFF6FF' : '#FEF3C7', borderColor: isStaff ? '#93C5FD' : '#FCD34D' },
              ]}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: isStaff ? '#1D4ED8' : '#B45309' }}>
                {isStaff ? 'STAFF MODE' : 'MANAGER MODE'}
              </Text>
            </View>
          </View>

          {/* 1. PAYMENT METHOD / TYPE */}
          <Text style={mStyles.label}>1. Collection Method / Purpose *</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { id: 'REGULAR', label: '🔵 Regular Installment' },
              { id: 'ADVANCE', label: '🟢 Advance Payment' },
              { id: 'ARREARS', label: '🟠 Arrears / Pending Dues' },
              { id: 'PENALTY', label: '🔴 Late Fee / Penalty' },
              { id: 'OTHER', label: '⚪ Other Dues' },
            ].map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[mStyles.chip, installmentType === type.id && mStyles.chipActive]}
                onPress={() => setInstallmentType(type.id as any)}
              >
                <Text style={[mStyles.chipText, installmentType === type.id && mStyles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 2. SELECT MEMBER */}
          <View style={{ marginBottom: 16 }}>
            <Text style={mStyles.label}>
              2. Select Member / Subscriber * ({filteredSubscribers.length} Members)
            </Text>

            <TextInput
              style={[mStyles.searchBar, { marginBottom: 8 }]}
              placeholder="🔍 Search member by name, code or phone..."
              value={memberSearch}
              onChangeText={setMemberSearch}
            />

            {selectedSubscriber && (
              <View style={localStyles.selectedMemberCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>
                    ✓ Selected: {selectedSubscriber.fullName} [{selectedSubscriber.subscriberCode}]
                  </Text>
                  <Text style={{ fontSize: 11, color: '#0C4A6E', marginTop: 2 }}>
                    Phone: {selectedSubscriber.phone}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSubscriberId('')}>
                  <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '800' }}>Change Member</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ maxHeight: 140 }}>
              <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }}>
                {filteredSubscribers.length === 0 ? (
                  <Text style={{ padding: 12, fontSize: 12, color: '#94A3B8' }}>
                    No members match your search.
                  </Text>
                ) : (
                  filteredSubscribers.map((s: any) => {
                    const isSelected = selectedSubscriberId === s.id;
                    const enrolledGroups = (s.memberships || []).map((m: any) => m.group?.name).filter(Boolean).join(', ');
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[localStyles.memberListItem, isSelected && { backgroundColor: '#E0F2FE' }]}
                        onPress={() => handleSelectMember(s)}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0369A1' : '#0F172A', fontSize: 13 }}>
                            {s.fullName} [{s.subscriberCode}]
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                            📞 {s.phone} {enrolledGroups ? `• Chit: ${enrolledGroups}` : ''}
                          </Text>
                        </View>
                        <View style={[localStyles.selectBadge, isSelected && { backgroundColor: '#0284C7' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#FFF' : '#475569' }}>
                            {isSelected ? 'SELECTED' : 'SELECT'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>

          {/* 3. COMPUTED INSTALLMENT DETAILS */}
          {selectedSubscriber && (
            <View style={localStyles.computedCard}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 8, letterSpacing: 0.5 }}>
                ⚡ AUTOMATICALLY COMPUTED INSTALLMENT DETAILS
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Chit Group *</Text>
                  <View style={{ maxHeight: 110 }}>
                    <ScrollView nestedScrollEnabled style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFF' }}>
                      {groups.map((g: any) => {
                        const isSelected = selectedGroupId === g.id;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={{
                              padding: 8,
                              borderBottomWidth: 1,
                              borderBottomColor: '#F1F5F9',
                              backgroundColor: isSelected ? '#E0F2FE' : '#FFF',
                            }}
                            onPress={() => handleSelectGroup(g.id)}
                          >
                            <Text style={{ fontWeight: isSelected ? '800' : '500', fontSize: 12, color: isSelected ? '#0369A1' : '#0F172A' }}>
                              {g.name} [{g.groupCode}] - ₹{g.monthlyInstallment}/mo
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>

                <View style={{ width: 140 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Installment # *</Text>
                  <TextInput
                    style={[mStyles.input, { fontWeight: '800', color: '#0284C7', backgroundColor: '#FFF' }]}
                    keyboardType="numeric"
                    placeholder="1"
                    value={installmentNo}
                    onChangeText={setInstallmentNo}
                  />
                  <Text style={{ fontSize: 10, color: '#64748B', marginTop: -6 }}>Next in sequence</Text>
                </View>

                <View style={{ width: 150 }}>
                  <Text style={[mStyles.label, { marginBottom: 4 }]}>Total Amount (₹) *</Text>
                  <TextInput
                    style={[mStyles.input, { fontWeight: '800', color: '#16A34A', fontSize: 15, backgroundColor: '#FFF' }]}
                    keyboardType="numeric"
                    placeholder="5000"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <Text style={{ fontSize: 10, color: '#64748B', marginTop: -6 }}>Monthly Chit Rate</Text>
                </View>
              </View>
            </View>
          )}

          {/* 4. PAYMENT MODES */}
          <Text style={mStyles.label}>3. Payment Mode *</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { id: 'CASH', label: '💵 Cash' },
              { id: 'UPI', label: '📱 UPI / QR Code' },
              { id: 'BANK_TRANSFER', label: '🏦 Bank Transfer' },
              { id: 'SPLIT', label: '⚖️ Half Cash & Half Online' },
              { id: 'CHEQUE', label: '📝 Cheque / DD' },
            ].map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[mStyles.chip, paymentMode === mode.id && mStyles.chipActive]}
                onPress={() => {
                  setPaymentMode(mode.id as any);
                  if (mode.id === 'CASH') {
                    setNotes('Cash received in hand at counter / field');
                  } else if (mode.id === 'UPI') {
                    setNotes('UPI Payment verified via QR code');
                  } else if (mode.id === 'BANK_TRANSFER') {
                    setNotes('Bank Transfer / NEFT payment');
                  } else if (mode.id === 'SPLIT') {
                    const half = (parseFloat(amount) || 0) / 2;
                    setCashPortion(half > 0 ? String(half) : '');
                    setOnlinePortion(half > 0 ? String(half) : '');
                    setNotes(`Half Cash & Online: Cash ₹${half}, UPI ₹${half}`);
                  }
                }}
              >
                <Text style={[mStyles.chipText, paymentMode === mode.id && mStyles.chipTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* --- SPLIT MODE INPUTS (HALF CASH & HALF ONLINE) --- */}
          {paymentMode === 'SPLIT' && (
            <View style={localStyles.splitBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 14 }}>⚖️</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                  Half Cash & Half Online Split Breakdown
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Text style={[mStyles.label, { color: '#78350F' }]}>Cash Portion (₹) *</Text>
                  <TextInput
                    style={[mStyles.input, { backgroundColor: '#FFF', borderColor: '#FCD34D' }]}
                    keyboardType="numeric"
                    placeholder="e.g. 2500"
                    value={cashPortion}
                    onChangeText={handleSplitCashChange}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 140 }}>
                  <Text style={[mStyles.label, { color: '#78350F' }]}>Online Portion (₹) *</Text>
                  <TextInput
                    style={[mStyles.input, { backgroundColor: '#FFF', borderColor: '#FCD34D' }]}
                    keyboardType="numeric"
                    placeholder="e.g. 2500"
                    value={onlinePortion}
                    onChangeText={handleSplitOnlineChange}
                  />
                </View>

                <View style={{ width: 150 }}>
                  <Text style={[mStyles.label, { color: '#78350F' }]}>Online Method *</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {(['UPI', 'BANK_TRANSFER'] as const).map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          localStyles.miniChip,
                          splitOnlineMode === m && localStyles.miniChipActive,
                        ]}
                        onPress={() => {
                          setSplitOnlineMode(m);
                          setNotes(`Half Cash & Online: Cash ₹${cashPortion}, ${m} ₹${onlinePortion}`);
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: splitOnlineMode === m ? '#FFF' : '#334155' }}>
                          {m === 'UPI' ? 'UPI' : 'Bank'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* --- DIGITAL REFERENCE (FOR UPI, BANK, SPLIT) --- */}
          {paymentMode !== 'CASH' && (
            <View style={localStyles.digitalBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 16 }}>ℹ️</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF' }}>
                  Digital Transfer Details (Required for Verification & Audit)
                </Text>
              </View>

              <View>
                <Text style={[mStyles.label, { color: '#1E3A8A' }]}>
                  Transaction ID / UTR Reference Number *
                </Text>
                <TextInput
                  style={[mStyles.input, { backgroundColor: '#FFF', borderColor: '#93C5FD' }]}
                  placeholder="e.g. UPI Ref 4291849182 / IMPS-98472918491 / UTR-0921820"
                  value={externalRef}
                  onChangeText={(val) => {
                    setExternalRef(val);
                    if (paymentMode === 'SPLIT') {
                      setNotes(`Half Cash & Online: Cash ₹${cashPortion}, ${splitOnlineMode} ₹${onlinePortion} (Ref: ${val})`);
                    }
                  }}
                />
              </View>
            </View>
          )}

          {/* --- PHOTO PROOF / PAYMENT SCREENSHOT (AVAILABLE FOR ALL PAYMENT MODES) --- */}
          <View style={[localStyles.digitalBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ fontSize: 16 }}>📷</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>
                Payment Screenshot / Receipt Proof (Optional)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[mStyles.primaryBtn, { backgroundColor: '#2563EB', paddingHorizontal: 12 }]}
                onPress={() => handlePickReceiptImage()}
              >
                <Text style={mStyles.primaryBtnText}>📁 Gallery / Screenshot</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.primaryBtn, { backgroundColor: '#059669', paddingHorizontal: 12 }]}
                onPress={() => handleTakePhoto()}
              >
                <Text style={mStyles.primaryBtnText}>📸 Take Photo</Text>
              </TouchableOpacity>


              {receiptPhoto ? (
                <TouchableOpacity
                  onPress={() => setShowPhotoModal(true)}
                  style={localStyles.photoProofBadge}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
                    ✓ Photo Attached (Click to Preview)
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {receiptPhoto ? (
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image
                  source={{ uri: receiptPhoto }}
                  style={{ width: 80, height: 60, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}
                  resizeMode="cover"
                />
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '700' }}>✓ Screenshot attached</Text>
                  <TouchableOpacity onPress={() => setReceiptPhoto('')}>
                    <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>✕ Remove Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          {/* 5. MANDATORY REMARK SECTION */}
          <View style={localStyles.remarkContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[mStyles.label, { marginBottom: 0 }]}>
                4. Mandatory Collection Remark *
              </Text>
              <View style={localStyles.mandatoryBadge}>
                <Text style={localStyles.mandatoryBadgeText}>REQUIRED FOR ALL MODES</Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
              {paymentMode === 'CASH'
                ? 'Specify cash details (e.g. "Cash collected by staff at subscriber home / office counter").'
                : paymentMode === 'SPLIT'
                ? 'Specify split breakdown (e.g. "Cash ₹X received + Online ₹Y via UPI Ref...").'
                : 'Specify digital transfer remarks and confirmation details.'}
            </Text>

            {/* Quick Remark Chips */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {paymentMode === 'CASH' && (
                <>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark('Cash received in hand at counter')}>
                    <Text style={localStyles.quickChipText}>+ Counter Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark('Field collection cash received from subscriber')}>
                    <Text style={localStyles.quickChipText}>+ Doorstep Field Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark('Full cash amount verified & deposited')}>
                    <Text style={localStyles.quickChipText}>+ Full Cash Verified</Text>
                  </TouchableOpacity>
                </>
              )}
              {paymentMode === 'UPI' && (
                <>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark(`Paid via GooglePay / PhonePe (UTR: ${externalRef || '...'}`)}>
                    <Text style={localStyles.quickChipText}>+ GPay / PhonePe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark('Scanned ChitKart QR code')}>
                    <Text style={localStyles.quickChipText}>+ QR Scan</Text>
                  </TouchableOpacity>
                </>
              )}
              {paymentMode === 'BANK_TRANSFER' && (
                <>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark(`Bank IMPS/NEFT Transfer (UTR: ${externalRef || '...'}`)}>
                    <Text style={localStyles.quickChipText}>+ NEFT / IMPS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark('Direct bank credit confirmed on statement')}>
                    <Text style={localStyles.quickChipText}>+ Statement Verified</Text>
                  </TouchableOpacity>
                </>
              )}
              {paymentMode === 'SPLIT' && (
                <>
                  <TouchableOpacity style={localStyles.quickChip} onPress={() => applyQuickRemark(`Half Cash & Online: Cash ₹${cashPortion}, ${splitOnlineMode} ₹${onlinePortion} verified`)}>
                    <Text style={localStyles.quickChipText}>+ Auto Split Breakdown</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TextInput
              style={[
                mStyles.input,
                {
                  height: 70,
                  textAlignVertical: 'top',
                  borderColor: !notes ? '#FCA5A5' : '#94A3B8',
                  backgroundColor: !notes ? '#FFF5F5' : '#FFF',
                },
              ]}
              multiline
              placeholder="Type mandatory remark here e.g. Cash received in hand / UPI UTR verified..."
              value={notes}
              onChangeText={setNotes}
            />
            {!notes && (
              <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '600' }}>
                ⚠️ Remark cannot be empty. Please enter collection details.
              </Text>
            )}
          </View>

          {/* 6. SUBMIT BUTTON */}
          <TouchableOpacity
            style={[
              mStyles.primaryBtn,
              {
                paddingVertical: 14,
                paddingHorizontal: 26,
                backgroundColor: isStaff ? '#2563EB' : '#0070BA',
                marginTop: 10,
              },
            ]}
            disabled={submitting}
            onPress={handleRecordPayment}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={[mStyles.primaryBtnText, { fontSize: 15, fontWeight: '800' }]}>
                {isStaff
                  ? '🚀 Submit Collection Receipt to Manager for Approval'
                  : '✓ Save & Approve Payment (Manager Verified)'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* --- SUB TAB 2: TRANSACTIONS & RECEIPTS --- */}
      {/* ========================================================================= */}
      {subTab === 'TRANSACTIONS' && (
        <View>
          {/* STATS OVERVIEW */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <View style={[localStyles.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>✅ APPROVED (COUNTED)</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#059669', marginTop: 4 }}>
                ₹{(stats.approvedAmount || 0).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>{stats.approvedCount} Receipts Verified</Text>
            </View>

            <View style={[localStyles.statCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>⏳ PENDING (NOT COUNTED)</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#D97706', marginTop: 4 }}>
                ₹{(stats.pendingAmount || 0).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#B45309', marginTop: 2 }}>
                {stats.pendingCount} Waiting Manager Approval
              </Text>
            </View>

            <View style={[localStyles.statCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>❌ REJECTED (NOT COUNTED)</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#DC2626', marginTop: 4 }}>
                ₹{(stats.rejectedAmount || 0).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>{stats.rejectedCount} Rejected Collections</Text>
            </View>

            <View style={[localStyles.statCard, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>💵 APPROVED CASH IN HAND</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>
                ₹{(stats.approvedCashAmount || 0).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{stats.cashCount} Cash Collections</Text>
            </View>

            <View style={[localStyles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E40AF' }}>📱 DIGITAL & SPLIT</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1D4ED8', marginTop: 4 }}>
                {stats.digitalCount}
              </Text>
              <Text style={{ fontSize: 10, color: '#3B82F6', marginTop: 2 }}>UPI, Bank & Split</Text>
            </View>
          </View>

          {/* SEARCH & FILTERS */}
          <View style={mStyles.filterRow}>
            <TextInput
              style={mStyles.searchBar}
              placeholder="Search receipt # (REC-...), member, UTR, remark..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />

            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Receipts' },
                { id: 'PENDING', label: `⏳ Pending (${stats.pendingCount})` },
                { id: 'VERIFIED', label: '✅ Approved' },
                { id: 'REJECTED', label: '❌ Rejected' },
                { id: 'DIGITAL', label: '📱 Digital/Split' },
                { id: 'CASH', label: '💵 Cash' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[mStyles.chip, statusFilter === f.id && mStyles.chipActive]}
                  onPress={() => setStatusFilter(f.id as any)}
                >
                  <Text style={[mStyles.chipText, statusFilter === f.id && mStyles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* TRANSACTIONS LIST */}
          {loading ? (
            <ActivityIndicator size="large" color="#0070BA" style={{ marginVertical: 40 }} />
          ) : filteredTx.length === 0 ? (
            <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>No collection receipts match the criteria.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredTx.map((tx: any) => {
                const isPending = tx.verificationStatus === 'PENDING_VERIFICATION';
                const isVerified = tx.verificationStatus === 'VERIFIED';
                const isRejected = tx.verificationStatus === 'REJECTED';

                return (
                  <View key={tx.id} style={mStyles.card}>
                    {/* Top Row: Receipt No & Status Badge */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0284C7' }}>
                          {tx.receiptNo}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748B' }}>
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          mStyles.badge,
                          tx.isReversed
                            ? mStyles.badgeDanger
                            : isVerified
                            ? mStyles.badgeSuccess
                            : isPending
                            ? mStyles.badgeWarning
                            : mStyles.badgeDanger,
                        ]}
                      >
                        <Text
                          style={[
                            mStyles.badgeText,
                            tx.isReversed
                              ? mStyles.badgeDangerText
                              : isVerified
                              ? mStyles.badgeSuccessText
                              : isPending
                              ? mStyles.badgeWarningText
                              : mStyles.badgeDangerText,
                            { fontSize: 10 },
                          ]}
                        >
                          {tx.isReversed
                            ? 'REVERSED'
                            : isVerified
                            ? '✓ APPROVED'
                            : isPending
                            ? '⏳ PENDING'
                            : '✕ REJECTED'}
                        </Text>
                      </View>
                    </View>

                    {/* Member & Group Info */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                          {tx.subscriber?.fullName || 'Member'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>
                          {tx.subscriber?.subscriberCode || ''} • {tx.group?.name || 'Group'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                          Inst #{tx.installmentNo}
                        </Text>
                        {tx.installmentType && (
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: '800',
                              color:
                                tx.installmentType === 'ADVANCE'
                                  ? '#16A34A'
                                  : tx.installmentType === 'ARREARS'
                                  ? '#EA580C'
                                  : '#0284C7',
                            }}
                          >
                            {tx.installmentType}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Amount & Payment Mode Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                      <View>
                        <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>AMOUNT</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: isVerified ? '#16A34A' : isPending ? '#D97706' : '#DC2626' }}>
                          ₹{Number(tx.amount || 0).toLocaleString()}
                          {!isVerified ? ' (Not Counted)' : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>PAYMENT MODE</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                          {tx.paymentMode === 'CASH'
                            ? '💵 Cash'
                            : tx.paymentMode === 'UPI'
                            ? '📱 UPI/QR'
                            : tx.paymentMode === 'SPLIT'
                            ? '⚖️ Split'
                            : '🏦 Bank'}
                        </Text>
                      </View>
                    </View>

                    {/* Details: Reference, Remarks, Collector */}
                    {(tx.externalRef || tx.notes || tx.recordedBy?.fullName) && (
                      <View style={{ marginBottom: 8, gap: 2 }}>
                        {tx.externalRef ? (
                          <Text style={{ fontSize: 11, color: '#475569' }}>
                            <Text style={{ fontWeight: '600' }}>Ref/UTR:</Text> {tx.externalRef}
                          </Text>
                        ) : null}
                        {tx.notes ? (
                          <Text style={{ fontSize: 11, color: '#334155' }}>
                            <Text style={{ fontWeight: '600' }}>Remark:</Text> {tx.notes}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 10, color: '#64748B' }}>
                          Collected by: {tx.recordedBy?.fullName || 'Staff'}
                        </Text>
                      </View>
                    )}

                    {/* Rejection Reason Notice if Rejected */}
                    {isRejected && tx.rejectionReason && (
                      <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                          ✕ Rejection Reason: {tx.rejectionReason}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#991B1B', marginTop: 1 }}>
                          This money is excluded from all counts and member balance.
                        </Text>
                      </View>
                    )}

                    {/* Action Buttons Row */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center' }}>
                      {/* View Receipt */}
                      <TouchableOpacity
                        style={[mStyles.secondaryBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}
                        onPress={() => {
                          setSelectedTx(tx);
                          setShowReceiptModal(true);
                        }}
                      >
                        <Text style={[mStyles.secondaryBtnText, { fontSize: 11 }]}>🧾 View Receipt</Text>
                      </TouchableOpacity>

                      {/* Photo preview button if attached, or attach screenshot button */}
                      {tx.receiptPhoto ? (
                        <TouchableOpacity
                          style={{ backgroundColor: '#E0F2FE', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' }}
                          onPress={() => {
                            setSelectedTx(tx);
                            setShowPhotoModal(true);
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284C7' }}>📷 Slip</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={{ backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}
                          onPress={() => handlePickReceiptImage(tx)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>📷 + Slip</Text>
                        </TouchableOpacity>
                      )}

                      {/* Staff: Send Receipt to Manager */}
                      {isStaff && isPending && (
                        <TouchableOpacity
                          style={[mStyles.primaryBtn, { backgroundColor: '#2563EB', paddingVertical: 6, paddingHorizontal: 10 }]}
                          onPress={() => handleShareWhatsApp(tx, true)}
                        >
                          <Text style={[mStyles.primaryBtnText, { fontSize: 11 }]}>📤 Send to Manager</Text>
                        </TouchableOpacity>
                      )}

                      {/* Manager: Approve / Reject Controls */}
                      {isManager && isPending && (
                        <>
                          <TouchableOpacity
                            style={[mStyles.successBtn, { paddingVertical: 6, paddingHorizontal: 12 }]}
                            onPress={() => handleApproveTransaction(tx.id)}
                          >
                            <Text style={[mStyles.successBtnText, { fontSize: 11 }]}>✓ Approve</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[mStyles.dangerBtn, { paddingVertical: 6, paddingHorizontal: 12 }]}
                            onPress={() => {
                              setSelectedTx(tx);
                              setShowRejectModal(true);
                            }}
                          >
                            <Text style={[mStyles.dangerBtnText, { fontSize: 11 }]}>✕ Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Manager: Send Approved Receipt to Member */}
                      {isManager && isVerified && (
                        <TouchableOpacity
                          style={[mStyles.primaryBtn, { backgroundColor: '#059669', paddingVertical: 6, paddingHorizontal: 10 }]}
                          onPress={() => handleShareWhatsApp(tx, false)}
                        >
                          <Text style={[mStyles.primaryBtnText, { fontSize: 11 }]}>📲 Send to Member</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* --- SUB TAB 3: RECONCILIATION CENTER (MANAGER ONLY) --- */}
      {/* ========================================================================= */}
      {!isStaff && subTab === 'RECONCILIATION' && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <Text style={{ fontSize: 13, color: '#64748B' }}>
              Match digital payments (UPI/IMPS/NEFT/Split) and cash records against bank book and issue verification.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={mStyles.successBtn}
                onPress={() => handleBulkReconcile('VERIFIED')}
              >
                <Text style={mStyles.successBtnText}>✓ Verify Selected ({selectedTxIds.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={mStyles.dangerBtn}
                onPress={() => handleBulkReconcile('REJECTED')}
              >
                <Text style={mStyles.dangerBtnText}>✕ Flag Mismatch ({selectedTxIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {transactions.map((tx) => {
              const isSelected = selectedTxIds.includes(tx.id);
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[
                    mStyles.card,
                    { padding: 12, marginBottom: 0 },
                    isSelected && { backgroundColor: '#F0F9FF', borderColor: '#0284C7' },
                  ]}
                  onPress={() => toggleSelectTx(tx.id)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>{isSelected ? '☑️' : '⬜'}</Text>
                      <Text style={{ fontWeight: '800', color: '#0284C7', fontSize: 13 }}>{tx.receiptNo}</Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color:
                          tx.verificationStatus === 'VERIFIED'
                            ? '#16A34A'
                            : tx.verificationStatus === 'REJECTED'
                            ? '#DC2626'
                            : '#D97706',
                      }}
                    >
                      {tx.verificationStatus === 'VERIFIED'
                        ? '✓ APPROVED'
                        : tx.verificationStatus === 'REJECTED'
                        ? '✕ REJECTED'
                        : '⏳ PENDING'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{tx.subscriber?.fullName}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        {tx.paymentMode} • Ref: {tx.externalRef || 'N/A (Cash)'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      ₹{tx.amount.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* --- SUB TAB 4: SURRENDERS & REFUNDS --- */}
      {/* ========================================================================= */}
      {subTab === 'SURRENDERS' && (
        <View>
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
              🔄 {isStaff ? 'Assigned Surrender Collections' : 'Member Surrenders & Refund Requests'}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              {isStaff
                ? 'Collect surrender documents, passbook and member consent, then submit to manager for approval.'
                : 'Review staff-collected surrender requests. On approval, the member enrollment is surrendered and future monthly installment calculations stop.'}
            </Text>
          </View>

          {refunds.length === 0 ? (
            <View style={[mStyles.card, { alignItems: 'center', paddingVertical: 40 }]}>
              <Text style={{ color: '#64748B', fontSize: 13 }}>No surrender or refund requests on record.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {refunds.map((r) => {
                const isAssignedToStaff = r.status === 'ASSIGNED_TO_STAFF';
                const isSubmittedToManager = r.status === 'SUBMITTED_TO_MANAGER';
                const isApproved = r.status === 'APPROVED';
                const isDisbursed = r.status === 'DISBURSED';
                const isRejected = r.status === 'REJECTED';

                return (
                  <View key={r.id} style={[mStyles.card, { padding: 14, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                          {r.subscriber?.fullName || 'Member'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>
                          ID: {r.subscriber?.subscriberCode || 'N/A'} • {r.group?.name ? `${r.group.name} (${r.group.groupCode})` : 'Chit Group'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#E11D48' }}>
                          ₹{r.amount?.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>Refund Amount</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <View
                        style={[
                          mStyles.badge,
                          isDisbursed
                            ? mStyles.badgeSuccess
                            : isApproved
                            ? mStyles.badgeInfo
                            : isRejected
                            ? mStyles.badgeDanger
                            : isSubmittedToManager
                            ? { backgroundColor: '#E0E7FF' }
                            : { backgroundColor: '#FEF3C7' },
                        ]}
                      >
                        <Text
                          style={[
                            mStyles.badgeText,
                            isDisbursed
                              ? mStyles.badgeSuccessText
                              : isApproved
                              ? mStyles.badgeInfoText
                              : isRejected
                              ? mStyles.badgeDangerText
                              : isSubmittedToManager
                              ? { color: '#3730A3', fontWeight: '700' }
                              : { color: '#92400E', fontWeight: '700' },
                          ]}
                        >
                          {isAssignedToStaff
                            ? '🟡 Assigned to Staff (Pending Collection)'
                            : isSubmittedToManager
                            ? '🔵 Submitted to Manager (Pending Approval)'
                            : isApproved
                            ? '🟢 Approved (Surrendered - Calculation Stopped)'
                            : isDisbursed
                            ? '🟣 Disbursed (Completed)'
                            : '🔴 Rejected (Active in Group - Calculation Continues)'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: '#334155' }}>
                        <Text style={{ fontWeight: '600' }}>Surrender Details:</Text> {r.reason || 'No notes provided'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Staff: Collect & Submit */}
                      {isStaff && isAssignedToStaff && (
                        <TouchableOpacity
                          style={[mStyles.primaryBtn, { backgroundColor: '#2563EB' }]}
                          onPress={() => {
                            setSelectedRefund(r);
                            setStaffCollectNotes('');
                            setShowStaffCollectModal(true);
                          }}
                        >
                          <Text style={[mStyles.primaryBtnText, { fontSize: 12 }]}>
                            📥 Collect & Submit to Manager
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Manager: Approve or Reject */}
                      {isManager && (isSubmittedToManager || isAssignedToStaff) && (
                        <>
                          <TouchableOpacity
                            style={[mStyles.successBtn]}
                            onPress={() => {
                              Alert.alert(
                                'Approve Surrender & Refund?',
                                `Are you sure you want to approve the surrender for ${r.subscriber?.fullName}?\n\nThis will remove the member from this chit group so future installment dues and charges will stop.`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: '✓ Approve',
                                    onPress: () => handleProcessRefundInCollections(r.id, 'APPROVED'),
                                  },
                                ]
                              );
                            }}
                          >
                            <Text style={[mStyles.successBtnText, { fontSize: 12 }]}>
                              ✓ Approve Surrender
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[mStyles.dangerBtn]}
                            onPress={() => {
                              setSelectedRefund(r);
                              setRefundRejectReason('');
                              setShowRejectModalForRefund(true);
                            }}
                          >
                            <Text style={[mStyles.dangerBtnText, { fontSize: 12 }]}>
                              ✕ Reject Surrender
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Manager: Disburse */}
                      {isManager && isApproved && (
                        <TouchableOpacity
                          style={mStyles.primaryBtn}
                          onPress={() => handleProcessRefundInCollections(r.id, 'DISBURSED')}
                        >
                          <Text style={[mStyles.primaryBtnText, { fontSize: 12 }]}>
                            💰 Mark Disbursed
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 1: OFFICIAL RECEIPT DISPLAY & SHARING --- */}
      {/* ========================================================================= */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 580 }]}>
            <View style={mStyles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  resizeMode="contain"
                />
                <Text style={mStyles.modalTitle}>ChitKart Official Receipt</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={localStyles.receiptPrintWrapper}>
                  {/* ChitKart Receipt Header */}
                  <View style={{ alignItems: 'center', marginBottom: 14 }}>
                    <Image
                      source={require('../../../assets/logo.png')}
                      style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F59E0B' }}
                      resizeMode="contain"
                    />
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F2F52', letterSpacing: 0.5 }}>
                      CHITKART
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                      {user.company?.name || 'Apex Chit Funds Pvt Ltd'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                      Authorized Chit Fund Management Platform
                    </Text>
                    <View style={localStyles.receiptTag}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#0284C7' }}>
                        RECEIPT NO: {selectedTx.receiptNo}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                      Status:{' '}
                      <Text
                        style={{
                          fontWeight: '800',
                          color: selectedTx.verificationStatus === 'VERIFIED' ? '#16A34A' : '#D97706',
                        }}
                      >
                        {selectedTx.verificationStatus === 'VERIFIED'
                          ? '✅ VERIFIED & APPROVED'
                          : '⏳ PENDING MANAGER APPROVAL'}
                      </Text>{' '}
                      • Print Count: {selectedTx.receipt?.printedCount || 1}
                    </Text>
                  </View>

                  {/* Receipt Details Grid */}
                  <View style={localStyles.receiptGrid}>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Subscriber / Member:</Text>
                      <Text style={localStyles.receiptValue}>
                        {selectedTx.subscriber?.fullName} [{selectedTx.subscriber?.subscriberCode}]
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Phone Number:</Text>
                      <Text style={localStyles.receiptValue}>{selectedTx.subscriber?.phone || 'N/A'}</Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Chit Group:</Text>
                      <Text style={localStyles.receiptValue}>
                        {selectedTx.group?.name} [{selectedTx.group?.groupCode}]
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Installment No & Type:</Text>
                      <Text style={localStyles.receiptValue}>
                        #{selectedTx.installmentNo} ({selectedTx.installmentType || 'REGULAR'})
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Payment Mode:</Text>
                      <Text style={localStyles.receiptValue}>
                        {selectedTx.paymentMode}{' '}
                        {selectedTx.externalRef ? `(Ref: ${selectedTx.externalRef})` : ''}
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Mandatory Remark:</Text>
                      <Text style={[localStyles.receiptValue, { color: '#0369A1', fontStyle: 'italic' }]}>
                        "{selectedTx.notes || 'Cash'}"
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Collected By:</Text>
                      <Text style={localStyles.receiptValue}>
                        {selectedTx.recordedBy?.fullName || 'Staff Agent'}
                      </Text>
                    </View>
                    <View style={localStyles.receiptRow}>
                      <Text style={localStyles.receiptLabel}>Receipt Date & Time:</Text>
                      <Text style={localStyles.receiptValue}>
                        {new Date(selectedTx.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Amount Paid Box */}
                  <View style={localStyles.receiptTotalBox}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                      TOTAL AMOUNT RECEIVED:
                    </Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#16A34A' }}>
                      ₹{selectedTx.amount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Sharing & Printing Action Buttons */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                  {/* WhatsApp button */}
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, { backgroundColor: '#25D366' }]}
                    onPress={() => handleShareWhatsApp(selectedTx, isStaff && selectedTx.verificationStatus === 'PENDING_VERIFICATION')}
                  >
                    <Text style={mStyles.primaryBtnText}>
                      {isStaff && selectedTx.verificationStatus === 'PENDING_VERIFICATION'
                        ? '📤 Send to Manager (WhatsApp)'
                        : '📲 Send to Member (WhatsApp)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Copy Text */}
                  <TouchableOpacity
                    style={mStyles.secondaryBtn}
                    onPress={() => handleCopyReceiptText(selectedTx, isStaff && selectedTx.verificationStatus === 'PENDING_VERIFICATION')}
                  >
                    <Text style={mStyles.secondaryBtnText}>📋 Copy Receipt</Text>
                  </TouchableOpacity>

                  {/* Print */}
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={handlePrintReceipt}>
                    <Text style={mStyles.secondaryBtnText}>🖨️ Print Receipt</Text>
                  </TouchableOpacity>

                  {/* Reprint official tracking */}
                  <TouchableOpacity
                    style={mStyles.primaryBtn}
                    onPress={() => handleReprint(selectedTx.receiptNo)}
                  >
                    <Text style={mStyles.primaryBtnText}>🔄 Reprint</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 2: STAFF SUBMISSION CONFIRMATION --- */}
      {/* ========================================================================= */}
      <Modal visible={showStaffSubmittedModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 500 }]}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 36, marginBottom: 6 }}>🚀</Text>
              <Text style={[mStyles.modalTitle, { textAlign: 'center' }]}>
                Receipt Submitted to Manager!
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 }}>
                Your collection receipt has been recorded and submitted for manager approval.
              </Text>
            </View>

            {submittedTxData && (
              <View style={{ backgroundColor: '#F0F9FF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>
                  Receipt No: {submittedTxData.receipt?.receiptNo || submittedTxData.receiptNo}
                </Text>
                <Text style={{ fontSize: 13, color: '#0F172A', marginTop: 4 }}>
                  Member: {submittedTxData.subscriberName}
                </Text>
                <Text style={{ fontSize: 13, color: '#0F172A' }}>
                  Amount: ₹{Number(submittedTxData.amount).toLocaleString()} ({submittedTxData.paymentMode})
                </Text>
                <Text style={{ fontSize: 12, color: '#475569', marginTop: 2, fontStyle: 'italic' }}>
                  Remark: "{submittedTxData.notes || 'Cash'}"
                </Text>
                <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', padding: 6, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309' }}>
                    ⏳ STATUS: AWAITING MANAGER APPROVAL
                  </Text>
                </View>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[mStyles.primaryBtn, { backgroundColor: '#25D366', justifyContent: 'center' }]}
                onPress={() => {
                  handleShareWhatsApp(submittedTxData, true);
                  setShowStaffSubmittedModal(false);
                }}
              >
                <Text style={[mStyles.primaryBtnText, { fontSize: 14 }]}>
                  📤 Send Receipt to Manager via WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.secondaryBtn, { justifyContent: 'center' }]}
                onPress={() => {
                  handleCopyReceiptText(submittedTxData, true);
                  setShowStaffSubmittedModal(false);
                }}
              >
                <Text style={[mStyles.secondaryBtnText, { textAlign: 'center' }]}>
                  📋 Copy Receipt Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[mStyles.secondaryBtn, { borderColor: 'transparent', justifyContent: 'center' }]}
                onPress={() => {
                  setShowStaffSubmittedModal(false);
                  setSubTab('TRANSACTIONS');
                }}
              >
                <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 13, fontWeight: '700' }}>
                  Close & View in Transactions
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 3: PHOTO PROOF PREVIEW --- */}
      {/* ========================================================================= */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={[mStyles.modalBox, { maxWidth: 500 }]}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📷 Payment Receipt Proof</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              {selectedTx?.receiptPhoto || receiptPhoto ? (
                <Image
                  source={{ uri: selectedTx?.receiptPhoto || receiptPhoto }}
                  style={{ width: '100%', height: 300, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: '#64748B' }}>No photo attached</Text>
              )}
            </View>

            <TouchableOpacity style={mStyles.primaryBtn} onPress={() => setShowPhotoModal(false)}>
              <Text style={mStyles.primaryBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 4: MANAGER REJECT MODAL --- */}
      {/* ========================================================================= */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>❌ Reject Staff Collection Receipt</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>
                    Receipt #{selectedTx.receiptNo} • ₹{selectedTx.amount.toLocaleString()} ({selectedTx.paymentMode})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    Member: {selectedTx.subscriber?.fullName} • Staff: {selectedTx.recordedBy?.fullName}
                  </Text>
                </View>

                <Text style={mStyles.label}>Reason for Rejection *</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. UTR number not matching bank statement, incorrect installment amount, cash mismatch..."
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowRejectModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleRejectTransaction}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>✕ Confirm Rejection</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 5: PAYMENT REVERSAL (MANAGER ONLY) --- */}
      {/* ========================================================================= */}
      <Modal visible={showReversalModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>↩️ Authorize Payment Reversal</Text>
              <TouchableOpacity onPress={() => setShowReversalModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>
                    Reversing Receipt: {selectedTx.receiptNo} (₹{selectedTx.amount.toLocaleString()})
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    Member: {selectedTx.subscriber?.fullName} • Original record will remain immutable with reversal status and audit timestamp.
                  </Text>
                </View>

                <Text style={mStyles.label}>Mandatory Reason for Reversal *</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Specify correction reason e.g. Wrong member account selected, duplicate entry..."
                  value={reversalReason}
                  onChangeText={setReversalReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowReversalModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={handleReversePayment}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>✓ Execute Reversal</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 6: STAFF COLLECT SURRENDER (STAFF ONLY) --- */}
      {/* ========================================================================= */}
      <Modal visible={showStaffCollectModal} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>📥 Staff Collection: Surrender & Refund</Text>
              <TouchableOpacity onPress={() => setShowStaffCollectModal(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedRefund && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: '#1E40AF' }}>
                    Member: {selectedRefund.subscriber?.fullName} [{selectedRefund.subscriber?.subscriberCode}]
                  </Text>
                  <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 2 }}>
                    Chit Group: {selectedRefund.group?.name} • Refund: ₹{selectedRefund.amount?.toLocaleString()}
                  </Text>
                </View>

                <Text style={mStyles.label}>Staff Collection Remarks / Verification Notes *</Text>
                <TextInput
                  style={[mStyles.input, { height: 85, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. Visited member, collected original passbook and signed surrender request form..."
                  value={staffCollectNotes}
                  onChangeText={setStaffCollectNotes}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowStaffCollectModal(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.primaryBtn, { backgroundColor: '#2563EB' }, refundProcessing && { opacity: 0.7 }]}
                    disabled={refundProcessing}
                    onPress={() => {
                      if (!staffCollectNotes.trim()) {
                        alert('Please enter your collection remarks / verification notes.');
                        return;
                      }
                      handleProcessRefundInCollections(selectedRefund.id, 'SUBMITTED_TO_MANAGER', { notes: staffCollectNotes.trim() });
                    }}
                  >
                    {refundProcessing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.primaryBtnText}>✓ Submit to Manager</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* --- MODAL 7: MANAGER REJECT SURRENDER --- */}
      {/* ========================================================================= */}
      <Modal visible={showRejectModalForRefund} transparent animationType="fade">
        <View style={mStyles.modalBackdrop}>
          <View style={mStyles.modalBox}>
            <View style={mStyles.modalHeader}>
              <Text style={mStyles.modalTitle}>✕ Reject Member Surrender</Text>
              <TouchableOpacity onPress={() => setShowRejectModalForRefund(false)}>
                <Text style={mStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedRefund && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: '#991B1B' }}>
                    Member: {selectedRefund.subscriber?.fullName}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                    Group: {selectedRefund.group?.name} • Refund: ₹{selectedRefund.amount?.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#7F1D1D', marginTop: 6, fontStyle: 'italic' }}>
                    ⚠️ When rejected, the member will remain active in the chit group. Regular monthly installments, arrears, and dues calculations will continue.
                  </Text>
                </View>

                <Text style={mStyles.label}>Reason for Rejection *</Text>
                <TextInput
                  style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. Surrender not compliant with mandatory lock-in period / member agreed to continue..."
                  value={refundRejectReason}
                  onChangeText={setRefundRejectReason}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={mStyles.secondaryBtn} onPress={() => setShowRejectModalForRefund(false)}>
                    <Text style={mStyles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mStyles.dangerBtn, refundProcessing && { opacity: 0.7 }]}
                    disabled={refundProcessing}
                    onPress={() => {
                      if (!refundRejectReason.trim()) {
                        alert('Please provide a reason for rejecting the surrender request.');
                        return;
                      }
                      handleProcessRefundInCollections(selectedRefund.id, 'REJECTED', { rejectionReason: refundRejectReason.trim() });
                    }}
                  >
                    {refundProcessing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={mStyles.dangerBtnText}>✕ Confirm Rejection</Text>
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

const localStyles = StyleSheet.create({
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectedMemberCard: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberListItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  computedCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  splitBox: {
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 16,
  },
  miniChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  digitalBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
    gap: 12,
  },
  photoProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  remarkContainer: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  mandatoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  quickChip: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  receiptPrintWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0F2F52',
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  receiptTag: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  receiptGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    marginVertical: 12,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 4,
  },
  receiptLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    minWidth: 120,
  },
  receiptValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  receiptTotalBox: {
    marginTop: 6,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
});
