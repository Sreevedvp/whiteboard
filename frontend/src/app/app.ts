import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhiteboardComponent } from './components/whiteboard/whiteboard.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { TreeSidebarComponent } from './components/tree-sidebar/tree-sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WhiteboardComponent, ToolbarComponent, PropertiesPanelComponent, TreeSidebarComponent],
  template: `
    <main class="app-container">
      <app-toolbar />
      <app-properties-panel />
      <app-tree-sidebar />
      <app-whiteboard />
    </main>
  `,
  styles: [`
    .app-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
  `]
})
export class App {}
