import { BasePolygonElement } from './base-polygon';
import { Point } from './common-object';

export class PolygonElement extends BasePolygonElement {
  public subShape: 'diamond' | 'triangle' | 'custom' = 'diamond';

  constructor(data: any) {
    super({ ...data, type: 'polygon' });
    if (data.subShape) this.subShape = data.subShape;
    this.ensurePointsGenerated();
  }

  public ensurePointsGenerated(): void {
    const drawX = this.width < 0 ? this.x + this.width : this.x;
    const drawY = this.height < 0 ? this.y + this.height : this.y;
    const drawW = Math.max(1, Math.abs(this.width));
    const drawH = Math.max(1, Math.abs(this.height));

    if (this.subShape === 'diamond') {
      this.points = [
        { x: drawX + drawW / 2, y: drawY },
        { x: drawX + drawW, y: drawY + drawH / 2 },
        { x: drawX + drawW / 2, y: drawY + drawH },
        { x: drawX, y: drawY + drawH / 2 }
      ];
    } else if (this.subShape === 'triangle') {
      this.points = [
        { x: drawX + drawW / 2, y: drawY },
        { x: drawX + drawW, y: drawY + drawH },
        { x: drawX, y: drawY + drawH }
      ];
    }
  }

  public override createPath(ctx: CanvasRenderingContext2D): void {
    this.ensurePointsGenerated();
    if (this.points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
  }

  /**
   * Ray-casting point-in-polygon algorithm for pixel-perfect polygon selection
   */
  public override hitTest(point: Point): boolean {
    this.ensurePointsGenerated();
    if (this.points.length < 3) return super.hitTest(point);

    let inside = false;
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
      const xi = this.points[i].x, yi = this.points[i].y;
      const xj = this.points[j].x, yj = this.points[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  public override render(ctx: CanvasRenderingContext2D, rc: any): void {
    this.ensurePointsGenerated();
    if (this.points.length < 3) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    if (this.renderMode === 'polished' || !rc) {
      // Crisp polished vector polygon
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.closePath();

      if (this.fillColor && this.fillColor !== 'transparent') {
        ctx.fillStyle = this.fillColor;
        ctx.fill();
      }

      if (this.strokeWidth > 0 && this.strokeColor !== 'transparent') {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (this.strokeStyle === 'dashed') {
          ctx.setLineDash([8, 6]);
        } else if (this.strokeStyle === 'dotted') {
          ctx.setLineDash([3, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();
      }
    } else {
      // Subtle clean hand-drawn sketchy mode
      const roughOptions: any = {
        stroke: this.strokeColor,
        strokeWidth: this.strokeWidth,
        roughness: 0.3,
        bowing: 0.2,
        seed: 42
      };

      if (this.fillColor && this.fillColor !== 'transparent') {
        roughOptions.fill = this.fillColor;
        roughOptions.fillStyle = 'solid';
      }

      if (this.strokeStyle === 'dashed') {
        roughOptions.strokeLineDash = [8, 6];
      } else if (this.strokeStyle === 'dotted') {
        roughOptions.strokeLineDash = [3, 4];
      }

      const roughPoints = this.points.map(p => [p.x, p.y]);
      rc.polygon(roughPoints, roughOptions);
    }

    ctx.restore();
  }

  public override getCustomProperties(): Record<string, any> {
    return {
      ...super.getCustomProperties(),
      subShape: this.subShape
    };
  }
}
