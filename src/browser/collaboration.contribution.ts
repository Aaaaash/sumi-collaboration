import { Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

@Injectable()
@Domain(ClientAppContribution)
export class CollaborationContribution implements ClientAppContribution {

  initialize() {
    console.log('Hello OpenSumi IDE Collaboration!');
  }
}
