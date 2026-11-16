import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CanvasStateService } from './canvas-state.service';
import { ElementFactory } from '../models/element-factory';
import { CanvasElementDTO } from '../models/common-object';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

@Injectable({
  providedIn: 'root'
})
export class ApiSyncService {
  private http = inject(HttpClient);
  private canvasState = inject(CanvasStateService);
  private apiUrl = 'http://localhost:8000/api/v1';
  private ws: WebSocket | null = null;
  private autosaveTimer: any = null;

  // Real-time Save & Autosave status signals
  public saveStatus = signal<SaveStatus>('saved');
  public lastSaved = signal<Date>(new Date());

  /**
   * Loads board elements from backend database on initial startup
   */
  public loadBoard(boardId: string): void {
    this.http.get<CanvasElementDTO[]>(`${this.apiUrl}/boards/${boardId}/elements`)
      .subscribe({
        next: (dtos) => {
          if (dtos && dtos.length > 0) {
            const elements = dtos.map(dto => ElementFactory.createFromDTO(dto));
            this.canvasState.elements.set(elements);
            this.canvasState.recalculateHierarchy();
            this.saveStatus.set('saved');
          } else {
            // First time loading this board: persist initial default elements
            this.saveBoard();
          }
        },
        error: (err) => {
          console.warn('Backend not reachable yet, operating in local offline mode:', err.message);
          this.saveStatus.set('saved');
        }
      });
  }

  /**
   * Persists active elements to backend database with visual status updates
   */
  public saveBoard(): void {
    this.saveStatus.set('saving');
    const boardId = this.canvasState.boardId();
    const dtos: CanvasElementDTO[] = this.canvasState.elements().map(e => e.toJSON());

    this.http.post(`${this.apiUrl}/boards/${boardId}/elements/bulk-sync`, {
      board_id: boardId,
      elements: dtos
    }).subscribe({
      next: (res: any) => {
        this.saveStatus.set('saved');
        this.lastSaved.set(new Date());

        // Broadcast to WebSocket peers if open
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({
              type: 'SYNC_ELEMENTS',
              elements: dtos
            }));
          } catch (e) {
            // Ignore ws send error
          }
        }
      },
      error: (err) => {
        console.warn('Save failed or backend offline:', err.message);
        this.saveStatus.set('error');
      }
    });
  }

  /**
   * Triggers an automatic debounced save whenever elements are moved, resized, or modified
   */
  public triggerAutosave(delayMs: number = 500): void {
    this.saveStatus.set('saving');
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      this.saveBoard();
    }, delayMs);
  }

  public connectWebSocket(boardId: string): void {
    try {
      this.ws = new WebSocket(`ws://localhost:8000/api/v1/boards/${boardId}/live`);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SYNC_ELEMENTS' && Array.isArray(data.elements)) {
            const elements = data.elements.map((dto: CanvasElementDTO) => ElementFactory.createFromDTO(dto));
            this.canvasState.elements.set(elements);
            this.canvasState.recalculateHierarchy();
            this.saveStatus.set('saved');
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };
    } catch (e) {
      console.warn('WebSocket connection error:', e);
    }
  }
}
