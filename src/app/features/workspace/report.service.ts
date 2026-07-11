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
/** `pdf`/`excel` are file downloads; `table` is the interactive datatable. */
export type ReportOutput = 'pdf' | 'excel' | 'table';

export interface ReportInfo {
  name: string;
  title: string;
  group: string;
  outputs: ReportOutput[];
  default_format: ReportFormat;
  requires_permission?: string;
}

export interface ReportGroup {
  name: string;
  reports: ReportInfo[];
}

export interface ReportSettings {
  default_format?: ReportFormat | null;
  watermark?: string | null;
}

/** The themed preview: a report's pages as SVG markup, one per page. */
export interface ReportPreview {
  pages: string[];
}

export interface ReportTables {
  title: string;
  tables: DataTable[];
}

export interface DataTable {
  title?: string | null;
  columns: DataColumn[];
  rows: string[][];
  totals?: string[] | null;
}

export interface DataColumn {
  label: string;
  align: 'start' | 'center' | 'end';
  numeric: boolean;
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

  /**
   * The themed in-app preview: the report's pages as SVG, to render inside
   * the app's own chrome instead of the browser's native PDF viewer.
   */
  preview(name: string, format: ReportFormat | null): Observable<ReportPreview> {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    const qs = params.toString();
    return this.http.get<ReportPreview>(
      `${this.base}/reports/${encodeURIComponent(name)}/preview${qs ? `?${qs}` : ''}`,
    );
  }

  /** The interactive datatable payload for a list report (`table` output). */
  datatables(name: string, format: ReportFormat | null): Observable<ReportTables> {
    const params = new URLSearchParams();
    if (format) params.set('format', format);
    const qs = params.toString();
    return this.http.get<ReportTables>(
      `${this.base}/reports/${encodeURIComponent(name)}/table${qs ? `?${qs}` : ''}`,
    );
  }
}
