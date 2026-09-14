import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { colors } from '../theme';


export default function LoginModal() {
  const { isAuthenticated, isLoggingIn, loginError, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isLoggingIn;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await login(username.trim(), password);
  };

  return (
    <Modal visible={!isAuthenticated} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-slate-950/60 items-center justify-center p-6">
          <View className="w-full max-w-[400px] bg-white rounded-2xl p-6">
            {/* Brand */}
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-2xl bg-sidebar items-center justify-center">
                <MaterialCommunityIcons name="robot-outline" size={30} color={colors.emerald400} />
              </View>
              <Text className="text-lg font-extrabold text-slate-900 mt-3">AI CROP ROBOT</Text>
              <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                Sign in to connect to the control server
              </Text>
            </View>

            {/* Username */}
            <Text className="text-xs font-extrabold text-slate-700 mb-1.5">Username</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3">
              <Feather name="user" size={16} color={colors.slate400} />
              <TextInput
                className="flex-1 py-3 px-2.5 text-sm text-slate-900"
                placeholder="Enter username"
                placeholderTextColor={colors.slate400}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                editable={!isLoggingIn}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <Text className="text-xs font-extrabold text-slate-700 mb-1.5 mt-4">Password</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3">
              <Feather name="lock" size={16} color={colors.slate400} />
              <TextInput
                className="flex-1 py-3 px-2.5 text-sm text-slate-900"
                placeholder="Enter password"
                placeholderTextColor={colors.slate400}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                editable={!isLoggingIn}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.slate400} />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {loginError ? (
              <View className="flex-row items-center bg-rose-100 rounded-lg px-3 py-2.5 mt-4">
                <Feather name="alert-circle" size={14} color={colors.rose600} />
                <Text className="text-xs font-bold text-rose-600 ml-2 flex-1">{loginError}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={handleSubmit}
              className={`flex-row items-center justify-center rounded-xl py-3.5 mt-5 ${
                canSubmit ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              {isLoggingIn ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="log-in" size={16} color={colors.white} />
                  <Text className="text-[13px] font-extrabold text-white ml-2">Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            <Text className="text-[10px] text-slate-400 text-center mt-4">
              WebSocket connects automatically after successful sign-in
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
