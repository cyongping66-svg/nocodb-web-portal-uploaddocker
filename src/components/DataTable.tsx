import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, GripVertical, Link, File, Mail, Phone, Search, Filter, X, CheckSquare, Square, Download, Copy } from 'lucide-react';
import { Table, Column, Row } from '@/types';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';

// 為選項生成一致的顏色
const getOptionColor = (option: string, index: number) => {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200', 
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-red-100 text-red-800 border-red-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200'
  ];
  
  // 使用選項字串的哈希值來確保相同選項總是得到相同顏色
  let hash = 0;
  for (let i = 0; i < option.length; i++) {
    const char = option.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 轉換為32位整數
  }
  
  return colors[Math.abs(hash) % colors.length];
};

interface DataTableProps {
  table: Table;
  onUpdateTable: (table: Table) => void;
  onCreateRow?: (tableId: string, rowData: any) => void;
  onUpdateRow?: (tableId: string, rowId: string, rowData: any) => void;
  onDeleteRow?: (tableId: string, rowId: string) => void;
}

interface SortableHeaderProps {
  column: Column;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (columnId: string) => void;
  onDelete: (columnId: string) => void;
  onUpdateColumn: (columnId: string, newName: string) => void;
  columnWidth?: number;
  onResizeStart: (e: React.MouseEvent, columnId: string) => void;
  resizingColumn: string | null;
}

