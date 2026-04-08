import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fittrack_auth_token';
const USER_KEY = 'fittrack_user';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUser(user: { id: string; name: string; email: string }): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<{ id: string; name: string; email: string } | null> {
  const data = await SecureStore.getItemAsync(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export async function removeUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

// Generic key-value helpers for other secure storage needs
export async function saveValue(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function getValue(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function removeValue(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
