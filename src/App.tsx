import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useTables } from '@/hooks/use-tables';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Table as TableIcon, Grid3X3, Download, Menu, X } from 'lucide-react';
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
                    />
                  </div>
                ) : (
                  <CardView table={activeTable} onUpdateTable={updateTable} />
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