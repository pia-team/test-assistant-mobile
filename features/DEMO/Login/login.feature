@login @smoke
Feature: Login through side menu and reach Products

  @login @smoke
  Scenario: Login through side menu and reach Products
    Given the user taps "open menu" for login
    When the user taps "menu item log in" for login
    When the user enters the username into the "Username input field" for login
    When the user enters the password into the "Password input field" for login
    When the user taps "Login button" for login
    Then the user sees "Products" for login
