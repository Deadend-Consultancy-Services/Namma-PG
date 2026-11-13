import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { connectSocket } from './socket';
import { Loading, C } from './ui';
import { Welcome, RoleSelect, Login, Signup, Forgot } from './screens/Auth';
import Search from './screens/Search';
import PgDetails from './screens/PgDetails';
import BookVisit from './screens/BookVisit';
import Bookings from './screens/Bookings';
import Payments from './screens/Payments';
import FoodMenu from './screens/FoodMenu';
import Concerns from './screens/Concerns';
import Profile from './screens/Profile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;

function Tabs() {
  const qc = useQueryClient();
  React.useEffect(() => {
    // Real-time: server events refresh the relevant screens instantly
    const s = connectSocket();
    const all = () => qc.invalidateQueries();
    ['payment:updated', 'kyc:updated', 'concern:updated'].forEach((e) => s.on(e, all));
    s.on('notification:new', () => qc.invalidateQueries({ queryKey: ['notifications'] }));
    return () => { s.off('payment:updated', all); s.off('kyc:updated', all); s.off('concern:updated', all); s.off('notification:new'); };
  }, [qc]);
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: C.brand, headerTitleStyle: { fontWeight: '700' } }}>
      <Tab.Screen name="Search" component={Search} options={{ headerShown: false, tabBarIcon: icon('🔎') }} />
      <Tab.Screen name="Bookings" component={Bookings} options={{ title: 'My Visits', tabBarIcon: icon('🗓') }} />
      <Tab.Screen name="Payments" component={Payments} options={{ tabBarIcon: icon('💳') }} />
      <Tab.Screen name="Food" component={FoodMenu} options={{ title: 'Food Menu', tabBarIcon: icon('🍽') }} />
      <Tab.Screen name="Concerns" component={Concerns} options={{ title: 'Help', tabBarIcon: icon('🛟') }} />
      <Tab.Screen name="Profile" component={Profile} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

export default function Nav() {
  const { user, booting } = useAuth();
  if (booting) return <Loading />;
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="PgDetails" component={PgDetails} options={({ route }) => ({ title: route.params?.name || 'PG' })} />
            <Stack.Screen name="BookVisit" component={BookVisit} options={{ title: 'Book a Visit' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={Welcome} options={{ headerShown: false }} />
            <Stack.Screen name="Role" component={RoleSelect} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={Signup} options={{ headerShown: false }} />
            <Stack.Screen name="Forgot" component={Forgot} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
