import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, OtpBoxes, C, T, H, Card } from '../ui';

const Shell = ({ title, sub, children, footer }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 22 }}>
          <H style={{ fontSize: 22 }}>{title}</H>{sub ? <T mute style={{ marginTop: 2, marginBottom: 16 }}>{sub}</T> : <View style={{ height: 16 }} />}
          {children}
          {footer ? <View style={{ marginTop: 16, alignItems: 'center' }}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
const Link = ({ text, onPress, strong }) => <TouchableOpacity onPress={onPress}><Text style={{ color: C.brand, fontWeight: strong ? '700' : '500' }}>{text}</Text></TouchableOpacity>;

export function Welcome({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}><Text style={{ fontSize: 40 }}>🏠</Text></View>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' }}>Find your perfect PG</Text>
      <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 10, marginBottom: 32 }}>Search, visit, pay rent and stay connected with your PG — all in one app.</Text>
      <Btn title="Get Started" onPress={() => navigation.navigate('Role')} style={{ alignSelf: 'stretch' }} />
    </SafeAreaView>
  );
}

export function RoleSelect({ navigation }) {
  const { setRole } = useAuth();
  const Opt = ({ icon, title, desc, onPress }) => (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}><T bold size={16}>{title}</T><T mute>{desc}</T></View>
    </TouchableOpacity>
  );
  return (
    <Shell title="Who are you?" sub="Choose how you will use the app" footer={<Link text="← Back" onPress={() => navigation.goBack()} />}>
      <Opt icon="🧑‍🎓" title="I am a Tenant" desc="Find a PG, pay rent, raise concerns" onPress={() => { setRole('tenant'); navigation.navigate('Login'); }} />
      <Opt icon="🏢" title="I am a PG Owner" desc="Owners use the web dashboard" onPress={() => Alert.alert('PG Owner', 'The owner experience is on the web dashboard. Open it in your browser to manage properties, tenants, rent and expenses.')} />
    </Shell>
  );
}

export function Login({ navigation }) {
  const { setSession } = useAuth();
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const go = async () => {
    if (!phone || !password) return Alert.alert('Missing details', 'Enter your phone number and password.');
    setBusy(true);
    try { const { data } = await api.post('/auth/login', { phone, password, role: 'tenant' }); await setSession(data); }
    catch (e) { Alert.alert('Login failed', errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Tenant login" sub="Log in with your phone number" footer={<View style={{ alignItems: 'center', gap: 8 }}><View style={{ flexDirection: 'row', gap: 4 }}><T mute>New here?</T><Link strong text="Create account" onPress={() => navigation.navigate('Signup')} /></View><Link text="Forgot password?" onPress={() => navigation.navigate('Forgot')} /></View>}>
      <Input label="Phone number" keyboardType="number-pad" maxLength={13} value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" autoComplete="tel" />
      <Input label="Password" secureTextEntry={!show} value={password} onChangeText={setPassword} autoComplete="password" />
      <TouchableOpacity onPress={() => setShow(!show)} style={{ alignSelf: 'flex-end', marginTop: -6, marginBottom: 12 }}><T style={{ color: C.brand }} size={12}>{show ? 'Hide' : 'Show'} password</T></TouchableOpacity>
      <Btn title="Login" onPress={go} loading={busy} />
    </Shell>
  );
}

function useCountdown() {
  const [n, setN] = useState(0);
  useEffect(() => { if (n <= 0) return undefined; const t = setTimeout(() => setN(n - 1), 1000); return () => clearTimeout(t); }, [n]);
  return [n, setN];
}

export function Signup({ navigation }) {
  const { setSession } = useAuth();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', phone: '', password: '', confirm: '' });
  const [otp, setOtp] = useState(''); const [busy, setBusy] = useState(false); const [wait, setWait] = useCountdown();
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const send = async () => {
    if (f.name.trim().length < 2) return Alert.alert('Name required', 'Enter your full name.');
    if (f.password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (f.password !== f.confirm) return Alert.alert('Passwords differ', 'Password and confirmation do not match.');
    setBusy(true);
    try { const { data } = await api.post('/auth/signup/send-otp', { name: f.name, phone: f.phone, password: f.password, role: 'tenant' }); setStep(2); setWait(data.resendInSec || 45); setOtp(''); }
    catch (e) { Alert.alert('Could not send OTP', errMsg(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (otp.length !== 6) return Alert.alert('Enter OTP', 'Type the 6-digit code.');
    setBusy(true);
    try { const { data } = await api.post('/auth/signup/verify-otp', { phone: f.phone, otp }); await setSession(data); }
    catch (e) { Alert.alert('Verification failed', errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Shell title={step === 1 ? 'Create account' : 'Verify your number'} sub={step === 1 ? 'If your PG owner added you, use the same phone number' : `Enter the OTP sent to ${f.phone}`} footer={<View style={{ flexDirection: 'row', gap: 4 }}><T mute>Have an account?</T><Link strong text="Login" onPress={() => navigation.navigate('Login')} /></View>}>
      {step === 1 ? <>
        <Input label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
        <Input label="Phone number" keyboardType="number-pad" maxLength={13} value={f.phone} onChangeText={set('phone')} placeholder="10-digit mobile number" />
        <Input label="Password" secureTextEntry value={f.password} onChangeText={set('password')} placeholder="At least 8 characters" />
        <Input label="Confirm password" secureTextEntry value={f.confirm} onChangeText={set('confirm')} />
        <Btn title="Send OTP" onPress={send} loading={busy} />
      </> : <>
        <OtpBoxes value={otp} onChange={setOtp} />
        <Btn title="Verify & create account" onPress={verify} loading={busy} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}><Link text="← Edit details" onPress={() => setStep(1)} /><TouchableOpacity disabled={wait > 0 || busy} onPress={send}><Text style={{ color: wait > 0 ? '#94a3b8' : C.brand, fontWeight: '600' }}>{wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}</Text></TouchableOpacity></View>
      </>}
    </Shell>
  );
}

export function Forgot({ navigation }) {
  const [step, setStep] = useState(1); const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [wait, setWait] = useCountdown();
  const send = async () => { setBusy(true); try { const { data } = await api.post('/auth/forgot/send-otp', { phone }); setStep(2); setWait(data.resendInSec || 45); } catch (e) { Alert.alert('Error', errMsg(e)); } finally { setBusy(false); } };
  const reset = async () => {
    if (pw.length < 8) return Alert.alert('Weak password', 'At least 8 characters.');
    setBusy(true);
    try { await api.post('/auth/forgot/reset', { phone, otp, newPassword: pw }); Alert.alert('Done', 'Password updated. Please log in.'); navigation.navigate('Login'); }
    catch (e) { Alert.alert('Error', errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset password" sub={step === 1 ? 'We will send an OTP to your phone' : 'Enter the OTP and a new password'} footer={<Link text="Back to login" onPress={() => navigation.navigate('Login')} />}>
      {step === 1 ? <><Input label="Phone number" keyboardType="number-pad" value={phone} onChangeText={setPhone} maxLength={13} /><Btn title="Send OTP" onPress={send} loading={busy} /></>
        : <><OtpBoxes value={otp} onChange={setOtp} /><Input label="New password" secureTextEntry value={pw} onChangeText={setPw} /><Btn title="Update password" onPress={reset} loading={busy} /><TouchableOpacity disabled={wait > 0} onPress={send} style={{ marginTop: 12, alignItems: 'center' }}><Text style={{ color: wait > 0 ? '#94a3b8' : C.brand }}>{wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}</Text></TouchableOpacity></>}
    </Shell>
  );
}
