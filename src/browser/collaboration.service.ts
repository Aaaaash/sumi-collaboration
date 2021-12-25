import * as Y from 'yjs';
import { Selection, SelectionDirection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';
import { WebrtcProvider } from 'y-webrtc';
import { createMutex } from 'lib0/mutex.js';
import { Injectable, Autowired } from '@opensumi/di';
import { OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { v4 } from 'uuid';

import { ICollaborationService } from 'common';
import { initializeWebRTCProvider, initializeYDoc } from './yjs/binding';
import { EditorActiveResourceStateChangedEvent, EditorGroupChangeEvent } from '@opensumi/ide-editor/lib/browser';

class RelativeSelection {
  start: Y.RelativePosition;
  end: Y.RelativePosition;
  direction: SelectionDirection;

  constructor (start: Y.RelativePosition, end: Y.RelativePosition, direction: SelectionDirection) {
    this.start = start
    this.end = end
    this.direction = direction
  }
}

const createRelativeSelection = (editor, monacoModel, type) => {
  const sel = editor.getSelection()
  if (sel !== null) {
    const startPos = sel.getStartPosition()
    const endPos = sel.getEndPosition()
    const start = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(startPos))
    const end = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(endPos))
    return new RelativeSelection(start, end, sel.getDirection())
  }
  return null
}


/**
 * @param {monaco.editor.IEditor} editor
 * @param {Y.Text} type
 * @param {RelativeSelection} relSel
 * @param {Y.Doc} doc
 * @return {null|monaco.Selection}
 */
 const createMonacoSelectionFromRelativeSelection = (editor, type, relSel, doc) => {
  const start = Y.createAbsolutePositionFromRelativePosition(relSel.start, doc)
  const end = Y.createAbsolutePositionFromRelativePosition(relSel.end, doc)
  if (start !== null && end !== null && start.type === type && end.type === type) {
    const model = /** @type {monaco.editor.ITextModel} */ (editor.getModel())
    const startPos = model.getPositionAt(start.index)
    const endPos = model.getPositionAt(end.index)
    return Selection.createWithDirection(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column, relSel.direction)
  }
  return null
}

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

  private savedSelections = new Map()

  @Autowired()
  protected readonly editorService: WorkbenchEditorService;

  private yTexts: Map<string, Y.Text> = new Map();

  @OnEvent(EditorActiveResourceStateChangedEvent)
  onEditorActiveResourceStateChangedEvent(e: EditorActiveResourceStateChangedEvent) {
    if (this.editorService.currentEditor && !this.textEditors.has(this.editorService.currentEditor)) {
      this.textEditors.add(this.editorService.currentEditor);

      const model = this.editorService.currentEditor?.monacoEditor.getModel();
      if (!model || !this.yDoc) {
        return;
      }

      const yText = this.yDoc?.getText(model?.getValue());
      this.yTexts.set(model?.uri.toString(), yText);
      yText?.observe(this.onDidTextChange.bind(this));
      model?.setValue(yText?.toString() || '');

      const rsel = createRelativeSelection(this.editorService.currentEditor.monacoEditor, model, yText);
      if (rsel !== null) {
        this.savedSelections.set(this.editorService.currentEditor.monacoEditor, rsel);
      }

      model?.onDidChangeContent((event) => {
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
        const sel = createMonacoSelectionFromRelativeSelection(editor, yText, rsel, this.yDoc);
        if (sel !== null) {
          editor.setSelection(sel)
        }
      })
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
