const { AndroidConfig, withInfoPlist, withStringsXml } = require("expo/config-plugins");

/**
 * The name under the app icon, separate from `expo.name`. The Xcode project
 * and target are named after `expo.name`, which must stay ASCII: with an
 * Arabic name, EAS Build looked for a transliterated target that prebuild
 * hadn't created. So `expo.name` is the English name, and this sets the
 * Arabic one users see (PLAN.md §0 #46).
 */
module.exports = function withDisplayName(config, { name }) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.CFBundleDisplayName = name;
    return mod;
  });
  return withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: "app_name", value: name })],
      mod.modResults,
    );
    return mod;
  });
};
