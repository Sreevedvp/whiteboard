import { CommonObjectClass, CanvasElementDTO } from './common-object';
import { RectangleElement } from './rectangle';
import { EllipseElement } from './ellipse';
import { PolygonElement } from './polygon';
import { ArrowElement } from './arrow';
import { TextElement } from './text';

export class ElementFactory {
  public static createFromDTO(dto: CanvasElementDTO): CommonObjectClass {
    const baseParams = {
      id: dto.id,
      boardId: dto.board_id,
      type: dto.type,
      x: dto.x,
      y: dto.y,
      width: dto.width,
      height: dto.height,
      rotation: dto.rotation,
      zIndex: dto.z_index,
      parentClass: dto.parentclass,
      managerClassHash: dto.managerclasshash,
      ...(dto.properties || {})
    };

    switch (dto.type) {
      case 'rectangle':
        return new RectangleElement(baseParams);
      case 'ellipse':
        return new EllipseElement(baseParams);
      case 'polygon':
        return new PolygonElement(baseParams);
      case 'arrow':
        return new ArrowElement(baseParams);
      case 'text':
        return new TextElement(baseParams);
      default:
        return new RectangleElement(baseParams);
    }
  }

  public static createNew(
    type: string,
    x: number,
    y: number,
    boardId: string,
    defaults?: Record<string, any>
  ): CommonObjectClass {
    const id = 'el_' + Math.random().toString(36).substring(2, 9);
    const params = {
      id,
      boardId,
      type,
      x,
      y,
      width: 0,
      height: 0,
      strokeColor: '#2563eb',
      fillColor: '#eff6ff',
      strokeWidth: 2,
      cornerRadius: 8,
      renderMode: 'polished' as const,
      fontFamily: "'Patrick Hand', 'Caveat', cursive, sans-serif",
      ...(defaults || {})
    };

    switch (type) {
      case 'rectangle':
        return new RectangleElement(params);
      case 'ellipse':
        return new EllipseElement(params);
      case 'polygon':
        return new PolygonElement({ ...params, subShape: 'diamond' });
      case 'arrow':
        return new ArrowElement({
          ...params,
          startPoint: { x, y },
          endPoint: { x, y }
        });
      case 'text':
        return new TextElement({
          ...params,
          text: 'Crayon Text ✨',
          width: 150,
          height: 38,
          fontSize: 22,
          fontFamily: "'Patrick Hand', 'Caveat', cursive, sans-serif",
          fillColor: 'transparent',
          strokeColor: '#1e293b'
        });
      default:
        return new RectangleElement(params);
    }
  }
}
