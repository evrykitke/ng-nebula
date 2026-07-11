import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Client for the reporting engine. These endpoints are framework-level
 * (`/reports…`) and not part of the module OpenAPI, so there is no NSwag
 * proxy — a thin HttpClient wrapper does the job. The api interceptor still
 * attaches the bearer token and `X-Tenant` header.
 */
export type ReportFormat = 'modern' | 'compact' | 'corporate';
export type ReportOutput = 'pdf' | 'excel';

export interface ReportInfo {
  name: string;
  title: string;
  outputs: ReportOutput[];
  default_format: ReportFormat;
  requires_permission?: string;
}

export interface ReportSettings {
  default_format?: ReportFormat | null;
  watermark?: string | null;
}

export const REPORT_FORMATS: readonly ReportFormat[] = ['modern', 'compact', 'corporate'];

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** The catalogue of reports the current user may see. */
  list(): Observable<ReportInfo[]> {
    return this.http.get<ReportInfo[]>(`${this.base}/reports`);
  }

  /** The tenant's report settings (house format + watermark). */
  getSettings(): Observable<ReportSettings> {
    return this.http.get<ReportSettings>(`${this.base}/reports/settings`);
  }

  /** Persist the tenant's report settings (admin only, enforced server-side). */
  saveSettings(settings: ReportSettings): Observable<ReportSettings> {
    return this.http.put<ReportSettings>(`${this.base}/reports/settings`, settings);
  }

  /**
   * Render a report to bytes. `format` of `null` lets the server apply the
   * tenant's house default.
   */
  render(name: string, format: ReportFormat | null, output: ReportOutput): Observable<Blob> {
    const params = new URLSearchParams({ output });
    if (format) params.set('format', format);
    return this.http.get(`${this.base}/reports/${encodeURIComponent(name)}?${params.toString()}`, {
      responseType: 'blob',
    });
  }
}
