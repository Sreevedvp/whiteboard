import { Injectable, signal, computed } from '@angular/core';
import { CommonObjectClass, Point, ElementStylePatch } from '../models/common-object';
import { ElementFactory } from '../models/element-factory';
import { ManagerClass, HierarchyTreeNode } from '../models/manager-class';

export type ToolType = 'select' | 'hand' | 'rectangle' | 'polygon' | 'ellipse' | 'arrow' | 'text';

@Injectable({
  providedIn: 'root'
})
export class CanvasStateService {
  // Whiteboard session state
  public boardId = signal<string>('default-board');

  // Object-Oriented Element Registry (Stable Instances)
  public elements = signal<CommonObjectClass[]>([]);

  // Version counter to trigger zoneless change detection on instance property mutations
  public stateVersion = signal<number>(0);

  // Active drawing/selection tool
  public activeTool = signal<ToolType>('select');

  // Selection state
  public selectedElementIds = signal<Set<string>>(new Set());

  // Viewport transformation (Pan & Zoom)
  public zoom = signal<number>(1.0);
  public pan = signal<Point>({ x: 0, y: 0 });

  // Common styling defaults
  public currentStrokeColor = signal<string>('#2563eb');
  public currentFillColor = signal<string>('#eff6ff');
  public currentStrokeWidth = signal<number>(2);
  public currentStrokeStyle = signal<'solid' | 'dashed' | 'dotted'>('solid');
  public currentFontSize = signal<number>(22);
  public currentFontFamily = signal<string>("'Patrick Hand', 'Caveat', cursive, sans-serif");
  public currentCornerRadius = signal<number>(8);
  public currentRenderMode = signal<'polished' | 'sketch'>('polished');

  // Toggle for: "sometimes manager and parent can be same"
  public managerParentSame = signal<boolean>(true);

  // Computed state & Instance Statistics (Strict Invariant Tracking)
  public instanceCount = computed(() => this.elements().length);
  public managerCount = computed(() => this.elements().filter(e => e.isManager).length);
  public childCount = computed(() => this.elements().filter(e => e.parentClass !== null && e.parentClass !== e.id).length);

  public selectedElements = computed(() => {
    this.stateVersion();
    const ids = this.selectedElementIds();
    return this.elements().filter(e => ids.has(e.id));
  });

  public singleSelectedElement = computed(() => {
    this.stateVersion();
    const selected = this.selectedElements();
    return selected.length === 1 ? selected[0] : null;
  }, { equal: () => false });

  public managerElements = computed(() => {
    this.stateVersion();
    return this.elements().filter(e => e.isManager);
  });

  // Real-time hierarchy tree visualization of what's inside what
  public hierarchyTree = computed<HierarchyTreeNode[]>(() => {
    this.stateVersion();
    return ManagerClass.buildHierarchyTree(this.elements());
  });

  constructor() {
    this.initDefaultDemoElements();
  }

  private initDefaultDemoElements(): void {
    const bId = this.boardId();

    // 1. Outermost bounding polygon (Manager)
    const bigBox = ElementFactory.createNew('rectangle', 180, 140, bId, {
      width: 480,
      height: 320,
      fillColor: '#eff6ff',
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 12
    });

    // 2. Inner child box (Parent-Child relationship)
    const smallBox = ElementFactory.createNew('rectangle', 220, 200, bId, {
      width: 240,
      height: 150,
      fillColor: '#fef3c7',
      strokeColor: '#f59e0b',
      strokeWidth: 2,
      cornerRadius: 8
    });

    // 3. Inner text child with Crayon style font
    const text = ElementFactory.createNew('text', 245, 230, bId, {
      text: 'Crayon Text ✨',
      fontSize: 22,
      fontFamily: "'Patrick Hand', 'Caveat', cursive, sans-serif",
      strokeColor: '#92400e'
    });

    this.elements.set([bigBox, smallBox, text]);
    this.recalculateHierarchy();
  }

