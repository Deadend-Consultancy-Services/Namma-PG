import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = { brand: '#2563eb', brandSoft: '#dbeafe', navy: '#0b1a33', bg: '#f1f5f9', card: '#fff', text: '#0f172a', mute: '#64748b', line: '#e2e8f0', green: '#16a34a', red: '#dc2626', amber: '#d97706' };
export const inr = (n = 0) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const label = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const ymd = (d = new Date()) => { const x = new Date(d.getTime() + 5.5 * 3600 * 1000); return x.toISOString().slice(0, 10); };
export const confirm = (title, msg, ok = 'Confirm', destructive = false) =>
  new Promise((res) => Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel', onPress: () => res(false) }, { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => res(true) }]));

export function Screen({ children, scroll = true, refreshing, onRefresh, pad = true, style }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[{ padding: pad ? 16 : 0, paddingBottom: 40 }, style]} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>{children}</ScrollView>
  ) : <View style={[{ flex: 1, padding: pad ? 16 : 0 }, style]}>{children}</View>;
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: C.bg }}>{body}</SafeAreaView>;
}

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const H = ({ children, style }) => <Text style={[{ fontSize: 18, fontWeight: '700', color: C.text }, style]}>{children}</Text>;
export const T = ({ children, mute, bold, size = 14, style, ...p }) => <Text {...p} style={[{ fontSize: size, color: mute ? C.mute : C.text, fontWeight: bold ? '600' : '400' }, style]}>{children}</Text>;

export function Btn({ title, onPress, loading, variant = 'primary', disabled, style }) {
  const bg = { primary: C.brand, danger: C.red, success: C.green, secondary: '#fff', ghost: 'transparent' }[variant];
  const fg = variant === 'secondary' ? C.text : variant === 'ghost' ? C.brand : '#fff';
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.8} style={[s.btn, { backgroundColor: bg, borderWidth: variant === 'secondary' ? 1 : 0, borderColor: C.line, opacity: disabled || loading ? 0.6 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Input({ label: lb, style, ...p }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {lb ? <Text style={{ fontSize: 12, fontWeight: '600', color: C.mute, marginBottom: 4 }}>{lb}</Text> : null}
      <TextInput placeholderTextColor="#94a3b8" {...p} style={[s.input, p.multiline && { height: 90, textAlignVertical: 'top' }, style]} />
    </View>
  );
}

export function Badge({ text, tone = 'gray' }) {
  const t = { green: ['#ecfdf5', '#047857'], yellow: ['#fffbeb', '#b45309'], red: ['#fef2f2', '#b91c1c'], blue: ['#eff6ff', '#1d4ed8'], gray: ['#f1f5f9', '#475569'] }[tone];
  return <View style={{ backgroundColor: t[0], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, alignSelf: 'flex-start' }}><Text style={{ color: t[1], fontSize: 11, fontWeight: '600' }}>{text}</Text></View>;
}
export const tone = (st) => ({ paid: 'green', verified: 'green', resolved: 'green', completed: 'green', pending: 'yellow', processing: 'blue', in_progress: 'blue', upcoming: 'blue', open: 'red', overdue: 'red', rejected: 'red', failed: 'red' }[st] || 'gray');

export const Loading = () => <View style={{ padding: 40 }}><ActivityIndicator size="large" color={C.brand} /></View>;
export const Empty = ({ title, hint, action }) => <View style={{ alignItems: 'center', padding: 32 }}><Text style={{ fontWeight: '600', color: C.text }}>{title}</Text>{hint ? <Text style={{ color: C.mute, textAlign: 'center', marginTop: 4 }}>{hint}</Text> : null}{action}</View>;
export const ErrorView = ({ error, retry }) => <Card><Text style={{ color: C.red }}>{error?.response?.data?.message || 'Could not load. Check your connection.'}</Text>{retry ? <Btn title="Retry" variant="secondary" onPress={retry} style={{ marginTop: 8 }} /> : null}</Card>;

export function Chip({ text, active, onPress }) {
  return <TouchableOpacity onPress={onPress} style={[s.chip, active && { backgroundColor: C.brand, borderColor: C.brand }]}><Text style={{ color: active ? '#fff' : C.text, fontSize: 13 }}>{text}</Text></TouchableOpacity>;
}

export function OtpBoxes({ value, onChange }) {
  return <TextInput value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus textContentType="oneTimeCode" placeholder="••••••" placeholderTextColor="#cbd5e1" style={{ fontSize: 30, letterSpacing: 12, textAlign: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12, backgroundColor: '#fff', marginBottom: 16 }} />;
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  btn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: C.text },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', marginRight: 8 },
});
