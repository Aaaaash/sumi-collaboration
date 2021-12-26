import * as Y from 'yjs';
import {
  Selection,
  SelectionDirection,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { WebrtcProvider } from 'y-webrtc';
import { createMutex } from 'lib0/mutex.js';
import { Injectable, Autowired } from '@opensumi/di';
import { OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { EditorActiveResourceStateChangedEvent } from '@opensumi/ide-editor/lib/browser';
import { v4 } from 'uuid';

import { ICollaborationService } from 'common';
import {
  createMonacoSelectionFromRelativeSelection,
  createRelativeSelection,
  initializeWebRTCProvider,
  initializeYDoc,
} from './yjs/binding';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import './styles.less';

@Injectable()
export class CollaborationServiceImpl extends WithEventBus implements ICollaborationService {
  private yDoc?: Y.Doc;

  private yWebRTCProvider?: WebrtcProvider;

  private mutex = createMutex();

  private getUserName() {
    return `大表哥` + v4();
  }

  private collaborators = new Map<number, { user: string }>();

  private textEditors: Set<IEditor> = new Set();

  private savedSelections = new Map();

  private decorations: Map<IEditor, string[]> = new Map();

  @Autowired()
  protected readonly editorService: WorkbenchEditorService;

  private yTexts: Map<string, Y.Text> = new Map();

  @OnEvent(EditorActiveResourceStateChangedEvent)
  onEditorActiveResourceStateChangedEvent(e: EditorActiveResourceStateChangedEvent) {
    if (
      this.editorService.currentEditor &&
      !this.textEditors.has(this.editorService.currentEditor)
    ) {
      this.textEditors.add(this.editorService.currentEditor);
      const monacoEditor = this.editorService.currentEditor.monacoEditor;

      const textModel = monacoEditor.getModel();
      if (!textModel || !this.yDoc) {
        return;
      }

      const yText = this.yDoc?.getText(textModel?.getValue());
      this.yTexts.set(textModel?.uri.toString(), yText);
      yText?.observe(this.onDidTextChange.bind(this));
      textModel?.setValue(yText?.toString() || '');

      const rsel = createRelativeSelection(
        this.editorService.currentEditor.monacoEditor,
        textModel,
        yText,
      );
      if (rsel !== null) {
        this.savedSelections.set(this.editorService.currentEditor.monacoEditor, rsel);
      }

      textModel?.onDidChangeContent((event) => {
        this.mutex(() => {
          this.yDoc?.transact(() => {
            event.changes
              .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
              .forEach((change) => {
                yText?.delete(change.rangeOffset, change.rangeLength);
                yText?.insert(change.rangeOffset, change.text);
              });
          }, this);
        });
      });

      monacoEditor.onDidChangeCursorSelection(() => {
        if (monacoEditor.getModel() === textModel) {
          const sel = monacoEditor.getSelection();
          if (sel === null) {
            return;
          }
          let anchor = textModel.getOffsetAt(sel.getStartPosition());
          let head = textModel.getOffsetAt(sel.getEndPosition());
          if (sel.getDirection() === SelectionDirection.RTL) {
            const tmp = anchor;
            anchor = head;
            head = tmp;
          }
          this.yWebRTCProvider?.awareness.setLocalStateField('selection', {
            anchor: Y.createRelativePositionFromTypeIndex(yText, anchor),
            head: Y.createRelativePositionFromTypeIndex(yText, head),
          });
        }
      });
    }
  }

  initializeYDoc(clientId: string): void {
    this.yDoc = initializeYDoc(clientId);
    this.yWebRTCProvider = initializeWebRTCProvider(this.yDoc);

    const name = this.getUserName();
    this.collaborators.set(this.yDoc.clientID, { user: name });
    this.yWebRTCProvider.awareness.setLocalStateField('user', {
      name,
    });

    this.yWebRTCProvider.awareness.on('change', this.onDidAwarenessChange.bind(this));

    this.onDispose(() => {
      this.yDoc?.destroy();
      this.yWebRTCProvider?.destroy();
    });
  }

  private onDidTextChange(event) {
    this.mutex(() => {
      let index = 0;
      const textModel = this.editorService.currentEditor?.monacoEditor.getModel();
      if (!textModel || !this.yTexts.has(textModel.uri.toString())) {
        return;
      }
      const yText = this.yTexts.get(textModel.uri.toString());
      event.delta.forEach((op) => {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const pos = textModel.getPositionAt(index);
          const range = new Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
          textModel.applyEdits([{ range, text: op.insert }]);
          index += op.insert.length;
        } else if (op.delete !== undefined) {
          const pos = textModel.getPositionAt(index);
          const endPos = textModel.getPositionAt(index + op.delete);
          const range = new Selection(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
          textModel.applyEdits([{ range, text: '' }]);
        } else {
          console.log('unknown op', op);
        }
      });
      this.savedSelections.forEach((rsel, editor) => {
        const sel = createMonacoSelectionFromRelativeSelection(editor, yText!, rsel, this.yDoc!);
        if (sel !== null) {
          editor.setSelection(sel);
        }
      });
    });
    this.renderDecorations();
  }

  private renderDecorations() {
    this.textEditors.forEach((editor) => {
      const textModel = this.editorService.currentEditor?.monacoEditor.getModel();
      const yText = this.yTexts.get(textModel?.uri.toString()!);
      if (!yText || !textModel) {
        return;
      }
      if (this.yWebRTCProvider?.awareness && editor.monacoEditor.getModel() === textModel) {
        const currentDecorations = this.decorations.get(editor) || [];
        const newDecorations: IModelDeltaDecoration[] = [];
        this.yWebRTCProvider?.awareness.getStates().forEach((state, clientID) => {
          if (
            clientID !== this.yDoc?.clientID &&
            state.selection != null &&
            state.selection.anchor != null &&
            state.selection.head != null
          ) {
            const anchorAbs = Y.createAbsolutePositionFromRelativePosition(
              state.selection.anchor,
              this.yDoc!,
            );
            const headAbs = Y.createAbsolutePositionFromRelativePosition(
              state.selection.head,
              this.yDoc!,
            );
            if (
              anchorAbs !== null &&
              headAbs !== null &&
              anchorAbs.type === yText &&
              headAbs.type === yText
            ) {
              let start, end, afterContentClassName, beforeContentClassName;
              if (anchorAbs.index < headAbs.index) {
                start = textModel.getPositionAt(anchorAbs.index);
                end = textModel.getPositionAt(headAbs.index);
                afterContentClassName = 'yRemoteSelectionHead';
                beforeContentClassName = null;
              } else {
                start = textModel.getPositionAt(headAbs.index);
                end = textModel.getPositionAt(anchorAbs.index);
                afterContentClassName = null;
                beforeContentClassName = 'yRemoteSelectionHead';
              }
              newDecorations.push({
                range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
                options: {
                  description: 'Remote Selection',
                  className: 'yRemoteSelection',
                  afterContentClassName,
                  beforeContentClassName,
                },
              });
            }
          }
        });
        this.decorations.set(
          editor,
          editor.monacoEditor.deltaDecorations(currentDecorations, newDecorations),
        );
      } else {
        // ignore decorations
        this.decorations.delete(editor);
      }
    });
  }

  private onDidAwarenessChange(changes: { added: number[]; updated: number[]; removed: number[] }) {
    if (changes.added.length > 0) {
      const states = this.yWebRTCProvider?.awareness.getStates();
      for (const id of states?.keys() || []) {
        if (!this.collaborators.has(id) && states?.get(id)?.user) {
          this.collaborators.set(id, states.get(id)!.user);
        }
      }
    }
  }
}
