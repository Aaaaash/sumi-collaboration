import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Selection, SelectionDirection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';

export function initializeYDoc(
  clientId: string,
) {
  const ydoc = new Y.Doc({
    guid: clientId,
    meta: {
      name: 'Aaaaash' + Math.random() * 10,
    },
  });

  return ydoc;
}

export function initializeWebRTCProvider(doc: Y.Doc) {
  return new WebrtcProvider(doc.guid, doc);
}


export class RelativeSelection {
  constructor (
    public start: Y.RelativePosition,
    public end: Y.RelativePosition,
    public direction: SelectionDirection,
) {}
}

/**
 * @param {monaco.editor.IEditor} editor
 * @param {Y.Text} type
 * @param {RelativeSelection} relSel
 * @param {Y.Doc} doc
 * @return {null|monaco.Selection}
 */
export const createMonacoSelectionFromRelativeSelection = (editor, type, relSel, doc) => {
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

export const createRelativeSelection = (editor, monacoModel, type) => {
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