import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideIcons } from '@ng-icons/core';

import { routes } from './app.routes';
import { appIcons } from './shared/ui/icons';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './shared/service-proxies/service-proxies';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideIcons(appIcons),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
