// Jest para los tests de UI (componentes y pages) en jsdom + React Testing
// Library. La suite de motor/integración sigue en Playwright (test/run-tests
// .mjs) porque necesita Chrome real (WASM, OffscreenCanvas, Workers).
//
// El transform de Babel se define inline aquí (no en un babel.config del root)
// para no interferir con el transform de React que usa Vite en el build.
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.{js,jsx}"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.cjs"],
  transform: {
    "^.+\\.(js|jsx)$": [
      "babel-jest",
      {
        sourceType: "unambiguous",
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
        plugins: [
          "@babel/plugin-syntax-import-meta",
          "babel-plugin-transform-import-meta",
        ],
      },
    ],
  },
  moduleNameMapper: {
    // los assets no-JS no aportan a los tests de UI
    "\\.(css|png|svg|onnx|wasm)$": "<rootDir>/test/jest/fileMock.cjs",
  },
};
