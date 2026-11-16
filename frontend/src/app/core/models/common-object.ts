export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ElementStylePatch {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  cornerRadius?: number;
  renderMode?: 'polished' | 'sketch';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  clipContent?: boolean;
  parentClass?: string | null;
  managerClassHash?: string | null;
}

export interface CanvasElementDTO {
  id: string;
  board_id: string;
  type: string;
  parentclass: string | null;
  managerclasshash: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  properties: Record<string, any>;
  version: number;
  is_deleted: boolean;
}

export abstract class CommonObjectClass {
  public id: string;
  public boardId: string;
  public type: string;

  // Spatial coordinates & dimensions
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public rotation: number = 0;
  public zIndex: number = 0;

  // Common styling & polish options
  public strokeColor: string = '#2563eb';
  public fillColor: string = '#eff6ff';
  public strokeWidth: number = 2;
  public strokeStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  public opacity: number = 1.0;
  public fontSize: number = 20;
  public fontFamily: string = "'Patrick Hand', 'Caveat', cursive, sans-serif";
  public cornerRadius: number = 8;
  public renderMode: 'polished' | 'sketch' = 'polished';

  // Clipping: whether this container polygon clips child elements to its boundaries
  public clipContent: boolean = false;

  // Hierarchy & Manager pointers (Nullable)
  public parentClass: string | null = null;
  public managerClassHash: string | null = null;
  public isManager: boolean = false;

  // In-memory children references (stable identity)
  public children: CommonObjectClass[] = [];

  // Initial state snapshots for resetInstance()
  protected initialProps: Record<string, any> = {};

  constructor(data: {
    id: string;
    boardId: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parentClass?: string | null;
    managerClassHash?: string | null;
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    cornerRadius?: number;
    renderMode?: 'polished' | 'sketch';
    rotation?: number;
    zIndex?: number;
    clipContent?: boolean;
  }) {
    this.id = data.id;
    this.boardId = data.boardId;
    this.type = data.type;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.parentClass = data.parentClass ?? null;
    this.managerClassHash = data.managerClassHash ?? null;

    if (data.strokeColor !== undefined) this.strokeColor = data.strokeColor;
    if (data.fillColor !== undefined) this.fillColor = data.fillColor;
    if (data.strokeWidth !== undefined) this.strokeWidth = data.strokeWidth;
    if (data.strokeStyle !== undefined) this.strokeStyle = data.strokeStyle;
    if (data.opacity !== undefined) this.opacity = data.opacity;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.fontFamily !== undefined) this.fontFamily = data.fontFamily;
    if (data.cornerRadius !== undefined) this.cornerRadius = data.cornerRadius;
    if (data.renderMode !== undefined) this.renderMode = data.renderMode;
    if (data.rotation !== undefined) this.rotation = data.rotation;
    if (data.zIndex !== undefined) this.zIndex = data.zIndex;
    if (data.clipContent !== undefined) this.clipContent = !!data.clipContent;

