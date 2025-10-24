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
import { Plus, Table as TableIcon, Grid3X3, Download, Menu, X, RotateCcw, History, Trash2, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { toast, Toaster } from 'sonner';
import { Table, ViewMode } from '@/types';
import { TableManager } from '@/components/TableManager';
import { DataTable } from '@/components/DataTable';
import { CardView } from '@/components/CardView';
import { apiService } from '@/lib/api';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

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
  // 新增：當前操作用戶（後續可由 foundation 接入覆寫）
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<string[]>([]);
  const canAccessPermissionSettings = (currentRole === 'admin') || currentPermissions.includes('admin.manage');
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isPermissionsSettingsOpen, setIsPermissionsSettingsOpen] = useState(false);
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  // 新增：保護密碼登入的管理員與 Foundation 使用者列表
  const [isPasswordAdmin, setIsPasswordAdmin] = useState<boolean>(false);
  const [foundationUsers, setFoundationUsers] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const ADMIN_PASSWORD = '20251028';

  // 角色對應的默認權限（可二次調整）
  const ROLE_DEFAULT_PERMS: Record<string, string[]> = {
    '訪客': ['讀取'],
    '編輯者': ['讀取', '寫入'],
    '管理員': ['讀取', '寫入', '刪除', '管理'],
    '擁有者': ['讀取', '寫入', '刪除', '管理'],
  };
  const handleAdminLogin = () => {
    if (adminPassword.trim() === ADMIN_PASSWORD) {
      try {
        localStorage.setItem('currentUserName', 'admin');
        localStorage.setItem('foundation_user_role', 'admin');
        localStorage.setItem('foundation_user_permissions', JSON.stringify(['admin.manage']));
        localStorage.setItem('admin_login_method', 'password');
      } catch {}
      setCurrentUserName('admin');
      setCurrentRole('admin');
      setCurrentPermissions((prev) => Array.from(new Set([...(prev || []), 'admin.manage'])));
      setIsPasswordAdmin(true);
      toast.success('管理員登入成功');
      setIsLoginDialogOpen(false);
      setAdminPassword('');
    } else {
      toast.error('密碼錯誤');
    }
  };

  useEffect(() => {
    try {
      const name = localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name');
      const role = localStorage.getItem('foundation_user_role');
      const permsRaw = localStorage.getItem('foundation_user_permissions');
      if (name) setCurrentUserName(name);
      if (role) setCurrentRole(role);
      if (permsRaw) {
        try {
          const parsed = JSON.parse(permsRaw);
          if (Array.isArray(parsed)) setCurrentPermissions(parsed);
          else if (typeof permsRaw === 'string' && permsRaw.includes(',')) setCurrentPermissions(permsRaw.split(',').map(s => s.trim()).filter(Boolean));
        } catch {
          if (typeof permsRaw === 'string' && permsRaw.includes(',')) setCurrentPermissions(permsRaw.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
    } catch (e) {
      // 忽略本地存取錯誤
    }
  }, []);

  // 新增：Foundation 使用者列表（從 localStorage）
  useEffect(() => {
    try {
      const raw = localStorage.getItem('foundation_user_list');
      if (!raw) return;
      let list: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((x) => typeof x === 'string');
        }
      } catch {
        if (raw.includes(',')) {
          list = raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (list.length > 0) {
        setFoundationUsers(Array.from(new Set(list)));
      }
    } catch {}
  }, []);

  // 新增：密碼登入管理員保護狀態
  useEffect(() => {
    try {
      const method = localStorage.getItem('admin_login_method');
      setIsPasswordAdmin(method === 'password');
    } catch {
      setIsPasswordAdmin(false);
    }
  }, []);
  const startFoundationLogin = () => {
    const url = (import.meta as any).env?.VITE_FOUNDATION_LOGIN_URL || '';
    if (!url) {
      toast.error('未配置 Foundation 登入地址');
      return;
    }
    window.open(url, 'foundationLogin');
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = (event as any).data;
      if (data && data.type === 'FOUNDATION_AUTH_SUCCESS' && data.username) {
        try {
          localStorage.setItem('foundation_user_name', data.username);
        } catch {}
        setCurrentUserName(data.username);
        if (data.username === 'admin') {
          try { localStorage.setItem('admin_login_method', 'foundation'); } catch {}
          setIsPasswordAdmin(false);
        }
        // 合併至 Foundation 使用者列表
        try {
          const rawList = localStorage.getItem('foundation_user_list');
          let list: string[] = [];
          if (rawList) {
            try {
              const parsed = JSON.parse(rawList);
              if (Array.isArray(parsed)) list = parsed.filter((x) => typeof x === 'string');
            } catch {
              if (rawList.includes(',')) list = rawList.split(',').map((s) => s.trim()).filter(Boolean);
            }
          }
          list = Array.from(new Set([...(list || []), data.username]));
          localStorage.setItem('foundation_user_list', JSON.stringify(list));
          setFoundationUsers(list);
        } catch {}
        const foundationRole = typeof data.role === 'string' ? data.role : null;
        const foundationPerms = Array.isArray(data.permissions) ? data.permissions : [];
        if (foundationRole) {
          try { localStorage.setItem('foundation_user_role', foundationRole); } catch {}
          setCurrentRole(foundationRole);
        }
        let nextPerms = foundationPerms;
        const isAdvanced = (
          (foundationRole && foundationRole.toLowerCase() === 'admin') ||
          nextPerms.includes('admin.manage') ||
          (Array.isArray(data.groups) && data.groups.includes('permission-admin')) ||
          data.isAdvanced === true
        );
        if (isAdvanced) {
          nextPerms = Array.from(new Set([...(nextPerms || []), 'admin.manage']));
        }
        if (nextPerms && nextPerms.length > 0) {
          try { localStorage.setItem('foundation_user_permissions', JSON.stringify(nextPerms)); } catch {}
          setCurrentPermissions(nextPerms);
        }
        toast.success('Foundation 登入成功');
        setIsLoginDialogOpen(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('currentUserName');
      localStorage.removeItem('foundation_user_name');
      localStorage.removeItem('foundation_user_role');
      localStorage.removeItem('foundation_user_permissions');
      localStorage.removeItem('admin_login_method');
    } catch {}
    setCurrentUserName(null);
    setCurrentRole(null);
    setCurrentPermissions([]);
    setIsPasswordAdmin(false);
    toast.success('已登出');
  };
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

  // 歷史詳情狀態與輔助方法
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);
  const [historyDetailEntry, setHistoryDetailEntry] = useState<HistoryEntry | null>(null);
  const [historyDetailCurrent, setHistoryDetailCurrent] = useState<any | null>(null);
  const [historyDetailPrevious, setHistoryDetailPrevious] = useState<any | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  const openHistoryDetail = async (entry: HistoryEntry) => {
    if (!activeTable) return;
    setIsHistoryDetailOpen(true);
    setHistoryDetailEntry(entry);
    setHistoryDetailLoading(true);
    try {
      const current = await apiService.getHistoryEntry(activeTable.id, entry.id);
      setHistoryDetailCurrent(current);
      const idx = historyList.findIndex(e => e.id === entry.id);
      const prevEntry = idx >= 0 ? historyList[idx + 1] : undefined; // 列表最新在上，上一版本為下一項
      if (prevEntry) {
        const prev = await apiService.getHistoryEntry(activeTable.id, prevEntry.id);
        setHistoryDetailPrevious(prev);
      } else {
        setHistoryDetailPrevious(null);
      }
    } catch (e) {
      console.error('載入歷史詳情失敗:', e);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const computeSnapshotDiff = (prevSnap?: any, currSnap?: any) => {
    const result: Array<{ rowId: string; changes: Array<{ columnId: string; before: any; after: any }> }> = [];
    if (!currSnap || !currSnap.rows) return result;
    const prevById: Record<string, any> = {};
    (prevSnap?.rows || []).forEach((r: any) => { if (r?.id) prevById[r.id] = r; });
    const columns: Array<{ id: string; name?: string }> = currSnap.columns || [];
    (currSnap.rows || []).forEach((row: any) => {
      const rid = row?.id;
      if (!rid) return;
      const prev = prevById[rid];
      const changes: Array<{ columnId: string; before: any; after: any }> = [];
      columns.forEach((col: any) => {
        const cid = col.id;
        const before = prev ? prev[cid] : undefined;
        const after = row[cid];
        const normalize = (v: any) => {
          if (v && typeof v === 'object') {
            try { return JSON.stringify(v); } catch { return String(v); }
          }
          return v;
        };
        if (normalize(before) !== normalize(after)) {
          changes.push({ columnId: cid, before, after });
        }
      });
      if (!prev) {
        // 新增行：如果沒有欄位差異，補上一份所有欄位的狀態
        if (changes.length === 0) {
          columns.forEach((col: any) => {
            const cid = col.id;
            const after = row[cid];
            changes.push({ columnId: cid, before: undefined, after });
          });
        }
      }
      if (changes.length > 0) {
        result.push({ rowId: rid, changes });
      }
    });
    // 刪除行：存在於 prev 但不存在於 curr
    const currIds = new Set((currSnap.rows || []).map((r: any) => r.id));
    (prevSnap?.rows || []).forEach((r: any) => {
      if (!currIds.has(r.id)) {
        const changes: Array<{ columnId: string; before: any; after: any }> = [];
        (prevSnap.columns || []).forEach((col: any) => {
          const cid = col.id;
          changes.push({ columnId: cid, before: r[cid], after: undefined });
        });
        result.push({ rowId: r.id, changes });
      }
    });
    return result;
  };

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
            {/* 當前操作用戶顯示（為後續 foundation 登錄打底） */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex items-center justify-center text-sm text-muted-foreground mb-2 cursor-context-menu select-none">
                  <User className={`w-4 h-4 mr-2 ${currentUserName ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span className={currentUserName ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {currentUserName || '未登入'}
                  </span>
                  {!currentUserName && (
                    <button className="ml-2 px-2 py-1 rounded bg-primary text-primary-foreground" onClick={() => setIsLoginDialogOpen(true)}>登入</button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[180px]">
                <ContextMenuItem onClick={handleLogout}>登出</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => setIsPermissionsDialogOpen(true)}>查看權限</ContextMenuItem>
                {canAccessPermissionSettings && (
                  <ContextMenuItem onClick={() => setIsPermissionsSettingsOpen(true)}>權限設置</ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
            <a 
              href="https://omeoffice.com/usageFeedback" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium underline decoration-dotted underline-offset-2 flex items-center justify-center"
            >
              反馈建议入口
            </a>
            {/* 權限顯示映射與工具
              const PERMISSION_MAP: Record<string, { label: string; category: string; description: string; critical?: boolean }> = {
                'tables.read': { label: '讀取表格', category: '表格', description: '查看子表與欄位結構' },
                'tables.write': { label: '修改表格', category: '表格', description: '建立/刪除子表，調整欄位', critical: true },
                'rows.read': { label: '讀取行', category: '數據', description: '查看行數據與附件' },
                'rows.write': { label: '修改行', category: '數據', description: '新增/編輯/刪除行數據', critical: true },
                'files.upload': { label: '上傳附件', category: '文件', description: '向指定列上傳附件' },
                'history.read': { label: '查看歷史', category: '版本', description: '查看版本歷史與差異' },
                'history.write': { label: '回溯版本', category: '版本', description: '清除或回溯版本', critical: true },
                'admin.manage': { label: '系統管理', category: '系統', description: '管理使用者與權限', critical: true },
              };
              const ALL_PERMS = Object.keys(PERMISSION_MAP);
              const getEffectivePermissions = (role: string | null, perms: string[]) => {
                if (role === 'admin') return ALL_PERMS;
                return Array.isArray(perms) ? perms : [];
              };
              const groupByCategory = (perms: string[]) => {
                const groups: Record<string, string[]> = {};
                perms.forEach((p) => {
                  const cat = PERMISSION_MAP[p]?.category || '其他';
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(p);
                });
                return groups;
              };
              const getPermissionLabel = (p: string) => PERMISSION_MAP[p]?.label || p;
              const getPermissionDesc = (p: string) => PERMISSION_MAP[p]?.description || '無描述';
              const isCritical = (p: string) => !!PERMISSION_MAP[p]?.critical;
            {/* 權限查看對話框（放置於頁面中，使用 Portal 呈現） */}
            <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>查看權限</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  

                  {(() => {
                    const PERMISSION_MAP: Record<string, { label: string; category: string; description: string; critical?: boolean }> = {
                      'tables.read': { label: '查看子表與欄位結構', category: '表格', description: '查看表' },
                      'tables.write': { label: '建立/刪除子表，調整欄位', category: '表格', description: '改寫表', critical: true },
                      'rows.read': { label: '查看行數據與附件', category: '數據', description: '查看行' },
                      'rows.write': { label: '新增/編輯/刪除行數據', category: '數據', description: '改寫行', critical: true },
                      'files.upload': { label: '向指定行上傳附件', category: '文件', description: '上傳附件' },
                      'history.read': { label: '查看版本歷史與差異', category: '版本', description: '版本記錄' },
                      'history.write': { label: '清除或回溯版本', category: '版本', description: '版本回溯', critical: true },
                      'admin.manage': { label: '管理使用者與權限', category: '系統', description: '管理使用者與權限', critical: true },
                    };
                    const ALL_PERMS = Object.keys(PERMISSION_MAP);
                    const getEffectivePermissions = (role: string | null, perms: string[]) => {
                      if (role === 'admin') return ALL_PERMS;
                      return Array.isArray(perms) ? perms : [];
                    };
                    const groupByCategory = (perms: string[]) => {
                      const groups: Record<string, string[]> = {};
                      perms.forEach((p) => {
                        const cat = PERMISSION_MAP[p]?.category || '其他';
                        if (!groups[cat]) groups[cat] = [];
                        groups[cat].push(p);
                      });
                      return groups;
                    };
                    const getPermissionLabel = (p: string) => PERMISSION_MAP[p]?.label || p;
                    const getPermissionDesc = (p: string) => PERMISSION_MAP[p]?.description || '無描述';
                    const isCritical = (p: string) => !!PERMISSION_MAP[p]?.critical;
                    const roleKey = (currentRole || '').toLowerCase();
                    const roleStyle = roleKey === 'admin'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : roleKey === 'editor'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : roleKey === 'member'
                          ? 'bg-teal-50 border-teal-300 text-teal-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700';
                    const effective = getEffectivePermissions(currentRole, currentPermissions);
                    const critical = effective.filter(isCritical);
                    const groups = groupByCategory(effective);
                    const total = effective.length;
                    const ordered = effective.slice().sort((a, b) => Number(isCritical(b)) - Number(isCritical(a)));
                    return (
                      <>
                        <div className="mb-3 space-y-3">
                          <div className={`rounded-lg border px-3 py-2 text-sm ${roleStyle}`}>
                            <span className="font-semibold">當前角色：</span>
                            <span className="font-bold">{currentRole || '未設定'}</span>
                            <span className="ml-3 text-xs opacity-70">權限數：{total}</span>
                          </div>

                        </div>

                        <details className="mb-4" open>
                          <summary className="cursor-pointer font-semibold">角色說明</summary>
                          <div className="mt-2 text-sm text-gray-600">
                            {(() => {
                              const roleDescMap: Record<string, string> = {
                                admin: '擁有所有系統與數據管理權限，可建立/刪除表格、調整欄位、編輯行、管理使用者與權限。',
                                editor: '可讀寫數據並調整部分結構，但無法進行系統級管理操作。',
                                member: '可讀寫數據，不可變更表格結構或管理使用者。',
                                viewer: '僅可讀取數據與歷史，無任何寫入或結構調整權限。',
                              };
                              const roleKey = (currentRole || '').toLowerCase();
                              return roleDescMap[roleKey] || '角色資訊未定義，請聯絡管理員以確認您的權限範圍。';
                            })()}
                          </div>
                        </details>

                        <details className="border rounded-lg p-3" open={false}>
                           <summary className="cursor-pointer font-semibold flex items-center justify-between">
                             <span>權限詳情</span>
                             <span className="text-xs text-muted-foreground">{effective.length} 項</span>
                           </summary>
                           <ul className="mt-2 divide-y divide-muted/30">
                             {ordered.map((p) => (
                               <li key={p} className="py-2 flex items-start gap-3">
                                 <span className={`inline-flex items-center justify-center text-center rounded-sm border px-2 py-0.5 text-xs font-medium shrink-0 w-20 ${isCritical(p) ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-muted/40 bg-muted/20 text-muted-foreground'}`}>
                                   {isCritical(p) ? 'CRITICAL' : '標準'}
                                 </span>
                                 <span className="w-40 sm:w-56 md:w-72 shrink-0 font-semibold">
                                   {getPermissionLabel(p)}
                                 </span>
                                 <span className="flex-1 text-xs text-muted-foreground" title={getPermissionDesc(p)} style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                   {getPermissionDesc(p)}
                                 </span>
                               </li>
                             ))}
                           </ul>
                         </details>



                        <div className="rounded-lg border border-muted/40 p-3">
                          <div className="text-xs text-muted-foreground">
                            權限來源：本地登入或 Foundation 授權；不同來源的權限策略可能不同。
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </DialogContent>
            </Dialog>

            {/* 登入對話框 */}
            <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>登入</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">請使用 Foundation 帳號驗證登入，或以管理員密碼登入。</div>
                  <Button onClick={startFoundationLogin} className="w-full">使用 Foundation 登入</Button>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="adminPassword">管理員密碼</Label>
                    <Input id="adminPassword" type="password" placeholder="輸入管理員密碼" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                    <Button variant="secondary" className="w-full" onClick={handleAdminLogin}>管理員登入</Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setIsLoginDialogOpen(false)}>取消</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* 權限設定對話框 */}
            {canAccessPermissionSettings && (
              <Dialog open={isPermissionsSettingsOpen} onOpenChange={setIsPermissionsSettingsOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>權限設置</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">在同一對話框選擇角色 + 勾選權限，保存時同步到後端。</div>

                  {/* 目標使用者 */}
                  <div className="space-y-2">
                    <Label htmlFor="targetUsername">目標使用者</Label>
                    <div className="flex items-center gap-2">
                      <Input id="targetUsername" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="輸入要設置的使用者帳號才能選擇角色" />
                      {foundationUsers.length > 0 && (
                        <Select value={targetUsername} onValueChange={(val) => setTargetUsername(val)}>
                          <SelectTrigger size="sm" className="min-w-[200px]">
                            <SelectValue placeholder="從 Foundation 選擇" />
                          </SelectTrigger>
                          <SelectContent>
                            {foundationUsers.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    {(targetUsername === 'admin' && isPasswordAdmin) && (
                      <div className="text-xs text-red-600">不可修改使用密碼登入的管理員賬號權限</div>
                    )}
                  </div>

                  {/* 角色選擇 */}
                  <div className="space-y-2">
                    <Label>角色選擇</Label>

                    <Select value={currentRole || ''} onValueChange={(val) => {
                      setCurrentRole(val);
                      const defaults = ROLE_DEFAULT_PERMS[val] || [];
                      setCurrentPermissions(defaults);
                    }}>
                      <SelectTrigger size="sm" className="w-full" disabled={!targetUsername || (targetUsername === 'admin' && isPasswordAdmin)}>
                        <SelectValue placeholder={(targetUsername === 'admin' && isPasswordAdmin) ? '不可修改使用密碼登入的管理員賬號權限' : (!targetUsername ? '未選擇賬號，角色與權限操作將被禁用' : '選擇角色')} />
                      </SelectTrigger>
                      <SelectContent>
                        
                        <SelectItem value="訪客" disabled={!targetUsername}>訪客</SelectItem>
                        <SelectItem value="編輯者" disabled={!targetUsername}>編輯者</SelectItem>
                        <SelectItem value="管理員" disabled={!targetUsername}>管理員</SelectItem>
                        <SelectItem value="擁有者" disabled={!targetUsername}>擁有者</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 權限勾選 */}
                  <div className="space-y-2">
                    <Label>權限勾選</Label>
                    <div className="flex flex-col gap-2 text-sm">
                      {['讀取', '寫入', '刪除', '管理'].map((perm) => (
                        <label key={perm} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentPermissions.includes(perm)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCurrentPermissions((prev) => {
                                const set = new Set(prev);
                                if (checked) set.add(perm); else set.delete(perm);
                                return Array.from(set);
                              });
                            }}
                           disabled={!targetUsername || (targetUsername === 'admin' && isPasswordAdmin)}
                          />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsPermissionsSettingsOpen(false)}>取消</Button>

                    <Button size="sm" disabled={!targetUsername || (targetUsername === 'admin' && isPasswordAdmin)} onClick={async () => {
                       const target = (targetUsername || currentUserName);
                       if (!target) {
                         toast.error('請先輸入目標使用者或登入');
                         return;
                       }
                      if (target === 'admin' && isPasswordAdmin) {
                        toast.error('不可修改使用密碼登入的管理員賬號權限');
                        return;
                      }
                       try {
                         await apiService.updateUserSettings(target, {
                           role: currentRole || null,
                           permissions: currentPermissions,
                         });
                        // 僅在編輯自身時同步本地存儲
                        if (target === currentUserName) {
                          try {
                            localStorage.setItem('foundation_user_role', currentRole || '');
                            localStorage.setItem('foundation_user_permissions', JSON.stringify(currentPermissions));
                          } catch {}
                        }
                        toast.success('已保存角色與權限（已同步後端）');
                        setIsPermissionsSettingsOpen(false);
                      } catch (e) {
                        console.error('保存到後端失敗', e);
                        toast.error('保存到後端失敗');
                      }
                    }}>保存</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>)}
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
                              openHistoryDetail(entry);
                            }}>
                              <div className="flex flex-col">
                                <span className="text-sm">{entry.label || entry.id}</span>
                                <span className="text-xs text-muted-foreground">{formatLocalTime(entry.created_at)} · {entry.source || '未知來源'} · {entry.actor ? `由 ${entry.actor}` : '未知用戶'}</span>
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

                    {/* 歷史詳情對話框：顯示使用者、時間與資料差異 */}
                    <Dialog open={isHistoryDetailOpen} onOpenChange={setIsHistoryDetailOpen}>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>歷史詳情</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <div className="text-sm">操作：{historyDetailEntry?.label || historyDetailEntry?.id}</div>
                          <div className="text-sm">用戶：{historyDetailEntry?.actor || '未知用戶'}</div>
                          <div className="text-sm">來源：{historyDetailEntry?.source || '未知來源'}</div>
                          <div className="text-sm">時間：{historyDetailEntry ? formatLocalTime(historyDetailEntry.created_at) : ''}</div>
                        </div>
                        {historyDetailLoading ? (
                          <div className="text-sm text-muted-foreground">載入中...</div>
                        ) : (
                          <div className="mt-4">
                            <div className="text-sm font-medium mb-2">數據變更：</div>
                            {(() => {
                              const diffs = computeSnapshotDiff(historyDetailPrevious?.snapshot, historyDetailCurrent?.snapshot);
                              if (!diffs || diffs.length === 0) {
                                return <div className="text-sm text-muted-foreground">未檢測到可視化差異（或為初始快照）。</div>;
                              }
                              return (
                                <div className="space-y-3 max-h-64 overflow-auto pr-2">
                                  {diffs.map(d => (
                                    <div key={d.rowId} className="border rounded p-2">
                                      <div className="text-xs text-muted-foreground mb-1">行 ID：{d.rowId}</div>
                                      {d.changes.map(ch => (
                                        <div key={ch.columnId} className="text-sm">
                                          <span className="font-medium">{ch.columnId}</span>
                                          <span className="mx-2 text-muted-foreground">→</span>
                                          <span className="line-through mr-1">{typeof ch.before === 'object' ? JSON.stringify(ch.before) : String(ch.before ?? '')}</span>
                                          <span className="ml-1">{typeof ch.after === 'object' ? JSON.stringify(ch.after) : String(ch.after ?? '')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <div className="mt-4 flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsHistoryDetailOpen(false)}>關閉</Button>
                          <Button variant="default" onClick={async () => {
                            if (!activeTable || !historyDetailEntry) return;
                            try {
                              await apiService.revertToHistory(activeTable.id, historyDetailEntry.id);
                              setLastOpInfo({ label: `切換版本 | ${historyDetailEntry.label || historyDetailEntry.id}`, source: historyDetailEntry.source || '歷史', timestamp: Date.now() });
                              toast.success('已切換到所選版本');
                              setIsHistoryDetailOpen(false);
                              setHistoryDetailEntry(null);
                              refresh();
                              await loadHistory(activeTable.id);
                              await apiService.createHistorySnapshot(activeTable.id, { label: `切換版本 | ${historyDetailEntry.label || historyDetailEntry.id}`, source: '歷史' });
                              await loadHistory(activeTable.id);
                            } catch (e) {
                              console.error('切換版本失敗:', e);
                              toast.error('切換版本失敗');
                            }
                          }}>回溯到此版本</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
  
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