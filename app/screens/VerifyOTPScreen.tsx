import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {supabase} from '../lib/supabase';
import {useI18n} from '../lib/i18n';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyOTP'>;

export default function VerifyOTPScreen({route, navigation}: Props) {
  const {t} = useI18n();
  const {email} = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerifyOTP = async () => {
    if (!otp || otp.trim().length === 0) {
      Alert.alert(t('common.error'), t('verify.enterCode'));
      return;
    }

    setLoading(true);
    try {
      const {data, error} = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email',
      });

      if (error) throw error;

      if (data.session) {
        Alert.alert(t('verify.welcomeTitle'), t('verify.welcomeBody'));
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('verify.invalidCode'));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const {error} = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      Alert.alert(t('verify.resentTitle'), t('verify.resentBody'));
      setOtp('');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>📧</Text>
          <Text style={styles.title}>{t('verify.title')}</Text>
          <Text style={styles.subtitle}>{t('verify.subtitle')}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* OTP Input - Campo único */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('verify.codeLabel')}</Text>
          <TextInput
            style={styles.otpInput}
            placeholder={t('verify.codePlaceholder')}
            placeholderTextColor="#64748b"
            value={otp}
            onChangeText={setOtp}
            keyboardType="default"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            editable={!loading}
            maxLength={50}
            multiline={false}
          />
          <Text style={styles.hint}>{t('verify.hint')}</Text>
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
          activeOpacity={0.7}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{t('verify.verify')}</Text>
          )}
        </TouchableOpacity>

        {/* Resend Code */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={resending || loading}
          activeOpacity={0.7}>
          {resending ? (
            <ActivityIndicator size="small" color="#60a5fa" />
          ) : (
            <Text style={styles.resendText}>
              {t('verify.noCode')}{' '}
              <Text style={styles.resendLink}>{t('verify.resend')}</Text>
            </Text>
          )}
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={loading}>
          <Text style={styles.backText}>{t('verify.changeEmail')}</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t('verify.expires')}</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#60a5fa',
    fontWeight: '600',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  otpInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resendLink: {
    color: '#60a5fa',
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
