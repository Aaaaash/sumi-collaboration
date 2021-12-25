import '@opensumi/ide-i18n/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../../src/browser/common-modules';

import '@opensumi/ide-core-browser/lib/style/index.less';
import '@opensumi/ide-core-browser/lib/style/icon.less';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { SlotLocation } from '@opensumi/ide-core-browser';

import './styles.less';
import { CollaborationBorwserModule } from '../../../src/browser';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ExpressFileServerModule,
    CollaborationBorwserModule,
  ],
  layoutConfig: {
    ...defaultConfig,
    ...{[SlotLocation.top]: {
      modules: ['@opensumi/ide-menu-bar', 'toolbar'],
    }},
    ...{[SlotLocation.action]: {
      modules: ['@opensumi/ide-toolbar-action'],
  }},
  },
  useCdnIcon: false,
  useExperimentalShadowDom: false,
  defaultPreferences: {
    'general.theme': 'opensumi-dark',
    'general.icon': 'vscode-icons',
  },
  defaultPanels: {
    'bottom': '@opensumi/ide-terminal-next',
    'right': '',
  },
});
