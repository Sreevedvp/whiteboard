import { CommonObjectClass, Point } from './common-object';

export abstract class BasePolygonElement extends CommonObjectClass {
  public points: Point[] = [];

  constructor(data: any) {
    super(data);
    if (data.points && Array.isArray(data.points)) {
      this.points = data.points.map((p: any) => ({ x: p.x, y: p.y }));
    }
  }

  public setPoints(points: Point[]): void {
    this.points = points.map(p => ({ ...p }));
    this.recalculateBoundsFromPoints();
  }

  public recalculateBoundsFromPoints(): void {
    if (this.points.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    this.x = minX;
    this.y = minY;
    this.width = maxX - minX;
    this.height = maxY - minY;
  }

  public override translate(
    dx: number,
    dy: number,
    propagateChildren: boolean = true,
    visited: Set<string> = new Set()
  ): void {
    super.translate(dx, dy, propagateChildren, visited);
    for (const p of this.points) {
      p.x += dx;
      p.y += dy;
    }
  }

  public override getCustomProperties(): Record<string, any> {
    return {
      ...super.getCustomProperties(),
      points: this.points
    };
  }
}
