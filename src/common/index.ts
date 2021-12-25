import { Disposable } from '@opensumi/ide-core-common';

export const ICollaborationService = Symbol('ICollaborationService');

export interface ICollaborationService extends Disposable {
  initializeYDoc(clientId: string): void;
}
