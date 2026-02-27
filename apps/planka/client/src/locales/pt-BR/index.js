import merge from 'lodash/merge';

import login from './login';
import core from './core';

export default {
  language: 'pt-BR',
  country: 'br',
  name: 'Português',
  embeddedLocale: merge(login, core),
};
