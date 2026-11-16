import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasStateService, ToolType } from '../../core/services/canvas-state.service';
import { ApiSyncService } from '../../core/services/api-sync.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toolbar-container">
      <!-- Standard Navigation Tools -->
      <div class="tool-group">
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'select'"
          (click)="selectTool('select')"
          title="Select (V)"
        >
          <span class="icon">↖</span>
        </button>
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'hand'"
          (click)="selectTool('hand')"
          title="Hand / Pan (H)"
        >
          <span class="icon">✋</span>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Quick Shape Tools -->
      <div class="tool-group">
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'rectangle'"
          (click)="selectTool('rectangle')"
          title="Rectangle (R)"
        >
          <span class="icon">▭</span>
        </button>
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'polygon'"
          (click)="selectTool('polygon')"
          title="Diamond / Polygon (D)"
        >
          <span class="icon">◇</span>
        </button>
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'ellipse'"
          (click)="selectTool('ellipse')"
          title="Ellipse (O)"
        >
          <span class="icon">○</span>
        </button>
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'arrow'"
          (click)="selectTool('arrow')"
          title="Arrow (A)"
        >
          <span class="icon">➔</span>
        </button>
        <button
          class="tool-btn"
          [class.active]="canvasState.activeTool() === 'text'"
          (click)="selectTool('text')"
          title="Text (T)"
        >
          <span class="icon">T</span>
        </button>
      </div>

      <!-- Dropdown Option to Create Polygon/Text using the Same Edit Properties -->
      <div class="dropdown-wrapper">
        <button
          class="dropdown-trigger-btn"
          [class.open]="isDropdownOpen()"
          (click)="toggleDropdown()"
          title="Create polygon or text using edited properties"
        >
          <!-- Active Color Indicator -->
          <span
            class="active-color-dot"
            [style.background]="canvasState.currentStrokeColor()"
            [style.border-color]="canvasState.currentStrokeColor()"
          ></span>
          <span class="dropdown-text">Create with Style</span>
          <span class="dropdown-caret">▾</span>
        </button>

        @if (isDropdownOpen()) {
          <div class="dropdown-menu" (click)="$event.stopPropagation()">
            <!-- Current Active Style Header -->
            <div class="dropdown-header">
              <span class="header-label">ACTIVE EDIT PROPERTIES</span>
              <div class="style-preview-chips">
                <span
                  class="preview-chip"
                  [style.border-color]="canvasState.currentStrokeColor()"
                  [style.background]="canvasState.currentFillColor()"
                >
                  <span
                    class="chip-dot"
                    [style.background]="canvasState.currentStrokeColor()"
                  ></span>
                  {{ canvasState.currentStrokeWidth() }}px
                </span>
                <span class="preview-chip font-chip">
                  {{ getShortFontName() }}
                </span>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <!-- Creation Items -->
            <div class="dropdown-items">
              @for (item of createOptions; track item.type) {
                <div class="dropdown-item-row">
                  <button
                    class="item-select-btn"
                    (click)="chooseToolAndClose(item.type)"
                  >
                    <span class="item-icon">{{ item.icon }}</span>
                    <span class="item-name">{{ item.name }}</span>
                  </button>
                  <button
                    class="item-add-btn"
                    (click)="quickInsert(item.type)"
                    title="Insert directly on canvas"
                  >
                    + Add
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <div class="divider"></div>

      <!-- Actions -->
      <div class="action-group">
        <button class="tool-btn action" (click)="resetSelected()" title="Reset Instance State">
          <span class="label">Reset</span>
        </button>
        <button class="tool-btn action danger" (click)="deleteSelected()" title="Delete Selected">
          <span class="label">Delete</span>
        </button>
        <button
          class="tool-btn action primary save-btn"
          [class.saving]="syncService.saveStatus() === 'saving'"
          [class.saved]="syncService.saveStatus() === 'saved'"
          (click)="syncService.saveBoard()"
          [title]="'Last saved: ' + (syncService.lastSaved() | date:'mediumTime')"
        >
          <span class="save-status-dot"></span>
          <span class="label">
            @if (syncService.saveStatus() === 'saving') {
              Saving...
            } @else if (syncService.saveStatus() === 'saved') {
              Saved ✓
            } @else if (syncService.saveStatus() === 'error') {
              Retry Save
            } @else {
              Save
            }
          </span>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Zoom -->
      <div class="zoom-group">
        <button class="tool-btn mini" (click)="adjustZoom(-0.1)" title="Zoom Out">-</button>
        <span class="zoom-text">{{ Math.round(canvasState.zoom() * 100) }}%</span>
        <button class="tool-btn mini" (click)="adjustZoom(0.1)" title="Zoom In">+</button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar-container {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      z-index: 100;
      user-select: none;
    }

    .tool-group, .action-group, .zoom-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .divider {
      width: 1px;
      height: 24px;
      background: #e2e8f0;
      margin: 0 4px;
    }

    .tool-btn {
      background: transparent;
      border: none;
      outline: none;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, color 0.15s ease;
      color: #334155;

      &:hover {
        background: #f1f5f9;
      }

      &.active {
        background: #e0e7ff;
        color: #4f46e5;
        font-weight: 600;
      }

      &.action {
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 500;
      }

      &.danger {
        color: #ef4444;
        &:hover {
          background: #fee2e2;
        }
      }

      &.primary {
        background: #4f46e5;
        color: #ffffff;
        &:hover {
          background: #4338ca;
        }
      }

      &.primary.save-btn {
        background: #4f46e5;
        color: #ffffff;
        gap: 6px;
        transition: all 0.2s ease;

        &.saved {
          background: #059669;
          &:hover {
            background: #047857;
          }
        }

        &.saving {
          background: #d97706;
          &:hover {
            background: #b45309;
          }
        }

        .save-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ffffff;
          display: inline-block;
          opacity: 0.9;
        }
      }

      &.mini {
        padding: 4px 8px;
        font-size: 14px;
      }
    }

    .icon {
      font-size: 16px;
    }

    .zoom-text {
      font-size: 12px;
      color: #64748b;
      min-width: 42px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    /* Dropdown Styling */
    .dropdown-wrapper {
      position: relative;
    }

    .dropdown-trigger-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover, &.open {
        background: #f1f5f9;
        border-color: #4f46e5;
      }
    }

    .active-color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .dropdown-caret {
      font-size: 10px;
      color: #64748b;
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: 220px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 8px;
      z-index: 120;
      animation: fadeIn 0.12s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-header {
      padding: 4px 6px;
    }

    .header-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.04em;
      display: block;
      margin-bottom: 4px;
    }

    .style-preview-chips {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .preview-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;

      .chip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      &.font-chip {
        background: #f1f5f9;
        border-color: #e2e8f0;
      }
    }

    .dropdown-divider {
      height: 1px;
      background: #f1f5f9;
      margin: 6px 0;
    }

    .dropdown-items {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dropdown-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 6px;
      padding: 2px;

      &:hover {
        background: #f8fafc;
      }
    }

    .item-select-btn {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: none;
      padding: 6px 8px;
      font-size: 12px;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      text-align: left;
      border-radius: 4px;

      &:hover {
        color: #4f46e5;
      }
    }

    .item-icon {
      font-size: 14px;
      width: 16px;
      text-align: center;
    }

    .item-add-btn {
      background: #e0e7ff;
      border: none;
      color: #4338ca;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background: #c7d2fe;
      }
    }
  `]
})
export class ToolbarComponent {
  public canvasState = inject(CanvasStateService);
  public syncService = inject(ApiSyncService);
  public Math = Math;

  public isDropdownOpen = signal<boolean>(false);

  public createOptions: { type: ToolType; name: string; icon: string }[] = [
    { type: 'rectangle', name: 'Rectangle', icon: '▭' },
    { type: 'polygon', name: 'Diamond Polygon', icon: '◇' },
    { type: 'ellipse', name: 'Ellipse', icon: '○' },
    { type: 'arrow', name: 'Arrow', icon: '➔' },
    { type: 'text', name: 'Crayon Text', icon: '🅃' }
  ];

  public toggleDropdown(): void {
    this.isDropdownOpen.update(v => !v);
  }

  public selectTool(tool: ToolType): void {
    this.canvasState.activeTool.set(tool);
    if (tool !== 'select') {
      this.canvasState.clearSelection();
    }
    this.isDropdownOpen.set(false);
  }

  public chooseToolAndClose(tool: ToolType): void {
    this.selectTool(tool);
  }

  public quickInsert(type: ToolType): void {
    this.canvasState.createWithActiveProperties(type);
    this.isDropdownOpen.set(false);
    this.canvasState.activeTool.set('select');
    this.syncService.triggerAutosave();
  }

  public resetSelected(): void {
    this.canvasState.resetSelected();
    this.syncService.triggerAutosave();
  }

  public deleteSelected(): void {
    this.canvasState.deleteSelected();
    this.syncService.triggerAutosave();
  }

  public adjustZoom(delta: number): void {
    const current = this.canvasState.zoom();
    const next = Math.max(0.2, Math.min(3.0, current + delta));
    this.canvasState.zoom.set(Math.round(next * 10) / 10);
  }

  public getShortFontName(): string {
    const f = this.canvasState.currentFontFamily();
    if (f.includes('Patrick Hand')) return 'Patrick Hand';
    if (f.includes('Caveat')) return 'Caveat';
    if (f.includes('Kalam')) return 'Kalam';
    if (f.includes('Shantell')) return 'Shantell';
    return 'Crayon';
  }
}
