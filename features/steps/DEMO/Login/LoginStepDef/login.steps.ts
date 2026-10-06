import { Given, When, Then } from '@cucumber/cucumber';
import type { ICustomWorld } from '../../../../../support/world';
import { LoginPage } from '../../../../../pages/DEMO/Login/LoginPage/login.page';
import { getEnvConfig } from '../../../../../support/env';

Given('the user taps "open menu" for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.tapOpenMenu();
});

When('the user taps "menu item log in" for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.tapMenuLogin();
});

When('the user enters the username into the "Username input field" for login', async function (this: ICustomWorld) {
  const env = getEnvConfig();
  if (!env.username) {
    throw new Error('username not configured in environment profile');
  }
  const screen = new LoginPage(this.driver!);
  await screen.enterUsername(env.username);
});

When('the user enters the password into the "Password input field" for login', async function (this: ICustomWorld) {
  const env = getEnvConfig();
  if (!env.password) {
    throw new Error('password not configured in environment profile');
  }
  const screen = new LoginPage(this.driver!);
  await screen.enterPassword(env.password);
});

When('the user taps "Login button" for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.tapLoginButton();
});

Then('the user sees "Products" for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.verifyProductsVisible();
});