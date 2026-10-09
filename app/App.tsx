import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, {useState, useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet, StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {supabase} from './lib/supabase';
import type {RootStackParamList} from './types/navigation';

// Screens
import LoginScreen from './screens/LoginScreen';
import VerifyOTPScreen from './screens/VerifyOTPScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import PaymentMethodsScreen from './screens/PaymentMethodsScreen';
import ContactsScreen from './screens/ContactsScreen';
import AddContactScreen from './screens/AddContactScreen';
import PurchaseRequestsScreen from './screens/PurchaseRequestsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener la sesión inicial
    supabase.auth.getSession().then(({data: {session}}) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios en la autenticación
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1e293b',
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: '#0f172a',
            },
          }}>
        {session ? (
          <>
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="PaymentMethods"
              component={PaymentMethodsScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Contacts"
              component={ContactsScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="AddContact"
              component={AddContactScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="PurchaseRequests"
              component={PurchaseRequestsScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="VerifyOTP"
                component={VerifyOTPScreen}
                options={{
                  title: 'Verificación',
                  headerBackTitle: 'Atrás',
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});

export default App;
