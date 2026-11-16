import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  effect,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import rough from 'roughjs';
import { CanvasStateService } from '../../core/services/canvas-state.service';
import { ApiSyncService } from '../../core/services/api-sync.service';
import { ElementFactory } from '../../core/models/element-factory';
import { CommonObjectClass, Point } from '../../core/models/common-object';
import { TextElement } from '../../core/models/text';
import { ArrowElement } from '../../core/models/arrow';

type InteractionMode = 'none' | 'drawing' | 'moving' | 'resizing' | 'panning';

@Component({
  selector: 'app-whiteboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="whiteboard-wrapper" #wrapper>
      <!-- Main Sketch/Render Canvas -->
      <canvas #mainCanvas class="canvas-layer"></canvas>

      <!-- Selection, Handles & Guides Canvas -->
      <canvas
        #overlayCanvas
        class="canvas-layer overlay"
        (mousedown)="onMouseDown($event)"
        (mousemove)="onMouseMove($event)"
        (mouseup)="onMouseUp($event)"
        (wheel)="onWheel($event)"
        (dblclick)="onDoubleClick($event)"
        (contextmenu)="onContextMenu($event)"
      ></canvas>

      <!-- Polished On-Plane Instance Count & Status HUD -->
      <div class="plane-hud">
        <div class="hud-item">
          <span
            class="hud-dot"
            [class.saving]="syncService.saveStatus() === 'saving'"
            [class.error]="syncService.saveStatus() === 'error'"
          ></span>
          <span class="hud-label">Instances:</span>
          <span class="hud-val">{{ canvasState.instanceCount() }}</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item">
          <span class="hud-label">Managers:</span>
          <span class="hud-val manager">{{ canvasState.managerCount() }}</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item">
          <span class="hud-label">Children:</span>
          <span class="hud-val child">{{ canvasState.childCount() }}</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item">
          <span class="hud-label">Cloud:</span>
          <span
            class="hud-val cloud"
            [class.saving]="syncService.saveStatus() === 'saving'"
            [class.error]="syncService.saveStatus() === 'error'"
          >
            @if (syncService.saveStatus() === 'saving') {
              Saving...
            } @else if (syncService.saveStatus() === 'saved') {
              Autosaved ✓
            } @else {
              Offline
            }
          </span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item">
          <span class="hud-label">Zoom:</span>
          <span class="hud-val">{{ Math.round(canvasState.zoom() * 100) }}%</span>
        </div>
      </div>

      <!-- Right-Click Context Menu (Edit, Layering & Delete via ManagerClass) -->
      @if (contextMenu().visible && contextMenu().element) {
        <div
          class="custom-context-menu"
          [style.left.px]="contextMenu().x"
          [style.top.px]="contextMenu().y"
          (click)="$event.stopPropagation()"
          (contextmenu)="$event.preventDefault()"
        >
          <div class="menu-header">
            <span class="menu-type">{{ contextMenu().element!.type | uppercase }} INSTANCE</span>
            @if (contextMenu().element!.isManager) {
              <span class="menu-badge manager">MANAGER</span>
            } @else if (contextMenu().element!.parentClass) {
              <span class="menu-badge child">CHILD</span>
            }
          </div>
          <div class="menu-divider"></div>
          <button class="menu-btn edit-btn" (click)="onContextMenuEdit()">
            <span class="btn-icon">✏️</span>
            <div class="btn-text">
              <span class="btn-title">Edit Properties</span>
              <span class="btn-desc">Sync to toolbar creation</span>
            </div>
          </button>

          <!-- Layer / Z-Order: What comes front and what comes back -->
          <button class="menu-btn layer-btn" (click)="onContextMenuBringToFront()">
            <span class="btn-icon">🔝</span>
            <div class="btn-text">
              <span class="btn-title">Bring to Front</span>
              <span class="btn-desc">Move above other shapes (])</span>
            </div>
          </button>
          <button class="menu-btn layer-btn" (click)="onContextMenuSendToBack()">
            <span class="btn-icon">🔚</span>
            <div class="btn-text">
              <span class="btn-title">Send to Back</span>
              <span class="btn-desc">Move behind other shapes ([)</span>
            </div>
          </button>

          <div class="menu-divider"></div>
          <button class="menu-btn delete-btn" (click)="onContextMenuDelete()">
            <span class="btn-icon">🗑️</span>
            <div class="btn-text">
              <span class="btn-title">Delete Instance</span>
              <span class="btn-desc">Via ManagerClass</span>
            </div>
          </button>
        </div>
      }

      <!-- Seamless Inline Text Editor Overlay (Zero Form Chrome, Exact Canvas Match) -->
      @if (editingTextElement()) {
        <textarea
          #inlineEditor
          class="inline-text-editor"
          [style.left.px]="editingScreenPos().x"
          [style.top.px]="editingScreenPos().y"
          [style.font-size.px]="editingTextElement()!.fontSize * canvasState.zoom()"
          [style.font-family]="editingTextElement()!.fontFamily"
          [style.color]="editingTextElement()!.strokeColor"
          [style.caret-color]="editingTextElement()!.strokeColor"
          [style.width.px]="getTextEditorWidth()"
          [style.height.px]="getTextEditorHeight()"
          [(ngModel)]="editingTextElement()!.text"
          (input)="onTextInput()"
          (blur)="finishTextEditing()"
          (keydown)="onTextKeyDown($event)"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
      }
    </div>
  `,
  styles: [`
    .whiteboard-wrapper {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background-color: #f8fafc;
      background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px);
      background-size: 24px 24px;
      user-select: none;
    }

    .canvas-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;

      &.overlay {
        cursor: default;
      }
    }

    .plane-hud {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(8px);
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 6px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
      font-size: 12px;
      color: #475569;
      z-index: 80;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    }

    .hud-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .hud-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      transition: background 0.2s ease, transform 0.2s ease;

      &.saving {
        background: #f59e0b;
        animation: pulse 0.9s infinite alternate;
      }
      &.error {
        background: #ef4444;
      }
    }

    @keyframes pulse {
      0% { transform: scale(0.85); opacity: 0.6; }
      100% { transform: scale(1.25); opacity: 1; }
    }

    .hud-label {
      color: #64748b;
      font-size: 11px;
    }

    .hud-val {
      font-weight: 700;
      color: #0f172a;

      &.manager {
        color: #7c3aed;
      }
      &.child {
        color: #2563eb;
      }
      &.cloud {
        color: #10b981;
        &.saving { color: #f59e0b; }
        &.error { color: #ef4444; }
      }
    }

    .hud-divider {
      width: 1px;
      height: 14px;
      background: #e2e8f0;
    }

    /* Right-Click Context Menu */
    .custom-context-menu {
      position: absolute;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(12px);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 6px;
      width: 215px;
      z-index: 200;
      animation: popIn 0.12s ease-out;
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .menu-header {
      padding: 6px 8px 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .menu-type {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.04em;
    }

    .menu-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;

      &.manager {
        background: #7c3aed;
        color: #ffffff;
      }
      &.child {
        background: #2563eb;
        color: #ffffff;
      }
    }

    .menu-divider {
      height: 1px;
      background: #f1f5f9;
      margin: 4px 0;
    }

    .menu-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s ease;

      &:hover {
        background: #f8fafc;
      }

      &.edit-btn:hover {
        background: #eff6ff;
        .btn-title {
          color: #2563eb;
        }
      }

      &.layer-btn:hover {
        background: #f0fdf4;
        .btn-title {
          color: #16a34a;
        }
      }

      &.delete-btn:hover {
        background: #fee2e2;
        .btn-title {
          color: #ef4444;
        }
      }

      .btn-icon {
        font-size: 15px;
      }

      .btn-text {
        display: flex;
        flex-direction: column;
      }

      .btn-title {
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
      }

      .btn-desc {
        font-size: 10px;
        color: #94a3b8;
      }
    }

    /* Seamless Inline Text Editor: Zero Input Chrome, Matches Canvas Text Exactly */
    .inline-text-editor {
      position: absolute;
      background: transparent !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      resize: none !important;
      overflow: hidden !important;
      white-space: pre !important;
      line-height: 1.25 !important;
      z-index: 150;
      letter-spacing: normal;
      word-spacing: normal;
      font-weight: 500;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      display: block;
      box-sizing: content-box;
      user-select: text;
    }
  `]
})
export class WhiteboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('wrapper', { static: true }) wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('mainCanvas', { static: true }) mainCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayCanvas', { static: true }) overlayCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('inlineEditor') inlineEditorRef?: ElementRef<HTMLTextAreaElement>;

  public canvasState = inject(CanvasStateService);
  public syncService = inject(ApiSyncService);
  public Math = Math;

  private mainCtx!: CanvasRenderingContext2D;
  private overlayCtx!: CanvasRenderingContext2D;
  private roughCanvas: any;

  private mode: InteractionMode = 'none';
  private dragStart: Point = { x: 0, y: 0 };
  private panStart: Point = { x: 0, y: 0 };
  private activeElement: CommonObjectClass | null = null;
  private activeHandle: string | null = null;
  private isSpacePressed = false;
  private animFrameId: number | null = null;

  private draftElement: CommonObjectClass | null = null;

  public editingTextElement = signal<TextElement | null>(null);
  public editingScreenPos = signal<Point>({ x: 0, y: 0 });

  // Right-click context menu state
  public contextMenu = signal<{
    visible: boolean;
    x: number;
    y: number;
    element: CommonObjectClass | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    element: null
  });

  constructor() {
    effect(() => {
      this.canvasState.elements();
      this.canvasState.selectedElementIds();
      this.canvasState.zoom();
      this.canvasState.pan();
      this.requestRender();
    });
  }

  public ngAfterViewInit(): void {
    const mainCanvas = this.mainCanvasRef.nativeElement;
    const overlayCanvas = this.overlayCanvasRef.nativeElement;

    this.mainCtx = mainCanvas.getContext('2d', { alpha: true })!;
    this.overlayCtx = overlayCanvas.getContext('2d', { alpha: true })!;
    this.roughCanvas = rough.canvas(mainCanvas);

    this.resizeCanvas();
    this.requestRender();

    this.syncService.loadBoard(this.canvasState.boardId());
    this.syncService.connectWebSocket(this.canvasState.boardId());
  }

  public ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  @HostListener('window:resize')
  public onWindowResize(): void {
    this.resizeCanvas();
    this.requestRender();
  }

  @HostListener('window:click')
  public onWindowClick(): void {
    if (this.contextMenu().visible) {
      this.closeContextMenu();
    }
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.contextMenu().visible) {
        this.closeContextMenu();
        return;
      }
    }

    if (this.editingTextElement()) return;

    if (e.code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.overlayCanvasRef.nativeElement.style.cursor = 'grab';
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.canvasState.deleteSelected();
      this.syncService.triggerAutosave();
    }

    // Layer Shortcuts: What should come front and what should come back
    if (e.key === ']') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        this.canvasState.bringToFront();
      } else {
        this.canvasState.bringForward();
      }
      this.syncService.triggerAutosave();
      this.requestRender();
      return;
    }

    if (e.key === '[') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        this.canvasState.sendToBack();
      } else {
        this.canvasState.sendBackward();
      }
      this.syncService.triggerAutosave();
      this.requestRender();
      return;
    }

    if (e.key === 'Enter') {
      const single = this.canvasState.singleSelectedElement();
      if (single && single instanceof TextElement) {
        e.preventDefault();
        this.startTextEditing(single);
        return;
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  public onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.updateHoverCursor(this.canvasState.screenToWorld(0, 0));
    }
  }

  public onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const worldPt = this.canvasState.screenToWorld(e.clientX, e.clientY);
    const elements = [...this.canvasState.elements()].reverse();
    const hit = elements.find(el => el.hitTest(worldPt));

    if (hit) {
      this.canvasState.selectElement(hit.id);
      this.contextMenu.set({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        element: hit
      });
    } else {
      this.closeContextMenu();
    }
  }

  public closeContextMenu(): void {
    if (this.contextMenu().visible) {
      this.contextMenu.set({
        visible: false,
        x: 0,
        y: 0,
        element: null
      });
    }
  }

  public onContextMenuEdit(): void {
    const el = this.contextMenu().element;
    if (el) {
      this.canvasState.editElementViaManager(el);
      if (el instanceof TextElement) {
        this.startTextEditing(el);
      }
    }
    this.closeContextMenu();
  }

  public onContextMenuBringToFront(): void {
    const el = this.contextMenu().element;
    if (el) {
      this.canvasState.bringToFront(el.id);
      this.syncService.triggerAutosave();
      this.requestRender();
    }
    this.closeContextMenu();
  }

  public onContextMenuSendToBack(): void {
    const el = this.contextMenu().element;
    if (el) {
      this.canvasState.sendToBack(el.id);
      this.syncService.triggerAutosave();
      this.requestRender();
    }
    this.closeContextMenu();
  }

  public onContextMenuDelete(): void {
    const el = this.contextMenu().element;
    if (el) {
      this.canvasState.deleteElementViaManager(el.id);
      this.syncService.triggerAutosave();
      this.requestRender();
    }
    this.closeContextMenu();
  }

  /**
   * Maps resize handles to cursor styles
   */
  public getCursorForHandle(handle: string | null): string {
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'w':
      case 'e':
        return 'ew-resize';
      case 'start':
      case 'end':
        return 'crosshair';
      default:
        return 'default';
    }
  }

  /**
   * Updates overlay canvas cursor when hovering over shapes or polygon resize handles
   */
  public updateHoverCursor(worldPt: Point): void {
    const canvas = this.overlayCanvasRef?.nativeElement;
    if (!canvas) return;

    if (this.isSpacePressed || this.canvasState.activeTool() === 'hand') {
      canvas.style.cursor = 'grab';
      return;
    }

    const tool = this.canvasState.activeTool();
    if (tool !== 'select') {
      canvas.style.cursor = 'crosshair';
      return;
    }

    // 1. Check if hovering directly over a resize handle of the selected polygon/element
    const single = this.canvasState.singleSelectedElement();
    if (single) {
      const handle = this.getHandleAtPoint(worldPt, single);
      if (handle) {
        canvas.style.cursor = this.getCursorForHandle(handle);
        return;
      }
    }

    // 2. Check if hovering over any selectable shape on canvas
    const elements = [...this.canvasState.elements()].reverse();
    const hit = elements.find(el => el.hitTest(worldPt));
    if (hit) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  public onMouseDown(e: MouseEvent): void {
    this.closeContextMenu();
    const worldPt = this.canvasState.screenToWorld(e.clientX, e.clientY);
    this.dragStart = { ...worldPt };

    if (this.isSpacePressed || this.canvasState.activeTool() === 'hand' || e.button === 1) {
      this.mode = 'panning';
      this.panStart = { x: e.clientX - this.canvasState.pan().x, y: e.clientY - this.canvasState.pan().y };
      this.overlayCanvasRef.nativeElement.style.cursor = 'grabbing';
      return;
    }

    const tool = this.canvasState.activeTool();

    if (tool === 'select') {
      const single = this.canvasState.singleSelectedElement();
      if (single) {
        const handle = this.getHandleAtPoint(worldPt, single);
        if (handle) {
          this.mode = 'resizing';
          this.activeHandle = handle;
          this.activeElement = single;
          this.overlayCanvasRef.nativeElement.style.cursor = this.getCursorForHandle(handle);
          return;
        }
      }

      const elements = [...this.canvasState.elements()].reverse();
      const hit = elements.find(el => el.hitTest(worldPt));

      if (hit) {
        this.mode = 'moving';
        this.activeElement = hit;
        this.overlayCanvasRef.nativeElement.style.cursor = 'move';
        this.canvasState.selectElement(hit.id, e.shiftKey);
      } else {
        this.canvasState.clearSelection();
        this.overlayCanvasRef.nativeElement.style.cursor = 'default';
      }
    } else if (tool === 'text') {
      const textElem = ElementFactory.createNew('text', worldPt.x, worldPt.y, this.canvasState.boardId(), {
        strokeColor: this.canvasState.currentStrokeColor(),
        fontSize: this.canvasState.currentFontSize(),
        fontFamily: this.canvasState.currentFontFamily()
      }) as TextElement;

      this.canvasState.addElement(textElem);
      this.canvasState.selectElement(textElem.id);
      this.startTextEditing(textElem);
      this.syncService.triggerAutosave();
      this.canvasState.activeTool.set('select');
    } else {
      this.mode = 'drawing';
      this.draftElement = ElementFactory.createNew(tool, worldPt.x, worldPt.y, this.canvasState.boardId(), {
        strokeColor: this.canvasState.currentStrokeColor(),
        fillColor: this.canvasState.currentFillColor(),
        strokeWidth: this.canvasState.currentStrokeWidth(),
        strokeStyle: this.canvasState.currentStrokeStyle(),
        cornerRadius: this.canvasState.currentCornerRadius(),
        renderMode: this.canvasState.currentRenderMode()
      });
    }
  }

  public onMouseMove(e: MouseEvent): void {
    const worldPt = this.canvasState.screenToWorld(e.clientX, e.clientY);

    if (this.mode === 'none') {
      this.updateHoverCursor(worldPt);
      return;
    }

    if (this.mode === 'panning') {
      this.canvasState.pan.set({
        x: e.clientX - this.panStart.x,
        y: e.clientY - this.panStart.y
      });
      return;
    }

    if (this.mode === 'drawing' && this.draftElement) {
      if (this.draftElement instanceof ArrowElement) {
        this.draftElement.setEndpoints(this.dragStart, worldPt);
      } else {
        const dx = worldPt.x - this.dragStart.x;
        const dy = worldPt.y - this.dragStart.y;
        this.draftElement.width = dx;
        this.draftElement.height = dy;
      }
      this.requestRender();
    } else if (this.mode === 'moving' && this.activeElement) {
      const dx = worldPt.x - this.dragStart.x;
      const dy = worldPt.y - this.dragStart.y;

      this.activeElement.translate(dx, dy, true);
      this.dragStart = { ...worldPt };

      this.overlayCanvasRef.nativeElement.style.cursor = 'move';
      this.requestRender();
    } else if (this.mode === 'resizing' && this.activeElement && this.activeHandle) {
      // Dynamic cursor lock during polygon/shape resizing
      this.overlayCanvasRef.nativeElement.style.cursor = this.getCursorForHandle(this.activeHandle);
      this.applyResize(this.activeElement, this.activeHandle, worldPt);
      this.requestRender();
    }
  }

  public onMouseUp(_e: MouseEvent): void {
    if (this.mode === 'drawing' && this.draftElement) {
      let w = Math.abs(this.draftElement.width);
      let h = Math.abs(this.draftElement.height);

      if (this.draftElement instanceof ArrowElement) {
        const dist = Math.hypot(
          this.draftElement.endPoint.x - this.draftElement.startPoint.x,
          this.draftElement.endPoint.y - this.draftElement.startPoint.y
        );

        if (dist <= 8) {
          // Single-click on arrow: create a clean 140px horizontal arrow
          this.draftElement.setEndpoints(
            this.dragStart,
            { x: this.dragStart.x + 140, y: this.dragStart.y + 40 }
          );
        }
        this.canvasState.addElement(this.draftElement);
        this.canvasState.selectElement(this.draftElement.id);
        this.syncService.triggerAutosave();
      } else {
        if (w <= 8 && h <= 8) {
          // Single-click on shape tool: create clean default size instead of discarding
          const defaultW = this.draftElement.type === 'polygon' ? 130 : 160;
          const defaultH = this.draftElement.type === 'polygon' ? 130 : 110;
          this.draftElement.x = this.dragStart.x - defaultW / 2;
          this.draftElement.y = this.dragStart.y - defaultH / 2;
          this.draftElement.width = defaultW;
          this.draftElement.height = defaultH;
        } else {
          if (this.draftElement.width < 0) {
            this.draftElement.x += this.draftElement.width;
            this.draftElement.width = w;
          }
          if (this.draftElement.height < 0) {
            this.draftElement.y += this.draftElement.height;
            this.draftElement.height = h;
          }
        }

        this.canvasState.addElement(this.draftElement);
        this.canvasState.selectElement(this.draftElement.id);
        this.syncService.triggerAutosave();
      }

      this.draftElement = null;
      this.canvasState.activeTool.set('select');
    } else if (this.mode === 'moving' || this.mode === 'resizing') {
      this.canvasState.recalculateHierarchy();
      this.syncService.triggerAutosave();
    }

    this.mode = 'none';
    this.activeElement = null;
    this.activeHandle = null;
    this.updateHoverCursor(this.canvasState.screenToWorld(_e.clientX, _e.clientY));
    this.requestRender();
  }

  public onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    const currentZoom = this.canvasState.zoom();
    const newZoom = Math.max(0.2, Math.min(3.0, currentZoom * zoomFactor));

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const pan = this.canvasState.pan();

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / currentZoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / currentZoom);

    this.canvasState.zoom.set(newZoom);
    this.canvasState.pan.set({ x: newPanX, y: newPanY });
  }

  public onDoubleClick(e: MouseEvent): void {
    const worldPt = this.canvasState.screenToWorld(e.clientX, e.clientY);
    const elements = [...this.canvasState.elements()].reverse();
    const hit = elements.find(el => el.hitTest(worldPt));

    if (hit && hit instanceof TextElement) {
      this.startTextEditing(hit);
    }
  }

  public startTextEditing(textElem: TextElement): void {
    textElem.isEditing = true;
    this.editingScreenPos.set(this.canvasState.worldToScreen(textElem.x, textElem.y));
    this.editingTextElement.set(textElem);
    this.requestRender();
    setTimeout(() => {
      if (this.inlineEditorRef?.nativeElement) {
        const el = this.inlineEditorRef.nativeElement;
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    }, 30);
  }

  public finishTextEditing(): void {
    const el = this.editingTextElement();
    if (el) {
      el.isEditing = false;
      el.recalculateDimensions(this.mainCtx);
      this.editingTextElement.set(null);
      this.canvasState.recalculateHierarchy();
      this.syncService.triggerAutosave();
      this.requestRender();
    }
  }

  public onTextInput(): void {
    const el = this.editingTextElement();
    if (el && this.mainCtx) {
      el.recalculateDimensions(this.mainCtx);
    }
  }

  public onTextKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.finishTextEditing();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.finishTextEditing();
    } else {
      e.stopPropagation();
    }
  }

  public getTextEditorWidth(): number {
    const el = this.editingTextElement();
    if (!el) return 140;
    const zoom = this.canvasState.zoom();
    return Math.max(140, (el.width + 60) * zoom);
  }

  public getTextEditorHeight(): number {
    const el = this.editingTextElement();
    if (!el) return 40;
    const zoom = this.canvasState.zoom();
    const lineCount = (el.text.split('\n').length || 1) + 1;
    const lineH = el.fontSize * el.lineHeight * zoom;
    return Math.max(40, lineCount * lineH);
  }

  private applyResize(el: CommonObjectClass, handle: string, pt: Point): void {
    // Arrow-specific endpoint handling
    if (el instanceof ArrowElement) {
      if (handle === 'start') {
        el.setStart(pt);
      } else if (handle === 'end') {
        el.setEnd(pt);
      }
      return;
    }

    if (handle.includes('e')) el.width = Math.max(20, pt.x - el.x);
    if (handle.includes('s')) el.height = Math.max(20, pt.y - el.y);
    if (handle.includes('w')) {
      const origRight = el.x + el.width;
      el.x = Math.min(pt.x, origRight - 20);
      el.width = origRight - el.x;
    }
    if (handle.includes('n')) {
      const origBottom = el.y + el.height;
      el.y = Math.min(pt.y, origBottom - 20);
      el.height = origBottom - el.y;
    }
  }

  private getHandleAtPoint(pt: Point, el: CommonObjectClass): string | null {
    const threshold = 12 / this.canvasState.zoom();

    // Dedicated endpoint handles for arrows
    if (el instanceof ArrowElement) {
      if (Math.hypot(pt.x - el.startPoint.x, pt.y - el.startPoint.y) <= threshold) return 'start';
      if (Math.hypot(pt.x - el.endPoint.x, pt.y - el.endPoint.y) <= threshold) return 'end';
      return null;
    }

    const box = el.getBoundingBox();
    const handles: Record<string, Point> = {
      nw: { x: box.minX, y: box.minY },
      ne: { x: box.maxX, y: box.minY },
      se: { x: box.maxX, y: box.maxY },
      sw: { x: box.minX, y: box.maxY },
      n: { x: box.minX + box.width / 2, y: box.minY },
      s: { x: box.minX + box.width / 2, y: box.maxY },
      w: { x: box.minX, y: box.minY + box.height / 2 },
      e: { x: box.maxX, y: box.minY + box.height / 2 }
    };

    for (const [key, p] of Object.entries(handles)) {
      if (Math.abs(pt.x - p.x) <= threshold && Math.abs(pt.y - p.y) <= threshold) {
        return key;
      }
    }
    return null;
  }

  public requestRender(): void {
    if (this.animFrameId !== null) return;
    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      this.render();
    });
  }

  private render(): void {
    if (!this.mainCtx || !this.overlayCtx) return;

    const mainCanvas = this.mainCanvasRef.nativeElement;
    const overlayCanvas = this.overlayCanvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const zoom = this.canvasState.zoom();
    const pan = this.canvasState.pan();

    this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const scale = dpr * zoom;
    const offsetX = pan.x * dpr;
    const offsetY = pan.y * dpr;

    this.mainCtx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    this.overlayCtx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Fast lookup map for clipping parent traversal
    const idMap = new Map<string, CommonObjectClass>();
    for (const el of this.canvasState.elements()) {
      idMap.set(el.id, el);
    }

    // Render elements in topological / z-index order (what comes back is rendered first, what comes front on top)
    for (const el of this.canvasState.elements()) {
      // Check if any ancestor container has clipContent enabled
      const clippingAncestors: CommonObjectClass[] = [];
      let currentParentId = el.parentClass;
      const visitedParents = new Set<string>();

      while (currentParentId && currentParentId !== el.id && !visitedParents.has(currentParentId)) {
        visitedParents.add(currentParentId);
        const parent = idMap.get(currentParentId);
        if (!parent) break;
        if (parent.clipContent) {
          clippingAncestors.push(parent);
        }
        currentParentId = parent.parentClass;
      }

      if (clippingAncestors.length > 0) {
        this.mainCtx.save();
        for (const ancestor of clippingAncestors) {
          ancestor.createPath(this.mainCtx);
          this.mainCtx.clip();
        }
        el.render(this.mainCtx, this.roughCanvas);
        this.mainCtx.restore();
      } else {
        el.render(this.mainCtx, this.roughCanvas);
      }
    }

    if (this.draftElement) {
      this.draftElement.render(this.overlayCtx, this.roughCanvas);
    }

    const selected = this.canvasState.selectedElements();
    const editing = this.editingTextElement();
    for (const el of selected) {
      if (editing && el.id === editing.id) {
        continue;
      }
      this.drawSelectionBox(this.overlayCtx, el);
    }

    for (const el of this.canvasState.elements()) {
      if (el.isManager) {
        this.drawManagerBadge(this.overlayCtx, el);
      }
    }
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D, el: CommonObjectClass): void {
    const zoom = this.canvasState.zoom();
    const handleSize = 8 / zoom;

    // Arrow specific handles: circular endpoints (start and end)
    if (el instanceof ArrowElement) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 / zoom;

      for (const p of [el.startPoint, el.endPoint]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, handleSize / 1.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const box = el.getBoundingBox();

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(box.minX - 4, box.minY - 4, box.width + 8, box.height + 8);

    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';

    const points = [
      { x: box.minX - 4, y: box.minY - 4 },
      { x: box.maxX + 4, y: box.minY - 4 },
      { x: box.maxX + 4, y: box.maxY + 4 },
      { x: box.minX - 4, y: box.maxY + 4 },
      { x: box.minX + box.width / 2, y: box.minY - 4 },
      { x: box.minX + box.width / 2, y: box.maxY + 4 },
      { x: box.minX - 4, y: box.minY + box.height / 2 },
      { x: box.maxX + 4, y: box.minY + box.height / 2 }
    ];

    for (const p of points) {
      ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    }

    ctx.restore();
  }

  private drawManagerBadge(ctx: CanvasRenderingContext2D, el: CommonObjectClass): void {
    const box = el.getBoundingBox();
    const zoom = this.canvasState.zoom();

    ctx.save();
    const badgeW = 160 / zoom;
    const badgeH = 18 / zoom;
    const badgeX = box.minX;
    const badgeY = box.minY - badgeH - (4 / zoom);

    ctx.fillStyle = '#7c3aed';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4 / zoom);
      ctx.fill();
    } else {
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    }

    ctx.font = `600 ${10 / zoom}px -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    const isSame = el.parentClass === el.id || el.parentClass === el.managerClassHash;
    const sameText = isSame ? ' [P=M]' : '';
    const label = `★ MANAGER${sameText} (${el.managerClassHash?.slice(0, 8)})`;
    ctx.fillText(label, badgeX + (6 / zoom), badgeY + (12 / zoom));
    ctx.restore();
  }

  private resizeCanvas(): void {
    const wrapper = this.wrapperRef.nativeElement;
    const mainCanvas = this.mainCanvasRef.nativeElement;
    const overlayCanvas = this.overlayCanvasRef.nativeElement;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    mainCanvas.width = width * dpr;
    mainCanvas.height = height * dpr;
    mainCanvas.style.width = `${width}px`;
    mainCanvas.style.height = `${height}px`;

    overlayCanvas.width = width * dpr;
    overlayCanvas.height = height * dpr;
    overlayCanvas.style.width = `${width}px`;
    overlayCanvas.style.height = `${height}px`;
  }
}
