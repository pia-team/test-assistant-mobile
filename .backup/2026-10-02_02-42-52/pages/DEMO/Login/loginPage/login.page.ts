import type { Browser } from 'webdriverio';
import { tap, typeText, waitVisible, hideKeyboard } from '../../../../support/mobile-actions';

export class LoginPage {
  private readonly menuButton = '~open menu';
  private readonly menuLogin = '~menu item log in';
  private readonly usernameInput = '~Username input field';
  private readonly passwordInput = '~Password input field';
  private readonly loginButton = '~Login button';
  private readonly productsTitle = 'android=new UiSelector().text("Products")';

  constructor(private readonly driver: Browser) {}

  async openLoginScreen(): Promise<void> {
    await tap(this.driver, this.menuButton);
    await tap(this.driver, this.menuLogin);
    await waitVisible(this.driver, this.usernameInput);
  }

  async enterCredentials(username: string, password: string): Promise<void> {
    await typeText(this.driver, this.usernameInput, username);
    await typeText(this.driver, this.passwordInput, password);
    await hideKeyboard(this.driver);
  }

  async submit(): Promise<void> {
    await tap(this.driver, this.loginButton);
  }

  async expectProductsCatalog(): Promise<void> {
    await waitVisible(this.driver, this.productsTitle);
  }
}
