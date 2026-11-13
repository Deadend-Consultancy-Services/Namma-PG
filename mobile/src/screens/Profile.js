import React, { useState } from 'react';
import { View, Alert, Image, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Screen, Card, T, H, Btn, Input, Chip, Badge, tone, label, Loading, Empty, C, inr, fmtDate, ymd, confirm } from '../ui';

const DOCS = ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'college_id', 'photo'];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const qc = useQueryClient();
  const stay = useQuery({ queryKey: ['stay'], queryFn: () => api.get('/tenant/stay').then((r) => r.data.item) });
  const kyc = useQuery({ queryKey: ['kyc'], queryFn: () => api.get('/tenant/kyc').then((r) => r.data) });
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications').then((r) => r.data) });
  const [docType, setDocType] = useState('aadhaar'); const [up, setUp] = useState(false);
  const [showN, setShowN] = useState(false); const [vac, setVac] = useState(null); const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);

  const uploadKyc = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled) return;
    const a = r.assets[0]; setUp(true);
    try {
      const fd = new FormData(); fd.append('documentType', docType); fd.append('file', { uri: a.uri, name: a.fileName || 'kyc.jpg', type: a.mimeType || 'image/jpeg' });
      await api.post('/tenant/kyc', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries(); Alert.alert('Uploaded', 'Your document was sent for verification.');
    } catch (e) { Alert.alert('Upload failed', errMsg(e)); } finally { setUp(false); }
  };
  const avatar = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled) return;
    try { const fd = new FormData(); fd.append('file', { uri: r.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' }); const { data } = await api.post('/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setUser(data.user); }
    catch (e) { Alert.alert('Upload failed', errMsg(e)); }
  };
  const saveProfile = async () => {
    setBusy(true);
    try { const { data } = await api.put('/profile', { name: edit.name, email: edit.email, emergencyContact: { name: edit.ecName, phone: edit.ecPhone } }); setUser(data.user); setEdit(null); } catch (e) { Alert.alert('Error', errMsg(e)); } finally { setBusy(false); }
  };
  const giveNotice = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vac.date) || vac.date <= ymd()) return Alert.alert('Invalid date', 'Enter a future date as YYYY-MM-DD.');
    setBusy(true);
    try { await api.post('/tenant/vacate-notice', { vacateDate: vac.date, reason: vac.reason }); setVac(null); qc.invalidateQueries(); Alert.alert('Notice sent', 'Your PG owner has been informed.'); } catch (e) { Alert.alert('Error', errMsg(e)); } finally { setBusy(false); }
  };
  const openNotifs = async () => { setShowN(true); if (notifs.data?.unread) { await api.put('/notifications/read-all'); qc.invalidateQueries({ queryKey: ['notifications'] }); } };
  const s = stay.data;

  return (
    <Screen refreshing={stay.isRefetching} onRefresh={() => { stay.refetch(); kyc.refetch(); }}>
      <Card style={{ alignItems: 'center' }}>
        <TouchableOpacity onPress={avatar}>{user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: 84, height: 84, borderRadius: 42 }} /> : <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34, color: C.brand, fontWeight: '700' }}>{user.name[0]?.toUpperCase()}</Text></View>}</TouchableOpacity>
        <H style={{ marginTop: 8 }}>{user.name}</H><T mute>{user.phone}</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Btn title="Edit profile" variant="secondary" onPress={() => setEdit({ name: user.name, email: user.email || '', ecName: '', ecPhone: '' })} style={{ paddingHorizontal: 16 }} /><Btn title={`🔔 Notifications${notifs.data?.unread ? ` (${notifs.data.unread})` : ''}`} variant="secondary" onPress={openNotifs} style={{ paddingHorizontal: 16 }} /></View>
      </Card>

      <H style={{ fontSize: 16, marginVertical: 8 }}>My stay</H>
      {stay.isLoading ? <Loading /> : !s ? <Card><Empty title="Not assigned to a PG yet" hint="Once your PG owner onboards you using your phone number, your room details appear here." /></Card> : (
        <Card>
          <T bold size={16}>{s.property?.name}</T><T mute>{s.property?.address}, {s.property?.city}</T>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, flexWrap: 'wrap' }}><Badge text={`Room ${s.room?.roomNumber}`} tone="blue" /><Badge text={`Bed ${s.bed?.label}`} tone="blue" /><Badge text={`Rent ${inr(s.rentAmount)}`} tone="green" /></View>
          <T mute>Moved in {fmtDate(s.moveInDate)} · Owner: {s.owner?.name}</T>
          {s.notice ? <T style={{ color: C.amber, marginTop: 8 }}>You will vacate on {fmtDate(s.notice.vacateDate)}</T> : <Btn title="Give vacate notice" variant="secondary" style={{ marginTop: 10 }} onPress={() => setVac({ date: '', reason: '' })} />}
        </Card>
      )}

      {s && <>
        <H style={{ fontSize: 16, marginVertical: 8 }}>KYC verification</H>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><T>Status</T><Badge text={label(kyc.data?.status || 'pending')} tone={tone(kyc.data?.status || 'pending')} /></View>
          {kyc.data?.items?.map((d) => <View key={d._id} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: C.line }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T>{label(d.documentType)}</T><Badge text={label(d.status)} tone={tone(d.status)} /></View>{d.rejectionReason ? <T size={12} style={{ color: C.red }}>Reason: {d.rejectionReason}</T> : null}</View>)}
          <T mute size={12} style={{ marginTop: 10, marginBottom: 6 }}>UPLOAD A DOCUMENT</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{DOCS.map((d) => <Chip key={d} text={label(d)} active={docType === d} onPress={() => setDocType(d)} />)}</View>
          <Btn title="Choose image & upload" loading={up} onPress={uploadKyc} />
        </Card>
      </>}

      <Btn title="Log out" variant="secondary" style={{ marginTop: 8 }} onPress={async () => { if (await confirm('Log out?', '', 'Log out', true)) logout(); }} />

      <Modal visible={showN} animationType="slide" onRequestClose={() => setShowN(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><View style={{ padding: 16, flex: 1 }}>
          <H style={{ marginBottom: 10 }}>Notifications</H>
          {!notifs.data?.items?.length ? <Empty title="No notifications yet" /> : notifs.data.items.map((n) => <Card key={n._id}><T bold>{n.title}</T>{n.body ? <T mute>{n.body}</T> : null}<T mute size={11} style={{ marginTop: 2 }}>{fmtDate(n.createdAt)}</T></Card>)}
          <View style={{ flex: 1 }} /><Btn title="Close" onPress={() => setShowN(false)} />
        </View></SafeAreaView>
      </Modal>
      <Modal visible={!!edit} animationType="slide" onRequestClose={() => setEdit(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>{edit && <>
          <H style={{ marginBottom: 12 }}>Edit profile</H>
          <Input label="Full name" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} />
          <Input label="Email" value={edit.email} onChangeText={(v) => setEdit({ ...edit, email: v })} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Emergency contact name" value={edit.ecName} onChangeText={(v) => setEdit({ ...edit, ecName: v })} />
          <Input label="Emergency contact phone" value={edit.ecPhone} onChangeText={(v) => setEdit({ ...edit, ecPhone: v })} keyboardType="number-pad" />
          <Btn title="Save" loading={busy} onPress={saveProfile} /><Btn title="Cancel" variant="ghost" onPress={() => setEdit(null)} /></>}</SafeAreaView>
      </Modal>
      <Modal visible={!!vac} animationType="slide" onRequestClose={() => setVac(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>{vac && <>
          <H style={{ marginBottom: 12 }}>Vacate notice</H>
          <Input label="Vacate date (YYYY-MM-DD)" value={vac.date} onChangeText={(v) => setVac({ ...vac, date: v })} placeholder="2026-12-31" keyboardType="numbers-and-punctuation" />
          <Input label="Reason (optional)" value={vac.reason} onChangeText={(v) => setVac({ ...vac, reason: v })} multiline />
          <Btn title="Send notice" loading={busy} onPress={giveNotice} /><Btn title="Cancel" variant="ghost" onPress={() => setVac(null)} /></>}</SafeAreaView>
      </Modal>
    </Screen>
  );
}
