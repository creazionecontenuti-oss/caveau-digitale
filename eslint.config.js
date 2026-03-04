import security from "eslint-plugin-security";

export default [
  {
    files: ["app.js", "i18n.js", "i18n-langs.js", "sw.js"],
    plugins: {
      security,
    },
    rules: {
      ...security.configs.recommended.rules,
    },
  },
];
