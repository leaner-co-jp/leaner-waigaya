const { FusesPlugin } = require("@electron-forge/plugin-fuses")
const { FuseV1Options, FuseVersion } = require("@electron/fuses")
const { resolve } = require("path")

module.exports = {
  packagerConfig: {
    asar: true,
    name: "Waigaya",
    executableName: "waigaya",
    appBundleId: "jp.co.leaner.waigaya",
    appCategoryType: "public.app-category.utilities",
    icon: "./assets/icon.ico",
    author: "Yusuke Kokubo",
    homepage: "https://github.com/leaner-co-jp/leaner-waigaya",
    description: "Slack Message Display App",
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
    input: {
      display: resolve(__dirname, "display/display.html"),
      control: resolve(__dirname, "control/control.html"),
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "waigaya",
        setupExe: "Waigaya-Setup.exe",
        setupIcon: "./assets/icon.ico",
        authors: "Yusuke Kokubo",
        homepage: "https://github.com/leaner-co-jp/leaner-waigaya",
        description: "Slack Message Display App",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {
        name: "Waigaya",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Yusuke Kokubo",
          homepage: "https://github.com/leaner-co-jp/leaner-waigaya",
          description: "Slack Message Display App",
        },
        name: "waigaya",
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          maintainer: "Yusuke Kokubo",
          homepage: "https://github.com/leaner-co-jp/leaner-waigaya",
          description: "Slack Message Display App",
        },
        name: "waigaya",
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
