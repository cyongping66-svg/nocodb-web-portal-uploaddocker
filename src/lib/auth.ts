// 定义用户信息接口
export interface UserInfo {
  id: string;
  name: string;         // 姓名
  nickname: string;     // 英文名
  company_name: string; // 公司
  department_name: string; // 部门
  group_name: string;   // 小组
  position_name: string; // 职位
  supervisor_nickname: string; // 上级英文名
  supervisor_name: string; // 上级
  foundation_user_role?: string; // 角色
  foundation_user_permissions?: string[]; // 权限
  admin_login_method?: string; // 登录方式
}

// HRSaaS API配置
const HRSaaS_API_URL = 'https://hrsaastest-1-api.wiltechs.com/api/user/employee-info';

// 定义错误类型
export interface AuthError extends Error {
  statusCode?: number;
  isAuthenticationError?: boolean;
}

// 创建统一的存储服务
const storageService = {
  // 设置值到两个存储
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch (e) { console.warn('Failed to save to localStorage:', e); }
    try { sessionStorage.setItem(key, value); } catch (e) { console.warn('Failed to save to sessionStorage:', e); }
  },
  
  // 获取值，优先从sessionStorage
  getItem(key: string): string | null {
    try { return sessionStorage.getItem(key) || localStorage.getItem(key); } catch (e) { console.warn('Failed to get from storage:', e); return null; }
  },
  
  // 移除值
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch (e) { console.warn('Failed to remove from localStorage:', e); }
    try { sessionStorage.removeItem(key); } catch (e) { console.warn('Failed to remove from sessionStorage:', e); }
  },
  
  // 清除所有认证相关数据
  clearAuthData(): void {
    const authKeys = ['userInfo', 'currentUserName', 'foundation_user_name', 'oidc_access_token', 'oidc_refresh_token', 
                     'foundation_user_role', 'foundation_user_permissions', 'foundation_user_email', 
                     'foundation_user_groups', 'foundation_user_scope',
                     'token_expiry_timestamp', 'last_token_check', 'last_api_error']; // 添加新的认证相关键
    authKeys.forEach(key => this.removeItem(key));
  },
  
  // 同步localStorage和sessionStorage的数据
  syncStorage(): void {
    try {
      // 优先从sessionStorage同步到localStorage
      const keys = ['userInfo', 'currentUserName', 'foundation_user_name', 'oidc_access_token', 'oidc_refresh_token',
                   'foundation_user_role', 'foundation_user_permissions',
                   'token_expiry_timestamp', 'last_token_check', 'last_api_error']; // 添加新的同步键
      
      keys.forEach(key => {
        const sessionValue = sessionStorage.getItem(key);
        const localValue = localStorage.getItem(key);
        
        // 如果sessionStorage有值但localStorage没有，同步过去
        if (sessionValue && !localValue) {
          localStorage.setItem(key, sessionValue);
          console.log(`Synced ${key} from sessionStorage to localStorage`);
        }
        // 如果localStorage有值但sessionStorage没有，同步过去
        else if (localValue && !sessionValue) {
          sessionStorage.setItem(key, localValue);
          console.log(`Synced ${key} from localStorage to sessionStorage`);
        }
      });
    } catch (error) {
      console.error('Failed to sync storage:', error);
    }
  }
};

// 解析JWT token，提取其中的信息
function parseToken(token: string): any | null {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('Invalid JWT token format: incorrect number of parts');
      return null;
    }
    
    // 处理URL安全的base64编码（填充等问题）
    const base64Url = tokenParts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    
    const decoded = JSON.parse(atob(padded));
    return decoded;
  } catch (error) {
    console.error('Failed to parse token:', error);
    return null;
  }
}

