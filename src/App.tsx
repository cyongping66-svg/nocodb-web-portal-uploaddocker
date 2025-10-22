import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useTables } from '@/hooks/use-tables';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Table as TableIcon, Grid3X3, Download, Menu, X, RotateCcw, History, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { toast, Toaster } from 'sonner';
import { Table, ViewMode } from '@/types';
import { TableManager } from '@/components/TableManager';
import { DataTable } from '@/components/DataTable';
import { CardView } from '@/components/CardView';
import { apiService } from '@/lib/api';

function App() {
  const { 
    tables, 
    setTables, 
    createTable: createTableInDB, 
    deleteTable: deleteTableFromDB, 
    updateTable: updateTableInDB,
    createRow,
    updateRow,
    deleteRow,
    batchUpdateRows,
    loading, 
    error, 
    refresh
  } = useTables();
  
  const [activeTableId, setActiveTableId] = useState<string | null>('sample-employees'); // 默認使用示例表格
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [newTableName, setNewTableName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  // 新增：全域可回滾堆疊（支持連續回滾）
  const [undoStack, setUndoStack] = useState<Array<{ label: string; undo: () => Promise<void>; timestamp?: number; source?: string }>>([]);
  const [lastOpInfo, setLastOpInfo] = useState<{ label: string; timestamp?: number; source?: string } | null>(null);
  // 新增：回溯確認對話框狀態
  const [pendingRevertEntry, setPendingRevertEntry] = useState<{ id: string; label?: string; source?: string; created_at: string } | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  // 追蹤最新的 tables 狀態以便在回滾時取得最新資料
  const latestTablesRef = useRef<Table[] | null>(tables || null);
  useEffect(() => {
    latestTablesRef.current = tables || null;
  }, [tables]);

  // 版本歷史已改為後端存儲
  // 新增：版本歷史（後端存儲）
  type HistoryEntry = { id: string; label?: string; source?: string; actor?: string; created_at: string };
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const loadHistory = async (tableId: string) => {
    setHistoryLoading(true);
    try {
      const list = await apiService.getHistoryList(tableId);
      setHistoryList(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length === 0) {
        await apiService.createHistorySnapshot(tableId, { label: '初始載入', source: '系統' });
        const refreshed = await apiService.getHistoryList(tableId);
        setHistoryList(Array.isArray(refreshed) ? refreshed : []);
      }
    } catch (e) {
      console.error('載入歷史失敗:', e);
    } finally {
      setHistoryLoading(false);
    }
  };
  useEffect(() => {
    const t = tables?.find(t => t.id === activeTableId);
    setHistoryList([]);
    setLastOpInfo(null);
    if (t?.id) {
      loadHistory(t.id);
    }
  }, [activeTableId]);

  // 相對時間格式（中文）：將毫秒時間戳轉為「x 分鐘前 / x 秒前 / x 小時前」
  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const diffMs = Date.now() - ts;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `${sec} 秒前`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} 分鐘前`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} 小時前`;
    const day = Math.floor(hour / 24);
    return `${day} 天前`;
  };
  // 新增：本機時間格式化（改動時的本機時間顯示）
  // 新增：時間顯示控制（設為 true 時一律使用 PST 顯示）
  const FORCE_PST_TIME = false;
  
  // 新增：健壯的時間解析
  const parseToDate = (input?: string | number | Date) => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    if (typeof input === 'number') {
      const ms = input > 1e12 ? input : input * 1000; // 可能是秒或毫秒
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === 'string') {
      let s = input.trim();
      // 純數字字串（時間戳）
      if (/^\d+$/.test(s)) {
        const num = Number(s);
        const ms = s.length >= 13 ? num : num * 1000;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      // 兼容 "YYYY-MM-DD HH:mm:ss" → ISO
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
        s = s.replace(' ', 'T');
      }
      const hasTZ = /Z|[+-]\d{2}:?\d{2}$/.test(s);
      const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);
      const tryStr = isoLike && !hasTZ ? s + 'Z' : s; // 無時區時視為 UTC
      let d = new Date(tryStr);
      if (!isNaN(d.getTime())) return d;
      d = new Date(s + 'Z');
      if (!isNaN(d.getTime())) return d;
      return null;
    }
    return null;
  };
  
  // 更新：本機時間格式化（失敗時可回退為 PST）
  const formatLocalTime = (input?: string | number | Date) => {
    const d = parseToDate(input);
    if (!d) return '';
    const opts: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    try {
      if (FORCE_PST_TIME) {
        return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'America/Los_Angeles' }).format(d);
      }
      return new Intl.DateTimeFormat(undefined, opts).format(d);
    } catch {
      // 任意錯誤回退為 PST
      return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'America/Los_Angeles' }).format(d);
    }
  };
  // 检测屏幕尺寸变化，设置移动视图状态
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      // 在移动视图下默认隐藏侧边栏
      if (isMobile) {
        setIsSidebarOpen(false);
        // 在移动视图下默认使用卡片视图
        setViewMode('card');
      } else {
        setIsSidebarOpen(true);
        // 在非移动视图下使用网格视图
        setViewMode('grid');
      }
    };

    // 初始化
    handleResize();
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    // 清理函数
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 注意：项目已禁用浏览器缓存，不再保存表格选择状态到localStorage

  const activeTable = tables?.find(table => table.id === activeTableId);

  const createTable = async () => {
    if (!newTableName.trim()) {
      toast.error('請輸入子表名稱');
      return;
    }

    const newTableData = {
      id: Date.now().toString(),
      name: newTableName.trim(),
      columns: [
        { id: 'name', name: '姓名', type: 'text' as const },
        { id: 'email', name: '電子郵件', type: 'email' as const },
        { id: 'created', name: '建立日期', type: 'date' as const }
      ]
    };

    await createTableInDB(newTableData);
    setActiveTableId(newTableData.id);
    setNewTableName('');
    setIsCreateDialogOpen(false);
    // 記錄快照：新增子表
    try {
      await apiService.createHistorySnapshot(newTableData.id, { label: '新增子表', source: '子表管理' });
      await loadHistory(newTableData.id);
    } catch (e) {
      console.error('保存新增子表快照失敗:', e);
    }
  };

  const deleteTable = async (tableId: string) => {
    // 記錄快照：刪除子表（在刪除前保存當前狀態）
    try {
      await apiService.createHistorySnapshot(tableId, { label: '刪除子表', source: '子表管理' });
    } catch (e) {
      console.error('保存刪除子表快照失敗:', e);
    }
    await deleteTableFromDB(tableId);
    if (activeTableId === tableId) {
      setActiveTableId(null);
    }
  };

  const updateTable = async (updatedTable: Table) => {
    try {
      // 取得更新前的表格（用於判斷是否為改名操作）
      const prevTable = (tables || []).find(t => t.id === updatedTable.id);
      const prevName = prevTable?.name;

      // 使用 hook 中的 updateTable 方法
      if (updateTableInDB) {
        await updateTableInDB(updatedTable);
      } else {
        // 備用邏輯
        await setTables(currentTables => 
          currentTables ? currentTables.map(table => 
            table.id === updatedTable.id ? updatedTable : table
          ) : [updatedTable]
        );
      }

      // 若為表格名稱修改，註冊回滾操作並記錄快照
      if (prevName && updatedTable.name !== prevName) {
        // 記錄快照：子表名稱更新
        try {
          await apiService.createHistorySnapshot(updatedTable.id, { label: `子表名稱更新 | ${prevName} → ${updatedTable.name}`, source: '子表管理' });
          await loadHistory(updatedTable.id);
        } catch (e) {
          console.error('保存子表名稱更新快照失敗:', e);
        }
        setUndoStack(prev => [
          ...prev,
          {
            label: '子表名稱更新',
            undo: async () => {
              try {
                const currentTables = latestTablesRef.current || [];
                const current = currentTables.find(t => t.id === updatedTable.id);
                if (!current) return;
                const reverted = { ...current, name: prevName };
                if (updateTableInDB) {
                  await updateTableInDB(reverted);
                } else {
                  await setTables(ct =>
                    (ct || []).map(t => (t.id === reverted.id ? reverted : t))
                  );
                }
                toast.success('已回滾子表名稱修改');
              } catch (e) {
                console.error('回滾子表名稱失敗:', e);
                toast.error('回滾子表名稱失敗');
              }
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Error updating table:', error);
      toast.error('更新表格時發生錯誤');
    }
  };

  const exportData = () => {
    if (!activeTable) return;
    
    try {
      // 准备Excel导出数据
      const worksheetData = [
        // 表头行
        activeTable.columns.map(col => col.name),
        // 数据行
        ...activeTable.rows.map(row => 
          activeTable.columns.map(col => {
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
      XLSX.utils.book_append_sheet(workbook, worksheet, activeTable.name);

      // 导出Excel文件
      const fileName = `${activeTable.name.toLowerCase().replace(/\s+/g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('資料以Excel格式匯出成功');
    } catch (error) {
      console.error('Excel导出失败:', error);
      toast.error('Excel導出失敗，請重試');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 在Toaster组件下方添加移动端汉堡菜单按钮 */}
      <Toaster position="top-right" />
      
      {/* 移动端汉堡菜单按钮 */}
      {isMobileView && (
        <Button 
          className="fixed top-4 left-4 z-50 p-2 h-auto" 
          variant="secondary" 
          size="icon" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      )}
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">孵化之路信息管理系統</h1>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-muted-foreground">
                本地存儲 (SQLite)
              </span>
              {error && (
                <span className="text-xs text-red-500">連接錯誤</span>
              )}
            </div>
            
            {/* 版本信息 - 显示在本地存储文字的下方 */}
            <div className="mt-1 flex items-center gap-2">
              {/* 顯示藍色小球 */}
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-muted-foreground">
                版本信息: v1.1
              </span>
            </div>
          </div>
          
          <div className="p-4">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full mb-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  新增子表
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>建立新子表</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="table-name">子表名稱</Label>
                    <Input
                      id="table-name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="輸入子表名稱"
                      onKeyDown={(e) => e.key === 'Enter' && createTable()}
                    />
                  </div>
                  <Button onClick={createTable} className="w-full">
                    建立子表
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <TableManager
              tables={tables || []}
              activeTableId={activeTableId}
              onSelectTable={setActiveTableId}
              onDeleteTable={deleteTable}
              onUpdateTable={updateTable}
            />
          </div>
          
          {/* 反馈建议入口 - 放置在页面的最底部 */}
          <div className="mt-auto p-4 border-t border-border">
            <a 
              href="https://omeoffice.com/usageFeedback" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium underline decoration-dotted underline-offset-2 flex items-center justify-center"
            >
              反馈建议入口
            </a>
          </div>
        </div>

        {/* 移动端侧边栏遮罩 */}
        {isMobileView && isSidebarOpen && (
          <div 
            className="fixed inset-0 z-30 bg-black bg-opacity-50" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isMobileView && !isSidebarOpen ? 'w-full' : ''}`}>
          {activeTable ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">{activeTable.name}</h2>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const badgeOp = lastOpInfo || (undoStack.length > 0 ? undoStack[undoStack.length - 1] : null);
                      if (!badgeOp) return null;
                      const rel = formatRelativeTime(badgeOp.timestamp);
                      const rawLabel = badgeOp.label || '';
                      // 清理括號內容（全形/半形）
                      const cleanedLabel = rawLabel.replace(/[（(][^）)]*[）)]/g, '').trim();
                      // 支持「動作 | 細節」格式拆分
                      const [actionPartRaw, detailPartRaw] = cleanedLabel.split('|').map(s => s?.trim());
                      // 若包含來源前綴，移除重複前綴
                      const actionPart = badgeOp.source ? (actionPartRaw || '').replace(new RegExp(`^${badgeOp.source}\s*[：:]*\s*`), '').trim() : (actionPartRaw || '').trim();
                      const detailPart = detailPartRaw || '';
                      const sourceName = badgeOp.source || '';
                      const actionWithDetail = detailPart ? `${actionPart}：${detailPart}` : actionPart;
                      // 組裝格式：「 相對時間 · 視圖名稱 · 操作動作：細節 」
                      const pieces = [
                        rel ? `${rel}` : null,
                        sourceName || null,
                        actionWithDetail || null,
                      ].filter(Boolean);
                      return (
                        <span className="inline-flex items-center rounded-full border border-muted/30 bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                          {pieces.join(' · ')}
                        </span>
                      );
                    })()}
                    <Button
                      variant="default"
                      size="sm"
                      disabled={undoStack.length === 0}
                      onClick={async () => {
                        if (undoStack.length === 0) {
                          toast.error('暫無可回滾的操作');
                          return;
                        }
                        const lastOp = undoStack[undoStack.length - 1];
                        try {
                          await lastOp.undo();
                          setUndoStack(prev => prev.slice(0, -1));
                          setLastOpInfo({
                            label: `撤銷：${lastOp.label}`,
                            source: lastOp.source,
                            timestamp: Date.now(),
                          });
                          // 撤銷後也保存一個快照供審計
                          if (activeTable) {
                            await apiService.createHistorySnapshot(activeTable.id, { label: `撤銷：${lastOp.label}`, source: lastOp.source });
                            await loadHistory(activeTable.id);
                          }
                        } catch (e) {
                          console.error('回滾失敗:', e);
                          toast.error('回滾操作失敗');
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      回滾上次操作
                    </Button>
                    {/* 新增：歷史版本下拉菜單（置於回滾按鈕右側） */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" size="sm">
                          <History className="w-4 h-4 mr-2" />
                          歷史記錄
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="min-w-[280px]">
                        <DropdownMenuLabel>選擇版本回溯</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {historyLoading ? (
                          <DropdownMenuItem disabled>正在載入...</DropdownMenuItem>
                        ) : ((historyList || []).length === 0 ? (
                          <DropdownMenuItem disabled>暫無歷史版本</DropdownMenuItem>
                        ) : (
                          [...(historyList || [])].map((entry) => (
                            <DropdownMenuItem key={entry.id} onClick={() => {
                              setPendingRevertEntry(entry);
                              setIsRevertDialogOpen(true);
                            }}>
                              <div className="flex flex-col">
                                <span className="text-sm">{entry.label || entry.id}</span>
                                <span className="text-xs text-muted-foreground">{formatLocalTime(entry.created_at)} · {entry.source || '未知來源'}</span>
                              </div>
                            </DropdownMenuItem>
                          ))
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async () => {
                            if (!activeTable) return;
                            const ok = window.confirm('確定要清空該表的歷史記錄嗎？此操作不可撤銷。');
                            if (!ok) return;
                            try {
                              await apiService.clearHistory(activeTable.id);
                              setHistoryList([]);
                              toast.success('已清空該表的歷史記錄');
                            } catch (e) {
                              console.error('清空歷史失敗:', e);
                              toast.error('清空歷史失敗');
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />保存當前版本並清除歷史記錄
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 回溯確認對話框 */}
                    <AlertDialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>回溯確認</AlertDialogTitle>
                          <AlertDialogDescription>
                            將切換到所選版本：{pendingRevertEntry?.label || pendingRevertEntry?.id}
                            <br />時間：{pendingRevertEntry ? formatLocalTime(pendingRevertEntry.created_at) : ''}
                            <br />此操作將覆蓋當前表的數據，請慎重操作。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            if (!activeTable || !pendingRevertEntry) return;
                            try {
                              await apiService.revertToHistory(activeTable.id, pendingRevertEntry.id);
                              setLastOpInfo({ label: `切換版本 | ${pendingRevertEntry.label || pendingRevertEntry.id}`, source: pendingRevertEntry.source || '歷史', timestamp: Date.now() });
                              toast.success('已切換到所選版本');
                              setIsRevertDialogOpen(false);
                              setPendingRevertEntry(null);
                              refresh();
                              await loadHistory(activeTable.id);
                            } catch (e) {
                              console.error('切換版本失敗:', e);
                              toast.error('切換版本失敗');
                            }
                          }}>確認切換</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
  
                       <Button variant="outline" size="sm" onClick={exportData}>
                         <Download className="w-4 h-4 mr-2" />
                         匯出
                       </Button>
                       <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                         <TabsList>
                           <TabsTrigger value="grid">
                             <TableIcon className="w-4 h-4" />
                           </TabsTrigger>
                           <TabsTrigger value="card">
                             <Grid3X3 className="w-4 h-4" />
                           </TabsTrigger>
                         </TabsList>
                       </Tabs>
                  </div>
                </div>
              </div>

              {/* Content - 响应式设计 */}
              <div className="flex-1 p-4 overflow-auto">
                {viewMode === 'grid' ? (
                  <div className="overflow-x-auto">
                    <DataTable 
                      table={activeTable} 
                      onUpdateTable={updateTable}
                      onCreateRow={createRow}
                      onUpdateRow={updateRow}
                      onDeleteRow={deleteRow}
                      onBatchUpdateRows={batchUpdateRows} // 中文注释：传入批量更新回调，用于选项同步持久化
                      // 新增：接收子組件註冊的回滾操作（推入堆疊，附時間戳）
                      onSetLastOperation={async (op) => {
                         if (!op) return;
                         const augmented = { ...op, source: '表格視圖', timestamp: Date.now() };
                         setUndoStack(prev => [...prev, augmented]);
                         setLastOpInfo({ label: augmented.label, source: augmented.source, timestamp: augmented.timestamp });
                         try {
                           await apiService.createHistorySnapshot(activeTable.id, { label: augmented.label, source: augmented.source });
                           await loadHistory(activeTable.id);
                         } catch (e) {
                           console.error('保存快照失敗:', e);
                         }
                       }}
                    />
                  </div>
                ) : (
                  <CardView 
                    table={activeTable} 
                    onUpdateTable={updateTable}
                    // 新增：接收卡片視圖的回滾註冊並標註來源
                    onSetLastOperation={async (op) => {
                       if (!op) return;
                       const augmented = { ...op, source: '卡片視圖', timestamp: Date.now() };
                       setUndoStack(prev => [...prev, augmented]);
                       setLastOpInfo({ label: augmented.label, source: augmented.source, timestamp: augmented.timestamp });
                       // 新增：保存快照到後端
                       try {
                         await apiService.createHistorySnapshot(activeTable.id, { label: augmented.label, source: augmented.source });
                         await loadHistory(activeTable.id);
                       } catch (e) {
                         console.error('保存快照失敗:', e);
                       }
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle className="text-center">歡迎使用孵化之路信息管理系統</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground mb-4">
                    建立您的第一個子表來開始組織您的資料
                  </p>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        建立第一個子表
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;