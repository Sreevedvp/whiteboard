import { CommonObjectClass } from './common-object';

export class TextElement extends CommonObjectClass {
  public text: string = 'Double click to edit';
  public lineHeight: number = 1.25;
  public textAlign: 'left' | 'center' | 'right' = 'left';
  public isEditing: boolean = false;

  constructor(data: any) {
    super({
      ...data,
      type: 'text',
      fontFamily: data.fontFamily || "'Patrick Hand', 'Caveat', cursive, sans-serif"
    });
    if (data.text !== undefined) this.text = data.text;
    if (data.lineHeight !== undefined) this.lineHeight = data.lineHeight;
    if (data.textAlign !== undefined) this.textAlign = data.textAlign;
  }

  public setText(newText: string, ctx?: CanvasRenderingContext2D): void {
    this.text = newText;
    if (ctx) {
      this.recalculateDimensions(ctx);
    }
  }

  public recalculateDimensions(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    const lines = this.text.split('\n');
    let maxW = 20;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxW) maxW = metrics.width;
    }
    this.width = Math.max(maxW + 14, 40);
    this.height = Math.max(lines.length * (this.fontSize * this.lineHeight), 30);
    ctx.restore();
  }

  public override render(ctx: CanvasRenderingContext2D, _rc: any): void {
    if (this.isEditing) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.fillStyle = this.strokeColor;
    ctx.textBaseline = 'top';

    const lines = this.text.split('\n');
    const lineSpacing = this.fontSize * this.lineHeight;

    for (let i = 0; i < lines.length; i++) {
      let drawX = this.x;
      if (this.textAlign === 'center') {
        const metrics = ctx.measureText(lines[i]);
        drawX = this.x + (this.width - metrics.width) / 2;
      } else if (this.textAlign === 'right') {
        const metrics = ctx.measureText(lines[i]);
        drawX = this.x + this.width - metrics.width;
      }
      ctx.fillText(lines[i], drawX, this.y + i * lineSpacing);
    }

    ctx.restore();
  }

  public override getCustomProperties(): Record<string, any> {
    return {
      ...super.getCustomProperties(),
      text: this.text,
      lineHeight: this.lineHeight,
      textAlign: this.textAlign
    };
  }
}