// 检查token是否有效（未过期）
export function isTokenValid(token: string): boolean {
  try {
    const decoded = parseToken(token);
    if (!decoded) {
      return false;
    }
    
    // 检查token是否有过期时间
    if (!decoded.exp) {
      console.warn('Token does not contain expiration time (exp) field');
      return true; // 保守处理：没有过期时间的token视为有效
    }
    
    // 计算token过期时间（考虑1分钟的缓冲时间）
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = decoded.exp - 60; // 提前1分钟过期，避免边界问题
    
    const isValid = now < expiresAt;
    
    if (!isValid) {
      console.log('Token expired:', {
        now: new Date(now * 1000).toISOString(),
        expiresAt: new Date(expiresAt * 1000).toISOString()
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('Failed to check token validity:', error);
    return false;
  }
}

// 获取token过期时间戳
export function getTokenExpiry(token: string): number | null {
  try {
    const decoded = parseToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    
    return decoded.exp * 1000; // 转换为毫秒
  } catch (error) {
    console.error('Failed to get token expiry time:', error);
    return null;
  }
}

// 保存token及过期信息
export function saveTokenWithExpiry(token: string): void {
  // 保存token本身
  storageService.setItem('oidc_access_token', token);
  
  // 保存过期时间戳
  const expiry = getTokenExpiry(token);
  if (expiry) {
    storageService.setItem('token_expiry_timestamp', String(expiry));
  }
  
  // 记录最后检查时间
  storageService.setItem('last_token_check', String(Date.now()));
}

// 检查存储中的token是否有效
export function isStoredTokenValid(): boolean {
  try {
    // 获取token
    const token = storageService.getItem('oidc_access_token');
    if (!token) {
      return false;
    }
    
    // 获取最后检查时间，避免频繁检查（每60秒检查一次）
    const lastCheckStr = storageService.getItem('last_token_check');
    const now = Date.now();
    
    if (lastCheckStr) {
      const lastCheck = parseInt(lastCheckStr, 10);
      if (now - lastCheck < 60000) { // 60秒内不重复检查
        // 如果有缓存的过期时间，检查是否已过期
        const expiryStr = storageService.getItem('token_expiry_timestamp');
        if (expiryStr) {
          const expiry = parseInt(expiryStr, 10);
          const isValid = now < expiry - 60000; // 提前1分钟过期
          return isValid;
        }
      }
    }
    
    // 进行实际的token有效性检查
    const isValid = isTokenValid(token);
    
    // 更新最后检查时间
    storageService.setItem('last_token_check', String(now));
    
    return isValid;
  } catch (error) {
    console.error('Failed to check stored token validity:', error);
    return false;
  }
}

// 初始化时同步存储
try {
  storageService.syncStorage();
} catch (error) {
  console.error('Error during storage initialization:', error);
}

// 清除认证令牌
// 当token无效或过期时调用此函数
export const clearAuthToken = (reason?: string): void => {
  try {
    // 记录清除原因
    if (reason) {
      console.log(`Clearing authentication tokens: ${reason}`);
    }
    
    storageService.clearAuthData();
    console.log('Authentication tokens and user info cleared due to invalid token');
    
    // 触发认证清除事件
    window.dispatchEvent(new CustomEvent('auth_cleared', { detail: { reason } }));
  } catch (error) {
    console.error('Failed to clear authentication tokens:', error);
  }
};

// 从HRSaaS获取用户信息（带重试机制和增强错误处理）
export const fetchUserInfoFromHRSaaS = async (token: string, maxRetries = 2): Promise<UserInfo | null> => {
  // 首先检查token是否有效
  if (!isTokenValid(token)) {
    console.error('Failed to fetch user info from HRSaaS: Token expired or invalid');
    // 清除认证数据
    clearAuthToken('token expired');
    // 触发token过期事件
    window.dispatchEvent(new CustomEvent('token_expired'));
    return null;
  }
  
  let retries = 0;
  
  // 重试循环
  while (retries <= maxRetries) {
    try {
      // 检查token是否为空
      if (!token) {
        console.warn('fetchUserInfoFromHRSaaS: No token provided');
        return null;
      }
      
      // 配置请求头，添加认证token
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      // 添加请求超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
      
      // 发送请求到HRSaaS API
      const response = await fetch(HRSaaS_API_URL, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 清除超时定时器
      
      // 检查响应状态
      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text().catch(() => '');
        
        // 缓存错误信息到本地存储，便于调试
        try {
          storageService.setItem('last_api_error', JSON.stringify({
            code: status,
            message: errorText,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Failed to cache error info:', e);
        }
        
        // 特别处理401错误
        if (status === 401) {
          console.error('Authentication failed: Invalid or expired token', { errorText });
          clearAuthToken('authentication failed');
          // 触发token过期事件
          window.dispatchEvent(new CustomEvent('token_expired'));
          return null; // 401错误不需要重试
        }
        
        // 其他错误，根据状态码决定是否重试
        console.error(`Failed to fetch user info: HTTP ${status}`, { errorText });
        
        // 对于服务器错误(5xx)，可以重试
        if (status >= 500 && retries < maxRetries) {
          retries++;
          const waitTime = Math.min(1000 * Math.pow(2, retries - 1), 5000); // 指数退避，最多等待5秒
          console.log(`Retrying fetch (${retries}/${maxRetries}) after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        return null;
      }
      
      // 解析响应数据
      const data = await response.json();
      
      // 检查数据是否包含必要字段
      if (!data || typeof data !== 'object') {
        console.warn('Invalid user data format from HRSaaS: expected an object');
        return null;
      }
      
      // 构建统一格式的用户信息对象
      const userInfo: UserInfo = {
        id: String(data.id || 'unknown'),
        name: String(data.name || 'Unknown'),
        nickname: String(data.nickname || data.id || 'unknown'),
        company_name: String(data.company_name || 'Unknown'),
        department_name: String(data.department_name || 'Unknown'),
        group_name: String(data.group_name || 'Unknown'),
        position_name: String(data.position_name || 'Unknown'),
        supervisor_nickname: String(data.supervisor_nickname || 'Unknown'),
        supervisor_name: String(data.supervisor_name || 'Unknown'),
        foundation_user_role: data.foundation_user_role || 'user',
        foundation_user_permissions: Array.isArray(data.foundation_user_permissions) ? data.foundation_user_permissions : [],
        admin_login_method: data.admin_login_method || ''
      };
      
      // 数据完整性验证
      if (!userInfo.nickname || userInfo.nickname === 'unknown') {
        console.warn('User nickname is missing or invalid', { userId: userInfo.id });
      }
      
      // 存储用户信息
      try {
        storageService.setItem('userInfo', JSON.stringify(userInfo));
        storageService.setItem('currentUserName', userInfo.nickname || userInfo.name);
        storageService.setItem('foundation_user_name', userInfo.nickname || userInfo.name);
        storageService.setItem('foundation_user_role', userInfo.foundation_user_role || 'user');
        storageService.setItem('foundation_user_permissions', JSON.stringify(userInfo.foundation_user_permissions || []));
        
        // 保存额外的用户上下文信息
        storageService.setItem('foundation_user_email', String(data.email || ''));
        storageService.setItem('foundation_user_groups', JSON.stringify(Array.isArray(data.groups) ? data.groups : []));
        
        // 保存token及过期信息
        saveTokenWithExpiry(token);
        
        console.log('User information successfully fetched and stored', { userId: userInfo.id, userName: userInfo.nickname });
      } catch (storageError) {
        console.warn('Failed to store user info:', storageError);
      }
      
      // 同步存储确保一致性
      storageService.syncStorage();
      
      return userInfo;
      
    } catch (error) {
      // 缓存错误信息到本地存储
      try {
        const errorInfo = error.name === 'AbortError' ? {
          code: 'timeout',
          message: 'Request timeout after 15 seconds',
          timestamp: Date.now()
        } : {
          code: 'network_error',
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        };
        storageService.setItem('last_api_error', JSON.stringify(errorInfo));
      } catch (e) {
        console.warn('Failed to cache error info:', e);
      }
      
      // 处理不同类型的错误
      if (error.name === 'AbortError') {
        console.error('Fetch user info request timed out');
      } else {
        console.error('Error fetching user info from HRSaaS:', error);
      }
      
      // 网络错误可以重试
      if (retries < maxRetries) {
        retries++;
        const waitTime = Math.min(1000 * Math.pow(2, retries - 1), 5000);
        console.log(`Retrying fetch after network error (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return null;
    }
  }
  
  // 达到最大重试次数
  console.error(`Failed to fetch user info after ${maxRetries} retries`);
  return null;
};

// 获取用户信息
export const getUserInfo = (): UserInfo | null => {
  try {
    // 首先检查token是否有效
    if (!isStoredTokenValid()) {
      console.warn('Token expired or invalid, cannot get user info');
      // 清除过期的认证数据
      clearAuthToken('token expired');
      return null;
    }
    
    const userInfoStr = storageService.getItem('userInfo');
    if (!userInfoStr) return null;
    
    return JSON.parse(userInfoStr) as UserInfo;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
};

// 检查用户是否已认证
export const isAuthenticated = (): boolean => {
  try {
    // 检查token是否有效
    const tokenValid = isStoredTokenValid();
    
    // 如果token无效，即使有用户信息也返回false
    if (!tokenValid) {
      console.warn('Authentication check failed: token invalid');
      // 触发token过期事件
      window.dispatchEvent(new CustomEvent('token_expired'));
      return false;
    }
    
    const userInfo = storageService.getItem('userInfo');
    const user1 = storageService.getItem('currentUserName');
    const user2 = storageService.getItem('foundation_user_name');
    
    const isAuth = !!(userInfo || user1 || user2);
    
    if (!isAuth && storageService.getItem('oidc_access_token')) {
      // 如果有token但没有用户信息，可能是数据不一致
      console.warn('Authentication inconsistency: token exists but no user info');
    }
    
    return isAuth;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
};

// 用户登出
export const logout = (reason?: string): void => {
  try {
    // 清除认证数据
    clearAuthToken(reason || 'user initiated logout');
    console.log('User logged out');
    
    // 刷新页面以清除内存中的状态
    window.location.reload();
  } catch (error) {
    console.error('Error during logout:', error);
  }
};

// 检查权限
export const hasPermission = (permission: string): boolean => {
  const userInfo = getUserInfo();
  if (!userInfo?.foundation_user_permissions) return false;
  
  return userInfo.foundation_user_permissions.includes(permission);
};

// 获取用户角色
export const getUserRole = (): string => {
  const userInfo = getUserInfo();
  return userInfo?.foundation_user_role || '';
};

// 注册全局token过期事件监听器
export function onTokenExpired(callback: () => void): () => void {
  window.addEventListener('token_expired', callback as EventListener);
  return () => {
    window.removeEventListener('token_expired', callback as EventListener);
  };
}

// 注册全局认证清除事件监听器
export function onAuthCleared(callback: (reason?: string) => void): () => void {
  const eventHandler = (event: CustomEvent<{reason?: string}>) => {
    callback(event.detail.reason);
  };
  window.addEventListener('auth_cleared', eventHandler as EventListener);
  return () => {
    window.removeEventListener('auth_cleared', eventHandler as EventListener);
  };
}