export interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'file' | 'url' | 'email' | 'phone' | 'relation';
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
  // 关联字段配置
  relation?: {
    targetTableId: string; // 目标表ID
    targetColumnId: string; // 目标表字段ID
    displayColumnId?: string; // 显示字段ID（可选，默认为targetColumnId）
    type: 'single' | 'multiple'; // 关联类型：单选或多选
    inverse?: boolean; // 是否为反向关联
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

// 用户信息接口
export interface UserInfo {
  // 基本信息
  id?: string;
  user_id?: string;
  name?: string;
  nickname?: string;
  email?: string;
  mobile?: string;
  employee_id?: string;
  
  // 组织信息
  company_id?: string;
  company_name?: string;
  department_id?: string;
  department_name?: string;
  group_id?: string;
  group_name?: string;
  position_id?: string;
  position_name?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  
  // 权限信息
  role?: string;
  permissions?: string[];
  foundation_user_role?: string;
  foundation_user_permissions?: string[];
  
  // 其他可能的字段
  [key: string]: any;
}

// 关联数据缓存接口
export interface RelationCache {
  [key: string]: { // 格式: tableId_columnId_rowId
    [relatedId: string]: any; // 关联的行数据
  };
}