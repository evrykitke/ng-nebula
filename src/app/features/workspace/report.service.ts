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

export type ReportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

/** A background report render (data-heavy reports are queued off-request). */
export interface ReportJob {
  id: string;
  report: string;
  title: string;
  format?: ReportFormat | null;
  output: ReportOutput;
  status: ReportJobStatus;
  file_name?: string | null;
  content_type?: string | null;
  byte_size?: number | null;
  error?: string | null;
  requested_by?: string | null;
  created_at: string;
  completed_at?: string | null;
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

  /**
   * Queue a report to render in the background — for data-heavy reports.
   * Returns the created job; poll {@link job} until it is `completed`, then
   * {@link downloadJob}.
   */
  enqueueJob(
    name: string,
    format: ReportFormat | null,
    output: Exclude<ReportOutput, 'table'>,
  ): Observable<ReportJob> {
    const params = new URLSearchParams({ output });
    if (format) params.set('format', format);
    return this.http.post<ReportJob>(
      `${this.base}/reports/${encodeURIComponent(name)}/jobs?${params.toString()}`,
      {},
    );
  }

  /** One background job's current status. */
  job(id: string): Observable<ReportJob> {
    return this.http.get<ReportJob>(`${this.base}/reports/jobs/${encodeURIComponent(id)}`);
  }

  /** The tenant's recent background job history (newest first). */
  jobs(): Observable<ReportJob[]> {
    return this.http.get<ReportJob[]>(`${this.base}/reports/jobs`);
  }

  /** Download a completed job's stored artifact. */
  downloadJob(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/reports/jobs/${encodeURIComponent(id)}/download`, {
      responseType: 'blob',
    });
  }
}
