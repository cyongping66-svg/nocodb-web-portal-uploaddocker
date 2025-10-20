import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useTables } from '@/hooks/use-tables';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Table as TableIcon, Grid3X3, Download, Menu, X, RotateCcw } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Table, ViewMode } from '@/types';
import { TableManager } from '@/components/TableManager';
import { DataTable } from '@/components/DataTable';
import { CardView } from '@/components/CardView';

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
  // 追蹤最新的 tables 狀態以便在回滾時取得最新資料
  const latestTablesRef = useRef<Table[] | null>(tables || null);
  useEffect(() => {
    latestTablesRef.current = tables || null;
  }, [tables]);

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
  };

  const deleteTable = async (tableId: string) => {
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

      // 若為表格名稱修改，註冊回滾操作
      if (prevName && updatedTable.name !== prevName) {
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
                版本信息: v1.2
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
                    {undoStack.length > 0 && (() => {
                      const lastOp = undoStack[undoStack.length - 1];
                      const rel = formatRelativeTime(lastOp.timestamp);
                      const src = lastOp.source ? `${lastOp.source} · ` : '';
                      const rawLabel = lastOp.label || '';
                      // 1) 移除徽章內的欄位名稱（刪除括號中的內容，包含全形/半形）
                      let displayLabel = rawLabel.replace(/[（(][^）)]*[）)]/g, '').trim();
                      // 2) 若標籤已包含來源前綴（如「卡片視圖：」「表格視圖：」），移除重複前綴
                      if (lastOp.source) {
                        const prefixRegex = new RegExp(`^${lastOp.source}\\s*[：:]\\s*`);
                        displayLabel = displayLabel.replace(prefixRegex, '').trim();
                      }
                      return (
                        <span className="inline-flex items-center rounded-full border border-muted/30 bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                          最近操作：{src}{displayLabel}{rel ? ` · ${rel}` : ''}
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
                        } catch (e) {
                          console.error('回滾失敗:', e);
                          toast.error('回滾操作失敗');
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      回滾上次操作
                    </Button>
  
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
                      onSetLastOperation={(op) => {
                        if (op) setUndoStack(prev => [...prev, { ...op, source: '表格視圖', timestamp: Date.now() }]);
                      }}
                    />
                  </div>
                ) : (
                  <CardView 
                    table={activeTable} 
                    onUpdateTable={updateTable}
                    // 新增：接收卡片視圖的回滾註冊並標註來源
                    onSetLastOperation={(op) => {
                      if (op) setUndoStack(prev => [...prev, { ...op, source: '卡片視圖', timestamp: Date.now() }]);
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