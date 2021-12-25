import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ICollaborationService } from 'common';

import { CollaborationContribution } from './collaboration.contribution';
import { CollaborationServiceImpl } from './collaboration.service';

@Injectable()
export class CollaborationBorwserModule extends BrowserModule {
  providers: Provider[] = [
    CollaborationContribution,
    {
      token: ICollaborationService,
      useClass: CollaborationServiceImpl,
    }
  ];

}
