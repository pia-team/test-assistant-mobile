@demo @mobile
Feature: Login to the demo app

  Sample mobile feature for the Sauce Labs "My Demo App" (React Native, com.saucelabs.mydemoapp.rn).
  Credentials come from config/projects/DEMO.{tier}.json.

  Scenario: Successful login shows the products catalog
    Given the login screen is open for login
    When I enter valid credentials for login
    And I tap the login button for login
    Then the products catalog is shown for login
