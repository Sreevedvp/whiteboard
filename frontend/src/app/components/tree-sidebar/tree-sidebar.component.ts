import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasStateService } from '../../core/services/canvas-state.service';
import { HierarchyTreeNode } from '../../core/models/manager-class';
import { CommonObjectClass } from '../../core/models/common-object';
import { TextElement } from '../../core/models/text';

@Component({
  selector: 'app-tree-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class=\"tree-sidebar-wrapper\" [class.collapsed]=\"isCollapsed()\">
      <!-- Toggle Expand/Collapse Tab -->
      <button
        class=\"collapse-toggle\"
        (click)=\"toggleCollapse()\"
        [title]=\"isCollapsed() ? 'Expand Hierarchy Tree' : 'Collapse Tree'\"
      >
        <span class=\"toggle-icon\">{{ isCollapsed() ? '◀' : '▶' }}</span>
        <span class=\"toggle-label\">Hierarchy Tree</span>
        @if (isCollapsed()) {
          <span class=\"badge-mini\">{{ canvasState.instanceCount() }}</span>
        }
      </button>

      @if (!isCollapsed()) {
        <div class=\"tree-container\">
          <!-- Header -->
          <div class=\"tree-header\">
            <div class=\"title-row\">
              <div class=\"header-left\">
                <span class=\"tree-title\">Hierarchy Tree</span>
                <span class=\"subtitle\">What's inside what</span>
              </div>
              <span class=\"pill-count\">{{ canvasState.instanceCount() }} objects</span>
            </div>

            <!-- Summary Chips -->
            <div class=\"summary-bar\">
              <span class=\"summary-chip manager\">
                ★ {{ canvasState.managerCount() }} Managers
              </span>
              <span class=\"summary-chip child\">
                ↳ {{ canvasState.childCount() }} Children
              </span>
            </div>
          </div>

          <div class=\"tree-content\">
            @if (canvasState.hierarchyTree().length === 0) {
              <div class=\"empty-tree\">
                <span class=\"empty-icon\">🌲</span>
                <p class=\"empty-title\">No elements yet</p>
                <p class=\"empty-desc\">Create polygons or text to view parent-child and manager nesting.</p>
              </div>
            } @else {
              <div class=\"tree-nodes-list\">
                @for (rootNode of canvasState.hierarchyTree(); track rootNode.id) {
                  <ng-container
                    *ngTemplateOutlet=\"treeNodeTpl; context: { $implicit: rootNode }\"
                  ></ng-container>
                }
              </div>
            }
          </div>
        </div>
      }
    </aside>

    <!-- Recursive Node Template -->
    <ng-template #treeNodeTpl let-node>
      <div class=\"tree-node-wrapper\" [style.--depth]=\"node.depth\">
        <div
          class=\"tree-node-card\"
          [class.selected]=\"isSelected(node.id)\"
          [class.is-manager]=\"node.isManager\"
          [class.is-child]=\"node.parentClass && !node.isManager\"
          (click)=\"selectNode(node.id, $event)\"
        >
          <!-- Branch line indicator for children -->
          @if (node.depth > 0) {
            <span class=\"branch-elbow\">↳</span>
          }

          <!-- Type Icon -->
          <span class=\"type-icon\" [title]=\"node.type\">
            {{ getTypeIcon(node.element) }}
          </span>

          <!-- Node Info -->
          <div class=\"node-info\">
            <div class=\"node-title-row\">
              <span class=\"node-label\">{{ getNodeLabel(node.element) }}</span>
              @if (node.isManager) {
                <span class=\"badge manager-badge\" title=\"Outermost Enclosing Polygon\">
                  ★ MANAGER
                </span>
              } @else if (node.parentClass) {
                <span class=\"badge child-badge\" title=\"Child polygon/text\">
                  CHILD
                </span>
              } @else {
                <span class=\"badge root-badge\">
                  ROOT
                </span>
              }
            </div>

            <div class=\"node-meta-row\">
              <span class=\"node-coords\">
                {{ Math.round(node.element.x) }}, {{ Math.round(node.element.y) }}
                ({{ Math.round(node.element.width) }}×{{ Math.round(node.element.height) }})
              </span>
              @if (node.isManager && node.managerClassHash) {
                <span class=\"hash-tag\">#{{ node.managerClassHash.slice(0, 8) }}</span>
              }
            </div>
          </div>

          <!-- Quick Actions -->
          <div class=\"node-actions\">
            <button
              class=\"action-btn edit\"
              (click)=\"editNode(node.element, $event)\"
              title=\"Edit element properties\"
            >
              ✏️
            </button>
            <button
              class=\"action-btn delete\"
              (click)=\"deleteNode(node.id, $event)\"
              title=\"Delete via ManagerClass\"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- Render Children Recursively -->
        @if (node.children && node.children.length > 0) {
          <div class=\"nested-children\">
            @for (child of node.children; track child.id) {
              <ng-container
                *ngTemplateOutlet=\"treeNodeTpl; context: { $implicit: child }\"
              ></ng-container>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .tree-sidebar-wrapper {
      position: absolute;
      top: 18px;
      right: 20px;
      bottom: 80px;
      width: 310px;
      z-index: 90;
      display: flex;
      flex-direction: column;
      pointer-events: none;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      &.collapsed {
        width: 44px;
        bottom: auto;
      }

      * {
        pointer-events: auto;
      }
    }

    .collapse-toggle {
      align-self: flex-end;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
      transition: all 0.15s ease;

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      .toggle-icon {
        font-size: 10px;
        color: #64748b;
      }

      .badge-mini {
        background: #e0e7ff;
        color: #4338ca;
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 11px;
      }
    }

    .tree-container {
      flex: 1;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .tree-header {
      padding: 14px 16px 12px;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
    }

    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
    }

    .tree-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .subtitle {
      font-size: 11px;
      color: #64748b;
    }

    .pill-count {
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .summary-bar {
      display: flex;
      gap: 6px;
    }

    .summary-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;

      &.manager {
        background: #f5f3ff;
        color: #7c3aed;
        border: 1px solid #ddd6fe;
      }

      &.child {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
    }

    .tree-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
    }

    .empty-tree {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 16px;
      color: #94a3b8;

      .empty-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .empty-title {
        font-weight: 600;
        font-size: 13px;
        color: #475569;
        margin: 0 0 4px;
      }
      .empty-desc {
        font-size: 11px;
        margin: 0;
        line-height: 1.4;
      }
    }

    .tree-nodes-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .tree-node-wrapper {
      display: flex;
      flex-direction: column;
    }

    .tree-node-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;

        .node-actions {
          opacity: 1;
        }
      }

      &.selected {
        background: #eff6ff;
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px #3b82f6;
      }

      &.is-manager {
        border-left: 3px solid #7c3aed;
      }

      &.is-child {
        border-left: 3px solid #2563eb;
      }
    }

    .branch-elbow {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
    }

    .type-icon {
      font-size: 14px;
      color: #475569;
      width: 18px;
      text-align: center;
    }

    .node-info {
      flex: 1;
      min-width: 0;
    }

    .node-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .node-label {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.02em;

      &.manager-badge {
        background: #7c3aed;
        color: #ffffff;
      }

      &.child-badge {
        background: #2563eb;
        color: #ffffff;
      }

      &.root-badge {
        background: #f1f5f9;
        color: #64748b;
      }
    }

    .node-meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }

    .hash-tag {
      color: #7c3aed;
      font-family: monospace;
      font-weight: 600;
    }

    .node-actions {
      display: flex;
      gap: 3px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .action-btn {
      background: transparent;
      border: none;
      padding: 3px;
      font-size: 11px;
      cursor: pointer;
      border-radius: 4px;

      &:hover {
        background: #e2e8f0;
      }

      &.delete:hover {
        background: #fee2e2;
      }
    }

    .nested-children {
      margin-left: 16px;
      padding-left: 8px;
      border-left: 2px dashed #e2e8f0;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `]
})
export class TreeSidebarComponent {
  public canvasState = inject(CanvasStateService);
  public Math = Math;
  public isCollapsed = signal<boolean>(false);

  public toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
  }

  public isSelected(id: string): boolean {
    return this.canvasState.selectedElementIds().has(id);
  }

  public selectNode(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.canvasState.selectElement(id);
  }

  public editNode(element: CommonObjectClass, e: MouseEvent): void {
    e.stopPropagation();
    this.canvasState.editElementViaManager(element);
  }

  public deleteNode(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.canvasState.deleteElementViaManager(id);
  }

  public getTypeIcon(el: CommonObjectClass): string {
    switch (el.type) {
      case 'rectangle': return '▭';
      case 'ellipse': return '○';
      case 'polygon': return '◇';
      case 'arrow': return '➔';
      case 'text': return '🅃';
      default: return '▢';
    }
  }

  public getNodeLabel(el: CommonObjectClass): string {
    if (el instanceof TextElement) {
      return el.text.trim().slice(0, 18) || 'Text Element';
    }
    return `${el.type.charAt(0).toUpperCase() + el.type.slice(1)} #${el.id.slice(3, 7)}`;
  }
}
