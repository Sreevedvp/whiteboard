import { CommonObjectClass, ElementStylePatch } from './common-object';
import { BasePolygonElement } from './base-polygon';

export interface HierarchyTreeNode {
  element: CommonObjectClass;
  id: string;
  type: string;
  isManager: boolean;
  parentClass: string | null;
  managerClassHash: string | null;
  depth: number;
  children: HierarchyTreeNode[];
}

export class ManagerClass {
  /**
   * Generates a deterministic hash for the outermost manager polygon
   */
  public static generateHash(managerId: string, boardId: string): string {
    let hash = 0;
    const str = `${boardId}:${managerId}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'mgr_' + Math.abs(hash).toString(16) + managerId.slice(0, 4);
  }

  /**
   * Calculates containment hierarchy and designates ONLY the true outermost bounding polygon
   * enclosing other polygon(s) as the ManagerClass.
   *
   * Key Rules:
   * 1. Polygon-to-Polygon Containment Only: Text elements never trigger ManagerClass status.
   *    A box containing only text is NOT a manager.
   * 2. Proportional enclosure (`encloses(elem, 0.45)`): A larger box continues to own a child
   *    polygon even if the child sticks out by up to 55%.
   * 3. Dynamic Inversion: When the child polygon is resized to be strictly larger than the parent
   *    and encloses it, the child inverts and becomes the parent and manager.
   * 4. Outermost Manager Rule: Only the polygon with the maximum bounding area at the root level
   *    that encloses another polygon can be Manager.
   * 5. Topological Z-Index and Layer Invariant: Parents must always be rendered before children
   *    (parents in the back, children in the front).
   *
   * @param elements Array of element instances
   * @param boardId Whiteboard identifier
   * @param managerParentSame If true, sets parentClass = elem.id on the manager itself
   */
  public static recalculateAllHierarchies(
    elements: CommonObjectClass[],
    boardId: string,
    managerParentSame: boolean = true
  ): void {
    // 1. Reset dynamic hierarchy pointers while preserving object instances
    for (const elem of elements) {
      elem.children = [];
      elem.parentClass = null;
      elem.managerClassHash = null;
      elem.isManager = false;
    }

    // Only polygons, rectangles, and ellipses can act as containers
    const containers = elements.filter(
      e => e.type === 'rectangle' || e.type === 'polygon' || e.type === 'ellipse'
    );

    // 2. Identify parent-child containment with tolerance for sticking out:
    // If container A encloses element B (strict containment OR >= 45% of B is inside A with Area(A) > Area(B)),
    // assign candidate parent with the smallest enclosing area that is still larger than B.
    for (const elem of elements) {
      let candidateParent: CommonObjectClass | null = null;
      let minParentArea = Infinity;
      const elemArea = elem.getArea();

      for (const container of containers) {
        if (container.id === elem.id) continue;

        // Container must be larger than child to be a parent candidate
        const containerArea = container.getArea();
        if (containerArea <= elemArea && elem instanceof BasePolygonElement) continue;

        if (container.encloses(elem, 0.45)) {
          if (containerArea < minParentArea) {
            minParentArea = containerArea;
            candidateParent = container;
          }
        }
      }

      if (candidateParent) {
        elem.parentClass = candidateParent.id;
        candidateParent.children.push(elem);
      }
    }

    // 3. Dynamic Inversion Calculation:
    // If a child polygon was resized such that child.getArea() > parent.getArea()
    // AND child now encloses the former parent, invert their relationship!
    for (const container of containers) {
      const childrenSnapshot = [...container.children];
      for (const child of childrenSnapshot) {
        if (child instanceof BasePolygonElement) {
          const childArea = child.getArea();
          const parentArea = container.getArea();

          if (childArea > parentArea && child.encloses(container, 0.45)) {
            // Dynamic Inversion: child becomes parent, parent becomes child
            this.invertParentChild(container, child);
          }
        }
      }
    }

    // 4. Outermost Manager Class Determination:
    // Only a root BasePolygonElement that actually encloses at least 1 child POLYGON
    // can be designated as the ManagerClass.
    // Text elements NEVER make a box into a ManagerClass!
    for (const elem of elements) {
      if (!(elem instanceof BasePolygonElement)) {
        elem.isManager = false;
        continue;
      }

      // Check if this container has at least one child polygon
      const childPolygons = elem.children.filter(c => c instanceof BasePolygonElement);

      if (elem.parentClass === null && childPolygons.length > 0) {
        // Verify this root polygon is genuinely the outermost bounding polygon of its subtree
        const maxSubtreeArea = this.getMaxSubtreeArea(elem);
        const thisArea = elem.getArea();

        // If another polygon in the subtree is somehow larger, it should be inverted
        if (thisArea >= maxSubtreeArea * 0.95) {
          elem.isManager = true;
          const hash = this.generateHash(elem.id, boardId);
          elem.managerClassHash = hash;

          if (managerParentSame) {
            elem.parentClass = elem.id; // Manager and parent are the same entity
          }

          // Propagate managerclasshash to all descendant children
          this.propagateManagerHash(elem, hash);
        }
      } else {
        // If not a manager and has no external parent, clear manager fields
        if (elem.parentClass === null || elem.parentClass === elem.id) {
          elem.isManager = false;
          elem.parentClass = null;
          elem.managerClassHash = null;
        }
      }
    }

    // 5. Ensure Topological Z-Index and Layer Rendering Invariant:
    // Parents must always be rendered before children (parents in back, children in front)
    const sorted = this.ensureHierarchyOrder(elements);
    elements.splice(0, elements.length, ...sorted);
  }

  /**
   * Topological sort guaranteeing that parent containers are ordered before their children
   * (parents in the back, children in the front).
   * Monotonically assigns zIndex = 0, 1, 2, ...
   */
  public static ensureHierarchyOrder(elements: CommonObjectClass[]): CommonObjectClass[] {
    const idMap = new Map<string, CommonObjectClass>();
    for (const el of elements) {
      idMap.set(el.id, el);
    }

    const visited = new Set<string>();
    const sorted: CommonObjectClass[] = [];

    function visit(elem: CommonObjectClass, stack: Set<string>): void {
      if (visited.has(elem.id) || stack.has(elem.id)) return;
      stack.add(elem.id);

      // Visit parent first so parent is placed earlier (behind)
      if (elem.parentClass && elem.parentClass !== elem.id) {
        const parent = idMap.get(elem.parentClass);
        if (parent) {
          visit(parent, stack);
        }
      }

      visited.add(elem.id);
      sorted.push(elem);
    }

    for (const elem of elements) {
      visit(elem, new Set());
    }

    sorted.forEach((el, idx) => {
      el.zIndex = idx;
    });

    return sorted;
  }

  /**
   * Handles edit events dispatched to the ManagerClass:
   * applies property updates and re-synchronizes containment hierarchies.
   */
  public static handleEditEvent(
    element: CommonObjectClass,
    patch?: ElementStylePatch,
    elements?: CommonObjectClass[],
    boardId?: string
  ): void {
    if (patch) {
      element.updateProperties(patch);
    }
    if (elements && boardId) {
      this.recalculateAllHierarchies(elements, boardId);
    }
  }

  /**
   * Handles delete events dispatched to the ManagerClass:
   * cleans up associations, releases children, recalculates hierarchies,
   * and returns the pruned elements array.
   */
  public static handleDeleteEvent(
    elementId: string,
    elements: CommonObjectClass[],
    boardId: string
  ): CommonObjectClass[] {
    const target = elements.find(e => e.id === elementId);
    if (target) {
      target.removeInstance();
    }
    const remaining = elements.filter(e => e.id !== elementId);
    this.recalculateAllHierarchies(remaining, boardId);
    return remaining;
  }

  /**
   * Constructs a visual hierarchy tree structure representing what is inside what.
   */
  public static buildHierarchyTree(elements: CommonObjectClass[]): HierarchyTreeNode[] {
    const roots = elements.filter(
      elem => elem.parentClass === null || elem.parentClass === elem.id
    );

    const visited = new Set<string>();

    const buildNode = (elem: CommonObjectClass, depth: number): HierarchyTreeNode => {
      visited.add(elem.id);
      const childNodes: HierarchyTreeNode[] = [];

      for (const child of elem.children) {
        if (!visited.has(child.id)) {
          childNodes.push(buildNode(child, depth + 1));
        }
      }

      return {
        element: elem,
        id: elem.id,
        type: elem.type,
        isManager: elem.isManager,
        parentClass: elem.parentClass,
        managerClassHash: elem.managerClassHash,
        depth,
        children: childNodes
      };
    };

    const tree: HierarchyTreeNode[] = [];
    for (const root of roots) {
      tree.push(buildNode(root, 0));
    }

    // Catch any orphaned or unlinked elements that were not visited
    for (const elem of elements) {
      if (!visited.has(elem.id)) {
        tree.push(buildNode(elem, 0));
      }
    }

    return tree;
  }

  /**
   * Safely swaps parent and child relationships (Dynamic Inversion)
   */
  private static invertParentChild(oldParent: CommonObjectClass, newParent: CommonObjectClass): void {
    oldParent.children = oldParent.children.filter(c => c.id !== newParent.id);
    newParent.parentClass = oldParent.parentClass;
    oldParent.parentClass = newParent.id;

    if (!newParent.children.some(c => c.id === oldParent.id)) {
      newParent.children.push(oldParent);
    }
  }

  /**
   * Returns the maximum bounding area of any polygon in the subtree
   */
  private static getMaxSubtreeArea(root: CommonObjectClass): number {
    let maxArea = root.getArea();
    for (const child of root.children) {
      if (child instanceof BasePolygonElement) {
        const childMax = this.getMaxSubtreeArea(child);
        if (childMax > maxArea) maxArea = childMax;
      }
    }
    return maxArea;
  }

  /**
   * Recursively assigns managerclasshash to all children
   */
  private static propagateManagerHash(node: CommonObjectClass, hash: string): void {
    for (const child of node.children) {
      child.managerClassHash = hash;
      child.isManager = false; // Only the dominant outermost bounding polygon is the manager
      this.propagateManagerHash(child, hash);
    }
  }
}
