// Testbed for logic that can't be exercised on-device round-trip every
// time (HealthKit date-bucketing, multi-source dedup, sleep-stage
// filtering). Extends RN's own preset rather than pulling in jest-expo,
// since nothing here touches Expo-specific native modules — just the
// native react-native-health bridge, which each test mocks itself.
module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@fittrack/core$': '<rootDir>/../packages/core/src/index.ts',
    '^@fittrack/core/(.*)$': '<rootDir>/../packages/core/src/$1',
  },
};
