import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, Alert, StyleSheet, Platform } from 'react-native';
import { Heart, RefreshCw, CheckCircle, XCircle } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import {
  getHealthKitStatus,
  setHealthKitEnabled,
  requestHealthKitPermissions,
  syncHealthKitToServer,
  type HealthKitStatus,
} from '../services/healthkit';
import * as api from '../services/api';

interface HealthKitSyncProps {
  onSyncComplete?: () => void;
}

export function HealthKitSync({ onSyncComplete }: HealthKitSyncProps) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<HealthKitStatus>({ available: false, enabled: false, lastSync: null });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);

  useEffect(() => {
    getHealthKitStatus().then(setStatus);
  }, []);

  const handleToggle = async (value: boolean) => {
    if (value) {
      if (Platform.OS !== 'ios') {
        Alert.alert('Not Available', 'HealthKit is only available on iOS devices.');
        return;
      }

      const granted = await requestHealthKitPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable Health access in Settings > Privacy & Security > Health > FitTrack Pro.',
        );
        return;
      }

      await setHealthKitEnabled(true);
      setStatus((s) => ({ ...s, enabled: true }));

      // Immediately sync on first enable
      handleSync();
    } else {
      await setHealthKitEnabled(false);
      setStatus((s) => ({ ...s, enabled: false }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncHealthKitToServer(
        api.saveDailyActivity,
        api.addWeightEntry,
        7,
      );
      setSyncResult(result);
      setStatus((s) => ({ ...s, lastSync: new Date().toISOString() }));
      onSyncComplete?.();
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not sync HealthKit data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  if (!status.available) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Heart size={18} color={colors.mutedForeground} />
          <Text style={[styles.title, { color: colors.foreground }]}>Apple Health</Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
          HealthKit is only available on iOS devices.
        </Text>
      </View>
    );
  }

  const lastSyncFormatted = status.lastSync
    ? new Date(status.lastSync).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Never';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header with toggle */}
      <View style={styles.headerRow}>
        <Heart size={18} color={status.enabled ? '#FF2D55' : colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.foreground }]}>Apple Health</Text>
        <View style={{ flex: 1 }} />
        <Switch
          value={status.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.muted, true: colors.primary + '60' }}
          thumbColor={status.enabled ? colors.primary : colors.mutedForeground}
        />
      </View>

      {status.enabled && (
        <>
          {/* Sync info */}
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Last synced</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground, marginTop: 2 }}>
                {lastSyncFormatted}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.syncBtn, { backgroundColor: colors.primary + '15' }]}
              onPress={handleSync}
              disabled={syncing}
              activeOpacity={0.7}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RefreshCw size={16} color={colors.primary} />
              )}
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginLeft: 6 }}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sync result */}
          {syncResult && (
            <View style={[styles.resultRow, { backgroundColor: syncResult.errors > 0 ? colors.warning + '10' : colors.success + '10' }]}>
              {syncResult.errors > 0 ? (
                <XCircle size={14} color={colors.warning} />
              ) : (
                <CheckCircle size={14} color={colors.success} />
              )}
              <Text style={{ fontSize: 12, color: syncResult.errors > 0 ? colors.warning : colors.success, marginLeft: 6 }}>
                {syncResult.synced} day{syncResult.synced !== 1 ? 's' : ''} synced
                {syncResult.errors > 0 ? `, ${syncResult.errors} error${syncResult.errors !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          )}

          {/* Data types */}
          <View style={[styles.dataTypes, { borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Syncing
            </Text>
            {['Steps', 'Active Calories', 'Resting Heart Rate', 'Body Weight'].map((type) => (
              <View key={type} style={styles.dataTypeRow}>
                <CheckCircle size={12} color={colors.success} />
                <Text style={{ fontSize: 13, color: colors.foreground, marginLeft: 6 }}>{type}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 10, marginTop: 10 },
  dataTypes: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  dataTypeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
});
