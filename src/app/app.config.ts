import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIcons } from '@ng-icons/core';
import { provideDateAdapter } from '@spartan-ng/brain/date-time';
import { BrnLuxonDateAdapter } from '@spartan-ng/brain/date-time-luxon';

import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api-interceptor';
import { appIcons } from './shared/ui/icons';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './shared/service-proxies/service-proxies';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideIcons(appIcons),
    provideDateAdapter(BrnLuxonDateAdapter),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
