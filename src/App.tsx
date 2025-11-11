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
import { Plus, Table as TableIcon, Grid3X3, Download, Menu, X, RotateCcw, History, Trash2, User, HelpCircle, Database } from 'lucide-react';
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
  // 新增：賬號詳情對話框開關
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentGroups, setCurrentGroups] = useState<string[]>([]);
  const [currentScope, setCurrentScope] = useState<string | null>(null);
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

  const startOidcLogin = async () => {
    try {
      const AUTHORIZE_URL = 'https://ome-account.wiltechs.com/connect/authorize';
      const REDIRECT_URI = 'http://localhost:5000';
      const CLIENT_ID = '932647bf-39db-4991-8589-09bdb4074d2b';
      const SCOPE = 'offline_access openid email phone profile incubation_road';

      const base64url = (buf: Uint8Array) => {
        return btoa(String.fromCharCode(...Array.from(buf)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      };
      const randomBytes = (len: number) => {
        const arr = new Uint8Array(len);
        window.crypto.getRandomValues(arr);
        return arr;
      };
      const codeVerifier = base64url(randomBytes(32));
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const codeChallenge = base64url(new Uint8Array(digest));
      const state = base64url(randomBytes(16));

      sessionStorage.setItem('oidc_state', state);
      sessionStorage.setItem('oidc_verifier', codeVerifier);
      sessionStorage.setItem('oidc_return_to', window.location.href);

      const u = new URL(AUTHORIZE_URL);
      u.searchParams.set('client_id', CLIENT_ID);
      u.searchParams.set('redirect_uri', REDIRECT_URI);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('scope', SCOPE);
      u.searchParams.set('code_challenge', codeChallenge);
      u.searchParams.set('code_challenge_method', 'S256');
      u.searchParams.set('state', state);
      window.location.href = u.toString();
    } catch (e) {
      console.error('startOidcLogin error', e);
      toast.error('OIDC 登入初始化失敗');
    }
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

  // 新增：OIDC 回調處理（前端交換 code）
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const code = params.get('code');
        const state = params.get('state');
        if (!code) return;

        const expectedState = sessionStorage.getItem('oidc_state');
        if (expectedState && state && state !== expectedState) {
          toast.error('OIDC 回調 state 不匹配');
          return;
        }
        const codeVerifier = sessionStorage.getItem('oidc_verifier') || '';
        const REDIRECT_URI = 'http://localhost:5000';
        const CLIENT_ID = '932647bf-39db-4991-8589-09bdb4074d2b';

        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('client_id', CLIENT_ID);
        body.set('redirect_uri', REDIRECT_URI);
        body.set('code', code);
        body.set('code_verifier', codeVerifier);

        const resp = await fetch('https://ome-account.wiltechs.com/connect/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const tok = await resp.json();
        if (!resp.ok) {
          console.error('OIDC token exchange error', tok);
          toast.error('OIDC 令牌交換失敗');
          return;
        }

        const idToken = tok.id_token as string | undefined;
        const accessToken = tok.access_token as string | undefined;
        const refreshToken = tok.refresh_token as string | undefined;

        const base64urlDecode = (input: string) => {
          const s = input.replace(/-/g, '+').replace(/_/g, '/');
          const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
          const str = atob(s + pad);
          const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0)));
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(bytes);
        };

        if (idToken) {
          try {
            const parts = idToken.split('.');
            if (parts.length >= 2) {
              const payload = JSON.parse(base64urlDecode(parts[1]));
              const name = payload.name || payload.preferred_username || payload.email || (payload.sub ? String(payload.sub).slice(0, 8) : null);
              if (name) {
                try { localStorage.setItem('currentUserName', String(name)); } catch {}
                try { localStorage.setItem('foundation_user_name', String(name)); } catch {}
                setCurrentUserName(String(name));
              }
              const groups = Array.isArray(payload.groups) ? payload.groups : [];
              const isAdvanced = groups.includes('permission-admin');
              const nextPerms = isAdvanced ? ['admin.manage'] : [];
              if (nextPerms.length > 0) {
                try { localStorage.setItem('foundation_user_permissions', JSON.stringify(nextPerms)); } catch {}
                setCurrentPermissions(nextPerms);
              }
              const role = typeof payload.role === 'string' ? payload.role : null;
              if (role) {
                try { localStorage.setItem('foundation_user_role', role); } catch {}
                setCurrentRole(role);
              }
            }
          } catch (e) {
            console.warn('解析 id_token 失敗', e);
          }
        }

        if (accessToken) {
          try { localStorage.setItem('oidc_access_token', accessToken); } catch {}
          try { sessionStorage.setItem('oidc_access_token', accessToken); } catch {} // 同时保存到sessionStorage
        }
        if (refreshToken) {
          try { localStorage.setItem('oidc_refresh_token', refreshToken); } catch {}
          try { sessionStorage.setItem('oidc_refresh_token', refreshToken); } catch {} // 同时保存到sessionStorage
        }

        // 清理暫存 & 還原網址
        try {
          sessionStorage.removeItem('oidc_state');
          sessionStorage.removeItem('oidc_verifier');
          const returnTo = sessionStorage.getItem('oidc_return_to');
          if (returnTo) {
            sessionStorage.removeItem('oidc_return_to');
            window.history.replaceState(null, '', returnTo);
          } else {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            url.searchParams.delete('state');
            window.history.replaceState(null, '', url.toString());
          }
        } catch {}

        // 初始化用户信息
        try {
          // 从auth.ts导入统一的存储服务
          const { storageService } = await import('./lib/auth');
          
          // 从accessToken中提取用户标识（如果有）或使用默认值
          let userName = null;
          let userData = {};
          if (accessToken) {
            try {
              // 尝试从JWT token中提取信息（如果格式正确）
              const tokenParts = accessToken.split('.');
              if (tokenParts.length === 3) {
                const decoded = JSON.parse(atob(tokenParts[1]));
                userName = decoded.name || decoded.preferred_username || decoded.email || (decoded.sub ? String(decoded.sub).slice(0, 8) : null);
                userData = decoded; // 保存完整的token数据
              }
            } catch (e) {
              console.warn('解析token获取用户信息失败:', e);
            }
          }
          
          // 如果无法从token获取，使用一个基于时间的唯一标识
          if (!userName) {
            userName = 'user_' + Date.now().toString(36).substr(2, 9);
          }
          
          // 构建标准格式的用户信息对象
          const userInfo = {
            id: String(userData.sub || ''),
            name: userName,
            nickname: userName,
            company_name: String(userData.company || ''),
            department_name: String(userData.department || ''),
            group_name: String(userData.group || ''),
            position_name: String(userData.position || ''),
            supervisor_nickname: String(userData.supervisor || ''),
            supervisor_name: String(userData.supervisor || ''),
            foundation_user_role: String(userData.role || 'user'),
            foundation_user_permissions: Array.isArray(userData.permissions) ? userData.permissions : (Array.isArray(userData.groups) && userData.groups.includes('permission-admin') ? ['admin.manage'] : []),
            admin_login_method: 'oidc'
          };
          
          // 使用统一的存储服务保存用户信息
          storageService.setItem('userInfo', JSON.stringify(userInfo));
          storageService.setItem('currentUserName', userInfo.nickname || userInfo.name);
          storageService.setItem('foundation_user_name', userInfo.nickname || userInfo.name);
          storageService.setItem('foundation_user_role', userInfo.foundation_user_role || 'user');
          storageService.setItem('foundation_user_permissions', JSON.stringify(userInfo.foundation_user_permissions || []));
          storageService.setItem('foundation_user_email', String(userData.email || ''));
          storageService.setItem('foundation_user_groups', JSON.stringify(Array.isArray(userData.groups) ? userData.groups : []));
          storageService.setItem('foundation_user_scope', String(userData.scope || ''));
          
          // 更新组件状态
          setCurrentUserName(userInfo.nickname || userInfo.name);
          setCurrentRole(userInfo.foundation_user_role || 'user');
          setCurrentPermissions(userInfo.foundation_user_permissions || []);
          setCurrentEmail(String(userData.email || null));
          setCurrentGroups(Array.isArray(userData.groups) ? userData.groups : []);
          setCurrentScope(String(userData.scope || null));
          
          console.log('OIDC登录成功，已初始化用户信息:', userInfo);
          console.log('Token已保存到localStorage和sessionStorage');
          
          // 同步存储数据
          storageService.syncStorage();
        } catch (e) {
          console.error('初始化用户信息失败:', e);
        }

        toast.success('OIDC 登入成功');
        setIsLoginDialogOpen(false);
      } catch (e) {
        console.error('處理 OIDC 回調失敗', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // 获取两个存储中的token
        const localStorageToken = localStorage.getItem('oidc_access_token');
        const sessionStorageToken = sessionStorage.getItem('oidc_access_token');
        const localStorageRefreshToken = localStorage.getItem('oidc_refresh_token');
        const sessionStorageRefreshToken = sessionStorage.getItem('oidc_refresh_token');
        
        // 确保token在两个存储中都存在
        if (localStorageToken && !sessionStorageToken) {
          try { sessionStorage.setItem('oidc_access_token', localStorageToken); } catch {}
        } else if (sessionStorageToken && !localStorageToken) {
          try { localStorage.setItem('oidc_access_token', sessionStorageToken); } catch {}
        }
        
        if (localStorageRefreshToken && !sessionStorageRefreshToken) {
          try { sessionStorage.setItem('oidc_refresh_token', localStorageRefreshToken); } catch {}
        } else if (sessionStorageRefreshToken && !localStorageRefreshToken) {
          try { localStorage.setItem('oidc_refresh_token', sessionStorageRefreshToken); } catch {}
        }
        
        // 导入统一的存储服务和用户信息相关函数
        const { storageService, getUserInfo, fetchUserInfoFromHRSaaS } = await import('./lib/auth');
        
        // 使用统一的存储服务同步数据
        storageService.syncStorage();
        
        // 1. 获取token
        const token = storageService.getItem('oidc_access_token');
        
        // 2. 获取用户信息
        let userInfo = getUserInfo();
        let savedName = storageService.getItem('currentUserName') || storageService.getItem('foundation_user_name');
        
        // 3. 核心问题处理：如果有token但没有用户信息，尝试从token重建用户信息
        if (token && !userInfo && !savedName) {
          console.warn('检测到有token但无用户信息，尝试从token重建');
          try {
            // 尝试从token重建用户信息
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const decoded = JSON.parse(atob(tokenParts[1]));
              const name = decoded.name || decoded.preferred_username || decoded.email || 
                         ('sub' in decoded ? String(decoded.sub).slice(0, 8) : null);
              
              if (name) {
                const tempUserInfo = {
                  id: String(decoded.sub || ''),
                  name: name,
                  nickname: name,
                  company_name: String(decoded.company || ''),
                  department_name: String(decoded.department || ''),
                  group_name: String(decoded.group || ''),
                  position_name: String(decoded.position || ''),
                  supervisor_nickname: String(decoded.supervisor || ''),
                  supervisor_name: String(decoded.supervisor || ''),
                  foundation_user_role: String(decoded.role || 'user'),
                  foundation_user_permissions: Array.isArray(decoded.permissions) ? decoded.permissions : 
                                             (Array.isArray(decoded.groups) && decoded.groups.includes('permission-admin') ? ['admin.manage'] : []),
                  admin_login_method: 'oidc'
                };
                
                // 保存重建的用户信息
                storageService.setItem('userInfo', JSON.stringify(tempUserInfo));
                storageService.setItem('currentUserName', name);
                storageService.setItem('foundation_user_name', name);
                storageService.setItem('foundation_user_role', tempUserInfo.foundation_user_role || 'user');
                storageService.setItem('foundation_user_permissions', JSON.stringify(tempUserInfo.foundation_user_permissions || []));
                storageService.setItem('foundation_user_email', String(decoded.email || ''));
                storageService.setItem('foundation_user_groups', JSON.stringify(Array.isArray(decoded.groups) ? decoded.groups : []));
                
                console.log('成功从token重建用户信息:', name);
                savedName = name;
                userInfo = tempUserInfo;
              }
            }
          } catch (e) {
            console.error('从token重建用户信息失败:', e);
          }
        }
        
        // 4. 如果仍然没有用户信息但有token，这是一个严重问题
        if (token && !savedName) {
          console.error('有token但无法重建用户信息');
          toast.error('认证状态异常，请重新登录');
          // 清除无效的token
          storageService.clearAuthData();
          return;
        }
        
        // 5. 加载用户信息到状态
        if (userInfo) {
          setCurrentUserName(userInfo.nickname || userInfo.name);
          setCurrentRole(userInfo.foundation_user_role || 'user');
          setCurrentPermissions(userInfo.foundation_user_permissions || []);
          
          // 加载额外的用户信息
          const savedEmail = storageService.getItem('foundation_user_email');
          const savedGroupsStr = storageService.getItem('foundation_user_groups');
          const savedScope = storageService.getItem('foundation_user_scope');
          
          if (savedEmail) setCurrentEmail(savedEmail);
          if (savedGroupsStr) {
            try {
              const groups = JSON.parse(savedGroupsStr);
              if (Array.isArray(groups)) {
                setCurrentGroups(groups);
              }
            } catch (e) {
              console.warn('解析群组信息失败:', e);
            }
          }
          if (savedScope) setCurrentScope(savedScope);
          
          console.log('已从userInfo对象加载用户信息');
        } else if (savedName) {
          // 回退到旧的加载方式
          setCurrentUserName(savedName);
          const savedRole = storageService.getItem('foundation_user_role');
          const savedPermissionsStr = storageService.getItem('foundation_user_permissions');
          const savedEmail = storageService.getItem('foundation_user_email');
          const savedGroupsStr = storageService.getItem('foundation_user_groups');
          const savedScope = storageService.getItem('foundation_user_scope');
          
          if (savedRole) setCurrentRole(savedRole);
          if (savedPermissionsStr) {
            try {
              const permissions = JSON.parse(savedPermissionsStr);
              if (Array.isArray(permissions)) {
                setCurrentPermissions(permissions);
              }
            } catch (e) {
              console.warn('解析权限信息失败:', e);
            }
          }
          if (savedEmail) setCurrentEmail(savedEmail);
          if (savedGroupsStr) {
            try {
              const groups = JSON.parse(savedGroupsStr);
              if (Array.isArray(groups)) {
                setCurrentGroups(groups);
              }
            } catch (e) {
              console.warn('解析群组信息失败:', e);
            }
          }
          if (savedScope) setCurrentScope(savedScope);
          
          console.log('已从存储加载基础用户信息');
        }
        
        // 6. 尝试通过HRSaaS API获取最新用户信息（异步，不阻塞UI）
        if (token) {
          try {
            console.log('尝试通过HRSaaS API获取最新用户信息');
            const newUserInfo = await fetchUserInfoFromHRSaaS(token);
            
            if (newUserInfo) {
              // 更新状态
              setCurrentUserName(newUserInfo.nickname || newUserInfo.name);
              if (newUserInfo.foundation_user_role) {
                setCurrentRole(newUserInfo.foundation_user_role);
              }
              if (newUserInfo.foundation_user_permissions) {
                setCurrentPermissions(newUserInfo.foundation_user_permissions);
              }
              
              // 加载额外的用户信息
              const savedEmail = storageService.getItem('foundation_user_email');
              const savedGroupsStr = storageService.getItem('foundation_user_groups');
              
              if (savedEmail) setCurrentEmail(savedEmail);
              if (savedGroupsStr) {
                try {
                  const groups = JSON.parse(savedGroupsStr);
                  if (Array.isArray(groups)) {
                    setCurrentGroups(groups);
                  }
                } catch (e) {
                  console.warn('解析群组信息失败:', e);
                }
              }
              
              console.log('通过HRSaaS API成功获取最新用户信息');
              setIsLoginDialogOpen(false);
            } else {
              // 如果userInfo为null，可能是401错误，显示前端提示
              console.error('HRSaaS API调用失败：未返回用户信息');
              // 假设有toast.error可以使用
              if (typeof toast !== 'undefined' && toast.error) {
                toast.error('认证信息已过期，请重新登录');
              }
            }
          } catch (error) {
            console.warn('HRSaaS API调用失败，继续使用缓存的用户信息:', error);
            // 不抛出错误，允许应用继续使用缓存的用户信息
          }
        }
        
        // 失败时继续使用已加载的本地信息，不影响用户体验
        // 失败时继续使用已加载的本地信息，不影响用户体验
      } catch (error) {
        console.error('初始化用户信息时发生错误:', error);
      }
    })();
  }, []);

  const handleLogout = () => {
    try {
      // 退出登錄時清空本地與會話緩存
      localStorage.clear();
      try { sessionStorage.clear(); } catch {}
    } catch {}
    setCurrentUserName(null);
    setCurrentRole(null);
    setCurrentPermissions([]);
    setIsPasswordAdmin(false);
    setCurrentEmail(null);
    setCurrentGroups([]);
    setCurrentScope(null);
    setIsAccountDialogOpen(false);
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
  const [historyMenuMeta, setHistoryMenuMeta] = useState<Record<string, { time: string; user: string; action: string; view: string; columns: string[]; type: 'add' | 'edit' | 'delete' | 'other'; }>>({});
// 新增：歷史分頁狀態
const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
const [historyHasMore, setHistoryHasMore] = useState<boolean>(false);
const [historyPageSize, setHistoryPageSize] = useState<number>(20);
  const extractActionFromLabel = (l?: string) => {
    if (!l) return '修改';
    const first = String(l).split('|')[0].trim();
    return first || '修改';
  };
  const classifyActionType = (action: string): 'add' | 'edit' | 'delete' | 'other' => {
    const a = action.toLowerCase();
    if (/[添加增新]/.test(action) || a.includes('add') || a.includes('create')) return 'add';
    if (/[删除移除]/.test(action) || a.includes('delete') || a.includes('remove')) return 'delete';
    if (/[修改编輯编辑]/.test(action) || a.includes('edit') || a.includes('update')) return 'edit';
    return 'other';
  };
  const loadHistory = async (tableId: string, append: boolean = false) => {
    setHistoryLoading(true);
    try {
      const resp = await apiService.getHistoryList(tableId, { limit: historyPageSize, cursor: append ? historyNextCursor || undefined : undefined });
      const items = Array.isArray(resp) ? resp : (resp?.items || []);
      const nextCursor = Array.isArray(resp) ? null : (resp?.nextCursor || null);

      if (!append) {
        if (items.length === 0) {
          await apiService.createHistorySnapshot(tableId, { label: '初始載入', source: '系統' });
          const resp2 = await apiService.getHistoryList(tableId, { limit: historyPageSize });
          const items2 = Array.isArray(resp2) ? resp2 : (resp2?.items || []);
          const nextCursor2 = Array.isArray(resp2) ? null : (resp2?.nextCursor || null);
          setHistoryList(items2);
          setHistoryNextCursor(nextCursor2);
          setHistoryHasMore(items2.length >= historyPageSize && !!nextCursor2);
        } else {
          setHistoryList(items);
          setHistoryNextCursor(nextCursor);
          setHistoryHasMore(items.length >= historyPageSize && !!nextCursor);
        }
      } else {
        setHistoryList(prev => [...prev, ...items]);
        setHistoryNextCursor(nextCursor);
        setHistoryHasMore(items.length >= historyPageSize && !!nextCursor);
      }

      // 構建下拉菜單的二行摘要（前 12 條），以「當前表」為對比基準
      setHistoryMenuMeta({});
      if (activeTable) {
        const currentState = { columns: activeTable.columns || [], rows: activeTable.rows || [] };
        const sourceList = (append ? [...historyList, ...items] : items);
        const limit = Math.min(sourceList.length, 12);
        const top = sourceList.slice(0, limit);
        const metaPairs: Array<[string, { time: string; user: string; action: string; view: string; columns: string[]; type: 'add' | 'edit' | 'delete' | 'other'; }]> = [];
        for (const entry of top) {
          try {
            const detail = await apiService.getHistoryEntry(tableId, entry.id);
            const prevSnap = detail?.snapshot;
            const diffs = computeSnapshotDiff(prevSnap, currentState);
            const actor = entry.actor || '未知用戶';
            const timeStr = formatLocalTime(entry.created_at);
            const action = extractActionFromLabel(entry.label || entry.id);
            const view = entry.source || '未知來源';
            const columnNameById = new Map((currentState.columns || []).map((c: any) => [c.id, c.name || c.id]));
            const changedColIds = new Set<string>();
            let addCount = 0, deleteCount = 0, editCount = 0;
            for (const d of diffs) {
              for (const ch of d.changes) {
                changedColIds.add(ch.columnId);
                const beforeUndef = typeof ch.before === 'undefined';
                const afterUndef = typeof ch.after === 'undefined';
                if (beforeUndef && !afterUndef) addCount++;
                else if (!beforeUndef && afterUndef) deleteCount++;
                else editCount++;
              }
            }
            const cols = Array.from(changedColIds).slice(0, 4).map(cid => String(columnNameById.get(cid)));
            let type: 'add' | 'edit' | 'delete' | 'other' = 'other';
            if (addCount > 0 && deleteCount === 0 && editCount === 0) type = 'add';
            else if (deleteCount > 0 && addCount === 0 && editCount === 0) type = 'delete';
            else if (editCount > 0 || (addCount > 0 && deleteCount > 0)) type = 'edit';
            metaPairs.push([entry.id, { time: timeStr, user: actor, action, view, columns: cols, type }]);
          } catch (e) {
            console.warn('生成歷史菜單元數據失敗:', e);
          }
        }
        setHistoryMenuMeta(prev => ({ ...prev, ...Object.fromEntries(metaPairs) }));
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
    setHistoryNextCursor(null);
    setHistoryHasMore(false);
    if (t?.id) {
      loadHistory(t.id, false);
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

      // 取得上一版本快照，用於顯示「本次操作」的變更（prev → current）
      // 優先從已載入列表尋找上一條；若未找到，則使用後端 cursor 依據當前條目的 created_at 拉取上一條
      let prevEntryMeta: any | null = null;
      try {
        const sorted = [...historyList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const idx = sorted.findIndex(e => e.id === entry.id);
        prevEntryMeta = (idx >= 0 && idx < sorted.length - 1) ? sorted[idx + 1] : null;
        if (!prevEntryMeta && current?.created_at) {
          const listResp = await apiService.getHistoryList(activeTable.id, { limit: 1, cursor: current.created_at });
          const items = Array.isArray(listResp) ? listResp : (listResp?.items || []);
          prevEntryMeta = items[0] || null;
        }
      } catch (e) {
        console.warn('查找上一歷史項失敗:', e);
      }
      if (prevEntryMeta?.id) {
        const prev = await apiService.getHistoryEntry(activeTable.id, prevEntryMeta.id);
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
        const stableStringify = (val: any): string => {
          try {
            if (val === null) return 'null';
            if (Array.isArray(val)) return `[${val.map(stableStringify).join(',')}]`;
            if (typeof val === 'object') {
              const keys = Object.keys(val).sort();
              return `{${keys.map(k => JSON.stringify(k)+':'+stableStringify(val[k])).join(',')}}`;
            }
            return JSON.stringify(val);
          } catch {
            return String(val);
          }
        };
        const normalize = (v: any) => {
          if (v && typeof v === 'object') return stableStringify(v);
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

  // 新版本對比：將歷史版本與當前版本全面對比
  const computeVersionDiff = (oldSnap?: any, newSnap?: any) => {
    const diff = { added: [] as any[], deleted: [] as any[], modified: [] as any[], moved: [] as any[] };
    if (!oldSnap || !newSnap) return diff;
    const oldRows: any[] = oldSnap.rows || [];
    const newRows: any[] = newSnap.rows || [];
    const oldColumns: any[] = oldSnap.columns || [];
    const newColumns: any[] = newSnap.columns || [];

    const oldIndexById: Record<string, number> = {};
    oldRows.forEach((r, i) => { if (r?.id) oldIndexById[r.id] = i; });
    const newIndexById: Record<string, number> = {};
    newRows.forEach((r, i) => { if (r?.id) newIndexById[r.id] = i; });

    const oldById: Record<string, any> = {};
    oldRows.forEach(r => { if (r?.id) oldById[r.id] = r; });
    const newById: Record<string, any> = {};
    newRows.forEach(r => { if (r?.id) newById[r.id] = r; });

    const stableStringify = (val: any): string => {
      try {
        if (val === null) return 'null';
        if (Array.isArray(val)) return `[${val.map(stableStringify).join(',')}]`;
        if (typeof val === 'object') {
          const keys = Object.keys(val).sort();
          return `{${keys.map(k => JSON.stringify(k)+':'+stableStringify(val[k])).join(',')}}`;
        }
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    };
    const normalize = (v: any) => { if (v && typeof v === 'object') return stableStringify(v); return v; };

    const colIdsSet = new Set<string>();
    oldColumns.forEach((c: any) => c?.id && colIdsSet.add(c.id));
    newColumns.forEach((c: any) => c?.id && colIdsSet.add(c.id));
    const colIds = Array.from(colIdsSet);

    // 新增與修改
    newRows.forEach((nr, idxNew) => {
      const id = nr?.id; if (!id) return;
      const or = oldById[id];
      if (!or) {
        diff.added.push({ rowId: id, indexNew: idxNew, row: nr });
      } else {
        const changes: Array<{ columnId: string; before: any; after: any }> = [];
        colIds.forEach(cid => {
          const before = or[cid];
          const after = nr[cid];
          if (normalize(before) !== normalize(after)) {
            changes.push({ columnId: cid, before, after });
          }
        });
        if (changes.length > 0) {
          diff.modified.push({ rowId: id, indexOld: oldIndexById[id], indexNew: newIndexById[id], changes });
        }
      }
    });

    // 刪除
    oldRows.forEach((or, idxOld) => {
      const id = or?.id; if (!id) return;
      if (!newById[id]) {
        diff.deleted.push({ rowId: id, indexOld: idxOld, row: or });
      }
    });

    // 移動（拖動）：排除純插入/刪除造成的整體位移，並抑制批量重排序噪音
    const addedList = Object.keys(newIndexById)
      .filter(id => oldIndexById[id] === undefined)
      .map(id => ({ id, idx: newIndexById[id] }));
    const deletedList = Object.keys(oldIndexById)
      .filter(id => newIndexById[id] === undefined)
      .map(id => ({ id, idx: oldIndexById[id] }));

    const candidateMoves: Array<{ rowId: string; from: number; to: number; effectiveShift: number }> = [];
    Object.keys(oldIndexById).forEach(id => {
      const newIdx = newIndexById[id];
      if (newIdx === undefined) return; // 已刪除的不計入移動
      const oldIdx = oldIndexById[id];
      const addedBefore = addedList.filter(a => a.idx < newIdx).length;
      const deletedBefore = deletedList.filter(d => d.idx < oldIdx).length;
      const effectiveShift = newIdx - oldIdx - addedBefore + deletedBefore;
      if (effectiveShift !== 0) {
        candidateMoves.push({ rowId: id, from: oldIdx, to: newIdx, effectiveShift });
      }
    });

    // 抑制批量重排序噪音：若絕大多數行具有相同有效位移，視為視圖層排序影響而非拖動
    if (candidateMoves.length > 0) {
      const freq: Record<number, number> = {};
      candidateMoves.forEach(m => { freq[m.effectiveShift] = (freq[m.effectiveShift] || 0) + 1; });
      const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      const [dominantShiftStr, dominantCount] = entries[0] || [undefined, 0];
      const dominantShift = dominantShiftStr !== undefined ? Number(dominantShiftStr) : 0;
      const dominantRatio = dominantCount / Math.max(1, candidateMoves.length);
      const bulkShiftLikely = Math.abs(dominantShift) <= (addedList.length + deletedList.length) && dominantRatio >= 0.8;
      const moves = bulkShiftLikely ? [] : candidateMoves;
      moves.forEach(m => diff.moved.push({ rowId: m.rowId, from: m.from, to: m.to }));
    }

    return diff;
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
        <div className="w-64 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">孵化之路信息管理系統</h1>
            <div className="mt-2 flex items-center justify-between text-sm rounded-md px-3 py-2 hover:bg-muted">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-green-600" />
                <span className="text-muted-foreground">本地存儲 (SQLite)</span>
              </div>
              {error && (
                <span className="text-sm text-red-600">連接錯誤</span>
              )}
            </div>
            
            {/* 版本信息 - 显示在本地存储文字的下方 */}
            <div className="mt-2 flex items-center text-sm rounded-md px-3 py-2 hover:bg-muted">
              <History className="w-4 h-4 text-muted-foreground mr-2" />
              <span className="text-muted-foreground">版本信息: v1.1</span>
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
          
          {/* 反馈建议入口與用戶狀態已移至側邊欄底部統一展示 */}
          <div className="hidden mt-auto p-4 border-t border-border">
            {/* 當前操作用戶顯示（為後續 foundation 登錄打底） */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="flex items-center justify-between text-sm mb-2 cursor-context-menu select-none rounded-md px-3 py-2 hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <User className={`w-4 h-4 ${currentUserName ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <span className={currentUserName ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {currentUserName || '未登入'}
                    </span>
                  </div>
                  {!currentUserName && (
                    <button className="px-2 py-1 rounded-md border border-border bg-card text-foreground hover:bg-muted" onClick={() => setIsLoginDialogOpen(true)}>登入</button>
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
            {/* 反馈入口已移至侧边栏底部以优化布局與一致性 */}
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
                  <div className="text-sm text-muted-foreground">請使用 OIDC 帳號驗證登入，或以管理員密碼登入。</div>
                  <Button onClick={startOidcLogin} className="w-full">使用 OIDC 登入</Button>
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
          <div className="mt-auto p-4 border-t border-border">
             {/* 當前操作用戶顯示（搬至底部，與反饋入口並列） */}
             {currentUserName ? (
               <ContextMenu>
                 <ContextMenuTrigger asChild>
                   <div className="flex items-center justify-between text-sm mb-2 cursor-context-menu select-none rounded-md px-3 py-2 hover:bg-muted">
                     <div className="flex items-center gap-2">
                       <User className={`w-4 h-4 ${currentUserName ? 'text-green-600' : 'text-muted-foreground'}`} />
                       <span className={currentUserName ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                         {currentUserName || '未登入'}
                       </span>
                     </div>
                   </div>
                 </ContextMenuTrigger>
                 <ContextMenuContent className="min-w-[200px]">
                   <ContextMenuItem onClick={() => setIsAccountDialogOpen(true)}>賬號詳情</ContextMenuItem>
                   <ContextMenuItem onClick={() => setIsPermissionsDialogOpen(true)}>查看權限</ContextMenuItem>
                   {canAccessPermissionSettings && (
                     <ContextMenuItem onClick={() => setIsPermissionsSettingsOpen(true)}>權限設置</ContextMenuItem>
                   )}
                   <ContextMenuSeparator />
                   <ContextMenuItem onClick={handleLogout}>退出登錄</ContextMenuItem>
                 </ContextMenuContent>
               </ContextMenu>
             ) : (
               <div
                 className="flex items-center justify-between text-sm mb-2 cursor-default select-none rounded-md px-3 py-2 hover:bg-muted"
                 onContextMenu={(e) => e.preventDefault()}
               >
                 <div className="flex items-center gap-2">
                   <User className={`w-4 h-4 ${currentUserName ? 'text-green-600' : 'text-muted-foreground'}`} />
                   <span className={currentUserName ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                     {currentUserName || '未登入'}
                   </span>
                 </div>
                 <button className="px-2 py-1 rounded-md border border-border bg-card text-foreground hover:bg-muted" onClick={() => setIsLoginDialogOpen(true)}>登入</button>
               </div>
             )}
  
               {/* 賬號詳情對話框 */}
             <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                   <DialogTitle>賬號詳情</DialogTitle>
                 </DialogHeader>
                 <div className="space-y-3 text-sm">
                   <div className="flex items-center justify-between">
                     <span className="text-muted-foreground">賬號名</span>
                     <span className="font-medium">{currentUserName || '未登入'}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-muted-foreground">角色</span>
                     <span className="font-medium">{currentRole || '未設定'}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-muted-foreground">Email</span>
                     <span className="font-medium">{currentEmail || '未提供'}</span>
                   </div>
                   <div>
                     <div className="text-muted-foreground mb-1">用戶組</div>
                     {(currentGroups && currentGroups.length > 0) ? (
                       <div className="flex flex-wrap gap-2">
                         {currentGroups.map((g) => (
                           <span key={g} className="px-2 py-1 rounded-md border text-xs">{g}</span>
                         ))}
                       </div>
                     ) : (
                       <div className="text-muted-foreground">無</div>
                     )}
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-muted-foreground">Scope</span>
                     <span className="font-medium">{currentScope || '未提供'}</span>
                   </div>
                   <div>
                     <div className="text-muted-foreground mb-1">權限</div>
                     {(currentPermissions && currentPermissions.length > 0) ? (
                       <div className="flex flex-wrap gap-2">
                         {currentPermissions.map((p) => (
                           <span key={p} className="px-2 py-1 rounded-md border text-xs">{p}</span>
                         ))}
                       </div>
                     ) : (
                       <div className="text-muted-foreground">無</div>
                     )}
                   </div>
                 </div>
               </DialogContent>
             </Dialog>

             <a 
               href="https://omeoffice.com/usageFeedback" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-2"
             >
               <HelpCircle className="w-4 h-4 text-primary" />
               使用反馈
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
                              openHistoryDetail(entry);
                            }}>
                              <div className="flex items-start gap-2">
                                <span className={`mt-1 w-2 h-2 rounded-full ${
                                  (historyMenuMeta[entry.id]?.type === 'add') ? 'bg-green-500' :
                                  (historyMenuMeta[entry.id]?.type === 'delete') ? 'bg-red-500' :
                                  (historyMenuMeta[entry.id]?.type === 'edit') ? 'bg-blue-500' : 'bg-gray-400'
                                }`}></span>
                                <div className="flex flex-col">
                                  <span className="text-xs">
                                    {(historyMenuMeta[entry.id]?.time || formatLocalTime(entry.created_at)) + ' -- ' + (historyMenuMeta[entry.id]?.user || entry.actor || '未知用戶')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {`【${historyMenuMeta[entry.id]?.action || extractActionFromLabel(entry.label || entry.id)}】`}
                                  </span>
                                </div>
                              </div>
                            </DropdownMenuItem>
                          ))
                        ))}
                        {historyHasMore && (
                          <DropdownMenuItem onClick={() => {
                            if (!activeTable) return;
                            loadHistory(activeTable.id, true);
                          }}>
                            載入更多...
                          </DropdownMenuItem>
                        )}
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
                      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle>歷史詳情</DialogTitle>
                        </DialogHeader>
                        {(() => {
                          const prevSnap = historyDetailPrevious?.snapshot;
                          const currSnap = historyDetailCurrent?.snapshot;
                          const actor = historyDetailEntry?.actor || '未知用戶';
                          const time = historyDetailEntry ? formatLocalTime(historyDetailEntry.created_at) : '';
                          const action = (historyDetailEntry?.label || historyDetailEntry?.id || '').split('|')[0] || '修改';
                          const title = (prevSnap && currSnap) ? '操作對比：上一版本 vs 此版本' : '版本對比：歷史版本 vs 當前版本';
                          return (
                            <div className="space-y-2">
                              <div className="text-sm">{title}</div>
                              <div className="text-sm">操作：{action}</div>
                              <div className="text-sm">用戶：{actor}</div>
                              <div className="text-sm">時間：{time}</div>
                            </div>
                          );
                        })()}
                        {historyDetailLoading ? (
                          <div className="text-sm text-muted-foreground">載入中...</div>
                        ) : (
                          <div className="mt-4">
                            <div className="text-sm font-medium mb-2">數據變更：</div>
                            {(() => {
                              const prevSnap = historyDetailPrevious?.snapshot;
                              const currSnap = historyDetailCurrent?.snapshot;
                              const latestSnap = activeTable ? { columns: activeTable.columns || [], rows: activeTable.rows || [] } : null;
                              // 優先對比「上一版本 → 此版本」，若無上一版本則退回「此版本 → 當前版本」
                              const baseSnap = (prevSnap && currSnap) ? prevSnap : currSnap;
                              const nextSnap = (prevSnap && currSnap) ? currSnap : latestSnap;
                              const diff = computeVersionDiff(baseSnap, nextSnap);
                              const colName = (cid: string) => (nextSnap?.columns || activeTable?.columns || []).find((c: any) => c.id === cid)?.name || cid;
                              const rowIndexNew = (id: string) => {
                                const rows = nextSnap?.rows || [];
                                const idx = rows.findIndex((r: any) => r.id === id);
                                return idx >= 0 ? idx + 1 : '';
                              };
                              const rowIndexOld = (id: string) => {
                                const rows = baseSnap?.rows || [];
                                const idx = rows.findIndex((r: any) => r.id === id);
                                return idx >= 0 ? idx + 1 : '';
                              };
                              const renderChanges = (changes: Array<{columnId: string; before: any; after: any}>) => (
                                <div className="mt-1 space-y-1">
                                  {changes.map(ch => (
                                    <div key={ch.columnId} className="text-sm">
                                      <span className="font-medium">{colName(ch.columnId)}</span>
                                      <span className="ml-2 px-1 rounded bg-blue-100 text-blue-700">修改</span>
                                      <span className="ml-2 text-muted-foreground">{String(ch.before ?? '')} → {String(ch.after ?? '')}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                              const hasDiff = diff.added.length || diff.deleted.length || diff.modified.length || diff.moved.length;
                              if (!hasDiff) {
                                return <div className="text-sm text-muted-foreground">未檢測到此操作引起的差異。</div>;
                              }
                              return (
                                <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">
                                  {diff.added.length > 0 && (
                                    <div>
                                      <div className="text-sm font-medium mb-1">新增（{diff.added.length}）</div>
                                      <div className="space-y-2">
                                        {diff.added.map(a => (
                                          <div key={a.rowId} className="border rounded p-2">
                                            <div className="text-xs text-green-700">行：{rowIndexNew(a.rowId) || a.rowId}</div>
                                            {renderChanges(Object.keys(a.row || {}).map(cid => ({ columnId: cid, before: undefined, after: a.row[cid] })))}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {diff.modified.length > 0 && (
                                    <div>
                                      <div className="text-sm font-medium mb-1">修改（{diff.modified.length}）</div>
                                      <div className="space-y-2">
                                        {diff.modified.map(m => (
                                          <div key={m.rowId} className="border rounded p-2">
                                            <div className="text-xs text-blue-700">行：{rowIndexNew(m.rowId) || rowIndexOld(m.rowId) || m.rowId}</div>
                                            {renderChanges(m.changes)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {diff.deleted.length > 0 && (
                                    <div>
                                      <div className="text-sm font-medium mb-1">刪除（{diff.deleted.length}）</div>
                                      <div className="space-y-2">
                                        {diff.deleted.map(d => (
                                          <div key={d.rowId} className="border rounded p-2">
                                            <div className="text-xs text-red-700">行：{rowIndexOld(d.rowId) || d.rowId}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">此行已刪除</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {(() => {
                                     const actionText = (historyDetailEntry?.label || historyDetailEntry?.id || '').split('|')[0] || '';
                                     const suppressMoves = /新增|刪除|批量刪除/.test(actionText) || (diff.deleted.length > 0 && diff.moved.length > 0);
                                     if (suppressMoves || diff.moved.length === 0) return null;
                                     return (
                                       <div>
                                         <div className="text-sm font-medium mb-1">拖動（{diff.moved.length}）</div>
                                         <div className="space-y-2">
                                           {diff.moved.map(move => (
                                             <div key={move.rowId} className="border rounded p-2">
                                               <div className="text-xs text-purple-700">行：{rowIndexOld(move.rowId) || move.rowId} → {rowIndexNew(move.rowId) || move.rowId}</div>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     );
                                   })()}
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
                           // 直接使用前端當前狀態構造快照，避免後端未落盤導致快照缺失變更
                           const snapshot = activeTable ? {
                             id: activeTable.id,
                             name: activeTable.name,
                             columns: activeTable.columns || [],
                             rows: activeTable.rows || [],
                             // 保留行順序（用當前渲染順序）
                             order: (activeTable.rows || []).map(r => r.id),
                           } : undefined;
                           await apiService.createHistorySnapshot(activeTable.id, { label: augmented.label, source: augmented.source, snapshot });
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