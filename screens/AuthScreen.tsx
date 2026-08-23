import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (mode === 'forgotPassword') {
      if (!email) {
        setError('Please enter your email.');
        return;
      }
      setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      });
      setLoading(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage("If an account exists for that email, we've sent a password reset link.");
      return;
    }

    if (!email || !password) {
      setError('Please enter both an email and a password.');
      return;
    }

    if (mode === 'signUp' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error: authError } =
      mode === 'signUp'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === 'signUp') {
      setMessage('Account created! Check your email to confirm, then log in.');
    }
  };

  const title =
    mode === 'signIn' ? 'Log In' : mode === 'signUp' ? 'Sign Up' : 'Reset Password';
  const buttonLabel =
    mode === 'signIn' ? 'Log In' : mode === 'signUp' ? 'Sign Up' : 'Send Reset Link';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>FitFlex</Text>
      <Text style={styles.subtitle}>{title}</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {mode !== 'forgotPassword' && (
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          importantForAutofill="no"
          value={password}
          onChangeText={setPassword}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
      </Pressable>

      {mode === 'signIn' && (
        <Pressable onPress={() => switchMode('forgotPassword')}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      )}

      {mode === 'forgotPassword' ? (
        <Pressable onPress={() => switchMode('signIn')}>
          <Text style={styles.switchText}>Back to log in</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchText}>
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchText: {
    textAlign: 'center',
    color: colors.primary,
    marginTop: 16,
  },
  forgotText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 12,
    fontSize: 13,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#16a34a',
    marginBottom: 12,
    textAlign: 'center',
  },
});
