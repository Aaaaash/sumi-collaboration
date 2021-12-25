import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { ICollaborationService } from 'common';

const TestClientId = 'test-client-id';

@Injectable()
@Domain(ClientAppContribution)
export class CollaborationContribution implements ClientAppContribution {
  @Autowired(ICollaborationService)
  protected readonly collaborationService: ICollaborationService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  initialize() {
    this.collaborationService.initializeYDoc(TestClientId);
  }

  onStop() {
    this.collaborationService.dispose();
  }
}
