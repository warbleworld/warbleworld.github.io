// ESLint configuration ("flat config" format).
// ESLint is a linter: it reads your source code without running it and
// flags problems. We use it here for one specific job — the `compat`
// plugin checks every browser feature you use against a support database
// (caniuse) and errors if something doesn't exist on our minimum devices.
// The device list itself lives in the "browserslist" field of package.json.
import compat from "eslint-plugin-compat";

export default [
  // Preset that enables the browser-compatibility rule.
  compat.configs["flat/recommended"],
  {
    files: ["site/js/**/*.js", "shared/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    // Never lint installed packages or build output.
    ignores: ["node_modules/", "dist/"],
  },
];
