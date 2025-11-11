// API 服務配置
// API 基礎配置
const API_BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(path: string, options: RequestOptions = {}) {
    const baseUrl = getApiOrigin();
    const url = `${baseUrl}/api${path}`;

    const method = (options.method || 'GET').toUpperCase();
    const isWriteMethod = method !== 'GET' && method !== 'HEAD';
    const currentUserName = localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name');
    if (isWriteMethod && !currentUserName) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const token = (typeof window !== 'undefined')
      ? (localStorage.getItem('oidc_access_token') || sessionStorage.getItem('oidc_access_token'))
      : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      // 尝试获取错误响应的JSON数据，特别是引用检测相关的信息
      try {
        const errorData = await response.json();
        // 创建一个包含更多信息的错误对象
        const enhancedError = new Error(errorData.message || `API request failed: ${response.status}`);
        // 添加错误数据到错误对象中
        (enhancedError as any).status = response.status;
        (enhancedError as any).data = errorData;
        throw enhancedError;
      } catch (jsonError) {
        // 如果无法解析JSON，则抛出原始错误
        throw new Error(`API request failed: ${response.status}`);
      }
    }

    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  async getTables() {
    return this.request(`/tables`);
  }

  async createTable(table) {
    return this.request(`/tables`, {
      method: 'POST',
      body: JSON.stringify(table),
    });
  }

  async updateTable(tableId, tableData, confirmed = false) {
    try {
      return await this.request(`/tables/${tableId}?confirmed=${confirmed}`, {
        method: 'PUT',
        body: JSON.stringify(tableData),
      });
    } catch (error) {
      // 重新抛出错误以保持原有行为，但确保前端可以捕获并处理
      throw error;
    }
  }

  async deleteTable(tableId, confirmed = false) {
    try {
      return await this.request(`/tables/${tableId}?confirmed=${confirmed}`, {
        method: 'DELETE',
      });
    } catch (error) {
      // 重新抛出错误以保持原有行为，但确保前端可以捕获并处理
      throw error;
    }
  }

  // 行數據相關 API
  async getTableRows(tableId) {
    return this.request(`/tables/${tableId}/rows`);
  }

  async createRow(tableId, rowData) {
    return this.request(`/tables/${tableId}/rows`, {
      method: 'POST',
      body: JSON.stringify(rowData),
    });
  }

  async updateRow(tableId, rowId, rowData) {
    return this.request(`/tables/${tableId}/rows/${rowId}`, {
      method: 'PUT',
      body: JSON.stringify(rowData),
    });
  }

  async deleteRow(tableId, rowId) {
    return this.request(`/tables/${tableId}/rows/${rowId}`, {
      method: 'DELETE',
    });
  }

  async setRowOrder(tableId, orderIds) {
    return this.request(`/tables/${tableId}/rows/order`, {
      method: 'PUT',
      body: JSON.stringify({ orderIds }),
    });
  }

  // 批量操作：刪除多行
  async batchDeleteRows(tableId, rowIds) {
    return this.request(`/tables/${tableId}/rows/batch`, {
      method: 'POST',
      body: JSON.stringify({
        operation: 'delete',
        rowIds,
      }),
    });
  }

  // 批量操作：更新多行
  async batchUpdateRows(tableId, operations) {
    return this.request(`/tables/${tableId}/rows/batch`, {
      method: 'POST',
      body: JSON.stringify({
        operation: 'update',
        operations,
      }),
    });
  }

  // 文件上傳相關
  async uploadFile(tableId, rowId, columnId, file) {
    const baseUrl = getApiOrigin();
    const url = `${baseUrl}/api/tables/${tableId}/rows/${rowId}/files/${columnId}`;

    const currentUserName = localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name');
    if (!currentUserName) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const formData = new FormData();
    formData.append('file', file);

    const token = (typeof window !== 'undefined')
      ? (localStorage.getItem('oidc_access_token') || sessionStorage.getItem('oidc_access_token'))
      : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }

    return await response.json();
  }

  async deleteFile(tableId, rowId, columnId) {
    return this.request(`/tables/${tableId}/rows/${rowId}/files/${columnId}`, {
      method: 'DELETE',
    });
  }

  async getUserSettings(username) {
    const safeName = encodeURIComponent(username);
    return this.request(`/users/${safeName}/settings`);
  }

  async updateUserSettings(username, settings) {
    const safeName = encodeURIComponent(username);
    return this.request(`/users/${safeName}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // 歷史版本 API
  async getHistoryList(tableId: string, params?: { limit?: number; cursor?: string; actor?: string; source?: string; from?: string; to?: string }) {
    const query = params
      ? '?' + Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return this.request(`/tables/${tableId}/history${query}`);
  }

  async getHistoryEntry(tableId: string, historyId: string) {
    return this.request(`/tables/${tableId}/history/${historyId}`);
  }

  async createHistorySnapshot(tableId: string, { label, source, snapshot }: { label?: string; source?: string; snapshot?: any }) {
    const actor = localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name') || null;
    return this.request(`/tables/${tableId}/history`, {
      method: 'POST',
      body: JSON.stringify({ label, source, actor, snapshot }),
    });
  }

  async clearHistory(tableId: string) {
    return this.request(`/tables/${tableId}/history`, {
      method: 'DELETE',
    });
  }

  async revertToHistory(tableId: string, historyId: string) {
    return this.request(`/tables/${tableId}/history/${historyId}/revert`, {
      method: 'POST',
    });
  }

  async getAuthMe() {
    return this.request(`/auth/me`);
  }

  // 获取用户详细信息，使用OIDC访问令牌
  async getUserInfo() {
    return this.request(`/auth/userinfo`);
  }
}

export const apiService = new ApiService();
export default apiService;
export const getApiOrigin = () => API_BASE_URL.replace(/\/api$/, '');
