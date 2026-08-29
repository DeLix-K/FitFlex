const { withEntitlementsPlist } = require('expo/config-plugins');

// expo-notifications' config plugin unconditionally adds the
// aps-environment (Push Notifications) entitlement during prebuild, even
// though this app only ever schedules LOCAL notifications (the Sleep tab's
// wake-up reminder) and never registers for remote push. The existing Ad
// Hoc provisioning profile doesn't have the Push Notifications capability
// enabled on the Apple Developer portal, which fails EAS's iOS build with
// "Provisioning profile ... doesn't include the aps-environment
// entitlement." Local notifications don't need this entitlement at all, so
// strip it back out after expo-notifications adds it, rather than touching
// Apple Developer portal capabilities for a feature that doesn't need them.
//
// Mod ordering gotcha: Expo's mod chain wraps each newly-registered mod
// AROUND the previously-registered one and runs the new (outer) mod's
// action FIRST, then delegates down to the previous (inner) one via
// `nextMod` -- so mods actually execute in REVERSE of their plugins-array
// registration order. To have this run AFTER expo-notifications adds the
// entitlement, it must be listed BEFORE expo-notifications in app.json's
// plugins array (so expo-notifications is registered later/outer and its
// add-action runs first, then delegates down to this delete-action).
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
