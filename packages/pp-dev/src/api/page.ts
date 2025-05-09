import { Headers } from './constants.js';
import { BaseAPI } from './base.js';

export interface Page {
  name: string;
  enabled: 'Y' | 'N';
  visible_in_homepage: 'Y' | 'N';
  internal_name: string;
  tags?: string;
  template?: string | null;
  template_id?: number | null;
  base_url?: string;
  groups?: { group_id: number; name: string }[];
  custom_domain?: string | null;
}

export class PageAPI extends BaseAPI {
  async getAll(headers?: Headers) {
    return (
      await this.axios.get<{ pages: Page[] }>('/api/page', {
        withCredentials: true,
        headers: Object.assign({}, headers, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Expires: '0',
        }),
      })
    ).data.pages;
  }

  async get(id: number | string, headers?: Headers) {
    return (
      await this.axios.get<{ page: Page }>(`/api/page/id/${id}`, {
        withCredentials: true,
        headers: Object.assign({}, headers, {
          accept: 'application/json',
          'content-type': 'application/json',
        }),
      })
    ).data.page;
  }

  async getPageContent(internalPageName: string, headers?: Headers) {
    return (
      await this.axios.get<string>(`/p/${internalPageName}`, {
        withCredentials: true,
        headers: Object.assign({}, headers, {
          accept: 'text/html',
          'content-type': 'application/json',
        }),
      })
    ).data;
  }

  async create(page: Page, headers?: Headers) {
    return (
      await this.axios.post<{ page: Page }>('/api/page', page, {
        withCredentials: true,
        headers: Object.assign({}, headers, {
          accept: 'application/json',
          'content-type': 'application/json',
        }),
      })
    ).data.page;
  }
}
