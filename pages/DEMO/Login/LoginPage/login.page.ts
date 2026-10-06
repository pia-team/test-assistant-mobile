import type { Browser } from 'webdriverio';
import { tap, typeText, waitVisible, hideKeyboard } from '../../../../support/mobile-actions';

export class LoginPage {
  private readonly openMenuButton = '~open menu';
  private readonly menuLoginItem = '~menu item log in';
  private readonly usernameInput = '~Username input field';
  private readonly passwordInput = '~Password input field';
  private readonly loginButton = '~Login button';
  private readonly productsLabel = 'android=new UiSelector().text("Products")';

  constructor(private readonly driver: Browser) {}

  async tapOpenMenu(): Promise<void> {
    await waitVisible(this.driver, this.openMenuButton);
    await tap(this.driver, this.openMenuButton);
  }

  async tapMenuLogin(): Promise<void> {
    await waitVisible(this.driver, this.menuLoginItem);
    await tap(this.driver, this.menuLoginItem);
  }

  async enterUsername(username: string): Promise<void> {
    await waitVisible(this.driver, this.usernameInput);
    await typeText(this.driver, this.usernameInput, username);
  }

  async enterPassword(password: string): Promise<void> {
    await waitVisible(this.driver, this.passwordInput);
    await typeText(this.driver, this.passwordInput, password);
    await hideKeyboard(this.driver);
  }

  async tapLoginButton(): Promise<void> {
    await waitVisible(this.driver, this.loginButton);
    await tap(this.driver, this.loginButton);
  }

  async verifyProductsVisible(): Promise<void> {
    await waitVisible(this.driver, this.productsLabel);
  }

  async enterCredentials(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.tapLoginButton();
  }
}