const { FusesPlugin } = require("@electron-forge/plugin-fuses")
const { FuseV1Options, FuseVersion } = require("@electron/fuses")

module.exports = {
  packagerConfig: {
    asar: true,
    name: "COMSC",
    executableName: "comsc",
    appBundleId: "com.example.comsc",
    appCategoryType: "public.app-category.utilities",
    icon: "./assets/icon",
    ignore: [
      /^\/src\//,
      /^\/\.vscode\//,
      /^\/\.git\//,
      /^\/out\//,
      /\.md$/,
      /vite\.config\.js$/,
      /forge\.config\.js$/,
      /^\/\.env/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "comsc",
        setupExe: "COMSC-Setup.exe",
        setupIcon: "./assets/icon.ico",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {
        name: "COMSC",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Your Name",
          homepage: "https://github.com/yourusername/comsc",
          description: "Slack Message Display App",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          maintainer: "Your Name",
          homepage: "https://github.com/yourusername/comsc",
          description: "Slack Message Display App",
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
