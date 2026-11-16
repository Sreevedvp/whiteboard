import { CommonObjectClass, Point, BoundingBox } from './common-object';

export class ArrowElement extends CommonObjectClass {
  public startPoint: Point;
  public endPoint: Point;
  public hasArrowHead: boolean = true;

  constructor(data: any) {
    super({ ...data, type: 'arrow' });
    this.startPoint = data.startPoint ? { ...data.startPoint } : { x: this.x, y: this.y };
    this.endPoint = data.endPoint ? { ...data.endPoint } : { x: this.x + (this.width || 120), y: this.y + (this.height || 60) };
    if (data.hasArrowHead !== undefined) this.hasArrowHead = data.hasArrowHead;
    this.syncBoundsFromEndpoints();
  }

  public setEndpoints(start: Point, end: Point): void {
    this.startPoint = { ...start };
    this.endPoint = { ...end };
    this.syncBoundsFromEndpoints();
  }

  public setStart(pt: Point): void {
    this.startPoint = { ...pt };
    this.syncBoundsFromEndpoints();
  }

  public setEnd(pt: Point): void {
    this.endPoint = { ...pt };
    this.syncBoundsFromEndpoints();
  }

  private syncBoundsFromEndpoints(): void {
    this.x = Math.min(this.startPoint.x, this.endPoint.x);
    this.y = Math.min(this.startPoint.y, this.endPoint.y);
    this.width = Math.max(1, Math.abs(this.endPoint.x - this.startPoint.x));
    this.height = Math.max(1, Math.abs(this.endPoint.y - this.startPoint.y));
  }

  public override getBoundingBox(): BoundingBox {
    this.syncBoundsFromEndpoints();
    return super.getBoundingBox();
  }

  /**
   * Distance-to-segment hit test: Only hits when click is within 12px of the actual arrow line.
   * Completely solves the "arrow sticking to clicks" issue across the canvas.
   */
  public override hitTest(point: Point): boolean {
    const threshold = 12 / (this.strokeWidth ? Math.max(1, this.strokeWidth / 2) : 1);
    const d = this.distToSegment(point, this.startPoint, this.endPoint);
    return d <= threshold;
  }

  private distToSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return Math.hypot(p.x - projX, p.y - projY);
  }

  public override translate(
    dx: number,
    dy: number,
    propagateChildren: boolean = true,
    visited: Set<string> = new Set()
  ): void {
    super.translate(dx, dy, propagateChildren, visited);
    this.startPoint.x += dx;
    this.startPoint.y += dy;
    this.endPoint.x += dx;
    this.endPoint.y += dy;
    this.syncBoundsFromEndpoints();
  }

  public override render(ctx: CanvasRenderingContext2D, rc: any): void {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const angle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);
    const headLength = Math.max(12, this.strokeWidth * 4.5);
    const angleOffset = Math.PI / 6;

    const p1x = this.endPoint.x - headLength * Math.cos(angle - angleOffset);
    const p1y = this.endPoint.y - headLength * Math.sin(angle - angleOffset);
    const p2x = this.endPoint.x - headLength * Math.cos(angle + angleOffset);
    const p2y = this.endPoint.y - headLength * Math.sin(angle + angleOffset);

    if (this.renderMode === 'polished' || !rc) {
      // Crisp polished vector line
      ctx.beginPath();
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = this.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (this.strokeStyle === 'dashed') {
        ctx.setLineDash([8, 6]);
      } else if (this.strokeStyle === 'dotted') {
        ctx.setLineDash([3, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.moveTo(this.startPoint.x, this.startPoint.y);
      ctx.lineTo(this.endPoint.x, this.endPoint.y);
      ctx.stroke();

      // Polished arrowhead
      if (this.hasArrowHead) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.fillStyle = this.strokeColor;
        ctx.moveTo(this.endPoint.x, this.endPoint.y);
        ctx.lineTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Subtle clean hand-drawn sketchy mode
      const roughOptions: any = {
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth,
        roughness: 0.3,
        bowing: 0.2
      };

      if (this.strokeStyle === 'dashed') {
        roughOptions.strokeLineDash = [8, 6];
      } else if (this.strokeStyle === 'dotted') {
        roughOptions.strokeLineDash = [3, 4];
      }

      rc.line(this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y, roughOptions);

      if (this.hasArrowHead) {
        rc.line(this.endPoint.x, this.endPoint.y, p1x, p1y, roughOptions);
        rc.line(this.endPoint.x, this.endPoint.y, p2x, p2y, roughOptions);
      }
    }

    ctx.restore();
  }

  public override getCustomProperties(): Record<string, any> {
    return {
      ...super.getCustomProperties(),
      startPoint: this.startPoint,
      endPoint: this.endPoint,
      hasArrowHead: this.hasArrowHead
    };
  }
}
