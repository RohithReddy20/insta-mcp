// const { createDefaultPreset } = require("ts-jest");
// const tsJestTransformCfg = createDefaultPreset().transform; // Not needed if using preset directly

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest", // This line is simpler and usually sufficient
  testEnvironment: "node",
  // moduleNameMapper: { // May not be needed for simple setups
  //   '^(\\.{1,2}/.*)\\.js$': '$1',
  // },
  // transform: { // ts-jest preset usually handles this
  //   '^.+\\.tsx?$': [
  //     'ts-jest',
  //     {
  //       useESM: false, // Set to true if you are using ES Modules
  //     },
  //   ],
  // },
};
