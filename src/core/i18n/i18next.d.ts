import 'i18next';

import { type defaultNS, type resources } from './i18n';

// Makes t('area.key') fail type checking when the key is not in en.json.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
