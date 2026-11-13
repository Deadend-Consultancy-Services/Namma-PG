import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/auth';
import Nav from './src/navigation';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1 } } });
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Nav />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
