import { BasePolygonElement } from './base-polygon';

export class EllipseElement extends BasePolygonElement {
  constructor(data: any) {
    super({ ...data, type: 'ellipse' });
  }

  public override createPath(ctx: CanvasRenderingContext2D): void {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      Math.abs(this.width) / 2,
      Math.abs(this.height) / 2,
      0,
      0,
      2 * Math.PI
    );
    ctx.closePath();
  }

  public override render(ctx: CanvasRenderingContext2D, rc: any): void {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    const roughOptions: any = {
      stroke: this.strokeColor,
      strokeWidth: this.strokeWidth,
      roughness: 1.2,
      bowing: 1,
      seed: 54321
    };

    if (this.fillColor && this.fillColor !== 'transparent') {
      roughOptions.fill = this.fillColor;
      roughOptions.fillStyle = 'solid';
    }

    if (this.strokeStyle === 'dashed') {
      roughOptions.strokeLineDash = [8, 6];
    } else if (this.strokeStyle === 'dotted') {
      roughOptions.strokeLineDash = [2, 4];
    }

    if (rc) {
      rc.ellipse(centerX, centerY, Math.abs(this.width), Math.abs(this.height), roughOptions);
    } else {
      ctx.beginPath();
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = this.strokeWidth;
      ctx.ellipse(
        centerX,
        centerY,
        Math.abs(this.width) / 2,
        Math.abs(this.height) / 2,
        0,
        0,
        2 * Math.PI
      );
      if (this.fillColor && this.fillColor !== 'transparent') {
        ctx.fillStyle = this.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
