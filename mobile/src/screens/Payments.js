import React, { useState } from 'react';
import { View, Alert, Modal, Share, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { errMsg } from '../api';
import { Screen, Card, T, H, Btn, Badge, tone, label, Loading, Empty, ErrorView, C, inr, fmtDate } from '../ui';

let Razorpay = null;
try { Razorpay = require('react-native-razorpay').default; } catch { /* not available in Expo Go: use a development build */ }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Payments() {
  const q = useQuery({ queryKey: ['payments'], queryFn: () => api.get('/tenant/payments').then((r) => r.data.items) });
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const pay = async (p) => {
    if (!Razorpay) return Alert.alert('Payments unavailable', 'Install the development build of this app to pay online (Razorpay does not run in Expo Go).');
    setBusy(p._id);
    try {
      const { data: o } = await api.post('/tenant/payments/create-order', { rentPaymentId: p._id });
      let res;
      try {
        res = await Razorpay.open({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: 'PG Rent', description: o.description, prefill: { name: o.tenant.name, email: o.tenant.email, contact: o.tenant.phone }, theme: { color: C.brand } });
      } catch (e) {
        // user cancelled / payment failed at the gateway. The server stays the source of truth.
        Alert.alert('Payment not completed', e?.description || 'You cancelled the payment. You can try again anytime.');
        return;
      }
      try { await api.post('/tenant/payments/verify', { razorpay_order_id: res.razorpay_order_id, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature }); }
      catch { /* webhook will settle it; poll below */ }
      let status = 'processing';
      for (let i = 0; i < 8 && status !== 'paid'; i += 1) { const { data } = await api.get(`/tenant/payments/${p._id}/status`); status = data.item.status; if (status !== 'paid') await wait(1500); }
      await qc.invalidateQueries({ queryKey: ['payments'] });
      Alert.alert(status === 'paid' ? 'Payment successful 🎉' : 'Payment received', status === 'paid' ? 'Your rent is paid. Receipt is available below.' : 'We are confirming your payment. It will update here shortly.');
    } catch (e) { Alert.alert('Payment error', errMsg(e)); } finally { setBusy(null); }
  };
  const viewReceipt = async (p) => { try { const { data } = await api.get(`/tenant/payments/${p._id}/receipt`); setReceipt(data.item); } catch (e) { Alert.alert('Error', errMsg(e)); } };

  if (q.isLoading) return <Loading />;
  if (q.isError) return <Screen><ErrorView error={q.error} retry={q.refetch} /></Screen>;
  const due = q.data.find((p) => p.status !== 'paid');
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      {!q.data.length ? <Empty title="No rent records yet" hint="Rent shows up here once your PG owner adds you to a room." /> : <>
        {due ? (
          <Card style={{ backgroundColor: C.navy }}>
            <T size={12} style={{ color: '#94a3b8' }}>{MONTHS[due.month - 1]} {due.year} rent</T>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginVertical: 4 }}>{inr(due.amountDue)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}><Badge text={label(due.status)} tone={tone(due.status)} /><T size={12} style={{ color: '#94a3b8' }}>Due {fmtDate(due.dueDate)}</T></View>
            <Btn title={due.status === 'processing' ? 'Continue payment' : 'Pay Now'} loading={busy === due._id} onPress={() => pay(due)} />
            <T size={11} style={{ color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>Pay with UPI (PhonePe, GPay, Paytm), cards or net banking</T>
          </Card>
        ) : <Card><T bold>🎉 All caught up</T><T mute>Your rent is fully paid.</T></Card>}
        <H style={{ fontSize: 16, marginVertical: 8 }}>Payment history</H>
        {q.data.map((p) => (
          <Card key={p._id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold>{MONTHS[p.month - 1]} {p.year}</T><Badge text={label(p.status)} tone={tone(p.status)} /></View>
            <T mute>{inr(p.amountDue)}{p.status === 'paid' ? ` · paid ${fmtDate(p.paidAt)} via ${label(p.method)}` : ` · due ${fmtDate(p.dueDate)}`}</T>
            {p.status === 'failed' && p.failureReason ? <T size={12} style={{ color: C.red }}>{p.failureReason}</T> : null}
            {p.status === 'paid' && <Btn title="View receipt" variant="secondary" style={{ marginTop: 8 }} onPress={() => viewReceipt(p)} />}
          </Card>
        ))}
      </>}
      <Modal visible={!!receipt} animationType="slide" onRequestClose={() => setReceipt(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
          {receipt && <>
            <H style={{ fontSize: 22 }}>Rent Receipt</H><T mute style={{ marginBottom: 16 }}>{receipt.receiptNumber}</T>
            {[['PG', receipt.pg], ['Address', receipt.address], ['Tenant', receipt.tenant], ['For', `${MONTHS[receipt.month - 1]} ${receipt.year}`], ['Amount', inr(receipt.amount)], ['Method', label(receipt.method)], ['Payment ID', receipt.paymentId || '—'], ['Paid on', fmtDate(receipt.paidAt)]].map(([k, v]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}><T mute>{k}</T><T bold style={{ flex: 1, textAlign: 'right' }}>{v}</T></View>)}
            <View style={{ flex: 1 }} />
            <Btn title="Share receipt" onPress={() => Share.share({ message: `Rent receipt ${receipt.receiptNumber}\n${receipt.pg}\n${MONTHS[receipt.month - 1]} ${receipt.year}: ${inr(receipt.amount)} paid on ${fmtDate(receipt.paidAt)}` })} />
            <Btn title="Close" variant="ghost" onPress={() => setReceipt(null)} />
          </>}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