    this.snapshotInitialState();
  }

  /**
   * Returns true if manager and parent are the same entity
   */
  public isParentAndManagerSame(): boolean {
    if (!this.parentClass && !this.managerClassHash) return false;
    if (this.isManager && (this.parentClass === this.id || this.parentClass === this.managerClassHash)) {
      return true;
    }
    return this.parentClass !== null && (this.parentClass === this.managerClassHash);
  }

  /**
   * Captures initial settings for resetInstance()
   */
  public snapshotInitialState(): void {
    this.initialProps = {
      strokeColor: this.strokeColor,
      fillColor: this.fillColor,
      strokeWidth: this.strokeWidth,
      strokeStyle: this.strokeStyle,
      opacity: this.opacity,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      cornerRadius: this.cornerRadius,
      renderMode: this.renderMode,
      clipContent: this.clipContent,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Resets element properties back to their initial creation values
   * without creating copies or changing instance references.
   */
  public resetInstance(): void {
    if (!this.initialProps) return;
    Object.assign(this, this.initialProps);
  }

  /**
   * Cleans up associations, removes element from its parent and manager
   */
  public removeInstance(): void {
    this.parentClass = null;
    this.managerClassHash = null;
    this.isManager = false;
    for (const child of this.children) {
      child.parentClass = null;
      child.managerClassHash = null;
    }
    this.children = [];
  }

  /**
   * Applies partial updates in-place to the instance
   */
  public updateProperties(patch: ElementStylePatch): void {
    if (patch.strokeColor !== undefined) this.strokeColor = patch.strokeColor;
    if (patch.fillColor !== undefined) this.fillColor = patch.fillColor;
    if (patch.strokeWidth !== undefined) this.strokeWidth = patch.strokeWidth;
    if (patch.strokeStyle !== undefined) this.strokeStyle = patch.strokeStyle;
    if (patch.opacity !== undefined) this.opacity = patch.opacity;
    if (patch.fontSize !== undefined) this.fontSize = patch.fontSize;
    if (patch.fontFamily !== undefined) this.fontFamily = patch.fontFamily;
    if (patch.cornerRadius !== undefined) this.cornerRadius = patch.cornerRadius;
    if (patch.renderMode !== undefined) this.renderMode = patch.renderMode;
    if (patch.clipContent !== undefined) this.clipContent = patch.clipContent;
    if (patch.x !== undefined) this.x = patch.x;
    if (patch.y !== undefined) this.y = patch.y;
    if (patch.width !== undefined) this.width = patch.width;
    if (patch.height !== undefined) this.height = patch.height;
    if (patch.rotation !== undefined) this.rotation = patch.rotation;
    if (patch.zIndex !== undefined) this.zIndex = patch.zIndex;
    if (patch.parentClass !== undefined) this.parentClass = patch.parentClass;
    if (patch.managerClassHash !== undefined) this.managerClassHash = patch.managerClassHash;
  }

  /**
   * Calculates normalized Axis-Aligned Bounding Box (AABB)
   */
  public getBoundingBox(): BoundingBox {
    const minX = Math.min(this.x, this.x + this.width);
    const maxX = Math.max(this.x, this.x + this.width);
    const minY = Math.min(this.y, this.y + this.height);
    const maxY = Math.max(this.y, this.y + this.height);

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  /**
   * Pixel-precise point-in-shape hit test
   */
  public hitTest(point: Point): boolean {
    const box = this.getBoundingBox();
    return (
      point.x >= box.minX &&
      point.x <= box.maxX &&
      point.y >= box.minY &&
      point.y <= box.maxY
    );
  }

  /**
   * Computes 2D bounding area for spatial containment calculations
   */
  public getArea(): number {
    const box = this.getBoundingBox();
    return Math.max(1, box.width * box.height);
  }

  /**
   * Spatial containment check with configurable overlap ratio tolerance.
   * If tolerance < 1.0, allows elements slightly sticking out (e.g. 0.45 = 45% inside).
   */
  public encloses(other: CommonObjectClass, tolerance: number = 1.0): boolean {
    const a = this.getBoundingBox();
    const b = other.getBoundingBox();

    if (tolerance >= 1.0) {
      // Strict containment
      return (
        b.minX >= a.minX &&
        b.maxX <= a.maxX &&
        b.minY >= a.minY &&
        b.maxY <= a.maxY
      );
    }

    // Overlap area calculation
    const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
    const overlapArea = overlapX * overlapY;
    const otherArea = b.width * b.height;

    if (otherArea <= 0) return false;
    return (overlapArea / otherArea) >= tolerance;
  }

  /**
   * Translates element in-place with cycle-safe visited protection
   */
  public translate(dx: number, dy: number, propagateChildren: boolean = true, visited: Set<string> = new Set()): void {
    if (visited.has(this.id)) return;
    visited.add(this.id);

    this.x += dx;
    this.y += dy;

    if (propagateChildren && this.children.length > 0) {
      for (const child of this.children) {
        child.translate(dx, dy, true, visited);
      }
    }
  }

  /**
   * Serializes instance into single-table database schema format
   */
  public toJSON(): CanvasElementDTO {
    return {
      id: this.id,
      board_id: this.boardId,
      type: this.type,
      parentclass: this.parentClass,
      managerclasshash: this.managerClassHash,
      x: Math.round(this.x * 10) / 10,
      y: Math.round(this.y * 10) / 10,
      width: Math.round(this.width * 10) / 10,
      height: Math.round(this.height * 10) / 10,
      rotation: this.rotation,
      z_index: this.zIndex,
      properties: this.getCustomProperties(),
      version: 1,
      is_deleted: false
    };
  }

  public getCustomProperties(): Record<string, any> {
    return {
      strokeColor: this.strokeColor,
      fillColor: this.fillColor,
      strokeWidth: this.strokeWidth,
      strokeStyle: this.strokeStyle,
      opacity: this.opacity,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      cornerRadius: this.cornerRadius,
      renderMode: this.renderMode,
      clipContent: this.clipContent,
      isManager: this.isManager
    };
  }

  /**
   * Defines the 2D clipping path of this element for Canvas 2D ctx.clip()
   */
  public createPath(ctx: CanvasRenderingContext2D): void {
    const box = this.getBoundingBox();
    ctx.beginPath();
    ctx.rect(box.minX, box.minY, box.width, box.height);
    ctx.closePath();
  }

  public abstract render(ctx: CanvasRenderingContext2D, rc: any): void;
}
