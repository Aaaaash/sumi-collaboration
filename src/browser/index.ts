import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { CollaborationContribution } from './collaboration.contribution';

@Injectable()
export class CollaborationBorwserModule extends BrowserModule {

  providers: Provider[] = [
    CollaborationContribution,
  ];

}