// Router minimal. roles: null = publik, [] = semua user login, ['x'] = hanya role tsb.
export class Router {
  routes = [];
  add(method, path, roles, handler) {
    const re = new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    this.routes.push({ method, re, roles, handler });
    return this;
  }
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.re.exec(pathname);
      if (m) return { route, params: m.groups || {} };
    }
    return null;
  }
}
