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
// Must be listed in app.json's plugins array AFTER expo-notifications.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
