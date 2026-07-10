import { PermissionDef } from '../../shared/service-proxies/service-proxies';

/** A node in the permission tree, as the management UIs render it. */
export interface PermTreeNode {
  /** Fully-qualified dotted name, e.g. `Pages.Administration.Users.View`. */
  name: string;
  /** Human-friendly label. */
  label: string;
  /** Depth from a module root (root = 0). */
  depth: number;
  /** Child permissions. */
  children: PermTreeNode[];
}

/**
 * Build render nodes from the definition trees served by
 * `GET /auth/permissions` (each module contributes its own root).
 */
export function buildPermissionTree(defs: PermissionDef[], depth = 0): PermTreeNode[] {
  return defs.map((def) => ({
    name: def.name,
    label: def.display_name || def.name.split('.').pop() || def.name,
    depth,
    children: buildPermissionTree(def.children ?? [], depth + 1),
  }));
}

/**
 * Pre-order list of the nodes that should currently render: a node is included
 * only when every ancestor is expanded. Drives a collapsible indented list.
 */
export function visibleNodes(
  roots: PermTreeNode[],
  isExpanded: (name: string) => boolean,
): PermTreeNode[] {
  const out: PermTreeNode[] = [];
  const walk = (nodes: PermTreeNode[]): void => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length && isExpanded(n.name)) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Names of every node in the forest that has children (the expandable ones). */
export function branchNames(nodes: PermTreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children.length ? [n.name, ...branchNames(n.children)] : []));
}

/** Names of every leaf node — the actual grantable permissions. */
export function leafNames(nodes: PermTreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children.length ? leafNames(n.children) : [n.name]));
}

/**
 * Prune a tree to the nodes matching `query` (case-insensitive, against the
 * label and the dotted name). A matching node keeps its whole subtree; a
 * non-matching node survives only when a descendant matches, so ancestors stay
 * visible as context. Pass the result to `visibleNodes` with everything
 * expanded to render search results.
 */
export function filterTree(nodes: PermTreeNode[], query: string): PermTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const prune = (node: PermTreeNode): PermTreeNode | null => {
    if (node.label.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) {
      return node;
    }
    const children = node.children.map(prune).filter((c): c is PermTreeNode => c !== null);
    return children.length ? { ...node, children } : null;
  };
  return nodes.map(prune).filter((n): n is PermTreeNode => n !== null);
}
