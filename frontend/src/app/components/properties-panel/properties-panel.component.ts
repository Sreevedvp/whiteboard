import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasStateService } from '../../core/services/canvas-state.service';
import { ApiSyncService } from '../../core/services/api-sync.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (element()) {
      <div class="panel-card">
        <div class="panel-header">
          <span class="element-title">{{ element()?.type | uppercase }} INSTANCE</span>
          @if (element()?.isManager) {
            <span class="badge manager">MANAGER CLASS</span>
          } @else if (element()?.parentClass) {
            <span class="badge child">CHILD INSTANCE</span>
          } @else {
            <span class="badge root">ROOT INSTANCE</span>
          }
        </div>

        <!-- Hierarchy & Manager Details -->
        <div class="hierarchy-info">
          <div class="info-row">
            <span class="info-label">Parent ID:</span>
            <span class="info-val">{{ element()?.parentClass || 'null (No Parent)' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Manager Hash:</span>
            <span class="info-val hash">{{ element()?.managerClassHash || 'null' }}</span>
          </div>

          <!-- Highlight when Manager and Parent are Same -->
          @if (isSameParentAndManager()) {
            <div class="same-badge">
              <span class="same-icon">★</span>
              <span>Manager & Parent are Same</span>
            </div>
          }

          <div class="info-row">
            <span class="info-label">Subtree Children:</span>
            <span class="info-val">{{ element()?.children?.length || 0 }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Layer Z-Index:</span>
            <span class="info-val">{{ element()?.zIndex ?? 0 }}</span>
          </div>
        </div>

        <!-- Manager = Parent Setting -->
        @if (element()?.isManager) {
          <div class="prop-section toggle-section">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [checked]="element()?.parentClass === element()?.id"
                (change)="toggleManagerAsParent($event)"
              />
              <span>Set Manager as Parent (Self-Parent)</span>
            </label>
          </div>
        }

        <!-- Clipping: Clip children to container boundaries -->
        @if (element()?.type === 'rectangle' || element()?.type === 'polygon' || element()?.type === 'ellipse') {
          <div class="prop-section toggle-section">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [checked]="element()?.clipContent"
                (change)="toggleClipContent($event)"
              />
              <span>Clip Content (Inside Boundary)</span>
            </label>
          </div>
        }

        <!-- Layer / Z-Order: What comes front and what comes back -->
        <div class="prop-section">
          <label class="section-label">Layer Order (Front / Back)</label>
          <div class="layer-buttons-grid">
            <button class="toggle-btn" (click)="bringToFront()" title="Bring to Front (])">
              Front 🔝
            </button>
            <button class="toggle-btn" (click)="bringForward()" title="Bring Forward">
              Forward ⤊
            </button>
            <button class="toggle-btn" (click)="sendBackward()" title="Send Backward">
              Backward ⤋
            </button>
            <button class="toggle-btn" (click)="sendToBack()" title="Send to Back ([)">
              Back 🔚
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Render Mode (Polished vs Sketch) -->
        <div class="prop-section">
          <label class="section-label">Render Style</label>
          <div class="btn-toggle-group">
            <button
              class="toggle-btn"
              [class.active]="element()?.renderMode === 'polished'"
              (click)="updateStyle({ renderMode: 'polished' })"
            >
              Polished
            </button>
            <button
              class="toggle-btn"
              [class.active]="element()?.renderMode === 'sketch'"
              (click)="updateStyle({ renderMode: 'sketch' })"
            >
              Sketch
            </button>
          </div>
        </div>

        <!-- Font Family (Crayon / Hand-drawn Style Fonts) -->
        @if (element()?.type === 'text') {
          <div class="prop-section">
            <label class="section-label">Crayon Font Style</label>
            <div class="btn-toggle-group font-group">
              @for (f of fontOptions; track f.name) {
                <button
                  class="toggle-btn"
                  [class.active]="element()?.fontFamily === f.val"
                  (click)="updateStyle({ fontFamily: f.val })"
                  [style.font-family]="f.val"
                  [title]="f.name"
                >
                  {{ f.name }}
                </button>
              }
            </div>
          </div>
        }

        <!-- Corner Radius for Rectangles -->
        @if (element()?.type === 'rectangle') {
          <div class="prop-section">
            <label class="section-label">Corner Radius</label>
            <div class="btn-toggle-group">
              @for (r of [0, 8, 16, 24]; track r) {
                <button
                  class="toggle-btn"
                  [class.active]="element()?.cornerRadius === r"
                  (click)="updateStyle({ cornerRadius: r })"
                >
                  {{ r }}px
                </button>
              }
            </div>
          </div>
        }

        <!-- Stroke Color -->
        <div class="prop-section">
          <label class="section-label">Stroke Color</label>
          <div class="palette">
            @for (c of strokeColors; track c) {
              <button
                class="color-dot"
                [style.background]="c"
                [class.selected]="element()?.strokeColor === c"
                (click)="updateStyle({ strokeColor: c })"
              ></button>
            }
          </div>
        </div>

        <!-- Fill Color -->
        <div class="prop-section">
          <label class="section-label">Fill Color</label>
          <div class="palette">
            @for (c of fillColors; track c.val) {
              <button
                class="color-dot"
                [style.background]="c.val"
                [class.transparent]="c.val === 'transparent'"
                [class.selected]="element()?.fillColor === c.val"
                (click)="updateStyle({ fillColor: c.val })"
                [title]="c.name"
              ></button>
            }
          </div>
        </div>

        <!-- Stroke Width -->
        <div class="prop-section">
          <label class="section-label">Stroke Width</label>
          <div class="btn-toggle-group">
            @for (w of [1, 2, 4]; track w) {
              <button
                class="toggle-btn"
                [class.active]="element()?.strokeWidth === w"
                (click)="updateStyle({ strokeWidth: w })"
              >
                {{ w }}px
              </button>
            }
          </div>
        </div>

        <!-- Stroke Style -->
        <div class="prop-section">
          <label class="section-label">Stroke Style</label>
          <div class="btn-toggle-group">
            <button
              class="toggle-btn"
              [class.active]="element()?.strokeStyle === 'solid'"
              (click)="updateStyle({ strokeStyle: 'solid' })"
            >Solid</button>
            <button
              class="toggle-btn"
              [class.active]="element()?.strokeStyle === 'dashed'"
              (click)="updateStyle({ strokeStyle: 'dashed' })"
            >Dashed</button>
            <button
              class="toggle-btn"
              [class.active]="element()?.strokeStyle === 'dotted'"
              (click)="updateStyle({ strokeStyle: 'dotted' })"
            >Dotted</button>
          </div>
        </div>

        <!-- Font Size (if text) -->
        @if (element()?.type === 'text') {
          <div class="prop-section">
            <label class="section-label">Font Size</label>
            <div class="btn-toggle-group">
              @for (fs of [16, 22, 28, 36]; track fs) {
                <button
                  class="toggle-btn"
                  [class.active]="element()?.fontSize === fs"
                  (click)="updateStyle({ fontSize: fs })"
                >
                  {{ fs }}px
                </button>
              }
            </div>
          </div>
        }

        <div class="divider"></div>

        <!-- Instance Actions -->
        <div class="actions-row">
          <button class="action-btn secondary" (click)="resetInstance()">
            Reset Instance
          </button>
          <button class="action-btn danger" (click)="removeInstance()">
            Remove Instance
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .panel-card {
      position: absolute;
      top: 80px;
      left: 20px;
      width: 260px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
      padding: 16px;
      z-index: 90;
      user-select: none;
      font-family: inherit;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .element-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }

    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;

      &.manager {
        background: #fdf4ff;
        color: #7c3aed;
        border: 1px solid #e9d5ff;
      }
      &.child {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
      &.root {
        background: #f1f5f9;
        color: #475569;
      }
    }

    .hierarchy-info {
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }

    .info-label {
      color: #64748b;
    }

    .info-val {
      font-weight: 600;
      color: #1e293b;

      &.hash {
        font-family: monospace;
        color: #7c3aed;
      }
    }

    .same-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #fdf2f8;
      color: #db2777;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1px solid #fbcfe8;
    }

    .same-icon {
      font-size: 11px;
    }

    .toggle-section {
      margin-bottom: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #475569;
      cursor: pointer;
    }

    .layer-buttons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }

    .divider {
      height: 1px;
      background: #f1f5f9;
      margin: 12px 0;
    }

    .prop-section {
      margin-bottom: 12px;
    }

    .section-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }

    .palette {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .color-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      outline: none;
      transition: transform 0.1s ease;

      &:hover {
        transform: scale(1.15);
      }

      &.selected {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
      }

      &.transparent {
        background: linear-gradient(45deg, #ddd 25%, transparent 25%),
                    linear-gradient(-45deg, #ddd 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #ddd 75%),
                    linear-gradient(-45deg, transparent 75%, #ddd 75%);
        background-size: 8px 8px;
        background-color: white;
      }
    }

    .btn-toggle-group {
      display: flex;
      background: #f1f5f9;
      border-radius: 6px;
      padding: 2px;
      gap: 2px;

      &.font-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
    }

    .toggle-btn {
      flex: 1;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 5px;
      font-size: 11px;
      font-weight: 500;
      border-radius: 4px;
      color: #475569;
      cursor: pointer;
      text-align: center;
      transition: all 0.1s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      &.active {
        background: #ffffff;
        color: #0f172a;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
    }

    .actions-row {
      display: flex;
      gap: 6px;
    }

    .action-btn {
      flex: 1;
      padding: 6px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      background: #ffffff;

      &.secondary {
        color: #334155;
        &:hover {
          background: #f8fafc;
        }
      }

      &.danger {
        color: #ef4444;
        border-color: #fecaca;
        &:hover {
          background: #fee2e2;
        }
      }
    }
  `]
})
export class PropertiesPanelComponent {
  public canvasState = inject(CanvasStateService);
  public syncService = inject(ApiSyncService);
  public element = this.canvasState.singleSelectedElement;

  public fontOptions = [
    { name: 'Crayon Hand', val: "'Patrick Hand', 'Caveat', cursive, sans-serif" },
    { name: 'Caveat', val: "'Caveat', cursive, sans-serif" },
    { name: 'Kalam', val: "'Kalam', cursive, sans-serif" },
    { name: 'Shantell', val: "'Shantell Sans', cursive, sans-serif" }
  ];

  public strokeColors = ['#2563eb', '#1e293b', '#dc2626', '#16a34a', '#d97706', '#9333ea'];
  public fillColors = [
    { name: 'Light Blue', val: '#eff6ff' },
    { name: 'Light Yellow', val: '#fef3c7' },
    { name: 'Light Green', val: '#f0fdf4' },
    { name: 'Light Red', val: '#fef2f2' },
    { name: 'Light Purple', val: '#faf5ff' },
    { name: 'Transparent', val: 'transparent' }
  ];

  public isSameParentAndManager(): boolean {
    const el = this.element();
    if (!el) return false;
    return el.isParentAndManagerSame() || (el.isManager && el.parentClass === el.id);
  }

  public toggleManagerAsParent(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const el = this.element();
    if (!el) return;

    if (checked) {
      el.parentClass = el.id;
    } else {
      el.parentClass = null;
    }
    this.canvasState.elements.update(prev => [...prev]);
    this.syncService.triggerAutosave();
  }

  public toggleClipContent(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const el = this.element();
    if (!el) return;

    el.clipContent = checked;
    this.canvasState.elements.update(prev => [...prev]);
    this.syncService.triggerAutosave();
  }

  public bringToFront(): void {
    this.canvasState.bringToFront();
    this.syncService.triggerAutosave();
  }

  public sendToBack(): void {
    this.canvasState.sendToBack();
    this.syncService.triggerAutosave();
  }

  public bringForward(): void {
    this.canvasState.bringForward();
    this.syncService.triggerAutosave();
  }

  public sendBackward(): void {
    this.canvasState.sendBackward();
    this.syncService.triggerAutosave();
  }

  public updateStyle(patch: any): void {
    this.canvasState.updateSelectedProperties(patch);
    this.syncService.triggerAutosave();
  }

  public resetInstance(): void {
    this.canvasState.resetSelected();
    this.syncService.triggerAutosave();
  }

  public removeInstance(): void {
    this.canvasState.deleteSelected();
    this.syncService.triggerAutosave();
  }
}
