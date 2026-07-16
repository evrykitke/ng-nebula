import { Routes } from '@angular/router';
// Type-only: nav.model composes the registry, and a runtime import back
// into it would close a cycle.
import type { NavItem } from './nav.model';

/**
 * An app: a body of work that declares itself.
 *
 * The backend has had this for a while — a module names its own permissions,
 * reports and series, and the kernel composes them. The client did not: adding
 * an app meant hand-editing a nav array here, a routes array there, and hoping
 * the two agreed with each other and with the server. Once the product started
 * calling its modules "apps" to the user's face, that gap stopped being tidy
 * bookkeeping and became a lie about the architecture.
 *
 * So an app owns both halves. `nav` is what the sidebar and launcher show;
 * `routes` is what those entries open. They sit in one file, next to the pages
 * they describe, and the shell composes whatever it is handed.
 */
export interface AppDef {
  /** The section as the sidebar and launcher render it. */
  nav: NavItem;
  /** The pages it owns, mounted inside the shell. */
  routes: Routes;
}

/** Declare an app. A thin helper, but it names the shape at every call site. */
export function defineApp(def: AppDef): AppDef {
  return { nav: { ...def.nav, app: true }, routes: def.routes };
}
