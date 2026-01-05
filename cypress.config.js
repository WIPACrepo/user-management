const { defineConfig } = require('cypress')
module.exports = defineConfig({  e2e: {
  "baseUrl": "http://localhost:8080",
  "screenshotOnRunFailure": false,
  "video": false,
  "supportFile": "cypress/support/index.js",
  "specPattern": "cypress/integration/*.spec.js"
}})
