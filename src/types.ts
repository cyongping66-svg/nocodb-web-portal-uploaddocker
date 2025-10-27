export interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'file' | 'url' | 'email' | 'phone';
  options?: string[];
  isMultiSelect?: boolean;
  // 視圖設定（持久化在 columns JSON）
  visible?: boolean;
  frozen?: 'left' | 'right' | boolean;
  order?: number;
  // 字典引用（選項來自特定子表/欄位）
  dictRef?: {
    tableId: string;
    columnId: string;
    labelKey?: string;
  };
}

export interface Row {
  id: string;
  [key: string]: any;
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
}

export type ViewMode = 'grid' | 'card';