import React, { useState } from 'react';
import { View, Image, TouchableOpacity, FlatList, Modal, ScrollView, Text } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api';
import { Card, T, H, Input, Btn, Badge, Chip, Loading, Empty, ErrorView, C, inr } from '../ui';

export default function Search({ navigation }) {
  const [f, setF] = useState({ q: '', locality: '', area: '', type: '', sharing: '', minPrice: '', maxPrice: '' });
  const [applied, setApplied] = useState(f);
  const [open, setOpen] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['search', applied], initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get('/tenant/pgs/search', { params: { ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== '')), page: pageParam } }).then((r) => r.data),
    getNextPageParam: (l) => (l.page < l.pages ? l.page + 1 : undefined),
  });
  const items = q.data?.pages.flatMap((p) => p.items) || [];
  const activeFilters = ['locality', 'area', 'type', 'sharing', 'minPrice', 'maxPrice'].filter((k) => applied[k]).length;
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const apply = () => { setApplied(f); setOpen(false); };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <H style={{ fontSize: 22, marginBottom: 10 }}>Find a PG</H>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Input value={f.q} onChangeText={set('q')} placeholder="Search by name, area, locality…" returnKeyType="search" onSubmitEditing={apply} style={{ marginBottom: 0 }} /></View>
          <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: activeFilters ? C.brand : '#fff', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ color: activeFilters ? '#fff' : C.text, fontWeight: '600' }}>Filters{activeFilters ? ` (${activeFilters})` : ''}</Text></TouchableOpacity>
        </View>
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <View style={{ padding: 16 }}><ErrorView error={q.error} retry={q.refetch} /></View> : (
        <FlatList data={items} keyExtractor={(i) => i._id} contentContainerStyle={{ padding: 16, paddingTop: 4 }} refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={q.refetch}
          onEndReached={() => q.hasNextPage && q.fetchNextPage()} onEndReachedThreshold={0.4}
          ListEmptyComponent={<Empty title="No PGs found" hint="Try different filters or search words." action={activeFilters ? <Btn title="Clear filters" variant="secondary" style={{ marginTop: 12 }} onPress={() => { const c = { q: '', locality: '', area: '', type: '', sharing: '', minPrice: '', maxPrice: '' }; setF(c); setApplied(c); }} /> : null} />}
          ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
          renderItem={({ item: p }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('PgDetails', { id: p._id, name: p.name })}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ height: 150, width: '100%' }} /> : <View style={{ height: 110, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32 }}>🏠</Text></View>}
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold size={16} style={{ flex: 1 }}>{p.name}</T>{p.rating ? <T bold>⭐ {p.rating} <T mute size={12}>({p.reviewCount})</T></T> : <T mute size={12}>No reviews yet</T>}</View>
                  <T mute>{p.locality}, {p.city}</T>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}><Badge text={p.pgType === 'co-living' ? 'Co-living' : p.pgType === 'boys' ? 'Boys' : 'Girls'} tone="blue" /><Badge text={`${p.vacantBeds} bed${p.vacantBeds === 1 ? '' : 's'} vacant`} tone={p.vacantBeds ? 'green' : 'red'} />{p.facilities?.slice(0, 3).map((x) => <Badge key={x.name} text={x.name} />)}</View>
                  <T bold size={16} style={{ marginTop: 8, color: C.brand }}>{p.minRent != null ? `From ${inr(p.minRent)}/month` : 'Price on request'}</T>
                </View>
              </Card>
            </TouchableOpacity>
          )} />
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <H style={{ marginBottom: 12 }}>Filters</H>
            <Input label="City / Area" value={f.area} onChangeText={set('area')} placeholder="e.g. Bengaluru" />
            <Input label="Locality" value={f.locality} onChangeText={set('locality')} placeholder="e.g. Koramangala" />
            <T mute bold size={12} style={{ marginBottom: 6 }}>PG TYPE</T>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>{[['', 'Any'], ['boys', 'Boys'], ['girls', 'Girls'], ['co-living', 'Co-living']].map(([v, l]) => <Chip key={v} text={l} active={f.type === v} onPress={() => set('type')(v)} />)}</View>
            <T mute bold size={12} style={{ marginBottom: 6 }}>SHARING</T>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>{[['', 'Any'], ['1', 'Single'], ['2', '2'], ['3', '3'], ['4', '4']].map(([v, l]) => <Chip key={v} text={l} active={f.sharing === v} onPress={() => set('sharing')(v)} />)}</View>
            <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label="Min price (₹)" keyboardType="number-pad" value={f.minPrice} onChangeText={set('minPrice')} /></View><View style={{ flex: 1 }}><Input label="Max price (₹)" keyboardType="number-pad" value={f.maxPrice} onChangeText={set('maxPrice')} /></View></View>
            <Btn title="Show results" onPress={apply} />
            <Btn title="Reset" variant="ghost" onPress={() => setF({ q: f.q, locality: '', area: '', type: '', sharing: '', minPrice: '', maxPrice: '' })} />
            <Btn title="Close" variant="ghost" onPress={() => setOpen(false)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
