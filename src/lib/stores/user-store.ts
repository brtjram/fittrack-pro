import type { UserProfile } from '@/types';

export async function getUserProfile(): Promise<UserProfile | undefined> {
  const res = await fetch('/api/fitness/profile');
  if (!res.ok) return undefined;
  const data = await res.json();
  return data ?? undefined;
}

export async function saveUserProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void> {
  const res = await fetch('/api/fitness/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error(`Failed to save profile (${res.status})`);
  }
}

export async function updateUserWeight(weightLbs: number): Promise<void> {
  const profile = await getUserProfile();
  if (profile) {
    await saveUserProfile({ ...profile, currentWeightLbs: weightLbs });
  }
}
