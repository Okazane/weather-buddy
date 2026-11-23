const fs = require('fs');
const path = require('path');

function loadExpoConfigPlugins() {
  try {
    return require('expo/config-plugins');
  } catch (_err) {
    return require('@expo/config-plugins');
  }
}

const DEFAULT_APP_GROUP_ID = 'group.com.weatherbuddy.shared';
const DEFAULT_ANDROID_RECEIVER = 'com.weatherbuddy.widget.WeatherBuddyWidgetReceiver';
const WIDGET_PROVIDER_RESOURCE = '@xml/weather_buddy_widget_info';

/**
 * Adds `com.apple.security.application-groups` (`group.com.weatherbuddy.shared`)
 * so the main React Native app and the SwiftUI WidgetKit extension share `WidgetSyncPayload` JSON
 * and 2.5D character PNG sprites.
 */
function withWeatherBuddyIosAppGroup(config, { appGroupId }) {
  const { withEntitlementsPlist, withInfoPlist } = loadExpoConfigPlugins();

  config = withEntitlementsPlist(config, (modConfig) => {
    const existingGroups = Array.isArray(
      modConfig.modResults['com.apple.security.application-groups']
    )
      ? modConfig.modResults['com.apple.security.application-groups']
      : [];

    if (!existingGroups.includes(appGroupId)) {
      existingGroups.push(appGroupId);
    }

    modConfig.modResults['com.apple.security.application-groups'] = existingGroups;
    return modConfig;
  });

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.WeatherBuddyAppGroup = appGroupId;

    const bgModes = Array.isArray(modConfig.modResults.UIBackgroundModes)
      ? modConfig.modResults.UIBackgroundModes
      : [];
    if (!bgModes.includes('fetch')) {
      bgModes.push('fetch');
    }
    modConfig.modResults.UIBackgroundModes = bgModes;

    return modConfig;
  });

  return config;
}

function ensureAndroidPermission(manifest, permissionName) {
  if (!Array.isArray(manifest['uses-permission'])) {
    manifest['uses-permission'] = [];
  }
  const alreadyPresent = manifest['uses-permission'].some(
    (entry) => entry?.$?.['android:name'] === permissionName
  );
  if (!alreadyPresent) {
    manifest['uses-permission'].push({
      $: { 'android:name': permissionName },
    });
  }
}

/**
 * Registers `WeatherBuddyWidgetReceiver` (Jetpack Glance Home Screen & Lock Screen Keyguard widget)
 * and required background sync permissions inside `AndroidManifest.xml`.
 */
function withWeatherBuddyAndroidWidgetManifest(config, { receiverName }) {
  const { withAndroidManifest } = loadExpoConfigPlugins();

  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults?.manifest;
    if (!manifest) {
      return modConfig;
    }

    ensureAndroidPermission(manifest, 'android.permission.INTERNET');
    ensureAndroidPermission(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED');

    const mainApplication = manifest.application?.[0];
    if (!mainApplication) {
      return modConfig;
    }

    if (!Array.isArray(mainApplication.receiver)) {
      mainApplication.receiver = [];
    }

    const receiverEntry = {
      $: {
        'android:name': receiverName,
        'android:exported': 'true',
        'android:label': '@string/app_name',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': WIDGET_PROVIDER_RESOURCE,
          },
        },
      ],
    };

    const existingIdx = mainApplication.receiver.findIndex(
      (item) => item?.$?.['android:name'] === receiverName
    );
    if (existingIdx >= 0) {
      mainApplication.receiver[existingIdx] = receiverEntry;
    } else {
      mainApplication.receiver.push(receiverEntry);
    }

    return modConfig;
  });
}

/**
 * Copies `weather_buddy_widget_info.xml` and Jetpack Glance Kotlin widget files into
 * the generated `android/` directory during `npx expo prebuild`.
 */
function withWeatherBuddyAndroidWidgetFiles(config) {
  const { withDangerousMod } = loadExpoConfigPlugins();

  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const platformRoot = modConfig.modRequest.platformProjectRoot;

      const xmlSource = path.join(
        projectRoot,
        'native-widgets',
        'android',
        'res',
        'xml',
        'weather_buddy_widget_info.xml'
      );
      const xmlDestDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
      if (fs.existsSync(xmlSource)) {
        fs.mkdirSync(xmlDestDir, { recursive: true });
        fs.copyFileSync(xmlSource, path.join(xmlDestDir, 'weather_buddy_widget_info.xml'));
      }

      const kotlinFiles = [
        'WeatherBuddyGlanceWidget.kt',
        'WeatherBuddyWidgetReceiver.kt',
        'WeatherSyncWorker.kt',
      ];
      const kotlinSourceDir = path.join(projectRoot, 'native-widgets', 'android');
      const kotlinDestDir = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'weatherbuddy',
        'widget'
      );

      if (fs.existsSync(kotlinSourceDir)) {
        fs.mkdirSync(kotlinDestDir, { recursive: true });
        for (const fileName of kotlinFiles) {
          const srcFile = path.join(kotlinSourceDir, fileName);
          if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(kotlinDestDir, fileName));
          }
        }
      }

      return modConfig;
    },
  ]);
}

function withWeatherBuddyWidgets(config, props = {}) {
  const appGroupId = props.appGroupId || DEFAULT_APP_GROUP_ID;
  const receiverName = props.receiverName || DEFAULT_ANDROID_RECEIVER;

  config = withWeatherBuddyIosAppGroup(config, { appGroupId });
  config = withWeatherBuddyAndroidWidgetManifest(config, { receiverName });
  config = withWeatherBuddyAndroidWidgetFiles(config);

  return config;
}

module.exports = withWeatherBuddyWidgets;
module.exports.DEFAULT_APP_GROUP_ID = DEFAULT_APP_GROUP_ID;
module.exports.DEFAULT_ANDROID_RECEIVER = DEFAULT_ANDROID_RECEIVER;
