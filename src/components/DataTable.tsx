import { useState, useEffect, useRef } from 'react';
import apiService, { getApiOrigin } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, GripVertical, Link, File, Mail, Phone, Search, Filter, X, CheckSquare, Square, Download, Copy, Settings, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { Table, Column, Row, RelationCache } from '@/types';
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
  verticalListSortingStrategy,
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
  onBatchUpdateRows?: (tableId: string, rows: any[]) => Promise<void>; // 中文注释：批量更新回調，用於選項同步
  onSetLastOperation?: (op: { label: string; undo: () => Promise<void> } | null) => void; // 新增：向上傳遞可回滾操作
}

interface SortableHeaderProps {
  column: Column;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (columnId: string) => void;
  onDelete: (columnId: string) => void;
  columnWidth?: number;
  onResizeStart: (e: React.MouseEvent, columnId: string) => void;
  resizingColumn: string | null;
  onOpenColumnConfig: (columnId: string) => void;
  allTables: any[];
  table: Table; // 添加table参数
}

function SortableHeader({ column, sortConfig, onSort, onDelete, columnWidth, onResizeStart, resizingColumn, onOpenColumnConfig, allTables, table }: SortableHeaderProps) {


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
          
          <div className="flex items-center gap-1">
            <div className="inline-flex items-center">
              {(() => {
                // 检查当前列是否是主关联列（有targetTableId）
                const isSourceRelation = !!column.relation?.targetTableId;
                
                // 检查当前列是否被其他表关联（反向关联）
                const isTargetRelation = allTables.some(otherTable => 
                  otherTable.id !== table.id && 
                  otherTable.columns?.some(otherColumn => 
                    otherColumn.relation?.targetTableId === table.id && 
                    otherColumn.relation?.targetColumnId === column.id
                  )
                );
                
                // 如果是关联列或被关联列，则显示图标
                return (isSourceRelation || isTargetRelation) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="inline-flex items-center mr-1">
                        <File className="w-4 h-4 text-primary cursor-help" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-60">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">关联信息</div>
                      
                      {/* 显示正向关联信息 */}
                      {isSourceRelation && (
                        <div className="space-y-1 pl-1">
                          <div className="text-xs text-muted-foreground">
                            关联表: {allTables.find(t => t.id === column.relation?.targetTableId)?.name || '未知表格'}
                          </div>
                          {column.relation?.targetColumnId && (
                            <div className="text-xs text-muted-foreground">
                              关联字段: {(() => {
                                const targetTable = allTables.find(t => t.id === column.relation?.targetTableId);
                                return targetTable?.columns?.find(c => c.id === column.relation?.targetColumnId)?.name || column.relation?.targetColumnId;
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 显示反向关联信息 */}
                      {isTargetRelation && (
                        <div className="space-y-1 pl-1">
                          <div className="text-xs text-muted-foreground font-medium">被以下表关联:</div>
                          {allTables
                            .filter(otherTable => 
                              otherTable.id !== table.id && 
                              otherTable.columns?.some(otherColumn => 
                                otherColumn.relation?.targetTableId === table.id && 
                                otherColumn.relation?.targetColumnId === column.id
                              )
                            )
                            .map(relatedTable => {
                              const relatedColumns = relatedTable.columns?.filter(otherColumn => 
                                otherColumn.relation?.targetTableId === table.id && 
                                otherColumn.relation?.targetColumnId === column.id
                              );
                              return (
                                <div key={relatedTable.id} className="text-xs text-muted-foreground pl-2">
                                  {relatedTable.name} (字段: {relatedColumns?.map(c => c.name).join(', ')})
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                  </Popover>
                );
              })()}
              <span 
                className="px-1 py-0.5 rounded text-sm font-medium text-foreground whitespace-nowrap"
                title={column.name}
              >
                {column.name}
              </span>
            </div>
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
        </div>
        
        <div className="flex items-center gap-1">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
            onClick={(e) => { e.stopPropagation(); onOpenColumnConfig(column.id); }}
            title="欄位設定"
          >
            <Settings className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
            onClick={(e) => { e.stopPropagation(); onDelete(column.id); }}
            title="刪除欄位"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
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

// 新增：可拖拽的行組件，僅通過行首手柄觸發拖拽
interface SortableRowProps {
  row: Row;
  selected: boolean;
  onToggleSelect: (rowId: string) => void;
  columns: Column[];
  columnWidths: Record<string, number>;
  renderCell: (row: Row, column: Column) => any;
  onDeleteRow: (rowId: string) => void;
  dragDisabled?: boolean;
}

function SortableRow({ row, selected, onToggleSelect, columns, columnWidths, renderCell, onDeleteRow, dragDisabled }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as any;

  return (
    <tr ref={setNodeRef} style={style} className="border-t border-border hover:bg-muted/25 transition-colors group">
      <td className="p-2">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onToggleSelect(row.id)}
            className="p-1 hover:bg-muted rounded"
          >
            {selected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
          <button
            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title={dragDisabled ? '清除篩選或排序後可拖拽' : '拖拽調整行順序'}
            {...(dragDisabled ? {} : { ...attributes, ...listeners })}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </td>
      {columns.map((column) => (
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
          onClick={() => onDeleteRow(row.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  );
}

export function DataTable({ 
  table, 
  onUpdateTable: originalOnUpdateTable, 
  onCreateRow, 
  onUpdateRow, 
  onDeleteRow, 
  onBatchUpdateRows,
  onSetLastOperation,
}: DataTableProps) {
  const isAuthenticated = () => !!(localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name'));
  // 直接使用原始的onUpdateTable函数，不再使用localStorage
  const onUpdateTable = async (updatedTable: Table) => {
    // 调用原始的onUpdateTable函数并等待其完成（包含後端持久化行順序等）
    await originalOnUpdateTable(updatedTable);
  };
  
  // 追蹤最新的表格狀態，用於回滾時獲取當前 rows/columns
  const latestTableRef = useRef<Table>(table);
  useEffect(() => {
    latestTableRef.current = table;
  }, [table]);
  
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

  // 不再从localStorage加载数据，完全依赖props和后端API
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  // 修改editValue类型以支持string或string[]，适应单选和多选模式
  const [editValue, setEditValue] = useState<string | string[] | null>('');
  const [selectOpen, setSelectOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  // 为newColumn添加isMultiSelect属性的支持
  // 关联数据缓存，避免重复请求
  const [relationCache, setRelationCache] = useState<RelationCache>({});
  
  // 初始化关联缓存数据
  useEffect(() => {
    // 获取所有关联类型的列
    const relationColumns = table.columns.filter(col => col.relation && col.relation.targetTableId && col.relation.targetColumnId);
    
    // 并发加载所有关联数据
    Promise.all(
      relationColumns.map(column => {
        // 确保column.relation存在
        if (!column.relation || !column.relation.targetTableId || !column.relation.targetColumnId) {
          return Promise.resolve();
        }
        
        const cacheKey = `${column.relation.targetTableId}_${column.relation.targetColumnId}`;
        
        // 如果缓存中已有数据，则跳过
        if (relationCache[cacheKey]) {
          return Promise.resolve();
        }
        
        return apiService.getTableRows(column.relation.targetTableId)
          .then(data => {
            setRelationCache(prev => ({
              ...prev,
              [cacheKey]: data || []
            }));
          })
          .catch(err => {
            console.error(`Failed to load relation data for ${cacheKey}:`, err);
          });
      })
    ).catch(err => {
      console.error('Failed to load some relation data:', err);
    });
  }, [table.id, table.columns, relationCache]); // 仅在表格或列定义变化时重新加载
  const [newColumn, setNewColumn] = useState<{ 
    name: string; 
    type: Column['type']; 
    options: string[]; 
    isMultiSelect: boolean; 
    dictRef?: { tableId: string; columnId: string }; 
    relation?: { targetTableId: string; targetColumnId: string; displayColumnId?: string; type: 'single' | 'multiple' } 
  }>({ 
    name: '', 
    type: 'text', 
    options: [''], 
    isMultiSelect: false, 
    dictRef: undefined,
    relation: undefined
  });
  const [configColumnId, setConfigColumnId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<{ name: string; type: Column['type']; options: string[]; isMultiSelect: boolean; dictRef?: { tableId: string; columnId: string }; relation?: { targetTableId: string; targetColumnId: string; displayColumnId?: string; type: 'single' | 'multiple' } } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 系統子表（字典來源）列表
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        setTablesLoading(true);
        const ts = await apiService.getTables();
        setAllTables(Array.isArray(ts) ? ts : []);
      } catch (e) {
        console.warn('載入系統子表失敗', e);
      } finally {
        setTablesLoading(false);
      }
    })();
  }, []);

  // 新增：提供手動刷新系統子表列表的方法，供互動時即時更新
  const refreshAllTables = async () => {
    try {
      setTablesLoading(true);
      const ts = await apiService.getTables();
      setAllTables(Array.isArray(ts) ? ts : []);
    } catch (e) {
      console.warn('刷新系統子表失敗', e);
    } finally {
      setTablesLoading(false);
    }
  };

  // 字典選項快取：key = `${tableId}:${columnId}`
  const [dictOptionsCache, setDictOptionsCache] = useState<{ [key: string]: string[] }>({});
  const getDictKey = (c: Column) => (c.dictRef && c.dictRef.tableId && c.dictRef.columnId) ? `${c.dictRef.tableId}:${c.dictRef.columnId}` : '';
  const getSelectOptions = (c: Column) => {
    // 防止關聯自身欄位造成無意義的字典選項
    if (c.dictRef && c.dictRef.tableId === table.id && c.dictRef.columnId === c.id) return [];
    const k = getDictKey(c);
    if (k) {
      const base = dictOptionsCache[k] || [];
      const dictTable = allTables.find(t => t.id === c.dictRef!.tableId);
      const dictCol = dictTable?.columns?.find((dc: Column) => dc.id === c.dictRef!.columnId);
      // 若字典欄位本身是 select，合併其定義的 options（包含尚未在子表資料中出現的）
      let definedOpts: string[] = [];
      if (dictCol?.type === 'select' && Array.isArray(dictCol?.options)) {
        definedOpts = (dictCol.options as string[]).map(v => String(v));
      }
      const union = Array.from(new Set<string>([...definedOpts, ...base]));
      return union;
    }
    return c.type === 'select' ? (c.options || []) : [];
  };

  // 新增：提供手動刷新某欄位的字典選項的方法，打開下拉時即時更新
  const refreshDictOptionsForColumn = async (c: Column) => {
    const key = getDictKey(c);
    if (!key) return;
    try {
      const rows = await apiService.getTableRows(c.dictRef!.tableId);
      const dictTable = allTables.find(t => t.id === c.dictRef!.tableId);
      const dictCol = dictTable?.columns?.find((dc: Column) => dc.id === c.dictRef!.columnId);
      const isDateDict = dictCol?.type === 'date';
      const isMultiSelectDict = dictCol?.type === 'select' && !!dictCol?.isMultiSelect;
      const collect = (val: any): string => {
        if (val === null || val === undefined || val === '') return '';
        if (isDateDict) {
          const d = new Date(String(val));
          return isNaN(d.getTime()) ? '' : d.toISOString();
        }
        return String(val);
      };
      const setVals = new Set<string>();
      for (const r of (rows || [])) {
        const raw = r[c.dictRef!.columnId];
        if (Array.isArray(raw) && isMultiSelectDict) {
          for (const item of raw) {
            const v = collect(item);
            if (v) setVals.add(v);
          }
        } else {
          const v = collect(raw);
          if (v) setVals.add(v);
        }
      }
      const values: string[] = Array.from(setVals);
      setDictOptionsCache(prev => ({ ...prev, [key]: values }));
    } catch (e) {
      console.warn('刷新字典選項失敗', e);
    }
  };

  // 新增：無感即時輪詢，定期刷新系統子表和字典選項（不需使用者操作）
  const lastTablesSig = useRef<string>('');
  useEffect(() => {
    const pollingIntervalMs = 5000; // 5秒一次，兼顧即時性與效能
    let timer: any = null;

    const tick = async () => {
      try {
        // 刷新系統子表（僅在結構變更時更新狀態，避免不必要重渲染）
        const ts = await apiService.getTables();
        const makeSig = (tables: any[]) => JSON.stringify((tables || []).map((t) => ({
          id: t.id,
          name: t.name,
          cols: (t.columns || []).map((c: Column) => ({ id: c.id, type: c.type, opts: Array.isArray(c.options) ? c.options.length : 0 })),
        })));
        const sigNew = makeSig(Array.isArray(ts) ? ts : []);
        if (sigNew !== lastTablesSig.current) {
          setAllTables(Array.isArray(ts) ? ts : []);
          lastTablesSig.current = sigNew;
        }

        // 刷新當前表格中所有帶字典引用欄位的選項
        const cols = (table.columns || []).filter(c => c.dictRef && c.dictRef.tableId && c.dictRef.columnId && !(c.dictRef.tableId === table.id && c.dictRef.columnId === c.id));
        for (const c of cols) {
          await refreshDictOptionsForColumn(c);
        }
      } catch (e) {
        // 靜默失敗，不打擾使用者
      }
    };

    // 立即執行一次，之後每隔一段時間執行
    tick();
    timer = setInterval(tick, pollingIntervalMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [table.id, table.columns]);

  useEffect(() => {
    // 預抓取所有帶有 dictRef 的欄位的字典選項
    (async () => {
      const cols = (table.columns || []).filter(c => c.dictRef && c.dictRef.tableId && c.dictRef.columnId && !(c.dictRef.tableId === table.id && c.dictRef.columnId === c.id));
      for (const c of cols) {
        const key = getDictKey(c);
        if (!key) continue;
        // 若尚未快取或需要刷新，則抓取
        if (!(key in dictOptionsCache)) {
          try {
            const rows = await apiService.getTableRows(c.dictRef!.tableId);
            // 依字典列型別正規化值（日期→ISO），其他保持字串；若字典列為多選，展開陣列中的各項
            const dictTable = allTables.find(t => t.id === c.dictRef!.tableId);
            const dictCol = dictTable?.columns?.find((dc: Column) => dc.id === c.dictRef!.columnId);
            const isDateDict = dictCol?.type === 'date';
            const isMultiSelectDict = dictCol?.type === 'select' && !!dictCol?.isMultiSelect;
            const collect = (val: any): string => {
              if (val === null || val === undefined || val === '') return '';
              if (isDateDict) {
                const d = new Date(String(val));
                return isNaN(d.getTime()) ? '' : d.toISOString();
              }
              return String(val);
            };
            const setVals = new Set<string>();
            for (const r of (rows || [])) {
              const raw = r[c.dictRef!.columnId];
              if (Array.isArray(raw) && isMultiSelectDict) {
                for (const item of raw) {
                  const v = collect(item);
                  if (v) setVals.add(v);
                }
              } else {
                const v = collect(raw);
                if (v) setVals.add(v);
              }
            }
            const values: string[] = Array.from(setVals);
            setDictOptionsCache(prev => ({ ...prev, [key]: values }));
          } catch (e) {
            console.warn('載入字典選項失敗', e);
          }
        }
      }
    })();
  }, [table.columns, allTables]);

  const openColumnConfig = (columnId: string) => {
    const col = table.columns.find(c => c.id === columnId);
    if (!col) return;
    setConfigColumnId(columnId);
    // 确保relation对象结构完整，包含所有必要字段
    const relationConfig = col.relation ? {
      targetTableId: col.relation.targetTableId || '',
      targetColumnId: col.relation.targetColumnId || '',
      displayColumnId: col.relation.displayColumnId || (col.relation.targetColumnId || ''),
      type: col.relation.type || 'single'
    } : undefined;
    
    setConfigForm({
      name: col.name,
      type: col.type,
      options: col.options ? [...col.options] : [''],
      isMultiSelect: !!col.isMultiSelect,
      dictRef: col.dictRef,
      relation: relationConfig
    });
  };

  const saveColumnConfig = async () => {
    if (!configColumnId || !configForm) return;

    // 禁止將关联来源设置为自身表
    if (configForm.relation && configForm.relation.targetTableId === table.id) {
      toast.error('不允許關聯至自身表格');
      return;
    }
    
    // 验证字段类型和名称匹配
    if (configForm.relation && configForm.relation.targetTableId && configForm.relation.targetColumnId) {
      const currentColumn = table.columns.find(c => c.id === configColumnId);
      const targetTable = allTables.find(t => t.id === configForm.relation?.targetTableId);
      const targetColumn = targetTable?.columns.find(c => c.id === configForm.relation?.targetColumnId);
      const currentTypeName = configForm.name.trim() || currentColumn?.name;
      
      if (currentColumn && targetColumn) {
        if (currentColumn.type !== targetColumn.type) {
          toast.error('只能关联相同类型的字段');
          return;
        }
        if (targetColumn.name !== currentTypeName) {
          toast.error('只能关联相同名称的字段');
          return;
        }
      }
    }

    // 先構造更新後的欄位定義
    const updatedColumns = table.columns.map(col =>
      col.id === configColumnId
        ? {
            ...col,
            name: configForm.name.trim() || col.name,
            type: configForm.type,
            options: (() => {
              // 如果有关联字段，清空选项
              if (configForm.relation && configForm.relation.targetTableId && configForm.relation.targetColumnId) return undefined;
              return configForm.type === 'select' ? configForm.options.filter(o => o.trim()) : undefined;
            })(),
            isMultiSelect: configForm.type === 'select' ? !!configForm.isMultiSelect : undefined,
            dictRef: configForm.dictRef, // 保留字典引用
            relation: (configForm.relation && configForm.relation.targetTableId && configForm.relation.targetColumnId) ? {
              ...configForm.relation,
              targetTableId: configForm.relation.targetTableId,
              targetColumnId: configForm.relation.targetColumnId,
              displayColumnId: configForm.relation.displayColumnId || configForm.relation.targetColumnId,
              targetTableName: allTables.find(t => t.id === configForm.relation?.targetTableId)?.name || '未知表格',
              type: configForm.relation.type || 'single'
            } : undefined
          }
        : col
    );

    // 中文註釋：僅當欄位為下拉選擇（單選或多選）時，才執行選項同步邏輯
    const targetOldColumn = table.columns.find(c => c.id === configColumnId);
    const isSelectType = targetOldColumn?.type === 'select';
    const oldOptions: string[] = Array.isArray(targetOldColumn?.options) ? (targetOldColumn?.options as string[]) : [];
    const hasValidRelation = (configForm.type === 'select' && configForm.relation && configForm.relation.targetTableId && configForm.relation.targetColumnId);
    const newOptions: string[] = (configForm.type === 'select' && !hasValidRelation) ? configForm.options.filter(o => o.trim()) : [];

    // 中文註釋：位置對齊映射（方案 A）——舊選項第 i 項映射到新選項第 i 項
    const renameMap: Record<string, string> = {};
    const minLen = Math.min(oldOptions.length, newOptions.length);
    for (let i = 0; i < minLen; i++) {
      const oldOpt = oldOptions[i];
      const newOpt = newOptions[i];
      if (oldOpt !== newOpt) {
        renameMap[oldOpt] = newOpt;
      }
    }

    // 中文註釋：刪除的選項（位置對齊視角）——舊選項中超出新選項長度的尾部項視為刪除
    const deletedOptions: string[] = [];
    for (let i = newOptions.length; i < oldOptions.length; i++) {
      deletedOptions.push(oldOptions[i]);
    }

    // 中文註釋：若存在刪除項，且表格中存在對應引用，提示刪除確認
    let hasDeletedReferences = false;
    if (isSelectType && deletedOptions.length > 0) {
      const targetNewColumn = updatedColumns.find(c => c.id === configColumnId);
      const isMultiSelect = !!targetNewColumn?.isMultiSelect;
      for (const row of table.rows) {
        const v = (row as any)[configColumnId];
        if (isMultiSelect) {
          const arr = Array.isArray(v) ? v : (typeof v === 'string' && v !== '' ? [v] : []);
          if (arr.some(x => deletedOptions.includes(x))) {
            hasDeletedReferences = true;
            break;
          }
        } else {
          if (typeof v === 'string' && deletedOptions.includes(v)) {
            hasDeletedReferences = true;
            break;
          }
        }
      }
    }

    if (hasDeletedReferences) {
      // 中文註釋：僅對「單選」保留保存時確認；多選不再彈窗
      const targetNewColumnConfirm = updatedColumns.find(c => c.id === configColumnId);
      const isMultiSelectConfirm = !!targetNewColumnConfirm?.isMultiSelect;
      if (!isMultiSelectConfirm) {
        const ok = window.confirm('删除后表格中已维护的相关值将被清空，是否继续执行删除操作');
        if (!ok) {
          // 中文註釋：用戶取消刪除，同步流程中止，不保存配置
          return;
        }
      }
    }

    // 中文註釋：構造行數據的更新（僅在 select 類型時進行）
    const targetNewColumn = updatedColumns.find(c => c.id === configColumnId);
    const isMultiSelect = !!targetNewColumn?.isMultiSelect;

    const updatedRows: Row[] = table.rows.map(row => {
      if (!isSelectType) return row;
      const currentVal: any = (row as any)[configColumnId];
      let changed = false;

      if (isMultiSelect) {
        // 中文註釋：多選刪除採用“僅移除被刪選項、保留其他選擇”，並套用重命名映射
        const arr = Array.isArray(currentVal)
          ? currentVal
          : (typeof currentVal === 'string' && currentVal !== '' ? [currentVal] : []);
        const nextArr = arr
          .filter(x => !deletedOptions.includes(x)) // 移除被刪選項
          .map(x => (renameMap[x] !== undefined ? renameMap[x] : x)); // 重命名映射

        // 中文註釋：去重並保持原有順序
        const deduped: string[] = [];
        for (const x of nextArr) {
          if (!deduped.includes(x)) deduped.push(x);
        }

        // 中文註釋：判斷是否變更
        if (JSON.stringify(deduped) !== JSON.stringify(arr)) {
          changed = true;
          return { ...row, [configColumnId]: deduped } as Row;
        }
        return row;
      } else {
        // 中文註釋：單選刪除採用“清空為空字串”，並套用重命名映射
        let nextVal: string = typeof currentVal === 'string' ? currentVal : '';
        if (renameMap[nextVal] !== undefined) {
          nextVal = renameMap[nextVal];
        } else if (deletedOptions.includes(nextVal)) {
          nextVal = '';
        }
        if (nextVal !== (typeof currentVal === 'string' ? currentVal : '')) {
          changed = true;
          return { ...row, [configColumnId]: nextVal } as Row;
        }
        return row;
      }
    });

    // 中文註釋：提取實際變更的行，用於批量持久化。需使用完整行數據以避免覆蓋其他欄位
    const changedRowsFull: Row[] = [];
    const prevChangedRowsFull: Row[] = []; // 新增：保存變更前的行快照以便回滾
    for (let i = 0; i < table.rows.length; i++) {
      const before = table.rows[i];
      const after = updatedRows[i];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changedRowsFull.push(after);
        prevChangedRowsFull.push(before);
      }
    }

    // 中文註釋：先更新本地表格視圖（欄位結構 + 行值同步），提供即時反饋
    const prevColumns = table.columns; // 新增：保存變更前的欄位結構以便回滾
    onUpdateTable({ ...table, columns: updatedColumns, rows: updatedRows });

    // 中文註釋：後端批量持久化（若不可用則逐行更新或僅本地更新）
    try {
      if (onBatchUpdateRows && changedRowsFull.length > 0) {
        await onBatchUpdateRows(table.id, changedRowsFull);
      } else if (onUpdateRow && changedRowsFull.length > 0) {
        for (const r of changedRowsFull) {
          await onUpdateRow(table.id, r.id, r);
        }
      }
      // 新增：設置可回滾的最後一次操作（欄位設定變更）
      onSetLastOperation?.({
        label: `欄位設定變更 | 欄位：${table.columns.find(c => c.id === configColumnId)?.name || configColumnId}，變更筆數：${changedRowsFull.length}`,
        undo: async () => {
          try {
            // 回滾欄位結構
            onUpdateTable({ ...table, columns: prevColumns });
            // 回滾行值（使用批量或逐行）
            if (onBatchUpdateRows && prevChangedRowsFull.length > 0) {
              await onBatchUpdateRows(table.id, prevChangedRowsFull);
            } else if (onUpdateRow && prevChangedRowsFull.length > 0) {
              for (const r of prevChangedRowsFull) {
                await onUpdateRow(table.id, r.id, r);
              }
            }
            toast.success('已回滾欄位設定至上次操作前狀態');
          } catch (e) {
            console.error('回滾欄位設定失敗:', e);
            toast.error('回滾欄位設定失敗');
          }
        }
      });
    } catch (err) {
      console.error('批量持久化失敗:', err);
      toast.error('批量持久化失敗，已回退變更');
      // 中文註釋：持久化失敗則回退本地數據
      onUpdateTable({ ...table, columns: table.columns, rows: table.rows });
      return;
    }

    // 中文註釋：添加单步操作双向关联功能 - 用户只需在一个表中创建关联字段，系统自动在目标表中创建反向关联字段，无需手动操作两次
    if (configForm.relation && configForm.relation.targetTableId && configForm.relation.targetColumnId) {
      try {
        // 找到目标表
        const targetTable = allTables.find(t => t.id === configForm.relation?.targetTableId);
        if (targetTable) {
          // 创建反向关联字段名
          const reverseRelationColumnName = `${table.name}_反向关联`;
          
          // 检查目标表中是否已存在相同名称的字段
          const existingColumn = targetTable.columns.find(col => col.name === reverseRelationColumnName);
          
          if (!existingColumn) {
            // 为目标表创建新的关联字段
            const newReverseColumn = {
              id: `col_${Date.now()}`, // 生成临时ID
              name: reverseRelationColumnName,
              type: 'select',
              options: undefined,
              isMultiSelect: false,
              dictRef: undefined,
              relation: {
                targetTableId: table.id,
                targetColumnId: configColumnId,
                displayColumnId: configColumnId,
                targetTableName: table.name,
                type: 'single'
              }
            };
            
            // 复制目标表并添加新列
            const updatedTargetTable = {
              ...targetTable,
              columns: [...targetTable.columns, newReverseColumn]
            };
            
            // 调用后端API更新目标表
            // 分离表格结构和行数据
            const { rows, ...tableStructure } = updatedTargetTable;
            await apiService.updateTable(updatedTargetTable.id, tableStructure);
            
            // 重新获取所有表，确保UI更新
            const updatedTables = await apiService.getTables();
            setAllTables(Array.isArray(updatedTables) ? updatedTables : []);
            
            toast.success(`已在表「${targetTable.name}」中自动创建反向关联字段，双向关联已完成`);
          }
        }
      } catch (e) {
        console.error('创建反向关联失败:', e);
        // 仅记录错误，不影响主流程
      }
    }
    
    // 中文註釋：收尾與提示
    setConfigColumnId(null);
    setConfigForm(null);
    toast.success('欄位設定已更新');
  };

  const cancelColumnConfig = () => {
    setConfigColumnId(null);
    setConfigForm(null);
  };
  const [searchTerm, setSearchTerm] = useState('');
  // 多選 Popover 專用的本地搜尋字典（每個單元格一個鍵，不影響全局搜尋）
  const [multiSelectSearch, setMultiSelectSearch] = useState<Record<string, string>>({});
  const [multiSelectOpen, setMultiSelectOpen] = useState<Record<string, boolean>>({});
  const [multiSelectDraft, setMultiSelectDraft] = useState<Record<string, string[]>>({});
  const [singleSelectOpen, setSingleSelectOpen] = useState<Record<string, boolean>>({});
  const [singleSelectDraft, setSingleSelectDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<{ [columnId: string]: string }>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [enableMultiTableQuery, setEnableMultiTableQuery] = useState(false);
  
  // 获取与当前行相关联的所有表的数据（包括被动关联）
  const getRelatedTableDataByRow = (currentTableId: string, currentRowId: string): Array<{ table: Table; rows: Row[] }> => {
    if (!allTables || !Array.isArray(allTables)) return [];
    
    const result: Array<{ table: Table; rows: Row[] }> = [];
    
    // 查找所有关联到当前表的其他表
    for (const relatedTable of allTables) {
      if (!relatedTable || !relatedTable.id || relatedTable.id === currentTableId) continue;
      
      // 查找该表中关联到当前表的列
      const relationColumns = relatedTable.columns?.filter((col: Column) => 
        col.relation && col.relation.targetTableId === currentTableId
      ) || [];
      
      if (relationColumns.length > 0 && relatedTable.rows && Array.isArray(relatedTable.rows)) {
        // 查找引用当前行的记录
        const relatedRows = relatedTable.rows.filter((relatedRow: Row) => {
          return relationColumns.some((col: Column) => {
            const cellValue = relatedRow[col.id];
            return cellValue === currentRowId || 
                   (Array.isArray(cellValue) && cellValue.includes(currentRowId));
          });
        });
        
        if (relatedRows.length > 0) {
          result.push({
            table: relatedTable,
            rows: relatedRows
          });
        }
      }
    }
    
    return result;
  };
  
  // 格式化被动关联数据的显示
  const formatPassiveRelationData = (relatedRow: any, targetTable: any): string => {
    if (!relatedRow || !targetTable || !targetTable.columns) return '';
    
    // 找到显示列
    const displayColumn = targetTable.columns.find((col: Column) => 
      // 查找名称为name或title的列，或者第一个非关联列
      col.name === 'name' || col.name === 'title' || !col.relation
    ) || targetTable.columns[0];
    
    const displayValue = relatedRow[displayColumn?.id || 'id'] || '未知';
    
    // 添加其他重要字段
    const otherFields = targetTable.columns
      .filter((col: Column) => col.id !== displayColumn?.id && !col.relation)
      .slice(0, 2)
      .map((col: Column) => {
        const val = relatedRow[col.id];
        return val ? `${col.name}: ${val}` : '';
      })
      .filter(Boolean);
    
    return [displayValue, ...otherFields].join(', ');
  };
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [batchEditColumn, setBatchEditColumn] = useState('');
  const [batchEditValue, setBatchEditValue] = useState('');

  // 获取所有关联表数据的辅助函数
  const getRelatedTableData = (tableId: string) => {
    // 在实际应用中，这里应该通过API获取所有关联表的数据
    // 由于是模拟环境，我们直接返回DataTable组件接收到的allTables数据
    return allTables || [];
  };
  
  // 递归查找关联数据的函数
  const findRelatedData = (row: Row, relationCache: Record<string, any> = {}) => {
    const result = { ...row };
    
    // 查找当前行中的关联字段
    table.columns.forEach(column => {
      if (column.relation && column.relation.targetTableId && column.relation.targetColumnId) {
        const relatedValue = (row as any)[column.id];
        const { targetTableId, targetColumnId } = column.relation;
        if (relatedValue) {
          const relatedTables = getRelatedTableData(targetTableId);
          const relatedTable = relatedTables.find((t: any) => t.id === targetTableId);
          
          if (relatedTable && relatedTable.rows) {
            const relatedRow = relatedTable.rows.find((r: any) => r[targetColumnId] === relatedValue);
            if (relatedRow && !relationCache[`${relatedTable.id}_${relatedRow.id}`]) {
              // 防止循环引用
              relationCache[`${relatedTable.id}_${relatedRow.id}`] = true;
              // 递归查找更深层次的关联数据
              result[`${column.id}_related`] = findRelatedData(relatedRow, relationCache);
            }
          }
        }
      }
    });
    
    return result;
  };
  
  // 控制关联详情弹窗的状态
  const [showRelationDetail, setShowRelationDetail] = useState(false);
  const [selectedRelationData, setSelectedRelationData] = useState<any>(null);
  const [relationDataTitle, setRelationDataTitle] = useState('');
  
  // 处理关联信息点击事件
  const handleRelationClick = (data: any, title: string) => {
    setSelectedRelationData(data);
    setRelationDataTitle(title);
    setShowRelationDetail(true);
  };
  
  // 递归渲染关联数据详情
  const renderRelationDetail = (data: any, level = 0) => {
    if (!data || typeof data !== 'object') return null;
    
    const indent = level * 20;
    
    return Object.entries(data).map(([key, value]) => {
      // 跳过内部关联标识
      if (key.endsWith('_related')) return null;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return (
          <div key={key} className="mb-2">
            <div className="font-medium text-sm" style={{ marginLeft: `${indent}px` }}>
              {key}:
            </div>
            {renderRelationDetail(value, level + 1)}
          </div>
        );
      } else if (Array.isArray(value)) {
        return (
          <div key={key} className="mb-2">
            <div className="font-medium text-sm" style={{ marginLeft: `${indent}px` }}>
              {key}:
            </div>
            {value.map((item, index) => (
              <div key={index} className="ml-4 mb-1">
                {typeof item === 'object' && item !== null ? (
                  renderRelationDetail(item, level + 1)
                ) : (
                  <div style={{ marginLeft: `${indent + 20}px` }}>{String(item)}</div>
                )}
              </div>
            ))}
          </div>
        );
      }
      
      return (
        <div key={key} className="flex text-sm" style={{ marginLeft: `${indent}px` }}>
          <div className="w-24 text-gray-500">{key}:</div>
          <div>{value !== undefined ? String(value) : '未设置'}</div>
        </div>
      );
    });
  };

  // 多表关联搜索的辅助函数
  const searchInRelatedData = (row: Row, searchTerm: string) => {
    // 先检查当前行是否匹配
    const currentRowMatch = Object.values(row).some(value => {
      if (value && typeof value === 'object' && (value as any).name) {
        return String((value as any).name).toLowerCase().includes(searchTerm.toLowerCase());
      }
      return String(value || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    if (currentRowMatch) return true;
    
    // 如果启用了多表关联查询，则检查关联表数据
    if (enableMultiTableQuery) {
      const relationCache: Record<string, any> = {};
      const rowWithRelatedData = findRelatedData(row, relationCache);
      
      // 检查所有关联数据
      const checkAllProperties = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false;
        
        for (const key in obj) {
          if (key.endsWith('_related')) {
            // 检查关联数据的直接属性
            for (const prop in obj[key]) {
              if (prop !== 'id' && !prop.endsWith('_related')) {
                const value = obj[key][prop];
                if (value && typeof value === 'object' && (value as any).name) {
                  if (String((value as any).name).toLowerCase().includes(searchTerm.toLowerCase())) {
                    return true;
                  }
                }
                if (String(value || '').toLowerCase().includes(searchTerm.toLowerCase())) {
                  return true;
                }
              }
            }
            // 递归检查更深层次的关联数据
            if (checkAllProperties(obj[key])) {
              return true;
            }
          }
        }
        return false;
      };
      
      return checkAllProperties(rowWithRelatedData);
    }
    
    return false;
  };
  
  // 幫手：取得當前視圖中的行序號（1 起算）；若被篩掉則回退以原始 rows 順序
  const getDisplayedRowIndex = (rowId: string) => {
    try {
      const filteredRows = (table.rows || []).filter(row => {
        // 搜尋篩選
        if (searchTerm) {
          const searchMatch = searchInRelatedData(row, searchTerm);
          if (!searchMatch) return false;
        }

        // 欄位篩選
        return Object.entries(filters).every(([filterKey, filterValue]) => {
          if (!filterValue || filterValue === '__all__') return true;

          // 範圍篩選（數字 / 日期）
          if (
            filterKey.endsWith('_min') || filterKey.endsWith('_max') ||
            filterKey.endsWith('_start') || filterKey.endsWith('_end')
          ) {
            const columnId = filterKey.replace(/_min|_max|_start|_end$/, '');
            const column = table.columns.find(col => col.id === columnId);
            const cellValue = (row as any)[columnId];

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
          const cellValue = (row as any)[filterKey];
          const column = table.columns.find(col => col.id === filterKey);

          if (!column) return true;

          if (column.type === 'boolean') {
            return String(cellValue) === filterValue;
          } else if (column.type === 'select') {
            return cellValue === filterValue;
          } else {
            if (cellValue && typeof cellValue === 'object' && (cellValue as any).name) {
              return String((cellValue as any).name).toLowerCase().includes(filterValue.toLowerCase());
            }
            return String(cellValue || '').toLowerCase().includes(filterValue.toLowerCase());
          }
        });
      });

      const sortedRows = [...filteredRows];
      if (sortConfig) {
        sortedRows.sort((a, b) => {
          const aVal = (a as any)[sortConfig.key];
          const bVal = (b as any)[sortConfig.key];
          const column = table.columns.find(col => col.id === sortConfig.key);

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
            const strA = String(aVal || '').toLowerCase();
            const strB = String(bVal || '').toLowerCase();
            if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
          }
        });
      }

      const idx = sortedRows.findIndex(r => r.id === rowId);
      if (idx >= 0) return idx + 1;

      const baseIdx = table.rows.findIndex(r => r.id === rowId);
      return baseIdx >= 0 ? baseIdx + 1 : -1;
    } catch {
      return -1;
    }
  };

  // 文件預覽與右鍵選單狀態
  const [fileContextMenu, setFileContextMenu] = useState<{ visible: boolean; x: number; y: number; rowId: string; columnId: string } | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; type?: string; name?: string } | null>(null);

  useEffect(() => {
    const hideMenu = () => setFileContextMenu(null);
    window.addEventListener('click', hideMenu);
    return () => window.removeEventListener('click', hideMenu);
  }, []);
  
  // 欄位寬度調整相關狀態
  const [columnWidths, setColumnWidths] = useState<{ [columnId: string]: number }>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // 文件預覽 & 操作
  const exportFile = (file: any) => {
    if (!file?.url) return;
    const url = file.url.startsWith('http') ? file.url : `${getApiOrigin()}${file.url}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || '';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('已導出本地以供預覽');
  };

  const openFilePreview = (file: any) => {
    if (!file?.url) return;
    const url = file.url.startsWith('http') ? file.url : `${getApiOrigin()}${file.url}`;
    const type: string | undefined = file.type;

    const isImage = (type && type.startsWith('image')) || /\.(png|jpe?g|gif|webp)$/i.test(url);
    const isVideo = (type && type.startsWith('video')) || /\.(mp4|m4v)$/i.test(url);
    const isAudio = (type && type.startsWith('audio')) || /\.(mp3|m4a|wav)$/i.test(url);
    const isPdf = (type && type.includes('pdf')) || /\.pdf$/i.test(url);

    if (isImage || isVideo || isAudio || isPdf) {
      setFilePreview({ url, type, name: file.name });
    } else {
      exportFile(file);
    }
  };

  const fixMojibakeName = (name?: string) => {
    if (!name || typeof name !== 'string') return name || '';
    // Already contains readable CJK
    if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(name)) return name;
    try {
      // If percent-encoded, decode
      if (/%[0-9A-Fa-f]{2}/.test(name)) {
        return decodeURIComponent(name);
      }
    } catch {}
    try {
      // Attempt Latin-1 -> UTF-8 repair (classic mojibake fix)
      // escape() transforms bytes to percent encoding, then decode as UTF-8
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const repaired = decodeURIComponent(escape(name));
      // If repaired contains CJK, prefer it
      if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(repaired)) return repaired;
    } catch {}
    return name;
  };

  const triggerReupload = async (rowId: string, columnId: string) => {
  if (!isAuthenticated()) { toast.error('未登入，禁止上傳'); return; }
    setFileContextMenu(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e: any) => {
      const f: File | undefined = e.target?.files?.[0];
      if (!f) return;
      // 取得上傳前的舊值，以支援撤回
      const prevRow = table.rows.find(r => r.id === rowId);
      const prevValue = prevRow ? (prevRow as any)[columnId] : null;
      try {
        const res = await apiService.uploadFile(table.id, rowId, columnId, f);
        const fileData = res?.file ? { ...res.file, url: res.file.url } : null;
        const updatedRows = table.rows.map(r => r.id === rowId ? { ...r, [columnId]: fileData } : r);
        onUpdateTable({ ...table, rows: updatedRows });
        toast.success('附件已更新');
        // 登記可撤回操作：刪除新檔案並恢復舊值
        onSetLastOperation?.({
          label: `附件重新上傳 | 欄位：${table.columns.find(c => c.id === columnId)?.name || columnId}，行：${getDisplayedRowIndex(rowId)}`,
          undo: async () => {
            try {
              const current = latestTableRef.current;
              // 刪除新上傳附件（清空欄位）
              await apiService.deleteFile(current.id, rowId, columnId);
              // 若存在舊值，恢復舊值到欄位
              if (prevValue) {
                if (onUpdateRow) {
                  await onUpdateRow(current.id, rowId, { [columnId]: prevValue });
                } else {
                  const revertRows = current.rows.map(r => r.id === rowId ? { ...r, [columnId]: prevValue } : r);
                  onUpdateTable({ ...current, rows: revertRows });
                }
              }
              toast.success('已撤回附件重新上傳');
            } catch (e) {
              console.error('撤回附件重新上傳失敗:', e);
              toast.error('撤回附件重新上傳失敗');
            }
          },
          //source: '表格視圖'
        });
      } catch (err) {
        console.error(err);
        toast.error('重新上傳失敗');
      }
    };
    input.click();
  };

  const deleteFileFromCell = async (rowId: string, columnId: string) => {
  if (!isAuthenticated()) { toast.error('未登入，禁止刪除附件'); return; }
    // 記錄刪除前的舊值，以支援撤回
    const prevRow = table.rows.find(r => r.id === rowId);
    const prevValue = prevRow ? (prevRow as any)[columnId] : null;
    try {
      await apiService.deleteFile(table.id, rowId, columnId);
      const updatedRows = table.rows.map(r => r.id === rowId ? { ...r, [columnId]: null } : r);
      onUpdateTable({ ...table, rows: updatedRows });
      toast.success('附件已刪除');
      // 登記可撤回操作：恢復欄位至刪除前附件
      onSetLastOperation?.({
        label: `刪除附件 | 欄位：${table.columns.find(c => c.id === columnId)?.name || columnId}，行：${getDisplayedRowIndex(rowId)}`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            if (prevValue) {
              if (onUpdateRow) {
                await onUpdateRow(current.id, rowId, { [columnId]: prevValue });
              } else {
                const revertRows = current.rows.map(r => r.id === rowId ? { ...r, [columnId]: prevValue } : r);
                onUpdateTable({ ...current, rows: revertRows });
              }
            } else {
              // 若原本為空，僅維持空值
              const revertRows = current.rows.map(r => r.id === rowId ? { ...r, [columnId]: null } : r);
              onUpdateTable({ ...current, rows: revertRows });
            }
            toast.success('已撤回刪除附件');
          } catch (e) {
            console.error('撤回刪除附件失敗:', e);
            toast.error('撤回刪除附件失敗');
          }
        },
        //source: '表格視圖'
      });
    } catch (err) {
      console.error(err);
      toast.error('刪除附件失敗');
    } finally {
      setFileContextMenu(null);
    }
  };

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const isColumnDrag = table.columns.some(col => col.id === active.id);
    const isRowDrag = table.rows.some(row => row.id === active.id);

    if (isColumnDrag) {
      const oldIndex = table.columns.findIndex(col => col.id === active.id);
      const newIndex = table.columns.findIndex(col => col.id === over?.id);

      const prevColumns = table.columns;
      const newColumns = arrayMove(table.columns, oldIndex, newIndex);
      
      await onUpdateTable({
        ...table,
        columns: newColumns
      });
      
      toast.success('欄位順序已更新');

      onSetLastOperation?.({
        label: `欄位順序調整 | ${table.columns.find(c => c.id === String(active.id))?.name || String(active.id)}：${oldIndex} → ${newIndex}`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            onUpdateTable({ ...current, columns: prevColumns });
            toast.success('已回滾欄位順序調整');
          } catch (e) {
            console.error('回滾欄位順序調整失敗:', e);
            toast.error('回滾欄位順序調整失敗');
          }
        },
        //source: '表格視圖'
      });
    } else if (isRowDrag) {
      const hasActiveFilters = Boolean(sortConfig) || Boolean(searchTerm) || Object.keys(filters).length > 0;
      if (hasActiveFilters) {
        toast.error('已開啟排序或篩選時不支持拖拽行順序');
        return;
      }

      const oldIndex = table.rows.findIndex(r => r.id === active.id);
      const newIndex = table.rows.findIndex(r => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const prevRows = table.rows;
      const newRows = arrayMove(prevRows, oldIndex, newIndex);

      await onUpdateTable({
        ...table,
        rows: newRows
      });

      toast.success('行順序已更新');

      onSetLastOperation?.({
        label: `行順序調整 | ID：${String(active.id)}：${oldIndex} → ${newIndex}`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            onUpdateTable({ ...current, rows: prevRows });
            toast.success('已回滾行順序調整');
          } catch (e) {
            console.error('回滾行順序調整失敗:', e);
            toast.error('回滾行順序調整失敗');
          }
        },
        //source: '表格視圖'
      });
    }
  };

  const addColumn = () => {
    if (!newColumn.name.trim()) {
      toast.error('請輸入欄位名稱');
      return;
    }

    // 检查关联字段配置是否有效并验证字段名称和类型匹配
    const validRelation = newColumn.relation && newColumn.relation.targetTableId && newColumn.relation.targetColumnId;
    
    // 如果配置了关联字段，验证字段名称和类型是否匹配
    if (validRelation) {
      const targetTable = allTables.find(t => t.id === newColumn.relation!.targetTableId);
      const targetColumn = targetTable?.columns.find(c => c.id === newColumn.relation!.targetColumnId);
      
      if (targetColumn && (targetColumn.name !== newColumn.name || targetColumn.type !== newColumn.type)) {
        toast.error('關聯字段名稱和類型必須與目標字段完全一致');
        return;
      }
    }
    
    const column: Column = {
      id: Date.now().toString(),
      name: newColumn.name.trim(),
      type: newColumn.type,
      options: newColumn.type === 'select' && !newColumn.dictRef && !validRelation ? newColumn.options.filter(opt => opt.trim()) : undefined,
      // 添加isMultiSelect属性
      isMultiSelect: newColumn.type === 'select' ? newColumn.isMultiSelect : undefined,
      dictRef: newColumn.dictRef,
      // 添加relation属性，确保只有在配置有效的情况下才添加
      relation: validRelation && newColumn.relation ? {
        targetTableId: newColumn.relation.targetTableId,
        targetColumnId: newColumn.relation.targetColumnId,
        displayColumnId: newColumn.relation.displayColumnId || newColumn.relation.targetColumnId,
        type: newColumn.relation.type || 'single'
      } : undefined
    };

    // 本地更新：新增欄位
    onUpdateTable({
      ...table,
      columns: [...table.columns, column]
    });

    // 註冊回滾：移除剛新增的欄位，並從行中刪除其值（僅影響該欄位，不影響其他欄位）
    onSetLastOperation?.({
      label: `新增欄位 | ${column.name}（${column.type}）`,
      undo: async () => {
        try {
          const current = latestTableRef.current;
          const revertedColumns = current.columns.filter(c => c.id !== column.id);
          const revertedRows: Row[] = current.rows.map((row) => {
            const { [column.id]: removed, ...rest } = row as any;
            return rest as Row;
          });
          onUpdateTable({ ...current, columns: revertedColumns, rows: revertedRows });
          toast.success('已回滾欄位新增');
        } catch (e) {
          console.error('回滾欄位新增失敗:', e);
          toast.error('回滾欄位新增失敗');
        }
      }
    });

    // 重置新增字段表单，包括relation属性
    setNewColumn({ name: '', type: 'text', options: [''], isMultiSelect: false, dictRef: undefined, relation: undefined });
    setIsAddColumnOpen(false);
    toast.success('欄位新增成功');
  };

  // 已移除表格視圖的欄位名稱編輯功能

  const deleteColumn = async (columnId: string) => {
    const deletedIndex = table.columns.findIndex(col => col.id === columnId);
    const deletedColumn = table.columns.find(col => col.id === columnId);
    if (!deletedColumn) return;
    
    // 检查哪些其他表格的字段引用了这个要删除的字段
    const referringFields: { tableName: string; columnName: string }[] = [];
    
    // 遍历所有表格查找引用关系
    for (const t of allTables) {
      for (const col of t.columns) {
        if (col.dictRef && col.dictRef.tableId === table.id && col.dictRef.columnId === columnId) {
          referringFields.push({ tableName: t.name || t.id, columnName: col.name || col.id });
        }
      }
    }
    
    // 构建确认对话框消息
    let confirmMessage = `确定要删除「${deletedColumn.name}」字段吗？`;
    confirmMessage += '\n删除后，该字段中的所有数据将被永久删除。';
    
    if (referringFields.length > 0) {
      confirmMessage += '\n\n警告：删除此字段将影响以下字典子表设置：';
      referringFields.forEach(ref => {
        confirmMessage += `\n- ${ref.tableName} 表的 ${ref.columnName} 字段`;
      });
      confirmMessage += '\n\n这些引用字段将失去字典子表设置，但不会清空原有已保存的数据。';
    }
    
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    // 快照刪除前的欄位值（僅保存被刪欄位的各行原值，用於回滾）
    const deletedValuesByRowId: Record<string, any> = {};
    for (const row of table.rows) {
      deletedValuesByRowId[row.id] = (row as any)[columnId];
    }

    // 准备更新的表格数据
    const updatedColumns = table.columns.filter(col => col.id !== columnId);
    const updatedRows: Row[] = table.rows.map(row => {
      const { [columnId]: deleted, ...rest } = row;
      return rest as Row;
    });

    const updatedTable = {
      ...table,
      columns: updatedColumns,
      rows: updatedRows
    };

    // 调用onUpdateTable，这会触发use-tables中的updateTable函数，包含确认对话框逻辑
    await onUpdateTable(updatedTable);

    // 註冊回滾：復原刪除的欄位至原位置，並恢復各行對應值
    onSetLastOperation?.({
      label: `刪除欄位 | ${deletedColumn.name}（索引：${deletedIndex}）`,
      undo: async () => {
        try {
          const current = latestTableRef.current;
          const revertedColumns = [...current.columns];
          const insertIndex = Math.min(Math.max(deletedIndex, 0), revertedColumns.length);
          if (!revertedColumns.some(c => c.id === deletedColumn.id)) {
            revertedColumns.splice(insertIndex, 0, deletedColumn);
          }
          const revertedRows: Row[] = current.rows.map(row => {
            const value = deletedValuesByRowId[row.id];
            return { ...row, [deletedColumn.id]: value } as Row;
          });
          await onUpdateTable({ ...current, columns: revertedColumns, rows: revertedRows });
          toast.success('已回滾欄位刪除');
        } catch (e) {
          console.error('回滾欄位刪除失敗:', e);
          toast.error('回滾欄位刪除失敗');
        }
      }
    });
  };

  const addRow = async () => {
  if (!isAuthenticated()) { toast.error('未登入，禁止新增'); return; }
    try {
      // 新增前，先將當前資料保存到本地資料庫（不顯示成功提示）
      if (onUpdateRow) {
        await Promise.all(
          table.rows.map((row) => onUpdateRow(table.id, row.id, row))
        );
      }

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
              acc[col.id] = '';
              break;
            default:
              acc[col.id] = '';
          }
          return acc;
        }, {} as Record<string, any>)
      };

      // 先更新本地表格視圖
      onUpdateTable({
        ...table,
        rows: [...table.rows, newRow] as Row[]
      });

      // 再持久化新增行，僅顯示一次成功新增提示
      if (onCreateRow) {
        await onCreateRow(table.id, newRow);
      }
      toast.success('成功新增行');

      // 註冊回滾：移除剛新增的行
      onSetLastOperation?.({
        label: `新增行 | ID：${newRow.id}`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            const rows = current.rows.filter(r => r.id !== newRow.id);
            onUpdateTable({ ...current, rows });
            toast.success('已回滾新增行');
          } catch (e) {
            console.error('回滾新增行失敗:', e);
            toast.error('回滾新增行失敗');
          }
        },
        //source: '表格視圖'
      });
    } catch (err) {
      console.error('保存當前資料失敗', err);
      toast.error('保存當前資料失敗');
    }
  };

  const deleteRow = (rowId: string) => {
  if (!isAuthenticated()) { toast.error('未登入，禁止刪除'); return; }
    // 快照：被刪除行與其位置
    const deletedIndex = table.rows.findIndex(r => r.id === rowId);
    const deletedRow = table.rows.find(r => r.id === rowId);

    // 如果有 API 方法，使用 API；否則使用本地更新
    if (onDeleteRow) {
      onDeleteRow(table.id, rowId);
    } else {
      onUpdateTable({
        ...table,
        rows: table.rows.filter(row => row.id !== rowId)
      });
    }

    // 註冊回滾：復原刪除的行（盡量回到原位置）
    if (deletedRow) {
      onSetLastOperation?.({
        label: `刪除行 | ID：${rowId}（索引：${deletedIndex}）`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            const rows = [...current.rows];
            const insertIndex = Math.min(Math.max(deletedIndex, 0), rows.length);
            if (!rows.some(r => r.id === deletedRow.id)) {
              rows.splice(insertIndex, 0, deletedRow);
            }
            onUpdateTable({ ...current, rows });
            toast.success('已回滾刪除行');
          } catch (e) {
            console.error('回滾刪除行失敗:', e);
            toast.error('回滾刪除行失敗');
          }
        },
        //source: '表格視圖'
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
          // 日期类型处理，确保格式正确（使用本地時間格式輸入）
          if (currentValue) {
            const d = new Date(currentValue);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => String(n).padStart(2, '0');
              const y = d.getFullYear();
              const m = pad(d.getMonth() + 1);
              const da = pad(d.getDate());
              const h = pad(d.getHours());
              const mi = pad(d.getMinutes());
              setEditValue(`${y}-${m}-${da}T${h}:${mi}`);
            } else {
              setEditValue('');
            }
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

  const saveEdit = (overrideValue?: any, explicitContext?: { rowId: string; columnId: string }) => {
  if (!isAuthenticated()) { toast.error('未登入，禁止編輯'); return; }
    const ctx = explicitContext || editingCell;
    if (!ctx) return;

    const column = table.columns.find(col => col.id === ctx.columnId);
    if (!column) return;

    // 中文註釋：若提供覆蓋值（例如單選當前改動），優先使用；否則退回使用當前狀態中的 editValue
    let processedValue: any = overrideValue !== undefined ? overrideValue : editValue;
    
    // 根据列类型进行正确的数据类型转换
    if (column.type === 'number') {
      // 数字类型转换 - 确保处理各种边界情况
      if (processedValue === null || processedValue === undefined || processedValue === '') {
        processedValue = 0;
      } else {
        const numValue = parseFloat(String(processedValue));
        processedValue = isNaN(numValue) ? 0 : numValue;
      }
    } else if (column.type === 'boolean') {
      // 布尔值类型转换 - 支持多种输入格式
      const stringValue = typeof processedValue === 'string' ? processedValue : String(processedValue);
      processedValue = stringValue === 'true' || stringValue === '1';
    } else if (column.type === 'date') {
      // 日期类型转换（支持覆蓋值）——允許過去日期；以本地字串保存，避免時區造成日期偏移
      if (processedValue) {
        const raw = Array.isArray(processedValue) ? (processedValue[0] || '') : String(processedValue);
        let stored: string | null = null;
        // 已是標準 'YYYY-MM-DDTHH:mm' 或 'YYYY-MM-DD'，直接保存
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
          const d = new Date(raw);
          stored = isNaN(d.getTime()) ? null : raw;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          const d = new Date(`${raw}T00:00`);
          stored = isNaN(d.getTime()) ? null : raw;
        } else {
          // 其他情況：嘗試解析後以本地時間組字串
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            const y = d.getFullYear();
            const m = pad(d.getMonth() + 1);
            const da = pad(d.getDate());
            const h = pad(d.getHours());
            const mi = pad(d.getMinutes());
            stored = `${y}-${m}-${da}T${h}:${mi}`;
          } else {
            stored = null;
          }
        }
        processedValue = stored;
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
      processedValue = processedValue === null ? '' : processedValue;
    }

    // 獲取要更新的行
    const rowToUpdate = table.rows.find(row => row.id === ctx.rowId);
    if (!rowToUpdate) return;
    // 新增：保存回滾需要的上下文
    const prevRowId = ctx.rowId;
    const prevColumnId = ctx.columnId;
    const prevValue = rowToUpdate[prevColumnId];

    const updatedRowData = {
      ...rowToUpdate,
      [ctx.columnId]: processedValue
    };

    // 优化：先立即更新本地表格数据，提供更好的用户体验
    // 同时调用API以确保数据持久化到服务器
    const updatedRows: Row[] = table.rows.map(row =>
      row.id === ctx.rowId
        ? updatedRowData
        : row
    );
    onUpdateTable({ ...table, rows: updatedRows });

    // 新增：設置可回滾的最後一次操作（單元格編輯）
    onSetLastOperation?.({
      label: `單元格編輯 | 欄位：${column.name}，行：${getDisplayedRowIndex(prevRowId)}，${String(prevValue ?? '')} → ${String(processedValue ?? '')}`,
      undo: async () => {
        try {
          const current = latestTableRef.current;
          if (onUpdateRow) {
            await onUpdateRow(current.id, prevRowId, { [prevColumnId]: prevValue });
          } else {
            const revertRows = current.rows.map(r =>
              r.id === prevRowId ? { ...r, [prevColumnId]: prevValue } : r
            );
            onUpdateTable({ ...current, rows: revertRows });
          }
          toast.success('已回滾單元格編輯');
        } catch (e) {
          console.error('回滾單元格編輯失敗:', e);
          toast.error('回滾單元格編輯失敗');
        }
      },
      //source: '表格視圖'
    });

    // 如果有API方法，调用它进行数据持久化
    if (onUpdateRow) {
      // 只传递实际修改的字段，而不是整个行对象，提高效率
      const fieldData = {
        [ctx.columnId]: processedValue
      };
      
      // 异步调用API并添加错误处理
      (async () => {
        try {
          await onUpdateRow(table.id, ctx.rowId, fieldData);
          console.log('Row updated successfully');
        } catch (error) {
          console.error('Error updating row:', error);
          // 添加错误提示
          toast.error('更新数据失败，请重试');
          
          // 由于更新失败，恢复原始数据
          const originalRows: Row[] = table.rows.map(row => {
            if (row.id === ctx.rowId) {
              const originalValue = row[ctx.columnId];
              return {
                ...row,
                [ctx.columnId]: originalValue
              };
            }
            return row;
          });
          
          // 更新表格数据以显示原始值
          onUpdateTable({ ...table, rows: originalRows });
        }
      })();
    }

    setEditingCell(null);
    setEditValue('');
    setSelectOpen(false);
  };

  const handleFileUpload = async (rowId: string, columnId: string, file: File) => {
  if (!isAuthenticated()) { toast.error('未登入，禁止上傳'); return; }
    try {
      // 上傳前先記錄舊值，以支援撤回
      const prevRow = table.rows.find(r => r.id === rowId);
      const prevValue = prevRow ? (prevRow as any)[columnId] : null;

      // 調用後端 API 上傳文件並更新該列數據
      const result = await apiService.uploadFile(table.id, rowId, columnId, file);
      const fileData = result?.file || {
        name: file.name,
        size: file.size,
        type: file.type,
        url: '',
      };

      // 使用後端返回的可訪問 URL 更新前端狀態
      const updatedRows: Row[] = table.rows.map(row =>
        row.id === rowId
          ? { ...row, [columnId]: fileData }
          : row
      );

      onUpdateTable({ ...table, rows: updatedRows });
      toast.success('檔案上傳成功');

      // 登記可撤回操作：刪除新檔案並恢復舊值
      onSetLastOperation?.({
        label: `附件上傳 | 欄位：${table.columns.find(c => c.id === columnId)?.name || columnId}，行：${getDisplayedRowIndex(rowId)}`,
        undo: async () => {
          try {
            const current = latestTableRef.current;
            // 刪除新上傳附件（清空欄位）
            await apiService.deleteFile(current.id, rowId, columnId);
            // 若存在舊值，恢復舊值到欄位
            if (prevValue) {
              if (onUpdateRow) {
                await onUpdateRow(current.id, rowId, { [columnId]: prevValue });
              } else {
                const revertRows = current.rows.map(r => r.id === rowId ? { ...r, [columnId]: prevValue } : r);
                onUpdateTable({ ...current, rows: revertRows });
              }
            }
            toast.success('已撤回附件上傳');
          } catch (e) {
            console.error('撤回附件上傳失敗:', e);
            toast.error('撤回附件上傳失敗');
          }
        },
        //source: '表格視圖'
      });
    } catch (error) {
      console.error('File upload failed:', error);
      toast.error('檔案上傳失敗');
    }
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

  const batchDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要刪除的資料');
      return;
    }

    // 新增：記錄刪除前的行資料以便回滾
    const rowsToDelete = table.rows.filter(row => selectedRows.has(row.id));

    try {
      // 优先使用API进行批量删除
      if (onDeleteRow) {
        // 循环删除每一行，直到有批量删除API
        const deletePromises = Array.from(selectedRows).map(rowId => 
          onDeleteRow(table.id, rowId)
        );
        await Promise.all(deletePromises);
      } else {
        // 备用：更新本地表格数据
        const updatedRows: Row[] = table.rows.filter(row => !selectedRows.has(row.id));
        onUpdateTable({ ...table, rows: updatedRows });
      }
      setSelectedRows(new Set());
      toast.success(`已刪除 ${rowsToDelete.length} 筆資料`);

      // 新增：設置可回滾的最後一次操作（批量刪除）
      onSetLastOperation?.({
        label: `批量刪除 | 筆數：${rowsToDelete.length}`,
        undo: async () => {
          try {
            if (onCreateRow) {
              for (const r of rowsToDelete) {
                await onCreateRow(table.id, r);
              }
            } else {
              onUpdateTable({ ...table, rows: [...table.rows, ...rowsToDelete] });
            }
            toast.success('已回滾批量刪除');
          } catch (e) {
            console.error('回滾批量刪除失敗:', e);
            toast.error('回滾批量刪除失敗');
          }
        }
      });
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除操作失败');
    }
  };

  const batchEdit = async () => {
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

    try {
      // 先拍快照：記錄所選行在該欄位的原始值，供回滾使用
      const selectedIds = Array.from(selectedRows);
      const revertMap: Record<string, any> = {};
      for (const row of table.rows) {
        if (selectedRows.has(row.id)) {
          revertMap[row.id] = row[batchEditColumn];
        }
      }

      // 优先使用API进行批量更新
      if (onUpdateRow) {
        const fieldData = { [batchEditColumn]: processedValue };
        // 循环更新每一行
        const updatePromises = selectedIds.map(rowId => 
          onUpdateRow(table.id, rowId, fieldData)
        );
        await Promise.all(updatePromises);
      } else {
        // 备用：更新本地表格数据
        const updatedRows: Row[] = table.rows.map(row =>
          selectedRows.has(row.id)
            ? { ...row, [batchEditColumn]: processedValue }
            : row
        );
        onUpdateTable({ ...table, rows: updatedRows });
      }
      setSelectedRows(new Set());
      setBatchEditColumn('');
      setBatchEditValue('');
      setIsBatchEditOpen(false);
      toast.success(`已更新 ${selectedIds.length} 筆資料`);

      // 註冊回滾：批量編輯
      onSetLastOperation?.({
        label: `批量編輯 | 欄位：${table.columns.find(c => c.id === batchEditColumn)?.name || batchEditColumn}，筆數：${selectedIds.length}，值：${String(processedValue ?? '')}`,
        undo: async () => {
          try {
            const currentTable = latestTableRef.current || table;
            if (onUpdateRow) {
              // 使用API逐筆回滾
              const revertPromises = selectedIds.map(rowId => {
                const originalValue = revertMap[rowId];
                return onUpdateRow(currentTable.id, rowId, { [batchEditColumn]: originalValue });
              });
              await Promise.all(revertPromises);
            } else {
              // 本地回滾
              const revertedRows: Row[] = currentTable.rows.map(row =>
                selectedIds.includes(row.id)
                  ? { ...row, [batchEditColumn]: revertMap[row.id] }
                  : row
              );
              onUpdateTable({ ...currentTable, rows: revertedRows });
            }
            toast.success('已回滾批量編輯');
          } catch (err) {
            console.error('批量編輯回滾失敗:', err);
            toast.error('批量編輯回滾失敗');
          }
        },
        //source: '表格視圖',
      });
    } catch (error) {
      console.error('批量更新失败:', error);
      toast.error('批量更新操作失败');
    }
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

  const batchDuplicate = async () => {
    if (selectedRows.size === 0) {
      toast.error('請選擇要複製的資料');
      return;
    }

    const selectedRowsData = table.rows.filter(row => selectedRows.has(row.id));
    const duplicatedRows: Row[] = selectedRowsData.map(row => ({
      ...row,
      id: `${Date.now()}-${Math.random()}`,
    }));

    try {
      // 优先使用API创建新行
      if (onCreateRow) {
        const createPromises = duplicatedRows.map(row => 
          onCreateRow(table.id, row)
        );
        await Promise.all(createPromises);
      } else {
        // 备用：更新本地表格数据
        onUpdateTable({
          ...table,
          rows: [...table.rows, ...duplicatedRows]
        });
      }

      setSelectedRows(new Set());
      toast.success(`已複製 ${selectedRowsData.length} 筆資料`);

      // 新增：設置可回滾的最後一次操作（批量複製）
      onSetLastOperation?.({
        label: `批量複製 | 筆數：${selectedRowsData.length}`,
        undo: async () => {
          try {
            if (onDeleteRow) {
              for (const r of duplicatedRows) {
                await onDeleteRow(table.id, r.id);
              }
            } else {
              const remaining = table.rows.filter(r => !duplicatedRows.some(d => d.id === r.id));
              onUpdateTable({ ...table, rows: remaining });
            }
            toast.success('已回滾批量複製');
          } catch (e) {
            console.error('回滾批量複製失敗:', e);
            toast.error('回滾批量複製失敗');
          }
        }
      });
    } catch (error) {
      console.error('批量复制失败:', error);
      toast.error('批量复制操作失败');
    }
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
        // 確保布林值立即持久化，避免 onBlur 未觸發造成未保存
        const stringValue = typeof editValue === 'string' ? editValue : String(editValue);
        const isChecked = stringValue === 'true' || stringValue === '1';
        return (
          <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => saveEdit(checked)}
              autoFocus
            />
          </div>
        );
      } else if (column.type === 'select') {
        const columnOptions = getSelectOptions(column);
        // 检查是否为多选模式
        if (column.isMultiSelect) {
          // 多選模式 — 使用下拉選單顯示可勾選選項
          const selectedValues = editValue ? (Array.isArray(editValue) ? editValue.map(String) : [String(editValue)]) : [];
          const isAllSelected = selectedValues.length === columnOptions.length;

          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Popover open={!!multiSelectOpen[`${row.id}:${column.id}`]} onOpenChange={(open) => {
                setMultiSelectOpen(prev => ({ ...prev, [`${row.id}:${column.id}`]: open }));
                if (!open) {
                  // 關閉時退出編輯模式並清理草稿
                  setEditingCell(null);
                  setMultiSelectSearch(prev => {
                    const key = `${row.id}:${column.id}`;
                    const cp = { ...prev };
                    delete cp[key];
                    return cp;
                  });
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-between">
                    <span className="truncate">
                      {selectedValues.length > 0 ? `已選 ${selectedValues.length} 項` : '請選擇選項'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜尋選項..."
                      value={multiSelectSearch[`${row.id}:${column.id}`] || ''}
                      onChange={(e) => setMultiSelectSearch(prev => ({ ...prev, [`${row.id}:${column.id}`]: e.target.value }))}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto space-y-2">
                     {columnOptions
                       .filter((opt) => {
                         const term = (multiSelectSearch[`${row.id}:${column.id}`] || '').toLowerCase();
                         return !term || String(opt).toLowerCase().includes(term);
                       })
                       .map((option, index) => {
                          const checked = selectedValues.includes(option);
                          return (
                            <label
                              key={option}
                              className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer"
                              onClick={() => {
                                const next = checked
                                  ? selectedValues.filter(v => v !== option)
                                  : [...selectedValues, option];
                                setEditValue(next);
                              }}
                            >
                              <Checkbox
                                 checked={checked}
                                 onCheckedChange={(c) => {
                                   const next = c
                                     ? [...selectedValues, option]
                                     : selectedValues.filter(v => v !== option);
                                   setEditValue(next);
                                 }}
                               />
                              <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                              <span className="text-xs">{option}</span>
                            </label>
                          );
                        })}
                   </div>
                   <div className="flex items-center justify-end gap-4 border-t pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditValue([]);
                          setMultiSelectSearch(prev => {
                            const key = `${row.id}:${column.id}`;
                            const cp = { ...prev };
                            delete cp[key];
                            return cp;
                          });
                        }}
                      >
                        重置
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          saveEdit(); 
                          setMultiSelectOpen(prev => ({ ...prev, [`${row.id}:${column.id}`]: false }));
                          setEditingCell(null);
                          toast.success('選項已更新'); 
                        }}
                      >
                        確認
                      </Button>
                    </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        } else {
          // 單選模式（改為 Popover + 草稿 + 確認/重置，點擊整列即可選）
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Popover open={!!singleSelectOpen[`${row.id}:${column.id}`]} onOpenChange={(open) => {
                setSingleSelectOpen(prev => ({ ...prev, [`${row.id}:${column.id}`]: open }));
                if (!open) {
                  // 關閉時退出編輯模式並清理草稿
                  setEditingCell(null);
                  setMultiSelectSearch(prev => {
                    const key = `${row.id}:${column.id}`;
                    const cp = { ...prev };
                    delete cp[key];
                    return cp;
                  });
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-between">
                    <span className="truncate">{typeof editValue === 'string' && editValue ? editValue : '請選擇選項'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜尋選項..."
                      value={multiSelectSearch[`${row.id}:${column.id}`] || ''}
                      onChange={(e) => setMultiSelectSearch(prev => ({ ...prev, [`${row.id}:${column.id}`]: e.target.value }))}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto space-y-2">
                    {columnOptions
                      .filter((opt) => {
                        const term = (multiSelectSearch[`${row.id}:${column.id}`] || '').toLowerCase();
                        return !term || String(opt).toLowerCase().includes(term);
                      })
                      .map((option, index) => {
                        const checked = (typeof editValue === 'string' ? editValue : '') === option;
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer"
                            onClick={() => setEditValue(option)}
                          >
                            <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                            <span className="text-xs">{option}</span>
                          </label>
                        );
                      })}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditValue('');
                        }}
                      >
                        清空
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const saved = typeof value === 'string' ? value : '';
                          setEditValue(saved);
                          setMultiSelectSearch(prev => {
                            const key = `${row.id}:${column.id}`;
                            const cp = { ...prev };
                            delete cp[key];
                            return cp;
                          });
                        }}
                      >
                        重置
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const finalVal = typeof editValue === 'string' ? editValue : '';
                          saveEdit(finalVal);
                          setSingleSelectOpen(prev => ({ ...prev, [`${row.id}:${column.id}`]: false }));
                          setEditingCell(null);
                          toast.success('選項已更新');
                        }}
                      >
                        確認
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
        const hasValidDict = !!(column.dictRef && column.dictRef.tableId && column.dictRef.columnId);
        const typeStr = String(column.type);
        if (hasValidDict && typeStr !== 'file' && typeStr !== 'boolean') {
          // 取得字典欄位資訊，判斷是否為日期型字典
          const dictTable = allTables.find(t => t.id === column.dictRef?.tableId);
          const dictCol = dictTable?.columns?.find((dc: Column) => dc.id === column.dictRef?.columnId);
          const isDateDict = dictCol?.type === 'date';

          // 構建選項列表
          const columnOptions = getSelectOptions(column);

          // 綁定值正規化：日期型字典改為 ISO 以便與選項匹配
          const currentRaw = String((row as any)[column.id] ?? '');
          let effectiveValue = currentRaw;
          if (isDateDict) {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(currentRaw)) {
              const d = new Date(currentRaw);
              effectiveValue = isNaN(d.getTime()) ? currentRaw : d.toISOString();
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(currentRaw)) {
              const d = new Date(`${currentRaw}T00:00`);
              effectiveValue = isNaN(d.getTime()) ? currentRaw : d.toISOString();
            }
          }

          const formatLabel = (v: string) => {
            if (!isDateDict) return v;
            const d = new Date(v);
            return isNaN(d.getTime()) ? v : d.toLocaleString();
          };

          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Select 
                value={effectiveValue}
                onValueChange={(val) => {
                  setEditValue(val);
                  saveEdit(val);
                  toast.success('值已更新');
                }}
              >
                <SelectTrigger className="h-8 w-full" onClick={(e) => { e.stopPropagation(); refreshAllTables(); refreshDictOptionsForColumn(column); }}>
                  <SelectValue placeholder="請選擇字典值" />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()}>
                  {isDateDict && (
                    <div className="p-2 border-b">
                      <div className="text-xs text-muted-foreground mb-1">自訂日期時間</div>
                      <Input
                        type="datetime-local"
                        className="h-8 w-full"
                        value={(function(){
                          const d = new Date(currentRaw);
                          if (!isNaN(d.getTime())) {
                            const ys = d.getFullYear();
                            const ms = String(d.getMonth()+1).padStart(2,'0');
                            const ds = String(d.getDate()).padStart(2,'0');
                            const hs = String(d.getHours()).padStart(2,'0');
                            const mins = String(d.getMinutes()).padStart(2,'0');
                            return `${ys}-${ms}-${ds}T${hs}:${mins}`;
                          }
                          return typeof editValue === 'string' ? editValue : '';
                        })()}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                        }}
                      />
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="mt-2 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = typeof editValue === 'string' ? editValue : '';
                          const d = new Date(v);
                          const iso = isNaN(d.getTime()) ? '' : d.toISOString();
                          if (iso) {
                            setEditValue(iso);
                            saveEdit(iso);
                            toast.success('日期已更新');
                            setEditingCell(null);
                          } else {
                            toast.error('請輸入有效日期');
                          }
                        }}
                      >
                        使用自訂
                      </Button>
                    </div>
                  )}

                  {!isDateDict && (
                    <div className="p-2 border-b">
                      <div className="text-xs text-muted-foreground mb-1">自訂輸入</div>
                      <Input
                        type={
                          column.type === 'number' ? 'number' :
                          column.type === 'email' ? 'email' :
                          column.type === 'phone' ? 'tel' :
                          column.type === 'url' ? 'url' : 'text'
                        }
                        className="h-8 w-full"
                        value={typeof editValue === 'string' ? editValue : String(editValue ?? '')}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                      <Button
                        variant="default"
                        size="sm"
                        className="mt-2 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = typeof editValue === 'string' ? editValue : String(editValue ?? '');
                          saveEdit(v);
                          toast.success('值已更新');
                          setEditingCell(null);
                        }}
                      >
                        使用自訂
                      </Button>
                    </div>
                  )}

                  {columnOptions.map((option) => (
                    <SelectItem key={option} value={option} onClick={(e) => e.stopPropagation()}>
                      {formatLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        return (
          <Input
            // 添加空值检查，修复类型错误
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={(e) => saveEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(editValue);
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
            // 允许输入0和负数
            min={column.type === 'number' ? '-999999' : undefined}
            autoFocus
          />
        );
      }
    }

    // 获取关联数据的辅助函数
    const getRelationData = () => {
      if (!column.relation || !column.relation.targetTableId || !column.relation.targetColumnId) return null;
      
      const cacheKey = `${column.relation.targetTableId}_${column.relation.targetColumnId}`;
      // 优先从relationCache获取数据
      return relationCache[cacheKey] || null;
    };
    
    // 获取多级关联数据的辅助函数
    const getRelatedTableData = (targetTableId: string) => {
      return allTables.find(t => t.id === targetTableId);
    };
    
    // 格式化多表关联数据的显示
    const formatMultiTableData = (relatedData: any) => {
      if (!relatedData || typeof relatedData !== 'object') return '';
      
      // 处理订单信息
      if (relatedData.amount || relatedData.orderDate) {
        let result = '';
        if (relatedData.amount) result += `金額 ${relatedData.amount} 元`;
        if (relatedData.orderDate) {
          result += result ? `，日期 ${new Date(relatedData.orderDate).toLocaleDateString()}` : `日期 ${new Date(relatedData.orderDate).toLocaleDateString()}`;
        }
        // 处理嵌套的产品信息
        if (relatedData.products && Array.isArray(relatedData.products) && relatedData.products.length > 0) {
          result += `，產品：${relatedData.products.map((p: any) => p.name || '未知').join(', ')}`;
        }
        return result;
      }
      
      // 处理产品信息
      if (relatedData.name || relatedData.stock) {
        let result = '';
        if (relatedData.name) result += `${relatedData.name}`;
        if (relatedData.stock !== undefined) {
          result += result ? `，庫存 ${relatedData.stock} 台` : `庫存 ${relatedData.stock} 台`;
        }
        return result;
      }
      
      // 默认处理
      const values = Object.entries(relatedData)
        .filter(([key, val]) => val !== null && val !== undefined && val !== '')
        .map(([key, val]) => `${val}`)
        .slice(0, 3); // 最多显示3个属性
      return values.join(', ');
    };
    
    // 获取格式化的关联数据显示值
    const getFormattedRelationValue = () => {
      // 检查值是否已经是后端返回的格式化数据
      if (value && typeof value === 'object' && value.displayValue !== undefined) {
        return Array.isArray(value) ? value : [value];
      }
      
      // 否则使用传统方式处理
      return Array.isArray(value) ? value : (value ? [value] : []);
    };



    // /显示不同列类型的逻辑
    const renderCellContent = () => {
      if (column.type === 'relation' || column.relation) {
        const relationData = getRelationData();
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
        // 确保displayColumnId始终是一个有效的字符串
        const displayColumnId = column.relation?.displayColumnId || column.relation?.targetColumnId || 'id';
        
        // 编辑模式
        if (isEditing) {
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Popover open={true} onOpenChange={() => {}}>
                <PopoverTrigger asChild>
                  <div>
                    <Input
                      value={Array.isArray(editValue) ? editValue.join(', ') : editValue || ''}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="請選擇關聯記錄"
                      readOnly
                      className="cursor-pointer"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 max-h-96 overflow-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="max-h-64 overflow-auto space-y-2">
                    {relationData?.map((item: any) => {
                      const itemId = item[column.relation?.targetColumnId || 'id'];
                      const displayValue = item[displayColumnId];
                      const isChecked = column.relation?.type === 'multiple' 
                        ? Array.isArray(editValue) && editValue.includes(String(itemId))
                        : editValue === String(itemId);
                      
                      return (
                        <label
                          key={itemId}
                          className={`flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer ${
                            isChecked ? 'bg-primary/10 border border-primary/20' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (column.relation?.type === 'multiple') {
                              const current = Array.isArray(editValue) ? editValue : [];
                              const newValue = isChecked
                                ? current.filter(v => v !== String(itemId))
                                : [...current, String(itemId)];
                              setEditValue(newValue);
                            } else {
                              setEditValue(String(itemId));
                            }
                          }}
                        >
                          {column.relation?.type === 'multiple' && (
                            <Checkbox checked={isChecked} />
                          )}
                          <span className="text-sm">{displayValue || itemId}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        }
        
        // 显示模式
        const relationValues = getFormattedRelationValue();
        
        if (column.relation?.type === 'multiple') {
          // 多选模式
        return (
          <div className="max-w-full">
            {relationValues.length > 0 ? (
              relationValues.map((val: any) => {
                // 检查是否是后端返回的格式化数据
                if (val && typeof val === 'object' && val.displayValue !== undefined) {
                  // 多表关联模式下显示更多信息
                  if (enableMultiTableQuery) {
                    // 获取被动关联数据
                    const passiveRelatedData = getRelatedTableDataByRow(table.id, row.id);
                    
                    return (
                      <div key={val.id || val.value} className="mb-2">
                        <span 
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 border border-primary/20 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => handleRelationClick(val, val.displayValue)}
                        >
                          {val.displayValue}
                        </span>
                        
                        {/* 显示主动关联数据 */}
                        {val.relatedData && val.relatedData.map((relatedItem: any, index: number) => (
                          <div 
                            key={`active-${index}`} 
                            className="text-xs text-muted-foreground pl-4 border-l-2 border-primary/30 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleRelationClick(relatedItem, `${val.displayValue} 的关联数据`)}
                          >
                            {formatMultiTableData(relatedItem)}
                          </div>
                        ))}
                        
                        {/* 显示被动关联数据 */}
                        {passiveRelatedData && passiveRelatedData.length > 0 && (
                          <div className="mt-1">
                            <div className="text-xs font-medium text-muted-foreground">
                              <span className="text-primary/80">被引用数据:</span>
                            </div>
                            {passiveRelatedData.map((relatedTable: any, tableIndex: number) => (
                              <div key={`passive-table-${tableIndex}`} className="mt-1">
                                <div className="text-xs text-muted-foreground font-medium">
                                  {relatedTable.table.name || relatedTable.table.id}
                                </div>
                                {relatedTable.rows.slice(0, 3).map((relatedItem: any, rowIndex: number) => (
                                  <div 
                                    key={`passive-${tableIndex}-${rowIndex}`} 
                                    className="text-xs text-muted-foreground pl-4 border-l-2 border-secondary/30 cursor-pointer hover:text-secondary transition-colors"
                                    onClick={() => handleRelationClick(relatedItem, `引用此记录的数据`)}
                                  >
                                    {formatPassiveRelationData(relatedItem, relatedTable.table)}
                                  </div>
                                ))}
                                {relatedTable.rows.length > 3 && (
                                  <div className="text-xs text-muted-foreground pl-4 italic">
                                    ... 还有 {relatedTable.rows.length - 3} 条未显示
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <span key={val.id || val.value} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 border border-primary/20 text-primary m-1">
                      {val.displayValue}
                    </span>
                  );
                }
                
                // 传统方式处理
                const relatedItem = relationData?.find((item: any) => 
                  String(item[column.relation?.targetColumnId || 'id']) === String(val)
                );
                const displayText = relatedItem ? relatedItem[displayColumnId] : val;
                
                // 获取被动关联数据
                const passiveRelatedData = enableMultiTableQuery ? getRelatedTableDataByRow(table.id, row.id) : null;
                
                // 多表关联模式下显示更多信息
                if (enableMultiTableQuery) {
                  const hasActiveRelation = relatedItem && Object.keys(relatedItem).length > 0;
                  const hasPassiveRelation = passiveRelatedData && passiveRelatedData.length > 0;
                  
                  if (hasActiveRelation || hasPassiveRelation) {
                    return (
                      <div key={val} className="mb-2">
                        {/* 显示主动关联数据 */}
                        {hasActiveRelation && (
                          <>
                            <span 
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 border border-primary/20 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={() => handleRelationClick(relatedItem, displayText || '关联数据')}
                            >
                              {displayText || '未找到关联数据'}
                            </span>
                            <div 
                              className="text-xs text-muted-foreground pl-4 border-l-2 border-primary/30 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleRelationClick(relatedItem, `${displayText || '关联数据'} 的详细信息`)}
                            >
                              {formatMultiTableData(relatedItem)}
                            </div>
                          </>
                        )}
                        
                        {/* 显示被动关联数据 */}
                        {hasPassiveRelation && (
                          <>
                            <div className="mt-1 text-xs font-medium text-muted-foreground">
                              <span className="text-primary/80">被引用数据:</span>
                            </div>
                            {passiveRelatedData.map((relatedTable: any, tableIndex: number) => (
                              <div key={`passive-table-${tableIndex}`} className="mt-1">
                                <div className="text-xs text-muted-foreground font-medium">
                                  {relatedTable.table.name || relatedTable.table.id}
                                </div>
                                {relatedTable.rows.slice(0, 3).map((relatedItem: any, rowIndex: number) => (
                                  <div 
                                    key={`passive-${tableIndex}-${rowIndex}`} 
                                    className="text-xs text-muted-foreground pl-4 border-l-2 border-secondary/30 cursor-pointer hover:text-secondary transition-colors"
                                    onClick={() => handleRelationClick(relatedItem, `引用此记录的数据`)}
                                  >
                                    {formatPassiveRelationData(relatedItem, relatedTable.table)}
                                  </div>
                                ))}
                                {relatedTable.rows.length > 3 && (
                                  <div className="text-xs text-muted-foreground pl-4 italic">
                                    ... 还有 {relatedTable.rows.length - 3} 条未显示
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  }
                }
                
                return (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 border border-primary/20 text-primary m-1">
                    {formatMultiTableData(relatedItem) || '未找到关联数据'}
                  </span>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground italic">未設置</span>
            )}
          </div>
          );
        } else {
          // 单选模式
          const val = relationValues[0];
          
          // 检查是否是后端返回的格式化数据
          if (val && typeof val === 'object' && val.displayValue !== undefined) {
            // 多表关联模式下显示更多信息
            if (enableMultiTableQuery) {
              // 获取被动关联数据
              const passiveRelatedData = getRelatedTableDataByRow(table.id, row.id);
              
              return (
                <div className="space-y-1">
                  <span 
                    className="text-sm text-primary font-medium cursor-pointer hover:underline"
                    onClick={() => handleRelationClick(val, val.displayValue)}
                  >
                    {val.displayValue}
                  </span>
                  
                  {/* 显示主动关联数据 */}
                  {val.relatedData && val.relatedData.map((relatedItem: any, index: number) => (
                    <div 
                      key={`active-${index}`} 
                      className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/30 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleRelationClick(relatedItem, `${val.displayValue} 的关联数据`)}
                    >
                      {formatMultiTableData(relatedItem)}
                    </div>
                  ))}
                  
                  {/* 显示被动关联数据 */}
                  {passiveRelatedData && passiveRelatedData.length > 0 && (
                    <div className="mt-1 text-xs font-medium text-muted-foreground">
                      <span className="text-primary/80">被引用数据:</span>
                    </div>
                  )}
                  {passiveRelatedData && passiveRelatedData.map((relatedItem: any, index: number) => (
                    <div 
                      key={`passive-${index}`} 
                      className="text-xs text-muted-foreground pl-2 border-l-2 border-secondary/30 cursor-pointer hover:text-secondary transition-colors"
                      onClick={() => handleRelationClick(relatedItem, `引用此记录的数据`)}
                    >
                      {formatPassiveRelationData(relatedItem, {})}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <span className="text-sm text-primary">
                {val.displayValue}
              </span>
            );
          }
          
          // 传统方式处理
          if (val && relationData) {
            const relatedItem = relationData.find((item: any) => 
              String(item[column.relation?.targetColumnId || 'id']) === String(val)
            );
            const displayText = relatedItem ? relatedItem[displayColumnId] : val;
            
            // 多表关联模式下显示更多信息
            if (enableMultiTableQuery && relatedItem && Object.keys(relatedItem).length > 0) {
              // 获取被动关联数据
              const passiveRelatedData = getRelatedTableDataByRow(table.id, row.id);
              
              return (
                <div className="space-y-1">
                  <span 
                    className="text-sm text-primary font-medium cursor-pointer hover:underline"
                    onClick={() => handleRelationClick(relatedItem, displayText || '关联数据')}
                  >
                    {displayText || '未找到关联数据'}
                  </span>
                  
                  {/* 显示关联数据的摘要信息 */}
                  <div 
                    className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/30 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleRelationClick(relatedItem, `${displayText || '关联数据'} 的详细信息`)}
                  >
                    {formatMultiTableData(relatedItem)}
                  </div>
                  
                  {/* 显示被动关联数据 */}
                  {passiveRelatedData && passiveRelatedData.length > 0 && (
                    <div className="mt-1 text-xs font-medium text-muted-foreground">
                      <span className="text-primary/80">被引用数据:</span>
                    </div>
                  )}
                  {passiveRelatedData && passiveRelatedData.map((relatedItem: any, index: number) => (
                    <div 
                      key={`passive-${index}`} 
                      className="text-xs text-muted-foreground pl-2 border-l-2 border-secondary/30 cursor-pointer hover:text-secondary transition-colors"
                      onClick={() => handleRelationClick(relatedItem, `引用此记录的数据`)}
                    >
                      {formatPassiveRelationData(relatedItem, {})}
                    </div>
                  ))}
                </div>
              );
            }
            
            return (
              <span className="text-sm text-primary">
                {displayText || '未找到关联数据'}
              </span>
            );
          }
          return <span className="text-sm text-muted-foreground italic">未設置</span>;
        }
      } else if (column.type === 'boolean') {
        return (
          <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={Boolean(value)}
              onCheckedChange={(checked) => {
                saveEdit(checked, { rowId: row.id, columnId: column.id });
              }}
            />
          </div>
        );
      } else if (column.type === 'file' && value) {
        return (
          <div
            className="flex items-center gap-2 text-sm"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFileContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId: row.id, columnId: column.id });
            }}
          >
            <File className="w-4 h-4 text-blue-500" />
            <a 
              href={value.url?.startsWith('http') ? value.url : `${getApiOrigin()}${value.url}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline truncate max-w-[180px]"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                openFilePreview(value);
              }}
            >
              {fixMojibakeName(value.name)}
            </a>

            {fileContextMenu?.visible && fileContextMenu.rowId === row.id && fileContextMenu.columnId === column.id && (
              <div
                className="z-50 bg-popover border rounded shadow text-sm p-1"
                style={{ position: 'fixed', top: fileContextMenu.y, left: fileContextMenu.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="block w-full text-left px-3 py-1 hover:bg-muted" onClick={() => triggerReupload(row.id, column.id)}>
                  重新上傳
                </button>
                <button className="block w-full text-left px-3 py-1 hover:bg-muted text-red-600" onClick={() => deleteFileFromCell(row.id, column.id)}>
                  刪除附件
                </button>
              </div>
            )}
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
        // 处理日期类型，使用更友好的格式显示（到分鐘）
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            // 格式化日期为 YYYY-MM-DD HH:mm
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return <span className="text-sm">{`${year}-${month}-${day} ${hours}:${minutes}`}</span>;
          }
        } catch (error) {
          console.error('Invalid date format:', error);
        }
        // 如果日期无效，回退到简单替换T为空格（仍可能含秒）
        return <span className="text-sm">{String(value).replace('T', ' ')}</span>;
      } else if (column.type === 'select') {
        const columnOptions = getSelectOptions(column);
        // 检查是否为多选模式
        if (column.isMultiSelect) {
          // 多選模式（檢視狀態）：用下拉選單提供勾選，避免在單元格內直接操作
          const selectedValues = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Popover open={!!multiSelectOpen[`${row.id}:${column.id}`]} onOpenChange={(open) => {
                   setMultiSelectOpen(prev => ({ ...prev, [`${row.id}:${column.id}`]: open }));
                   const key = `${row.id}:${column.id}`;
                   if (open) {
                     const current = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
                     setMultiSelectDraft(prev => ({ ...prev, [key]: current }));
                   } else {
                     setMultiSelectDraft(prev => { const cp = { ...prev }; delete cp[key]; return cp; });
                   }
                 }}>
                 <PopoverTrigger asChild>
                   <div className="min-h-[28px] flex items-center gap-1 flex-wrap cursor-pointer hover:bg-muted/50 rounded px-2">
                     {(multiSelectOpen[`${row.id}:${column.id}`] && multiSelectDraft[`${row.id}:${column.id}`]?.length)
                       ? multiSelectDraft[`${row.id}:${column.id}`]!.map((displayVal) => {
                           if (columnOptions?.includes(displayVal)) {
                             const optionIndex = columnOptions.indexOf(displayVal);
                             const colorClass = getOptionColor(displayVal, optionIndex);
                             return (
                               <span key={displayVal} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                                 {displayVal}
                               </span>
                             );
                           }
                           return null;
                         })
                       : (
                         selectedValues.length > 0 ? (
                           selectedValues.map((displayVal) => {
                             if (columnOptions?.includes(displayVal)) {
                               const optionIndex = columnOptions.indexOf(displayVal);
                               const colorClass = getOptionColor(displayVal, optionIndex);
                               return (
                                 <span key={displayVal} className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                                   {displayVal}
                                 </span>
                               );
                             }
                             return null;
                           })
                         ) : (
                           <span className="text-sm text-muted-foreground italic">請選擇選項</span>
                         )
                       )}
                   </div>
                 </PopoverTrigger>
                 <PopoverContent className="w-72 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜尋選項..."
                      value={multiSelectSearch[`${row.id}:${column.id}`] || ''}
                      onChange={(e) => setMultiSelectSearch(prev => ({ ...prev, [`${row.id}:${column.id}`]: e.target.value }))}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto space-y-2">
                    {columnOptions
                      .filter((opt) => {
                        const term = (multiSelectSearch[`${row.id}:${column.id}`] || '').toLowerCase();
                        return !term || String(opt).toLowerCase().includes(term);
                      })
                      .map((option, index) => {
                        const key = `${row.id}:${column.id}`;
                        const draft = multiSelectDraft[key] ?? selectedValues;
                        const checked = draft.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = checked
                                ? draft.filter(v => v !== option)
                                : [...draft, option];
                              setMultiSelectDraft(prev => ({ ...prev, [key]: next }));
                            }}
                          >
                            <Checkbox
                               checked={checked}
                               onCheckedChange={(c) => {
                                 const next = c
                                   ? [...draft, option]
                                   : draft.filter(v => v !== option);
                                 setMultiSelectDraft(prev => ({ ...prev, [key]: next }));
                               }}
                             />
                             <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                             <span className="text-xs">{option}</span>
                          </label>
                        );
                      })}
                  </div>
                  <div className="flex items-center justify-end gap-4 border-t pt-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={(e) => {
                         e.stopPropagation();
                         const key = `${row.id}:${column.id}`;
                         setMultiSelectDraft(prev => ({ ...prev, [key]: selectedValues }));
                         setMultiSelectSearch(prev => {
                           const cp = { ...prev };
                           delete cp[key];
                           return cp;
                         });
                       }}
                     >
                       重置
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         const key = `${row.id}:${column.id}`;
                         const finalVals = multiSelectDraft[key] ?? selectedValues;
                         saveEdit(finalVals, { rowId: row.id, columnId: column.id });
                         setMultiSelectOpen(prev => ({ ...prev, [key]: false }));
                         setMultiSelectDraft(prev => {
                           const cp = { ...prev };
                           delete cp[key];
                           return cp;
                         });
                         toast.success('已更新'); 
                       }}
                     >
                       確認
                     </Button>
                   </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        } else {
          // 單選模式（檢視狀態）：改用 Popover，草稿預覽 + 確認/重置，點擊整列即可選
          const displayVal = value !== undefined && value !== null ? String(value) : '';
          const key = `${row.id}:${column.id}`;
          return (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <Popover open={!!singleSelectOpen[key]} onOpenChange={(open) => {
                setSingleSelectOpen(prev => ({ ...prev, [key]: open }));
                if (open) {
                  setSingleSelectDraft(prev => ({ ...prev, [key]: displayVal }));
                } else {
                  setSingleSelectDraft(prev => { const cp = { ...prev }; delete cp[key]; return cp; });
                }
              }}>
                <PopoverTrigger asChild>
                  <div className="min-h-[28px] flex items-center gap-1 flex-wrap cursor-pointer hover:bg-muted/50 rounded px-2">
                    {(() => {
                      const val = singleSelectOpen[key] ? (singleSelectDraft[key] ?? displayVal) : displayVal;
                      if (val && columnOptions.includes(val)) {
                        const optionIndex = columnOptions.indexOf(val);
                        const colorClass = getOptionColor(val, optionIndex);
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                            {val}
                          </span>
                        );
                      }
                      return <span className="text-sm text-muted-foreground italic">請選擇選項</span>;
                    })()}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜尋選項..."
                      value={multiSelectSearch[key] || ''}
                      onChange={(e) => setMultiSelectSearch(prev => ({ ...prev, [key]: e.target.value }))}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto space-y-2">
                    {columnOptions
                      .filter((opt) => {
                        const term = (multiSelectSearch[key] || '').toLowerCase();
                        return !term || String(opt).toLowerCase().includes(term);
                      })
                      .map((option, index) => {
                        const draftVal = singleSelectDraft[key] ?? displayVal;
                        const checked = draftVal === option;
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/40 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSingleSelectDraft(prev => ({ ...prev, [key]: option }));
                            }}
                          >
                            <div className={`w-3 h-3 rounded border ${getOptionColor(option, index)}`} />
                            <span className="text-xs">{option}</span>
                          </label>
                        );
                      })}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSingleSelectDraft(prev => ({ ...prev, [key]: '' }));
                        }}
                      >
                        清空
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSingleSelectDraft(prev => ({ ...prev, [key]: displayVal }));
                          setMultiSelectSearch(prev => {
                            const cp = { ...prev };
                            delete cp[key];
                            return cp;
                          });
                        }}
                      >
                        重置
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const finalVal = singleSelectDraft[key] ?? displayVal;
                          saveEdit(finalVal, { rowId: row.id, columnId: column.id });
                          setSingleSelectOpen(prev => ({ ...prev, [key]: false }));
                          setSingleSelectDraft(prev => { const cp = { ...prev }; delete cp[key]; return cp; });
                          toast.success('已更新');
                        }}
                      >
                        確認
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        }
      } else {
        // 修复数字0不显示的问题：只有当value为undefined或null时才显示空字符串
        return <span className="text-sm">{value === undefined || value === null ? '' : String(value)}</span>;
      }
    };

    const passiveRelatedData = enableMultiTableQuery && !isEditing ? 
      getRelatedTableDataByRow(table.id, row.id) : [];
    
    return (
      <div
        className="p-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[32px] flex flex-col items-start justify-start gap-1"
        onClick={() => startEdit(row.id, column.id, column.type === 'file' ? '' : value)}
      >
        <div>{renderCellContent()}</div>
        
        {/* 显示被动关联数据 */}
        {passiveRelatedData.length > 0 && !isEditing && (
          <div className="w-full mt-1 pt-1 border-t border-dashed border-muted/50">
            {passiveRelatedData.map((relatedData: any, tableIndex: number) => {
              const displayRows = relatedData.rows.slice(0, 5); // 最多显示5条
              const hasMore = relatedData.rows.length > 5;
              
              return (
                <div key={tableIndex} className="mt-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center">
                    <span>{relatedData.table.name || relatedData.table.id}</span>
                    <span className="mx-1">:</span>
                    <span className="text-xs text-muted">共 {relatedData.rows.length} 筆</span>
                  </div>
                  <div className="mt-1 pl-2">
                    {displayRows.map((relatedRow: any, rowIndex: number) => (
                      <div key={rowIndex} className="text-xs text-muted-foreground mb-1">
                        {formatPassiveRelationData(relatedRow, relatedData.table)}
                      </div>
                    ))}
                    {hasMore && (
                      <div className="text-xs text-muted-foreground italic">
                        ... 還有 {relatedData.rows.length - 5} 筆未顯示
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              {/* 多表关联查询切换 */}
              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">多表关联查询</span>
                  </div>
                  <Checkbox 
                    checked={enableMultiTableQuery}
                    onCheckedChange={(checked) => setEnableMultiTableQuery(checked as boolean)}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  启用后，搜索时将自动关联查询所有相关表的数据
                </p>
              </div>
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
                        } else if (column.type === 'select') {
                          const columnOptions = getSelectOptions(column);
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
                                {columnOptions.map((option, index) => (
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
                                    step={60}
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
                                    step={60}
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
        
        {/* 关联数据详情弹窗 */}
        <Dialog open={showRelationDetail} onOpenChange={setShowRelationDetail}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{relationDataTitle}</DialogTitle>
              <DialogDescription>
                关联数据详情
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 max-h-[400px] overflow-y-auto">
              {renderRelationDetail(selectedRelationData)}
            </div>
            
            <DialogFooter className="mt-4">
              <Button onClick={() => setShowRelationDetail(false)}>
                关闭
              </Button>
            </DialogFooter>
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
                            } else if (column.type === 'select') {
                              const columnOptions = getSelectOptions(column);
                              return (
                                <Select value={batchEditValue} onValueChange={setBatchEditValue}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇選項" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {columnOptions.map((option, index) => (
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
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="column-type">資料類型</Label>
                  <Select value={newColumn.type} onValueChange={(value: Column['type']) => setNewColumn({ ...newColumn, type: value })}>
                    <SelectTrigger className="mt-2">
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
                
                {/* 高級選項：關聯字段 */}
                <div className="border-t pt-4 border-gray-200">
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox 
                        id="new-use-relation"
                        checked={!!newColumn.relation}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewColumn({ 
                              ...newColumn, 
                              relation: { 
                                targetTableId: newColumn.relation?.targetTableId || '', 
                                targetColumnId: newColumn.relation?.targetColumnId || '', 
                                displayColumnId: newColumn.relation?.displayColumnId || '',
                                type: newColumn.relation?.type || 'single'
                              } 
                            });
                          } else {
                            setNewColumn({ ...newColumn, relation: undefined });
                          }
                        }}
                      />
                      <Label htmlFor="new-use-relation" className="cursor-pointer text-gray-700 font-medium">
                        關聯字段
                      </Label>
                    </div>
                    {newColumn.relation && (
                      <div className="mt-2 space-y-2">
                        <div>
                        <Label htmlFor="new-relation-table">關聯表</Label>
                        <Select
                          value={newColumn.relation.targetTableId}
                          onValueChange={(value) => setNewColumn({ 
                            ...newColumn, 
                            relation: { 
                              ...newColumn.relation,
                              targetTableId: value,
                              targetColumnId: '',
                              displayColumnId: '',
                              type: newColumn.relation?.type || 'single'
                            } 
                          })}
                        >
                          <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                            <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇關聯表'} />
                          </SelectTrigger>
                          <SelectContent>
                            {allTables
                              .filter(t => t.id !== table.id)
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {newColumn.relation.targetTableId && (
                          <>
                            <div>
                              <Label htmlFor="new-relation-target-column">關聯字段</Label>
                              {(() => {
                                const targetTable = allTables.find(t => t.id === newColumn.relation?.targetTableId);
                                // 只显示与当前字段类型相同的目标列
                                const targetCols = targetTable?.columns.filter(c => c.type === newColumn.type) || [];
                                return (
                                  <Select
                                    value={newColumn.relation.targetColumnId}
                                    onValueChange={(value) => setNewColumn({ 
                                      ...newColumn, 
                                      relation: { 
                                        ...newColumn.relation,
                                        targetColumnId: value,
                                        displayColumnId: value,
                                        targetTableId: newColumn.relation?.targetTableId || '',
                                        type: newColumn.relation?.type || 'single'
                                      } 
                                    })}
                                  >
                                    <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                      <SelectValue placeholder={targetCols.length === 0 ? '没有相同类型的字段可选' : '選擇關聯字段'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetCols.length === 0 ? (
                                        <div className="text-center py-2 text-gray-500 text-sm">没有找到与当前字段类型和名称相同的列</div>
                                      ) : (
                                        targetCols.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </div>
                        </>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                {/* 字典子表功能 */}
                <div className="border-t pt-4 border-gray-200">
                  <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox 
                        id="new-use-dict"
                        checked={!!newColumn.dictRef}
                        onCheckedChange={(checked) => {
                          const next = !!checked ? { tableId: newColumn.dictRef?.tableId || '', columnId: '' } : undefined;
                          setNewColumn({ ...newColumn, dictRef: next });
                        }}
                      />
                      <Label htmlFor="new-use-dict" className="cursor-pointer font-medium">使用字典子表</Label>
                    </div>
                    {newColumn.dictRef && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <Label htmlFor="new-dict-table">字典表</Label>
                        <Select
                          value={newColumn.dictRef.tableId}
                          onValueChange={(value) => setNewColumn({ ...newColumn, dictRef: { tableId: value, columnId: '' } })}
                        >
                          <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                            <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇字典表'} />
                          </SelectTrigger>
                          <SelectContent>
                            {allTables.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="new-dict-column">字典列</Label>
                        {(() => {
                          const dictTable = allTables.find(t => t.id === newColumn.dictRef?.tableId);
                          const dictCols: Column[] = dictTable?.columns || [];
                          const sameTypeCols = dictCols.filter((c) => c.type === newColumn.type);
                          return (
                            <Select
                              value={newColumn.dictRef.columnId}
                              onValueChange={(value) => setNewColumn({ ...newColumn, dictRef: { tableId: newColumn.dictRef?.tableId || '', columnId: value } })}
                            >
                              <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                <SelectValue placeholder={sameTypeCols.length === 0 ? '請先選擇字典表' : '選擇同類型字典列'} />
                              </SelectTrigger>
                              <SelectContent>
                                {sameTypeCols.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                    </div>
                  )}
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
                {newColumn.type === 'relation' && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <Label htmlFor="new-relation-table">目標表格</Label>
                      <Select
                        value={newColumn.relation?.targetTableId || ''}
                        onValueChange={(value) => setNewColumn({ 
                          ...newColumn, 
                          relation: {
                            ...newColumn.relation,
                            targetTableId: value,
                            targetColumnId: '',
                            displayColumnId: '',
                            type: newColumn.relation?.type || 'single' // 确保type属性存在
                          } 
                        })}
                      >
                        <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                          <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇目標表格'} />
                        </SelectTrigger>
                        <SelectContent>
                          {allTables
                            .filter(t => t.id !== table.id)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newColumn.relation?.targetTableId && (
                          <>
                            <div>
                              <Label htmlFor="new-relation-column">關聯字段</Label>
                              {(() => {
                                const targetTable = allTables.find(t => t.id === newColumn.relation?.targetTableId);
                                // 只显示与当前字段类型相同且名称相同的目标列
                                // 注意：对于关联字段，我们需要确保类型判断正确
                                const targetCols: Column[] = targetTable?.columns.filter(c => c.type === newColumn.type && c.name === newColumn.name) || [];
                                return (
                                  <Select
                                    value={newColumn.relation?.targetColumnId || ''}
                                    onValueChange={(value) => setNewColumn({ 
                                      ...newColumn, 
                                      relation: {
                                        ...newColumn.relation,
                                        targetTableId: newColumn.relation?.targetTableId || '',
                                        targetColumnId: value,
                                        displayColumnId: value, // 默認顯示字段與關聯字段相同
                                        type: newColumn.relation?.type || 'single' // 确保type属性存在
                                      } 
                                    })}
                                  >
                                    <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                      <SelectValue placeholder={targetCols.length === 0 ? '没有相同类型和名称的字段可选' : '選擇關聯字段'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetCols.length === 0 ? (
                                        <div className="text-center py-2 text-gray-500 text-sm">没有找到与当前字段类型和名称相同的列</div>
                                      ) : (
                                        targetCols.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </div>
                        {newColumn.relation?.targetColumnId && (
                          <div>
                            <Label htmlFor="new-relation-display">顯示字段</Label>
                            {(() => {
                              const targetTable = allTables.find(t => t.id === newColumn.relation?.targetTableId);
                              const targetCols: Column[] = targetTable?.columns || [];
                              return (
                                <Select
                                  value={newColumn.relation?.displayColumnId || ''}
                                  onValueChange={(value) => setNewColumn({ 
                                    ...newColumn, 
                                    relation: {
                                      ...newColumn.relation,
                                      targetTableId: newColumn.relation?.targetTableId || '',
                                      targetColumnId: newColumn.relation?.targetColumnId || '',
                                      displayColumnId: value,
                                      type: newColumn.relation?.type || 'single' // 确保type属性存在
                                    } 
                                  })}
                                >
                                  <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                    <SelectValue placeholder={targetCols.length === 0 ? '請先選擇目標表格' : '選擇顯示字段'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {targetCols.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                        )}
                        <div>
                          <Label htmlFor="new-relation-type">關聯類型</Label>
                          <Select
                            value={newColumn.relation?.type || 'single'}
                            onValueChange={(value) => setNewColumn({ 
                              ...newColumn, 
                              relation: {
                                ...newColumn.relation,
                                targetTableId: newColumn.relation?.targetTableId || '',
                                targetColumnId: newColumn.relation?.targetColumnId || '',
                                type: value as 'single' | 'multiple' // 确保类型值正确
                              } 
                            })}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="選擇關聯類型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">單選</SelectItem>
                              <SelectItem value="multiple">多選</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <Button onClick={addColumn} className="w-full">
                  新增欄位
                </Button>
              </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!configColumnId} onOpenChange={(open) => !open && cancelColumnConfig()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>欄位設定</DialogTitle>
              </DialogHeader>
              {configForm && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="config-name">欄位名稱</Label>
                    <Input
                      id="config-name"
                      value={configForm.name}
                      onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                      placeholder="輸入欄位名稱"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="config-type">資料類型</Label>
                    <Select value={configForm.type} onValueChange={(value: Column['type']) => setConfigForm({ ...configForm, type: value })}>
                      <SelectTrigger className="mt-2">
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
                  
                  {/* 高級選項：關聯字段 */}
                  <div className="border-t pt-4 border-gray-200">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox 
                          id="config-use-relation"
                          checked={!!configForm.relation}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setConfigForm({ 
                                ...configForm, 
                                relation: { 
                                  targetTableId: configForm.relation?.targetTableId || '', 
                                  targetColumnId: configForm.relation?.targetColumnId || '', 
                                  displayColumnId: configForm.relation?.displayColumnId || '',
                                  type: configForm.relation?.type || 'single'
                                } 
                              });
                            } else {
                              setConfigForm({ ...configForm, relation: undefined });
                            }
                          }}
                        />
                        <Label htmlFor="config-use-relation" className="cursor-pointer text-gray-700 font-medium">
                          關聯字段
                        </Label>
                      </div>
                      {configForm.relation && (
                        <div className="mt-2 space-y-2">
                        <div>
                          <Label htmlFor="config-relation-table">關聯表</Label>
                          <Select
                            value={configForm.relation.targetTableId}
                            onValueChange={(value) => setConfigForm({ 
                              ...configForm, 
                              relation: { 
                                ...configForm.relation,
                                targetTableId: value,
                                targetColumnId: '',
                                displayColumnId: '',
                                type: configForm.relation?.type || 'single'
                              } 
                            })}
                          >
                            <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                              <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇關聯表'} />
                            </SelectTrigger>
                            <SelectContent>
                              {allTables
                                .filter(t => t.id !== table.id)
                                .map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {configForm.relation.targetTableId && (
                          <>
                            <div>
                              <Label htmlFor="config-relation-target-column">關聯字段</Label>
                              {(() => {
                                const targetTable = allTables.find(t => t.id === configForm.relation?.targetTableId);
                                // 只显示与当前字段类型和名称都相同的目标列
                                const currentColumn = table.columns.find(c => c.id === configColumnId);
                                const currentTypeName = configForm.name.trim() || currentColumn?.name;
                                const targetCols = targetTable?.columns.filter(col => 
                                  (col.type === currentColumn?.type || col.type === configForm.type) && 
                                  col.name === currentTypeName
                                ) || [];
                                return (
                                  <Select
                                    value={configForm.relation.targetColumnId}
                                    onValueChange={(value) => setConfigForm({ 
                                      ...configForm, 
                                      relation: { 
                                        ...configForm.relation,
                                      targetColumnId: value,
                                      displayColumnId: value,
                                      targetTableId: configForm.relation?.targetTableId || '',
                                      type: configForm.relation?.type || 'single'
                                      } 
                                    })}
                                  >
                                    <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                      <SelectValue placeholder={targetCols.length === 0 ? '没有相同类型的字段可选' : '選擇關聯字段'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetCols.length === 0 ? (
                                        <div className="text-center py-2 text-gray-500 text-sm">没有找到与当前字段类型相同的列</div>
                                      ) : (
                                        targetCols.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {configForm.type === 'select' && (
                    <div>
                      <Label>選項</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox 
                          id="config-is-multi"
                          checked={configForm.isMultiSelect}
                          onCheckedChange={(checked) => setConfigForm({ ...configForm, isMultiSelect: !!checked })}
                        />
                        <Label htmlFor="config-is-multi" className="cursor-pointer">啟用多選模式</Label>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          id="config-use-dict"
                          checked={!!configForm.dictRef}
                          onCheckedChange={(checked) => {
                            const next = !!checked ? { tableId: configForm.dictRef?.tableId || '', columnId: configForm.dictRef?.columnId || '' } : undefined;
                            setConfigForm({ ...configForm, dictRef: next });
                          }}
                        />
                        <Label htmlFor="config-use-dict" className="cursor-pointer">使用字典子表</Label>
                      </div>
                      {configForm.dictRef ? (
                        <div className="mt-2 space-y-2">
                          <div>
                            <Label htmlFor="config-dict-table">字典表</Label>
                            <Select
                              value={configForm.dictRef.tableId}
                              onValueChange={(value) => setConfigForm({ ...configForm, dictRef: { tableId: value, columnId: '' } })}
                            >
                              <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇字典表'} />
                              </SelectTrigger>
                              <SelectContent>
                                {allTables.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="config-dict-column">字典列</Label>
                            {/* 字典列选择 - 简化版本 */}
                            <Select
                              value={configForm.dictRef.columnId}
                              onValueChange={(value) => {
                                setConfigForm({
                                  ...configForm,
                                  dictRef: {
                                    tableId: configForm.dictRef?.tableId || '',
                                    columnId: value
                                  }
                                });
                              }}
                            >
                              <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                <SelectValue placeholder="選擇字典列" />
                              </SelectTrigger>
                              <SelectContent>
                                {allTables
                                  .find(t => t.id === configForm.dictRef?.tableId)
                                  ?.columns?.filter(c => c.type === configForm.type)
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <>
                          {configForm.options.map((option, index) => (
                            <div key={index} className="flex gap-2 mt-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...configForm.options];
                                  newOptions[index] = e.target.value;
                                  setConfigForm({ ...configForm, options: newOptions });
                                }}
                                placeholder={`選項 ${index + 1}`}
                              />
                              <Button type="button" variant="outline" size="sm" onClick={() => {
                                const newOptions = configForm.options.filter((_, i) => i !== index);
                                setConfigForm({ ...configForm, options: newOptions.length ? newOptions : [''] });
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              {index === configForm.options.length - 1 && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setConfigForm({ ...configForm, options: [...configForm.options, ''] })}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  {configForm.type !== 'select' && (
                    <div className="border-t pt-4 border-gray-200">
                      <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            id="config-use-dict"
                            checked={!!configForm.dictRef}
                            onCheckedChange={(checked) => {
                              const next = !!checked ? { tableId: configForm.dictRef?.tableId || '', columnId: configForm.dictRef?.columnId || '' } : undefined;
                              setConfigForm({ ...configForm, dictRef: next });
                            }}
                          />
                          <Label htmlFor="config-use-dict" className="cursor-pointer font-medium">使用字典子表</Label>
                        </div>
                      {configForm.dictRef ? (
                        <div className="mt-2 space-y-2">
                          <div>
                            <Label htmlFor="config-dict-table">字典表</Label>
                            <Select
                              value={configForm.dictRef.tableId}
                              onValueChange={(value) => setConfigForm({ ...configForm, dictRef: { tableId: value, columnId: '' } })}
                            >
                              <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                              <SelectValue placeholder={tablesLoading ? '載入中…' : '選擇字典表'} />
                            </SelectTrigger>
                              <SelectContent>
                                {allTables.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name || t.id}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            
                            <Label htmlFor="config-dict-column">字典列</Label>
                            {(() => {
                              const dictTable = allTables.find(t => t.id === configForm.dictRef?.tableId);
                              const dictCols: Column[] = dictTable?.columns || [];
                              return (
                                <Select
                                  value={configForm.dictRef.columnId}
                                  onValueChange={(value) => setConfigForm({ ...configForm, dictRef: { tableId: configForm.dictRef?.tableId || '', columnId: value } })}
                                >
                                  <SelectTrigger onClick={() => refreshAllTables()} className="mt-2">
                                    <SelectValue placeholder={dictCols.length === 0 ? '請先選擇字典表' : '選擇字典列'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dictCols
                                      .filter((c) => c.type === configForm.type && !(dictTable?.id === table.id && c.id === configColumnId))
                                      .map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                        </div>
                      ) : null}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={cancelColumnConfig} variant="outline" className="flex-1">取消</Button>
                    <Button onClick={saveColumnConfig} className="flex-1">保存</Button>
                  </div>
                </div>
              )}
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
                        columnWidth={columnWidths[column.id]}
                        onResizeStart={handleResizeStart}
                        resizingColumn={resizingColumn}
                        onOpenColumnConfig={openColumnConfig}
                        allTables={allTables}
                        table={table}
                      />
                    ))}
                  </SortableContext>
                  <th className="w-12 p-3"></th>
                </tr>
              </thead>
              <tbody>
                <SortableContext items={sortedRows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                  {sortedRows.map((row) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      selected={selectedRows.has(row.id)}
                      onToggleSelect={toggleRowSelection}
                      columns={table.columns}
                      columnWidths={columnWidths}
                      renderCell={renderCell}
                      onDeleteRow={deleteRow}
                      dragDisabled={Boolean(sortConfig) || Boolean(searchTerm) || Object.keys(filters).length > 0}
                    />
                  ))}
                </SortableContext>
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
      {/* 檔案預覽彈窗 */}
      {filePreview && (
        <Dialog open={!!filePreview} onOpenChange={(open) => { if (!open) setFilePreview(null); }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{fixMojibakeName(filePreview?.name) || '檔案預覽'}</DialogTitle>
            </DialogHeader>
            <div className="w-full">
              {/* 圖片預覽 */}
              {((filePreview?.type && filePreview.type.startsWith('image')) || /\.(png|jpe?g|gif|webp)$/i.test(filePreview?.url || '')) && (
                <img src={filePreview!.url} alt={fixMojibakeName(filePreview?.name) || ''} className="max-h-[70vh] mx-auto" />
              )}

              {/* 影片預覽 */}
              {((filePreview?.type && filePreview.type.startsWith('video')) || /\.(mp4|m4v)$/i.test(filePreview?.url || '')) && (
                <video src={filePreview!.url} controls className="w-full max-h-[70vh]" />
              )}

              {/* 音訊預覽 */}
              {((filePreview?.type && filePreview.type.startsWith('audio')) || /\.(mp3|m4a|wav)$/i.test(filePreview?.url || '')) && (
                <audio src={filePreview!.url} controls className="w-full" />
              )}

              {/* PDF 預覽 */}
              {((filePreview?.type && filePreview.type.includes('pdf')) || /\.pdf$/i.test(filePreview?.url || '')) && (
                <iframe src={filePreview!.url} className="w-full h-[70vh]" title={fixMojibakeName(filePreview?.name) || 'PDF 預覽'} />
              )}

              {/* 其他類型 fallback，用 iframe 嘗試顯示 */}
              {!(
                (filePreview?.type && (filePreview.type.startsWith('image') || filePreview.type.startsWith('video') || filePreview.type.startsWith('audio') || filePreview.type.includes('pdf')))
                || /\.(png|jpe?g|gif|webp|mp4|m4v|mp3|m4a|wav|pdf)$/i.test(filePreview?.url || '')
              ) && (
                <iframe src={filePreview!.url} className="w-full h-[70vh]" title={fixMojibakeName(filePreview?.name) || '檔案預覽'} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      </div>
    </div>
  );
}