import React, { useState } from 'react';
import { View, Alert, Linking, Image, Text, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errMsg } from '../api';
import { Screen, Card, T, H, Btn, Input, Chip, Badge, tone, label, Loading, Empty, ErrorView, C, fmtDate, confirm } from '../ui';

const CATS = ['maintenance', 'food', 'cleanliness', 'noise', 'safety', 'other'];

export default function Concerns() {
  const q = useQuery({ queryKey: ['concerns'], queryFn: () => api.get('/tenant/concerns').then((r) => r.data.items) });
  const qc = useQueryClient();
  const [cat, setCat] = useState('maintenance'); const [desc, setDesc] = useState(''); const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false); const [sos, setSos] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setImg(r.assets[0]);
  };
  const submit = async () => {
    if (desc.trim().length < 5) return Alert.alert('Describe the issue', 'Please write at least a few words.');
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('category', cat); fd.append('description', desc.trim());
      if (img) fd.append('file', { uri: img.uri, name: img.fileName || 'photo.jpg', type: img.mimeType || 'image/jpeg' });
      await api.post('/tenant/concerns', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDesc(''); setImg(null); qc.invalidateQueries({ queryKey: ['concerns'] }); Alert.alert('Submitted', 'Your PG owner has been notified.');
    } catch (e) { Alert.alert('Could not submit', errMsg(e)); } finally { setBusy(false); }
  };
  const emergency = async () => {
    if (!(await confirm('Send emergency alert?', 'This immediately notifies your PG owner with your name, room and phone number.', 'Send alert', true))) return;
    setSos(true);
    try {
      const { data } = await api.post('/tenant/emergency', {});
      qc.invalidateQueries({ queryKey: ['concerns'] });
      Alert.alert('Alert sent', 'Your PG owner has been notified.', data.owner?.phone ? [{ text: 'Call owner now', onPress: () => Linking.openURL(`tel:${data.owner.phone}`) }, { text: 'OK' }] : [{ text: 'OK' }]);
    } catch (e) { Alert.alert('Could not send alert', errMsg(e) + '\nIf this is urgent, call your owner or emergency services directly.'); } finally { setSos(false); }
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <TouchableOpacity activeOpacity={0.85} disabled={sos} onPress={emergency} style={{ backgroundColor: C.red, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 14, opacity: sos ? 0.6 : 1 }}>
        <Text style={{ fontSize: 28 }}>🚨</Text><Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>EMERGENCY</Text><Text style={{ color: '#fecaca', fontSize: 12 }}>Tap to alert your PG owner instantly</Text>
      </TouchableOpacity>
      <Card>
        <H style={{ fontSize: 16, marginBottom: 8 }}>Raise a concern</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{CATS.map((c) => <Chip key={c} text={label(c)} active={cat === c} onPress={() => setCat(c)} />)}</View>
        <Input value={desc} onChangeText={setDesc} multiline placeholder="Describe the issue…" maxLength={2000} />
        {img && <Image source={{ uri: img.uri }} style={{ height: 120, borderRadius: 10, marginBottom: 10 }} />}
        <View style={{ flexDirection: 'row', gap: 8 }}><Btn title={img ? 'Change photo' : '📷 Add photo'} variant="secondary" onPress={pick} style={{ flex: 1 }} /><Btn title="Submit" onPress={submit} loading={busy} style={{ flex: 1 }} /></View>
      </Card>
      <H style={{ fontSize: 16, marginVertical: 8 }}>My concerns</H>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView error={q.error} retry={q.refetch} /> : !q.data.length ? <Empty title="No concerns raised" /> : q.data.map((c) => (
        <Card key={c._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold>{c.isEmergency ? '🚨 Emergency' : label(c.category)}</T><Badge text={label(c.status)} tone={tone(c.status)} /></View>
          <T style={{ marginTop: 4 }}>{c.description}</T><T mute size={11} style={{ marginTop: 2 }}>{fmtDate(c.createdAt)}</T>
          {c.updates?.map((u, i) => <View key={i} style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginTop: 6 }}><T size={12}><T bold size={12}>{label(u.by)}:</T> {u.message}</T></View>)}
        </Card>
      ))}
    </Screen>
  );
}
