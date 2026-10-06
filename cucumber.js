// cucumber.js — mobile runner
// Step files are NOT listed here: the backend passes them via --require per selected feature
// (same model as the web runner) to avoid "Multiple step definitions match".
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['support/**/*.ts'],
    format: [
      'summary',
      'progress',
      'json:reports/cucumber-report.json',
      'message:reports/cucumber-messages.ndjson',
      'allure-cucumberjs/reporter'
    ],
    tags: 'not @ignore',
    timeout: 120_000,
    retry: 0,
    dryRun: false
  }
};
