import { Given, When, Then } from '@cucumber/cucumber';
import type { ICustomWorld } from '../../../../../support/world';
import { getEnvConfig } from '../../../../../support/env';
import { LoginPage } from '../../../../../pages/DEMO/Login/LoginPage/login.page';

Given('the login screen is open for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.openLoginScreen();
});

When('I enter valid credentials for login', async function (this: ICustomWorld) {
  const { username, password } = getEnvConfig();
  const screen = new LoginPage(this.driver!);
  await screen.enterCredentials(username, password);
});

When('I tap the login button for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.submit();
});

Then('the products catalog is shown for login', async function (this: ICustomWorld) {
  const screen = new LoginPage(this.driver!);
  await screen.expectProductsCatalog();
});
