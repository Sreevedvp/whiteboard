import { BasePolygonElement } from './base-polygon';

export class RectangleElement extends BasePolygonElement {
  constructor(data: any) {
    super({ ...data, type: 'rectangle' });
    if (data.cornerRadius !== undefined) {
      this.cornerRadius = data.cornerRadius;
    }
  }

  public override createPath(ctx: CanvasRenderingContext2D): void {
    const drawX = this.width < 0 ? this.x + this.width : this.x;
    const drawY = this.height < 0 ? this.y + this.height : this.y;
    const drawW = Math.max(1, Math.abs(this.width));
    const drawH = Math.max(1, Math.abs(this.height));
    const radius = Math.min(this.cornerRadius, drawW / 2, drawH / 2);

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(drawX, drawY, drawW, drawH, radius);
    } else {
      ctx.rect(drawX, drawY, drawW, drawH);
    }
    ctx.closePath();
  }

  public override render(ctx: CanvasRenderingContext2D, rc: any): void {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const drawX = this.width < 0 ? this.x + this.width : this.x;
    const drawY = this.height < 0 ? this.y + this.height : this.y;
    const drawW = Math.max(1, Math.abs(this.width));
    const drawH = Math.max(1, Math.abs(this.height));
    const radius = Math.min(this.cornerRadius, drawW / 2, drawH / 2);

    if (this.renderMode === 'polished' || !rc) {
      // Crisp, polished vector rendering (no rough duplication)
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(drawX, drawY, drawW, drawH, radius);
      } else {
        ctx.rect(drawX, drawY, drawW, drawH);
      }

      // Fill
      if (this.fillColor && this.fillColor !== 'transparent') {
        ctx.fillStyle = this.fillColor;
        ctx.fill();
      }

      // Stroke
      if (this.strokeWidth > 0 && this.strokeColor !== 'transparent') {
        ctx.lineWidth = this.strokeWidth;
        ctx.strokeStyle = this.strokeColor;
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
      // Subtle, clean hand-drawn sketchy mode
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

      rc.rectangle(drawX, drawY, drawW, drawH, roughOptions);
    }

    ctx.restore();
  }
}