function SortableHeader({ column, sortConfig, onSort, onDelete, onUpdateColumn, columnWidth, onResizeStart, resizingColumn }: SortableHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(column.name);
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue.trim() !== column.name) {
      onUpdateColumn(column.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue(column.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <th 
      ref={setNodeRef} 
      style={{
        ...style,
        width: columnWidth ? `${columnWidth}px` : 'auto',
        minWidth: '120px'
      }} 
      className="text-left border-r border-border last:border-r-0 relative"
    >
      <div className="flex items-center justify-between p-3 group">
        <div className="flex items-center gap-2 flex-1">
          <button
            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </button>
          
          {isEditing ? (
            <Input
                // 添加空值检查，修复类型错误
                value={editValue || ''}
                onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm font-medium"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <span 
                  className="hover:bg-muted/50 px-1 py-0.5 rounded cursor-pointer transition-colors text-sm font-medium text-foreground whitespace-nowrap"
                  onClick={handleEditClick}
                  title="點擊編輯欄位名稱"
                >
                  {column.name}
                </span>
                <button
                  className="flex items-center justify-center w-5 h-5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 rounded transition-colors"
                  onClick={() => onSort(column.id)}
                  title={
                    sortConfig?.key === column.id 
                      ? `當前排序：${sortConfig.direction === 'asc' ? '升序' : '降序'}，點擊切換` 
                      : '點擊排序'
                  }
                >
                  {sortConfig?.key === column.id ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-0">
                      <ArrowUp className="w-2.5 h-2.5 opacity-40" />
                      <ArrowDown className="w-2.5 h-2.5 opacity-40 -mt-0.5" />
                    </div>
                  )}
                </button>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
                onClick={handleEditClick}
                title="編輯欄位名稱"
              >
                <Edit className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
          onClick={() => onDelete(column.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      
      {/* 可拖拽的調整邊框 */}
      <div
        className={`absolute top-0 h-full cursor-col-resize transition-all duration-150 w-4 ${
          resizingColumn === column.id 
            ? 'bg-primary/30' 
            : 'bg-transparent hover:bg-primary/20'
        }`}
        style={{
          right: '-8px', // 調整位置讓拖拽區域在欄位邊界
          zIndex: 20,
        }}
        onMouseDown={(e) => onResizeStart(e, column.id)}
        title="拖拽調整欄位寬度"
      >
        {/* 中央的視覺指示線 */}
        <div className={`absolute left-1/2 top-0 w-0.5 h-full transition-all duration-150 ${
          resizingColumn === column.id 
            ? 'bg-primary' 
            : 'bg-border group-hover:bg-primary/70'
        }`} style={{ transform: 'translateX(-50%)' }} />
      </div>
    </th>
  );
}

export function DataTable({ 
  table, 
  onUpdateTable: originalOnUpdateTable, 
  onCreateRow, 
  onUpdateRow, 
  onDeleteRow 
}: DataTableProps) {
  // 存储表格ID用于localStorage的键名
  const tableStorageKey = `table_data_${table.id || 'default'}`;
  
  // 包装onUpdateTable函数以添加持久化逻辑
  const onUpdateTable = (updatedTable: Table) => {
    // 保存到localStorage
    try {
      localStorage.setItem(tableStorageKey, JSON.stringify(updatedTable));
    } catch (error) {
      console.error('Failed to save table data to localStorage:', error);
    }
    // 调用原始的onUpdateTable函数
    originalOnUpdateTable(updatedTable);
  };
  
  // 辅助函数：根据列类型转换数据值
  const convertValueByColumnType = (value: any, columnType: Column['type']): any => {
    // 特殊情况处理 - 使用类型安全的空值检查
    if (value === null || value === undefined || String(value).trim() === '') {
      switch (columnType) {
        case 'number':
          return 0;
        case 'boolean':
          return false;
        case 'date':
          return null;
        case 'select':
          return [];
        default:
          return '';
      }
    }
    
    switch (columnType) {
      case 'boolean':
        // 处理布尔值类型转换 - 支持多种输入格式，使用String()确保类型安全
        const boolValue = String(value).toLowerCase();
        return boolValue === 'true' || boolValue === '1' || value === true || value === 1;
      case 'number':
        // 处理数字类型转换
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      case 'date':
        // 处理日期类型转换
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      case 'select':
        // 处理选择类型，确保多选时返回数组
        if (Array.isArray(value)) {
          return value;
        } else {
          return [value];
        }
      default:
        // 对于文本、邮箱、电话、URL等类型，保持原样
        return value;
    }
  };

  // 从localStorage加载数据
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(tableStorageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // 进行类型转换
        const tableWithCorrectTypes = {
          ...parsedData,
          rows: parsedData.rows.map((row: Row) => {
            const typedRow = { ...row };
            // 根据列类型转换每一行的数据
            table.columns.forEach(column => {
              if (column.id in typedRow) {
                typedRow[column.id] = convertValueByColumnType(typedRow[column.id], column.type);
              }
            });
            return typedRow;
          })
        };
        
        // 只有当本地存储的数据与props提供的数据不同时才更新
        // 这里我们简单比较rows数组的长度和第一行的数据
        const hasDifferentData = 
          tableWithCorrectTypes.rows.length !== table.rows.length ||
          (tableWithCorrectTypes.rows.length > 0 && table.rows.length > 0 &&
           JSON.stringify(tableWithCorrectTypes.rows[0]) !== JSON.stringify(table.rows[0]));
        
        if (hasDifferentData) {
          originalOnUpdateTable(tableWithCorrectTypes);
        }        
      }
    } catch (error) {
      console.error('Failed to load table data from localStorage:', error);
    }
  }, [tableStorageKey, originalOnUpdateTable, table.columns]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  // 修改editValue类型以支持string或string[]，适应单选和多选模式
  const [editValue, setEditValue] = useState<string | string[] | null>('');
  const [selectOpen, setSelectOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  // 为newColumn添加isMultiSelect属性的支持
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' as Column['type'], options: [''], isMultiSelect: false });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ [columnId: string]: string }>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchEditColumn, setBatchEditColumn] = useState('');
  const [batchEditValue, setBatchEditValue] = useState('');
  
  // 欄位寬度調整相關狀態
  const [columnWidths, setColumnWidths] = useState<{ [columnId: string]: number }>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 当开始编辑选择类型的列时，自动打开选择器
  useEffect(() => {
    if (editingCell) {
      const column = table.columns.find(col => col.id === editingCell.columnId);
      if (column?.type === 'select') {
        setSelectOpen(true);
      }
    } else {
      setSelectOpen(false);
    }
  }, [editingCell, table.columns]);

  // 欄位寬度調整處理函數
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnId] || 200; // 增加預設寬度到 200px
    
    setResizingColumn(columnId);

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(120, startWidth + deltaX); // 增加最小寬度到 120px
      
      setColumnWidths(prev => ({
        ...prev,
        [columnId]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = table.columns.findIndex(col => col.id === active.id);
      const newIndex = table.columns.findIndex(col => col.id === over?.id);

      const newColumns = arrayMove(table.columns, oldIndex, newIndex);
      
      onUpdateTable({
        ...table,
        columns: newColumns
      });
      
      toast.success('欄位順序已更新');
    }
  };

  const addColumn = () => {
    if (!newColumn.name.trim()) {
      toast.error('請輸入欄位名稱');
      return;
    }

    const column: Column = {
      id: Date.now().toString(),
      name: newColumn.name.trim(),
      type: newColumn.type,
      options: newColumn.type === 'select' ? newColumn.options.filter(opt => opt.trim()) : undefined,
      // 添加isMultiSelect属性
      isMultiSelect: newColumn.type === 'select' ? newColumn.isMultiSelect : undefined
    };

    onUpdateTable({
      ...table,
      columns: [...table.columns, column]
    });

    // 添加isMultiSelect属性，修复类型错误
    setNewColumn({ name: '', type: 'text', options: [''], isMultiSelect: false });
    setIsAddColumnOpen(false);
    toast.success('欄位新增成功');
  };

  const updateColumn = (columnId: string, newName: string) => {
    const updatedColumns = table.columns.map(col =>
      col.id === columnId ? { ...col, name: newName } : col
    );

    onUpdateTable({
      ...table,
      columns: updatedColumns
    });

    toast.success('欄位名稱已更新');
  };

  const deleteColumn = (columnId: string) => {
    const updatedColumns = table.columns.filter(col => col.id !== columnId);
    const updatedRows: Row[] = table.rows.map(row => {
      const { [columnId]: deleted, ...rest } = row;
      return rest as Row;
    });

    onUpdateTable({
      ...table,
      columns: updatedColumns,
      rows: updatedRows
    });
    toast.success('欄位刪除成功');
  };

  const addRow = () => {
    const newRow: Row = {
      id: Date.now().toString(),
      ...table.columns.reduce((acc, col) => {
        switch (col.type) {
          case 'boolean':
            acc[col.id] = false;
            break;
          case 'date':
            acc[col.id] = new Date().toISOString().split('T')[0];
            break;
          case 'number':
            acc[col.id] = 0;
            break;
          case 'file':
            acc[col.id] = null;
            break;
          case 'select':
            // 对于选择类型，设置为空字符串，这样会显示占位符
            acc[col.id] = '';
            break;
          default:
            acc[col.id] = '';
        }
        return acc;
      }, {} as Record<string, any>)
    };

    // 优化：先立即更新本地表格数据，提供更好的用户体验
    // 同时调用API以确保数据持久化到服务器
    onUpdateTable({
      ...table,
      rows: [...table.rows, newRow] as Row[]
    });

    // 如果有API方法，也调用它
    if (onCreateRow) {
      onCreateRow(table.id, newRow);
    }
  };

  const deleteRow = (rowId: string) => {
    // 如果有 API 方法，使用 API；否則使用本地更新
    if (onDeleteRow) {
      onDeleteRow(table.id, rowId);
    } else {
      onUpdateTable({
        ...table,
        rows: table.rows.filter(row => row.id !== rowId)
      });
    }
  };

  const startEdit = (rowId: string, columnId: string, currentValue: any) => {
    setEditingCell({ rowId, columnId });
    
    // 根据列类型正确处理当前值
    const column = table.columns.find(col => col.id === columnId);
    if (column) {
      switch (column.type) {
        case 'boolean':
          // 布尔值保持布尔类型
          setEditValue(String(!!currentValue));
          break;
        case 'number':
          // 数字保持数字类型，如果为空则设为0
          setEditValue(currentValue || currentValue === 0 ? String(currentValue) : '0');
          break;
        case 'date':
          // 日期类型处理，确保格式正确
          if (currentValue) {
            const date = new Date(currentValue);
            // 转换为日期时间本地输入格式（YYYY-MM-DDTHH:MM）
            const formattedDate = isNaN(date.getTime()) 
              ? '' 
              : date.toISOString().slice(0, 16); // 截取到分钟
            setEditValue(formattedDate);
          } else {
            setEditValue('');
          }
          break;
        default:
          // 其他类型保持原样
          setEditValue(currentValue || '');
      }
    } else {
      // 如果找不到列，默认处理
      setEditValue(currentValue || '');
    }
  };

  const saveEdit = () => {
    if (!editingCell) return;

    const column = table.columns.find(col => col.id === editingCell.columnId);
    if (!column) return;

    let processedValue: any = editValue;
    
    // 根据列类型进行正确的数据类型转换
    if (column.type === 'number') {
      // 数字类型转换 - 确保处理各种边界情况
      if (editValue === null || editValue === undefined || editValue === '') {
        processedValue = 0;
      } else {
        const numValue = parseFloat(editValue as string);
        processedValue = isNaN(numValue) ? 0 : numValue;
      }
    } else if (column.type === 'boolean') {
      // 布尔值类型转换 - 支持多种输入格式
      // 添加类型安全检查，确保editValue是字符串类型
      const stringValue = typeof editValue === 'string' ? editValue : String(editValue);
      processedValue = stringValue === 'true' || stringValue === '1';
    } else if (column.type === 'date') {
        // 日期类型转换
        if (editValue) {
          // 确保editValue是有效的字符串类型
          const dateString = Array.isArray(editValue) ? editValue[0] || '' : editValue;
          const date = new Date(dateString);
        // 检查是否为有效日期
        processedValue = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } else {
        processedValue = null;
      }
    } else if (column.type === 'select') {
      // 选择类型处理 - 区分单选和多选模式
      if (column.isMultiSelect) {
        // 多选模式 - 确保是数组类型
        if (!Array.isArray(processedValue) && processedValue !== '') {
          processedValue = [processedValue];
        }
      } else {
        // 单选模式 - 确保是字符串类型
        if (Array.isArray(processedValue) && processedValue.length > 0) {
          processedValue = processedValue[0];
        }
      }
    } else {
      // 其他类型保持不变
      // 空字符串应该保持为空字符串而不是null
      processedValue = editValue === null ? '' : editValue;
    }

    // 獲取要更新的行
    const rowToUpdate = table.rows.find(row => row.id === editingCell.rowId);
    if (!rowToUpdate) return;

    const updatedRowData = {
      ...rowToUpdate,
      [editingCell.columnId]: processedValue
    };

    // 优化：先立即更新本地表格数据，提供更好的用户体验
    // 同时调用API以确保数据持久化到服务器
    const updatedRows: Row[] = table.rows.map(row =>
      row.id === editingCell.rowId
        ? updatedRowData
        : row
    );
    onUpdateTable({ ...table, rows: updatedRows });

    // 如果有API方法，也调用它
    if (onUpdateRow) {
      onUpdateRow(table.id, editingCell.rowId, updatedRowData);
    }

    setEditingCell(null);
    setEditValue('');
    setSelectOpen(false);
  };

  const handleFileUpload = (rowId: string, columnId: string, file: File) => {
    // Create a file URL for display
    const fileUrl = URL.createObjectURL(file);
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      url: fileUrl,
      lastModified: file.lastModified
    };

    const updatedRows: Row[] = table.rows.map(row =>
      row.id === rowId
        ? { ...row, [columnId]: fileData }
        : row
    );

    onUpdateTable({ ...table, rows: updatedRows });
    toast.success('檔案上傳成功');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setSelectOpen(false);
  };

  const handleSort = (columnId: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === columnId && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnId, direction });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // 批量操作函數
  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === sortedRows.length && sortedRows.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedRows.map(row => row.id)));
    }
  };

  const batchDelete = () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要刪除的資料');
      return;
    }

    const updatedRows: Row[] = table.rows.filter(row => !selectedRows.has(row.id));
    onUpdateTable({ ...table, rows: updatedRows });
    setSelectedRows(new Set());
    toast.success(`已刪除 ${selectedRows.size} 筆資料`);
  };

  const batchEdit = () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要編輯的資料');
      return;
    }
    if (!batchEditColumn) {
      toast.error('請選擇要編輯的欄位');
      return;
    }

    const column = table.columns.find(col => col.id === batchEditColumn);
    if (!column) return;

    let processedValue: any = batchEditValue;
    if (column.type === 'number') {
      processedValue = parseFloat(batchEditValue) || 0;
    } else if (column.type === 'boolean') {
      processedValue = batchEditValue === 'true';
    }

    const updatedRows: Row[] = table.rows.map(row =>
      selectedRows.has(row.id)
        ? { ...row, [batchEditColumn]: processedValue }
        : row
    );

    onUpdateTable({ ...table, rows: updatedRows });
    setSelectedRows(new Set());
    setBatchEditColumn('');
    setBatchEditValue('');
    setIsBatchEditOpen(false);
    toast.success(`已更新 ${selectedRows.size} 筆資料`);
  };

  const batchExport = () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要匯出的資料');
      return;
    }

    const selectedRowsData = table.rows.filter(row => selectedRows.has(row.id));
    
    try {
      // 准备Excel导出数据
      const worksheetData = [
        // 表头行
        table.columns.map(col => col.name),
        // 数据行
        ...selectedRowsData.map(row => 
          table.columns.map(col => {
            const value = row[col.id];
            // 处理不同类型的数据
            if (col.type === 'date' && value) {
              return new Date(value); // 确保日期格式正确
            }
            if (col.type === 'boolean') {
              return value ? '是' : '否';
            }
            if (col.type === 'file' && value) {
              return value.name || '文件';
            }
            return value || '';
          })
        )
      ];

      // 创建工作簿和工作表
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${table.name} (已选择)`);

      // 导出Excel文件
      const fileName = `${table.name.toLowerCase().replace(/\s+/g, '-')}-selected-${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`成功导出 ${selectedRows.size} 行数据为Excel文件`);
    } catch (error) {
      console.error('Excel批量导出失败:', error);
      toast.error('Excel批量導出失敗，請重試');
    }
  };

  const batchDuplicate = () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要複製的資料');
      return;
    }

    const selectedRowsData = table.rows.filter(row => selectedRows.has(row.id));
    const duplicatedRows: Row[] = selectedRowsData.map(row => ({
      ...row,
      id: `${Date.now()}-${Math.random()}`,
    }));

    onUpdateTable({
      ...table,
      rows: [...table.rows, ...duplicatedRows]
    });

    setSelectedRows(new Set());
    toast.success(`已複製 ${selectedRowsData.length} 筆資料`);
  };

  const filteredRows = table.rows.filter(row => {
    // 搜尋篩選
    if (searchTerm) {
      const searchMatch = Object.values(row).some(value => {
        if (value && typeof value === 'object' && value.name) {
          // 對於檔案類型，搜尋檔案名稱
          return value.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return String(value || '').toLowerCase().includes(searchTerm.toLowerCase());
      });
      if (!searchMatch) return false;
    }

    // 欄位篩選
    return Object.entries(filters).every(([filterKey, filterValue]) => {
      if (!filterValue || filterValue === '__all__') return true;
      
      // 檢查是否為範圍篩選（數字或日期）
      if (filterKey.endsWith('_min') || filterKey.endsWith('_max') || 
          filterKey.endsWith('_start') || filterKey.endsWith('_end')) {
        const columnId = filterKey.replace(/_min|_max|_start|_end$/, '');
        const column = table.columns.find(col => col.id === columnId);
        const cellValue = row[columnId];
        
        if (!column || cellValue === null || cellValue === undefined) return true;
        
        if (column.type === 'number') {
          const numValue = parseFloat(cellValue);
          if (isNaN(numValue)) return true;
          
          if (filterKey.endsWith('_min')) {
            const minValue = parseFloat(filterValue);
            return isNaN(minValue) || numValue >= minValue;
          } else if (filterKey.endsWith('_max')) {
            const maxValue = parseFloat(filterValue);
            return isNaN(maxValue) || numValue <= maxValue;
          }
        } else if (column.type === 'date') {
          const dateValue = new Date(cellValue);
          const filterDate = new Date(filterValue);
          
          if (isNaN(dateValue.getTime()) || isNaN(filterDate.getTime())) return true;
          
          if (filterKey.endsWith('_start')) {
            return dateValue >= filterDate;
          } else if (filterKey.endsWith('_end')) {
            return dateValue <= filterDate;
          }
        }
        
        return true;
      }
      
      // 一般篩選
      const cellValue = row[filterKey];
      const column = table.columns.find(col => col.id === filterKey);
      
      if (!column) return true;
      
      if (column.type === 'boolean') {
        return String(cellValue) === filterValue;
      } else if (column.type === 'select') {
        return cellValue === filterValue;
      } else {
        // 文字類型篩選
        if (cellValue && typeof cellValue === 'object' && cellValue.name) {
          // 對於檔案類型，篩選檔案名稱
          return cellValue.name.toLowerCase().includes(filterValue.toLowerCase());
        }
        return String(cellValue || '').toLowerCase().includes(filterValue.toLowerCase());
      }
    });
  });

  const sortedRows = [...filteredRows];
  if (sortConfig) {
    sortedRows.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      // 找到對應的欄位以獲取類型信息
      const column = table.columns.find(col => col.id === sortConfig.key);
      
      // 根據欄位類型進行不同的排序處理
      if (column?.type === 'number') {
        const numA = Number(aVal) || 0;
        const numB = Number(bVal) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      } else if (column?.type === 'date') {
        const dateA = new Date(aVal || 0).getTime();
        const dateB = new Date(bVal || 0).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (column?.type === 'boolean') {
        const boolA = aVal === true ? 1 : 0;
        const boolB = bVal === true ? 1 : 0;
        return sortConfig.direction === 'asc' ? boolA - boolB : boolB - boolA;
      } else {
        // 字符串類型的排序
        const strA = String(aVal || '').toLowerCase();
        const strB = String(bVal || '').toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }

  const renderCell = (row: Row, column: Column) => {
    const value = row[column.id];
    const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;

    if (isEditing) {
      if (column.type === 'boolean') {
        // 确保布尔值处理正确，支持多种输入格式
        // 添加类型安全检查，确保editValue是字符串类型
        const stringValue = typeof editValue === 'string' ? editValue : String(editValue);
        const isChecked = stringValue === 'true' || stringValue === '1';
        return (
          <Checkbox
            checked={isChecked}
            onCheckedChange={(checked) => setEditValue(String(checked))}
            onBlur={saveEdit}
            autoFocus
          />
        );
      } else if (column.type === 'select' && column.options) {
        // 检查是否为多选模式
        if (column.isMultiSelect) {
          // 多选模式
          const selectedValues = editValue ? (Array.isArray(editValue) ? editValue : [editValue]) : [];
          const isAllSelected = selectedValues.length === column.options.length;
          
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                {/* 搜索框 - 使用组件级状态 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search location ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 h-9 bg-background"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm('');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                {/* 全选和重置按钮 */}
                <div className="flex items-center justify-between px-2">
                  <div 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAllSelected) {
                        setEditValue([]);
                      } else {
                        setEditValue([...(column.options || [])]);
                      }
                    }}
                  >
                    <Checkbox 
                      checked={isAllSelected}
                      className="transition-all"
                    />
                    <span className="text-sm">全選</span>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditValue([]);
                      setSearchTerm('');
                    }}
                  >
                    Reset
                  </Button>
                </div>
                
                {/* 选项列表 - 使用组件级searchTerm进行过滤 */}
                {column.options
                  .filter(option => !searchTerm || option.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((option, index) => (
                  <div 
                    key={option} 
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${selectedValues.includes(option) ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      let newSelectedValues: string[];
                      if (selectedValues.includes(option)) {
                        // 取消选择
                        newSelectedValues = selectedValues.filter(val => val !== option);
                      } else {
                        // 添加选择
                        newSelectedValues = [...selectedValues, option];
                      }
                      setEditValue(newSelectedValues);
                    }}
                  >
                    <Checkbox 
                      checked={selectedValues.includes(option)}
                      className="transition-all"
                    />
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                      {option}
                    </div>
                  </div>
                ))}
                
                {/* 确认按钮 */}
                <Button 
                  variant="default" 
                  size="sm" 
                  className="mt-2 h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 立即更新數據並結束編輯
                    const updatedRows: Row[] = table.rows.map(row =>
                      row.id === editingCell?.rowId
                        ? { ...row, [editingCell.columnId]: editValue || [] }
                        : row
                    );
                    onUpdateTable({ ...table, rows: updatedRows });
                    setEditingCell(null);
                    setEditValue('');
                    setSearchTerm('');
                  }}
                >
                  confirm
                </Button>
              </div>
            </div>
          );
        } else {
          // 单选模式
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Select 
                // 确保值是字符串类型，修复类型错误
                value={typeof editValue === 'string' ? editValue : ''} 
                onValueChange={(val) => {
                  setEditValue(val);
                  // 立即更新數據並結束編輯
                  if (editingCell) {
                    const updatedRows: Row[] = table.rows.map(row =>
                      row.id === editingCell.rowId
                        ? { ...row, [editingCell.columnId]: val }
                        : row
                    );
                    onUpdateTable({ ...table, rows: updatedRows });
                    setEditingCell(null);
                    setEditValue('');
                    toast.success('選項已更新');
                  }
                }}
              >
                <SelectTrigger className="h-8 w-full" onClick={(e) => e.stopPropagation()}>
                  <SelectValue placeholder="請選擇選項" />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()}>
                  {column.options.map((option, index) => (
                    <SelectItem key={option} value={option} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                        {option}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
      } else if (column.type === 'file') {
        return (
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(row.id, column.id, file);
                setEditingCell(null);
              }
            }}
            className="h-8"
            autoFocus
          />
        );
      } else {
        return (
          <Input
            // 添加空值检查，修复类型错误
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="h-8"
            type={
              column.type === 'number' ? 'number' :
              column.type === 'date' ? 'datetime-local' :
              column.type === 'email' ? 'email' :
              column.type === 'phone' ? 'tel' :
              column.type === 'url' ? 'url' : 'text'
            }
            autoFocus
          />
        );
      }
    }

    // /显示不同列类型的逻辑
    const renderCellContent = () => {
      if (column.type === 'boolean') {
        return <Checkbox checked={Boolean(value)} disabled />;
      } else if (column.type === 'file' && value) {
        return (
          <div className="flex items-center gap-2 text-sm">
            <File className="w-4 h-4 text-blue-500" />
            <a 
              href={value.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline truncate max-w-[150px]"
              onClick={(e) => e.stopPropagation()}
            >
              {value.name}
            </a>
          </div>
        );
      } else if (column.type === 'url' && value) {
        return (
          <div className="flex items-center gap-2 text-sm">
            <Link className="w-4 h-4 text-blue-500" />
            <a 
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline truncate max-w-[150px]"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          </div>
        );
      } else if (column.type === 'email' && value) {
        return (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-green-500" />
            <a 
              href={`mailto:${value}`}
              className="text-green-600 hover:text-green-800 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          </div>
        );
      } else if (column.type === 'phone' && value) {
        return (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-purple-500" />
            <a 
              href={`tel:${value}`}
              className="text-purple-600 hover:text-purple-800 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          </div>
        );
      } else if (column.type === 'date' && value) {
        // 处理日期类型，使用更友好的格式显示
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            // 格式化日期为 YYYY-MM-DD HH:mm:ss
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            return <span className="text-sm">{`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`}</span>;
          }
        } catch (error) {
          console.error('Invalid date format:', error);
        }
        // 如果日期无效，回退到简单替换T为空格
        return <span className="text-sm">{String(value).replace('T', ' ')}</span>;
      } else if (column.type === 'select' && column.options) {
        // 检查是否为多选模式
        if (column.isMultiSelect) {
          // 多选模式
          const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
          
          if (selectedValues.length > 0) {
            return (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map((selectedValue) => {
                  if (column.options?.includes(selectedValue)) {
                    const optionIndex = column.options.indexOf(selectedValue);
                    const colorClass = getOptionColor(selectedValue, optionIndex);
                    
                    return (
                      <span 
                        key={selectedValue} 
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}
                      >
                        {selectedValue}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            );
          } else {
            // 如果没有选中值，显示占位符
            return <span className="text-sm text-muted-foreground italic">請選擇選項</span>;
          }
        } else {
          // 单选模式
          if (value && column.options.includes(value)) {
            // 為選項類型添加顏色標籤
            const optionIndex = column.options.indexOf(value);
            const colorClass = getOptionColor(value, optionIndex);
            
            return (
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                {value}
              </span>
            );
          } else {
            // 如果没有值或值不在选项中，显示占位符
            return <span className="text-sm text-muted-foreground italic">請選擇選項</span>;
          }
        }
      } else {
        return <span className="text-sm">{String(value || '')}</span>;
      }
    };

    return (
      <div
        className="p-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[32px] flex items-center"
        onClick={() => startEdit(row.id, column.id, column.type === 'file' ? '' : value)}
      >
        {renderCellContent()}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 搜尋和篩選區域 */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* 搜尋框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋所有欄位..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-10 bg-background"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto hover:bg-muted"
                onClick={() => setSearchTerm('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* 右側操作按鈕組 */}
          <div className="flex items-center gap-2">
            {/* 篩選按鈕 */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant={Object.values(filters).filter(Boolean).length > 0 ? "default" : "outline"} 
                  size="sm" 
                  className="relative h-10"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  篩選
                  {Object.values(filters).filter(Boolean).length > 0 && (
                    <span className="ml-2 bg-background text-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-medium">
                      {Object.values(filters).filter(Boolean).length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              {/* 篩選按鈕裡的進階篩選功能 */}
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-primary" />
                  進階篩選
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6 py-4">
                {table.columns.map((column) => (
                  <div key={column.id} className="space-y-2">
                    <Label htmlFor={`filter-${column.id}`} className="text-sm font-medium text-foreground">
                      {column.name}
                    </Label>
                    <div className="space-y-2">
                      {(() => {
                        // 根據欄位類型提供不同的篩選控制項
                        if (column.type === 'boolean') {
                          return (
                            <Select 
                              value={filters[column.id] || '__all__'} 
                              onValueChange={(value) => setFilters(prev => ({
                                ...prev,
                                [column.id]: value === '__all__' ? '' : value
                              }))}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="選擇布林值" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-muted border" />
                                    全部
                                  </div>
                                </SelectItem>
                                <SelectItem value="true">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    是
                                  </div>
                                </SelectItem>
                                <SelectItem value="false">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    否
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          );
                        } else if (column.type === 'select' && column.options) {
                          return (
                            <Select 
                              value={filters[column.id] || '__all__'} 
                              onValueChange={(value) => setFilters(prev => ({
                                ...prev,
                                [column.id]: value === '__all__' ? '' : value
                              }))}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="選擇選項" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded border bg-muted" />
                                    全部
                                  </div>
                                </SelectItem>
                                {column.options.map((option, index) => (
                                  <SelectItem key={option} value={option}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                                      {option}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        } else if (column.type === 'number') {
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">數值範圍</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">最小值</Label>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={filters[`${column.id}_min`] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                      ...prev,
                                      [`${column.id}_min`]: e.target.value
                                    }))}
                                    className="h-10"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">最大值</Label>
                                  <Input
                                    type="number" 
                                    placeholder="999"
                                    value={filters[`${column.id}_max`] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                      ...prev,
                                      [`${column.id}_max`]: e.target.value
                                    }))}
                                    className="h-10"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        } else if (column.type === 'date') {
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">日期時間範圍</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">起始日期時間</Label>
                                  <Input
                                    type="datetime-local"
                                    value={filters[`${column.id}_start`] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                      ...prev,
                                      [`${column.id}_start`]: e.target.value
                                    }))}
                                    className="h-10"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">結束日期時間</Label>
                                  <Input
                                    type="datetime-local"
                                    value={filters[`${column.id}_end`] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                      ...prev,
                                      [`${column.id}_end`]: e.target.value
                                    }))}
                                    className="h-10"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          // 預設為文字搜尋（適用於 text, email, phone, url, file）
                          return (
                            <div className="space-y-1">
                              <Input
                                id={`filter-${column.id}`}
                                placeholder={`搜尋 ${column.name}...`}
                                value={filters[column.id] || ''}
                                onChange={(e) => setFilters(prev => ({
                                  ...prev,
                                  [column.id]: e.target.value
                                }))}
                                type={
                                  column.type === 'email' ? 'email' :
                                  column.type === 'phone' ? 'tel' :
                                  column.type === 'url' ? 'url' : 'text'
                                }
                                className="h-10"
                              />
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                ))}
                </div>
              </div>
              
              {/* 底部按鈕區域 - 固定在底部 */}
              <div className="flex-shrink-0 border-t border-border p-4">
                <div className="flex gap-3">
                  <Button 
                    onClick={clearFilters} 
                    variant="outline" 
                    className="flex-1 h-11"
                    disabled={Object.values(filters).every(v => !v)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    清除篩選
                  </Button>
                  <Button 
                    onClick={() => setIsFilterOpen(false)} 
                    className="flex-1 h-11"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    套用篩選
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 清除篩選和排序 */}
          <div className="flex items-center gap-2">
            {(searchTerm || Object.values(filters).some(Boolean)) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                <X className="w-4 h-4 mr-2" />
                清除篩選
              </Button>
            )}
            
            {sortConfig && (
              <Button variant="ghost" size="sm" onClick={() => setSortConfig(null)} className="h-10">
                <ArrowUp className="w-4 h-4 mr-1 rotate-45" />
                <ArrowDown className="w-4 h-4 mr-2 -ml-2 rotate-45" />
                清除排序
              </Button>
            )}
          </div>
        </div>
      </div>

        {/* 作用中的篩選顯示 */}
        {(searchTerm || Object.values(filters).some(Boolean)) && (
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {searchTerm && (
              <span className="bg-muted px-2 py-1 rounded flex items-center gap-1">
                搜尋: "{searchTerm}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto ml-1"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            )}
            {Object.entries(filters).map(([filterKey, value]) => {
              if (!value) return null;
              
              // 處理範圍篩選的顯示
              if (filterKey.endsWith('_min') || filterKey.endsWith('_start')) {
                const columnId = filterKey.replace(/_min|_start$/, '');
                const column = table.columns.find(col => col.id === columnId);
                const maxKey = filterKey.replace(/_min$/, '_max').replace(/_start$/, '_end');
                const maxValue = filters[maxKey];
                
                if (!column) return null;
                
                const label = filterKey.endsWith('_min') ? '最小' : '起始';
                const rangeLabel = maxValue ? ` - ${maxValue}` : '';
                
                return (
                  <span key={filterKey} className="bg-muted px-2 py-1 rounded flex items-center gap-1">
                    {column.name} {label}: {value}{rangeLabel}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto ml-1"
                      onClick={() => {
                        setFilters(prev => {
                          const newFilters = { ...prev };
                          delete newFilters[filterKey];
                          if (maxValue) delete newFilters[maxKey];
                          return newFilters;
                        });
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </span>
                );
              } else if (filterKey.endsWith('_max') || filterKey.endsWith('_end')) {
                // 跳過 max/end 標籤，因為它們已經在 min/start 中處理了
                const minKey = filterKey.replace(/_max$/, '_min').replace(/_end$/, '_start');
                if (filters[minKey]) return null;
                
                const columnId = filterKey.replace(/_max|_end$/, '');
                const column = table.columns.find(col => col.id === columnId);
                if (!column) return null;
                
                const label = filterKey.endsWith('_max') ? '最大' : '結束';
                
                return (
                  <span key={filterKey} className="bg-muted px-2 py-1 rounded flex items-center gap-1">
                    {column.name} {label}: {value}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto ml-1"
                      onClick={() => setFilters(prev => ({ ...prev, [filterKey]: '' }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </span>
                );
              } else {
                // 一般篩選
                const column = table.columns.find(col => col.id === filterKey);
                if (!column) return null;
                
                return (
                  <span key={filterKey} className="bg-muted px-2 py-1 rounded flex items-center gap-1">
                    {column.name}: "{value}"
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto ml-1"
                      onClick={() => setFilters(prev => ({ ...prev, [filterKey]: '' }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </span>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* 批量操作工具列 */}
      {selectedRows.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">
                已選擇 {selectedRows.size} 筆資料
              </span>
              <div className="flex items-center gap-2">
                <Dialog open={isBatchEditOpen} onOpenChange={setIsBatchEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      批量編輯
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>批量編輯資料</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>選擇要編輯的欄位</Label>
                        <Select value={batchEditColumn} onValueChange={setBatchEditColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇欄位" />
                          </SelectTrigger>
                          <SelectContent>
                            {table.columns.map(column => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {batchEditColumn && (
                        <div>
                          <Label>新值</Label>
                          {(() => {
                            const column = table.columns.find(col => col.id === batchEditColumn);
                            if (!column) return null;

                            if (column.type === 'boolean') {
                              return (
                                <Select value={batchEditValue} onValueChange={setBatchEditValue}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇值" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">是</SelectItem>
                                    <SelectItem value="false">否</SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            } else if (column.type === 'select' && column.options) {
                              return (
                                <Select value={batchEditValue} onValueChange={setBatchEditValue}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇選項" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {column.options.map((option, index) => (
                                      <SelectItem key={option} value={option}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                                          {option}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            } else {
                              return (
                                <Input
                                  value={batchEditValue}
                                  onChange={(e) => setBatchEditValue(e.target.value)}
                                  placeholder="輸入新值"
                                  type={
                                    column.type === 'number' ? 'number' :
                                    column.type === 'date' ? 'datetime-local' :
                                    column.type === 'email' ? 'email' :
                                    column.type === 'phone' ? 'tel' :
                                    column.type === 'url' ? 'url' : 'text'
                                  }
                                />
                              );
                            }
                          })()}
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button onClick={() => setIsBatchEditOpen(false)} variant="outline" className="flex-1">
                          取消
                        </Button>
                        <Button onClick={batchEdit} className="flex-1" disabled={!batchEditColumn}>
                          套用變更
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" onClick={batchDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  複製
                </Button>

                <Button variant="outline" size="sm" onClick={batchExport}>
                  <Download className="w-4 h-4 mr-2" />
                  匯出選中
                </Button>

                <Button variant="destructive" size="sm" onClick={batchDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  刪除選中
                </Button>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedRows(new Set())}
            >
              <X className="w-4 h-4 mr-2" />
              取消選擇
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={addRow} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            新增行
          </Button>
          
          <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新增欄位
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增欄位</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="column-name">欄位名稱</Label>
                  <Input
                    id="column-name"
                    value={newColumn.name}
                    onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                    placeholder="輸入欄位名稱"
                  />
                </div>
                <div>
                  <Label htmlFor="column-type">資料類型</Label>
                  <Select value={newColumn.type} onValueChange={(value: Column['type']) => setNewColumn({ ...newColumn, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">文字</SelectItem>
                      <SelectItem value="number">數字</SelectItem>
                      <SelectItem value="date">日期</SelectItem>
                      <SelectItem value="boolean">布林值</SelectItem>
                      <SelectItem value="select">選項</SelectItem>
                      <SelectItem value="file">檔案</SelectItem>
                      <SelectItem value="url">網址連結</SelectItem>
                      <SelectItem value="email">電子郵件</SelectItem>
                      <SelectItem value="phone">電話號碼</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newColumn.type === 'select' && (
                  <div>
                    <Label>選項</Label>
                    {/* 添加多选模式复选框 */}
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox 
                        id="is-multi-select"
                        checked={newColumn.isMultiSelect || false}
                        // 确保checked是布尔类型，修复类型错误
                        onCheckedChange={(checked) => 
                          setNewColumn({ ...newColumn, isMultiSelect: !!checked })
                        }
                      />
                      <Label htmlFor="is-multi-select" className="cursor-pointer">
                        啟用多選模式
                      </Label>
                    </div>
                    {newColumn.options.map((option, index) => (
                      <div key={index} className="flex gap-2 mt-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...newColumn.options];
                            newOptions[index] = e.target.value;
                            setNewColumn({ ...newColumn, options: newOptions });
                          }}
                          placeholder={`選項 ${index + 1}`}
                        />
                        {index === newColumn.options.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNewColumn({ ...newColumn, options: [...newColumn.options, ''] })}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={addColumn} className="w-full">
                  新增欄位
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <span className="text-sm text-muted-foreground">
          顯示 {sortedRows.length} / {table.rows.length} 筆資料
        </span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {/* 桌面版表格 */}
        <div className="hidden md:block overflow-auto">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full min-w-full border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-12 p-3">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-muted rounded"
                        title={selectedRows.size === sortedRows.length && sortedRows.length > 0 ? "取消全選" : "全選"}
                      >
                        {selectedRows.size === sortedRows.length && sortedRows.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : selectedRows.size > 0 ? (
                          <div className="w-4 h-4 bg-primary/20 border-2 border-primary rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-primary rounded-sm" />
                          </div>
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </th>
                  <SortableContext items={table.columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                    {table.columns.map((column) => (
                      <SortableHeader
                        key={column.id}
                        column={column}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onDelete={deleteColumn}
                        onUpdateColumn={updateColumn}
                        columnWidth={columnWidths[column.id]}
                        onResizeStart={handleResizeStart}
                        resizingColumn={resizingColumn}
                      />
                    ))}
                  </SortableContext>
                  <th className="w-12 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/25 transition-colors group">
                    <td className="p-2">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => toggleRowSelection(row.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {selectedRows.has(row.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </div>
                    </td>
                    {table.columns.map((column) => (
                      <td 
                        key={column.id} 
                        className="border-r border-border last:border-r-0"
                        style={{
                          width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : 'auto',
                          minWidth: '120px'
                        }}
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                        onClick={() => deleteRow(row.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && table.rows.length > 0 ? (
                  <tr>
                    <td colSpan={table.columns.length + 2} className="p-8 text-center text-muted-foreground">
                      <div className="space-y-2">
                        <Search className="w-8 h-8 mx-auto text-muted-foreground/50" />
                        <p>找不到符合條件的資料</p>
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          清除篩選條件
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={table.columns.length + 2} className="p-8 text-center text-muted-foreground">
                      尚無資料。點擊「新增行」開始輸入資料。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* 移動版卡片列表 */}
        <div className="md:hidden p-2 space-y-2">
          {sortedRows.map((row) => (
            <div key={row.id} className="border border-border rounded-lg p-3 bg-background hover:bg-muted/25 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => toggleRowSelection(row.id)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {selectedRows.has(row.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <span className="text-xs text-muted-foreground">ID: {row.id.slice(-6)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto text-red-600"
                  onClick={() => deleteRow(row.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {table.columns.slice(0, 3).map((column) => {
                  const value = row[column.id];
                  return (
                    <div key={column.id} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground min-w-[60px]">{column.name}:</span>
                      <div className="flex-1 min-w-0" onClick={() => startEdit(row.id, column.id, column.type === 'file' ? '' : value)}>
                        {renderCell(row, column)}
                      </div>
                    </div>
                  );
                })}
                {table.columns.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    還有 {table.columns.length - 3} 個欄位...
                  </div>
                )}
              </div>
            </div>
          ))}
          {sortedRows.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Search className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p>{table.rows.length > 0 ? '找不到符合條件的資料' : '尚無資料'}</p>
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                清除篩選條件
              </Button>
            </div>
          )}
        </div>
        
        {/* 表格底部新增行按鈕 */}
        <div className="p-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增行
          </Button>
        </div>
      </div>
    </div>
  );
}