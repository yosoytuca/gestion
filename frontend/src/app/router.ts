export interface Route {path: string; sheet: string | null}
interface AppHistory {ga: true; index: number; returnIndex: number}
export interface NavigationWindow {
  location: {pathname: string; search: string}; history: History;
  addEventListener(type: string, callback: () => void): void;
  removeEventListener(type: string, callback: () => void): void;
}
export class AppRouter {
  private listeners = new Set<() => void>();
  private changed = () => {for (const listener of this.listeners) listener();};
  constructor(private readonly browser: NavigationWindow) {
    if (!this.state()) {
      const target = this.url();
      browser.history.replaceState({ga: true, index: 0, returnIndex: 0}, '', '/');
      if (target !== '/') browser.history.pushState({ga: true, index: 1, returnIndex: 0}, '', target);
    }
    browser.addEventListener('popstate', this.changed);
  }
  private state(): AppHistory | undefined {return this.browser.history.state?.ga ? this.browser.history.state as AppHistory : undefined;}
  private url() {return this.browser.location.pathname + this.browser.location.search;}
  route(): Route {return {path: this.browser.location.pathname, sheet: new URLSearchParams(this.browser.location.search).get('sheet')};}
  subscribe(listener: () => void) {this.listeners.add(listener); return () => {this.listeners.delete(listener);};}
  go(path: string, replace = false): void {
    const state = this.state() ?? {ga: true, index: 0, returnIndex: 0};
    const route = this.route();
    const list = (route.path === '/' || route.path.startsWith('/category/')) && !route.sheet;
    const next = {ga: true, index: state.index + (replace ? 0 : 1), returnIndex: list ? state.index : state.returnIndex};
    this.browser.history[replace ? 'replaceState' : 'pushState'](next, '', path);
    this.changed();
  }
  sheet(name: string) {this.go(`${this.route().path}?sheet=${encodeURIComponent(name)}`);}
  back(): void {this.browser.history.back();}
  home(): void {
    const state = this.state();
    if (state && state.index > 0) this.browser.history.go(-state.index);
    else {this.browser.history.replaceState({ga: true, index: 0, returnIndex: 0}, '', '/'); this.changed();}
  }
  returnToList(): void {
    const state = this.state();
    const distance = state ? state.index - state.returnIndex : 0;
    if (distance > 0) this.browser.history.go(-distance);
    else {this.browser.history.replaceState({ga: true, index: 0, returnIndex: 0}, '', '/'); this.changed();}
  }
  dispose() {this.browser.removeEventListener('popstate', this.changed); this.listeners.clear();}
}
