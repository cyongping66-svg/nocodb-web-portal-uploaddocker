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

  async request(endpoint: string, options: RequestOptions = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // 表格相關 API
  async getTables() {
    return this.request('/tables');
  }

  async getTable(tableId) {
    return this.request(`/tables/${tableId}`);
  }

  async createTable(tableData) {
    return this.request('/tables', {
      method: 'POST',
      body: JSON.stringify(tableData),
    });
  }

  async updateTable(tableId, tableData) {
    return this.request(`/tables/${tableId}`, {
      method: 'PUT',
      body: JSON.stringify(tableData),
    });
  }

  async deleteTable(tableId) {
    return this.request(`/tables/${tableId}`, {
      method: 'DELETE',
    });
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

  // 檔案上傳 API（新增）
  async uploadFile(tableId, rowId, columnId, file: File) {
    const url = `${this.baseURL}/tables/${tableId}/rows/${rowId}/files/${columnId}`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // 將相對路徑轉換為絕對 URL，以便在不同端口下正確訪問
      if (data?.file?.url && data.file.url.startsWith('/')) {
        const apiOrigin = getApiOrigin();
        data.file.url = `${apiOrigin}${data.file.url}`;
      }

      return data;
    } catch (error) {
      console.error(`File upload failed: ${url}`, error);
      throw error;
    }
  }

  async deleteFile(tableId, rowId, columnId) {
    return this.request(`/tables/${tableId}/rows/${rowId}/files/${columnId}`, {
      method: 'DELETE',
    });
  }

  async batchDeleteRows(tableId, rowIds) {
    return this.request(`/tables/${tableId}/rows/batch`, {
      method: 'POST',
      body: JSON.stringify({
        operation: 'delete',
        rowIds,
      }),
    });
  }

  async batchUpdateRows(tableId, rows) {
    // 中文注释：批量更新使用同一批量接口，operation 指定為 'update'
    return this.request(`/tables/${tableId}/rows/batch`, {
      method: 'POST',
      body: JSON.stringify({ operation: 'update', rows }),
    });
  }

  // 健康檢查
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiService = new ApiService();
export default apiService;
export const getApiOrigin = () => API_BASE_URL.replace(/\/api$/, '');
