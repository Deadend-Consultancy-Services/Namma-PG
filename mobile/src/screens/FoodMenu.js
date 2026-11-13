import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { Screen, Card, T, H, Chip, Loading, Empty, ErrorView, ymd } from '../ui';

const MEALS = [['breakfast', '🍳 Breakfast'], ['lunch', '🍛 Lunch'], ['eveningSnacks', '☕ Evening Snacks'], ['dinner', '🍽 Dinner']];
const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() + i * 86400000); return { v: ymd(d), l: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }) }; });

export default function FoodMenu() {
  const [date, setDate] = useState(days[0].v);
  const q = useQuery({ queryKey: ['food', date], queryFn: () => api.get('/tenant/food-menu', { params: { date } }).then((r) => r.data), retry: false });
  const noStay = q.error?.response?.data?.code === 'NO_STAY';
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>{days.map((d) => <Chip key={d.v} text={d.l} active={date === d.v} onPress={() => setDate(d.v)} />)}</ScrollView>
      {q.isLoading ? <Loading /> : noStay ? <Empty title="No PG assigned yet" hint="The food menu appears once your PG owner adds you." /> : q.isError ? <ErrorView error={q.error} retry={q.refetch} /> : !q.data.item ? <Empty title="Menu not published" hint="Your PG hasn't set the menu for this day yet." /> : MEALS.map(([k, n]) => (
        <Card key={k}><H style={{ fontSize: 16 }}>{n}</H>{q.data.item[k]?.length ? q.data.item[k].map((x, i) => <T key={i} style={{ marginTop: 4 }}>• {x}</T>) : <T mute style={{ marginTop: 4 }}>Not set</T>}</Card>
      ))}
    </Screen>
  );
}
