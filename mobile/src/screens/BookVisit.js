import React, { useState } from 'react';
import { View, Alert, TouchableOpacity, Text } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { errMsg } from '../api';
import { Screen, Card, T, H, Btn, Chip, Loading, Empty, C, fmtDate } from '../ui';

export default function BookVisit({ route, navigation }) {
  const { id, name } = route.params;
  const [date, setDate] = useState(null); const [slot, setSlot] = useState(null);
  const qc = useQueryClient();
  const dates = useQuery({ queryKey: ['slot-dates', id], queryFn: () => api.get(`/tenant/pgs/${id}/slot-dates`).then((r) => r.data.dates) });
  const slots = useQuery({ queryKey: ['slots', id, date], enabled: !!date, queryFn: () => api.get(`/tenant/pgs/${id}/slots`, { params: { date } }).then((r) => r.data.items) });
  const book = useMutation({
    mutationFn: () => api.post('/tenant/visits', { slotId: slot.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['visits'] }); qc.invalidateQueries({ queryKey: ['slots', id] }); qc.invalidateQueries({ queryKey: ['slot-dates', id] }); Alert.alert('Visit booked 🎉', `${name}\n${fmtDate(date)} at ${slot.time}`, [{ text: 'View my bookings', onPress: () => navigation.navigate('Tabs', { screen: 'Bookings' }) }]); },
    onError: (e) => { Alert.alert('Could not book', errMsg(e)); setSlot(null); qc.invalidateQueries({ queryKey: ['slots', id] }); },
  });
  return (
    <Screen>
      <H>{name}</H><T mute style={{ marginBottom: 14 }}>Pick a date and time for your visit</T>
      <Card>
        <T bold style={{ marginBottom: 8 }}>Available dates</T>
        {dates.isLoading ? <Loading /> : !dates.data?.length ? <Empty title="No visit slots available" hint="The owner hasn't published slots yet. Please check back later." /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{dates.data.map((d) => <Chip key={d} text={fmtDate(d)} active={date === d} onPress={() => { setDate(d); setSlot(null); }} />)}</View>}
      </Card>
      {date && <Card>
        <T bold style={{ marginBottom: 8 }}>Time slots · {fmtDate(date)}</T>
        {slots.isLoading ? <Loading /> : !slots.data?.length ? <T mute>No slots on this date.</T> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{slots.data.map((s) => (
          <TouchableOpacity key={s.id} disabled={!s.available} onPress={() => setSlot(s)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: slot?.id === s.id ? C.brand : C.line, backgroundColor: slot?.id === s.id ? C.brand : s.available ? '#fff' : '#f1f5f9' }}>
            <Text style={{ color: slot?.id === s.id ? '#fff' : s.available ? C.text : '#94a3b8', textDecorationLine: s.available ? 'none' : 'line-through' }}>{s.time}</Text></TouchableOpacity>))}</View>}
      </Card>}
      <Btn title={slot ? `Confirm visit · ${fmtDate(date)}, ${slot.time}` : 'Select a slot'} disabled={!slot} loading={book.isPending} onPress={() => book.mutate()} />
    </Screen>
  );
}