  /**
   * Recalculates spatial containment and manager class assignments,
   * guaranteeing parents remain behind children in render order.
   */
  public recalculateHierarchy(): void {
    const list = this.elements();
    ManagerClass.recalculateAllHierarchies(list, this.boardId(), this.managerParentSame());
    this.elements.set([...list]);
    this.stateVersion.update(v => v + 1);
  }

  public addElement(element: CommonObjectClass): void {
    this.elements.update(prev => [...prev, element]);
    this.recalculateHierarchy();
  }

  public selectElement(id: string, multi: boolean = false): void {
    this.selectedElementIds.update(set => {
      const next = multi ? new Set(set) : new Set<string>();
      next.add(id);
      return next;
    });
    this.stateVersion.update(v => v + 1);
  }

  public clearSelection(): void {
    this.selectedElementIds.set(new Set());
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Dispatches element deletion through ManagerClass
   */
  public deleteElementViaManager(elementId: string): void {
    const updated = ManagerClass.handleDeleteEvent(elementId, this.elements(), this.boardId());
    this.elements.set(updated);
    this.selectedElementIds.update(set => {
      const next = new Set(set);
      next.delete(elementId);
      return next;
    });
    this.stateVersion.update(v => v + 1);
  }

  public deleteSelected(): void {
    const ids = Array.from(this.selectedElementIds());
    for (const id of ids) {
      this.deleteElementViaManager(id);
    }
  }

  public resetSelected(): void {
    const selected = this.selectedElements();
    for (const elem of selected) {
      elem.resetInstance();
    }
    this.stateVersion.update(v => v + 1);
    this.elements.update(prev => [...prev]);
  }

  /**
   * Dispatches element edit through ManagerClass:
   * updates properties and copies active styles for toolbar creation dropdown
   */
  public editElementViaManager(element: CommonObjectClass, patch?: ElementStylePatch): void {
    ManagerClass.handleEditEvent(element, patch, this.elements(), this.boardId());

    // Sync active creation properties with this element's properties
    this.currentStrokeColor.set(element.strokeColor);
    this.currentFillColor.set(element.fillColor);
    this.currentStrokeWidth.set(element.strokeWidth);
    this.currentStrokeStyle.set(element.strokeStyle);
    this.currentFontSize.set(element.fontSize);
    this.currentFontFamily.set(element.fontFamily);
    this.currentCornerRadius.set(element.cornerRadius);
    this.currentRenderMode.set(element.renderMode);

    this.selectElement(element.id);
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Instantiates and adds a new polygon, shape, or text using the active edited properties
   */
  public createWithActiveProperties(type: ToolType, x?: number, y?: number): CommonObjectClass {
    const defaultX = x !== undefined ? x : 400 + Math.random() * 80;
    const defaultY = y !== undefined ? y : 250 + Math.random() * 80;

    const elem = ElementFactory.createNew(type, defaultX, defaultY, this.boardId(), {
      strokeColor: this.currentStrokeColor(),
      fillColor: this.currentFillColor(),
      strokeWidth: this.currentStrokeWidth(),
      strokeStyle: this.currentStrokeStyle(),
      fontSize: this.currentFontSize(),
      fontFamily: this.currentFontFamily(),
      cornerRadius: this.currentCornerRadius(),
      renderMode: this.currentRenderMode(),
      width: type === 'text' ? 160 : (type === 'polygon' ? 140 : 180),
      height: type === 'text' ? 40 : (type === 'polygon' ? 140 : 120)
    });

    if (type === 'arrow') {
      (elem as any).setEndpoints(
        { x: defaultX, y: defaultY },
        { x: defaultX + 160, y: defaultY + 40 }
      );
    }

    this.addElement(elem);
    this.selectElement(elem.id);
    return elem;
  }

  public updateSelectedProperties(patch: ElementStylePatch): void {
    const selected = this.selectedElements();
    for (const elem of selected) {
      ManagerClass.handleEditEvent(elem, patch);
    }

    if (patch.strokeColor) this.currentStrokeColor.set(patch.strokeColor);
    if (patch.fillColor) this.currentFillColor.set(patch.fillColor);
    if (patch.strokeWidth) this.currentStrokeWidth.set(patch.strokeWidth);
    if (patch.strokeStyle) this.currentStrokeStyle.set(patch.strokeStyle);
    if (patch.fontSize) this.currentFontSize.set(patch.fontSize);
    if (patch.fontFamily) this.currentFontFamily.set(patch.fontFamily);
    if (patch.cornerRadius !== undefined) this.currentCornerRadius.set(patch.cornerRadius);
    if (patch.renderMode) this.currentRenderMode.set(patch.renderMode);

    this.recalculateHierarchy();
    this.elements.update(prev => [...prev]);
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Moves element or selection to the absolute front (top) of the layer stack
   */
  public bringToFront(targetId?: string): void {
    const ids = targetId ? [targetId] : Array.from(this.selectedElementIds());
    if (ids.length === 0) return;

    const current = [...this.elements()];
    const targetSet = new Set(ids);

    // Expand targetSet to include children so parents never cover their children
    for (const el of current) {
      if (targetSet.has(el.id)) {
        this.collectAllDescendants(el, targetSet);
      }
    }

    const targets: CommonObjectClass[] = [];
    const others: CommonObjectClass[] = [];

    for (const el of current) {
      if (targetSet.has(el.id)) {
        targets.push(el);
      } else {
        others.push(el);
      }
    }

    const reordered = ManagerClass.ensureHierarchyOrder([...others, ...targets]);
    this.elements.set(reordered);
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Moves element or selection to the absolute back (bottom) of the layer stack
   */
  public sendToBack(targetId?: string): void {
    const ids = targetId ? [targetId] : Array.from(this.selectedElementIds());
    if (ids.length === 0) return;

    const current = [...this.elements()];
    const targetSet = new Set(ids);
    const targets: CommonObjectClass[] = [];
    const others: CommonObjectClass[] = [];

    for (const el of current) {
      if (targetSet.has(el.id)) {
        targets.push(el);
      } else {
        others.push(el);
      }
    }

    const reordered = ManagerClass.ensureHierarchyOrder([...targets, ...others]);
    this.elements.set(reordered);
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Moves element or selection one step forward in visual layer order
   */
  public bringForward(targetId?: string): void {
    const id = targetId || this.singleSelectedElement()?.id;
    if (!id) return;

    const list = [...this.elements()];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1 || idx === list.length - 1) return;

    const temp = list[idx];
    list[idx] = list[idx + 1];
    list[idx + 1] = temp;

    const reordered = ManagerClass.ensureHierarchyOrder(list);
    this.elements.set(reordered);
    this.stateVersion.update(v => v + 1);
  }

  /**
   * Moves element or selection one step backward in visual layer order
   */
  public sendBackward(targetId?: string): void {
    const id = targetId || this.singleSelectedElement()?.id;
    if (!id) return;

    const list = [...this.elements()];
    const idx = list.findIndex(e => e.id === id);
    if (idx <= 0) return;

    const temp = list[idx];
    list[idx] = list[idx - 1];
    list[idx - 1] = temp;

    const reordered = ManagerClass.ensureHierarchyOrder(list);
    this.elements.set(reordered);
    this.stateVersion.update(v => v + 1);
  }

  private collectAllDescendants(parent: CommonObjectClass, set: Set<string>): void {
    for (const child of parent.children) {
      set.add(child.id);
      this.collectAllDescendants(child, set);
    }
  }

  public screenToWorld(clientX: number, clientY: number): Point {
    const p = this.pan();
    const z = this.zoom();
    return {
      x: (clientX - p.x) / z,
      y: (clientY - p.y) / z
    };
  }

  public worldToScreen(worldX: number, worldY: number): Point {
    const p = this.pan();
    const z = this.zoom();
    return {
      x: worldX * z + p.x,
      y: worldY * z + p.y
    };
  }
}
