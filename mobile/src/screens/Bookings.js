import React from 'react';
import { View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import api, { errMsg } from '../api';
import { Screen, Card, T, Btn, Badge, tone, label, Loading, Empty, ErrorView, fmtDate, confirm } from '../ui';

export default function Bookings() {
  const q = useQuery({ queryKey: ['visits'], queryFn: () => api.get('/tenant/visits').then((r) => r.data.items) });
  const qc = useQueryClient();
  const cancel = useMutation({ mutationFn: (id) => api.put(`/tenant/visits/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['visits'] }), onError: (e) => Alert.alert('Error', errMsg(e)) });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView error={q.error} retry={q.refetch} /> : !q.data.length ? <Empty title="No visits booked" hint="Search a PG and book a visit." /> : q.data.map((v) => (
        <Card key={v._id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold size={16} style={{ flex: 1 }}>{v.property?.name}</T><Badge text={label(v.status)} tone={tone(v.status)} /></View>
          <T mute>{v.property?.locality}, {v.property?.city}</T><T style={{ marginTop: 6 }}>🗓 {fmtDate(v.date)} · {v.time}</T>
          {v.status === 'upcoming' && <Btn title="Cancel visit" variant="secondary" style={{ marginTop: 10 }} loading={cancel.isPending && cancel.variables === v._id} onPress={async () => { if (await confirm('Cancel visit?', 'The slot will be released for others.', 'Cancel visit', true)) cancel.mutate(v._id); }} />}
        </Card>
      ))}
    </Screen>
  );
}
