import React, { useState } from 'react';
import { View, Image, ScrollView, Text, Alert, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { errMsg } from '../api';
import { Card, T, H, Btn, Badge, Loading, Empty, ErrorView, Input, Chip, Screen, C, inr, fmtDate, ymd } from '../ui';

const W = Dimensions.get('window').width;
const Stars = ({ n }) => <Text>{'⭐'.repeat(Math.round(n))}</Text>;

export default function PgDetails({ route, navigation }) {
  const { id } = route.params;
  const q = useQuery({ queryKey: ['pg', id], queryFn: () => api.get(`/tenant/pgs/${id}`).then((r) => r.data.item) });
  const rv = useQuery({ queryKey: ['reviews', id], queryFn: () => api.get(`/tenant/pgs/${id}/reviews`).then((r) => r.data.items) });
  const qc = useQueryClient();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState('');
  const post = useMutation({ mutationFn: () => api.post(`/tenant/pgs/${id}/reviews`, { rating, comment }), onSuccess: () => { setRating(0); setComment(''); qc.invalidateQueries({ queryKey: ['reviews', id] }); qc.invalidateQueries({ queryKey: ['pg', id] }); Alert.alert('Thanks!', 'Your review was posted.'); }, onError: (e) => Alert.alert('Cannot post review', errMsg(e)) });
  const p = q.data;
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Screen><ErrorView error={q.error} retry={q.refetch} /></Screen>;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {p.images?.length ? <FlatList data={p.images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(u) => u} renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: W, height: 230 }} />} /> : <View style={{ height: 160, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 40 }}>🏠</Text></View>}
        <View style={{ padding: 16 }}>
          <H style={{ fontSize: 22 }}>{p.name}</H>
          <T mute style={{ marginTop: 2 }}>{p.address}, {p.locality}, {p.city}</T>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, alignItems: 'center' }}><Badge text={p.pgType === 'co-living' ? 'Co-living' : p.pgType === 'boys' ? 'Boys PG' : 'Girls PG'} tone="blue" />{p.rating ? <T bold>⭐ {p.rating} <T mute size={12}>({p.reviewCount} reviews)</T></T> : <T mute size={12}>No reviews yet</T>}</View>
          {p.description ? <T style={{ marginBottom: 12 }}>{p.description}</T> : null}

          <Card><H style={{ fontSize: 16, marginBottom: 8 }}>Pricing</H>
            {!p.roomTypes.length ? <T mute>Pricing not available yet.</T> : p.roomTypes.map((r) => <View key={r.sharingType} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}><T bold>{r.sharingType === 1 ? 'Single' : `${r.sharingType} sharing`}</T><View style={{ alignItems: 'flex-end' }}><T bold style={{ color: C.brand }}>{inr(r.minRent)}/mo</T><T mute size={12}>{r.vacant} vacant</T></View></View>)}</Card>

          <Card><H style={{ fontSize: 16, marginBottom: 8 }}>Facilities</H>
            {!p.facilities.length ? <T mute>No facilities listed.</T> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{p.facilities.map((f) => <View key={f._id} style={{ backgroundColor: C.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 }}><T size={13} style={{ color: C.brand }}>✓ {f.name}</T></View>)}</View>}</Card>

          <Card><H style={{ fontSize: 16, marginBottom: 8 }}>Reviews</H>
            {rv.isLoading ? <Loading /> : !rv.data?.length ? <T mute>Be the first to review this PG.</T> : rv.data.map((r) => <View key={r.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold>{r.name}</T><Stars n={r.rating} /></View>{r.comment ? <T style={{ marginTop: 2 }}>{r.comment}</T> : null}<T mute size={11}>{fmtDate(r.createdAt)}</T></View>)}
            <View style={{ marginTop: 14 }}><T bold style={{ marginBottom: 6 }}>Stayed here? Rate your experience</T>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>{[1, 2, 3, 4, 5].map((n) => <TouchableOpacity key={n} onPress={() => setRating(n)}><Text style={{ fontSize: 28, opacity: n <= rating ? 1 : 0.25 }}>⭐</Text></TouchableOpacity>)}</View>
              <Input value={comment} onChangeText={setComment} placeholder="Write a short review (optional)" multiline />
              <Btn title="Post review" variant="secondary" disabled={!rating} loading={post.isPending} onPress={() => post.mutate()} /></View></Card>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line }}><Btn title="Book a Visit" onPress={() => navigation.navigate('BookVisit', { id, name: p.name })} /></View>
    </SafeAreaView>
  );
}
