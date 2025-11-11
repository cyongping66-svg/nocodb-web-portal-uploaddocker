// auth.test.ts - 测试HRSaaS API对接和用户信息管理功能
import { 
  UserInfo, 
  fetchUserInfoFromHRSaaS, 
  getUserInfo, 
  isAuthenticated, 
  logout, 
  hasPermission, 
  getUserRole 
} from './auth';

// 模拟localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// 模拟fetch
(global as any).fetch = jest.fn();

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUserInfoFromHRSaaS', () => {
    it('should fetch user info and store it', async () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王',
        foundation_user_role: 'admin',
        foundation_user_permissions: ['read', 'write', 'delete'],
        admin_login_method: 'hrsaas'
      };

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo
      });

      const result = await fetchUserInfoFromHRSaaS('mock-token');

      expect(result).toEqual(mockUserInfo);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userInfo', JSON.stringify(mockUserInfo));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('currentUserName', 'zhangsan');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('foundation_user_name', 'zhangsan');
    });

    it('should handle API failure', async () => {
      (global as any).fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const result = await fetchUserInfoFromHRSaaS('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    it('should return user info from localStorage', () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王'
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUserInfo));

      const result = getUserInfo();

      expect(result).toEqual(mockUserInfo);
    });

    it('should return null if no user info exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);

      const result = getUserInfo();

      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if user info exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('{}');

      const result = isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return true if currentUserName exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null); // userInfo
      mockLocalStorage.getItem.mockReturnValueOnce('zhangsan'); // currentUserName
      mockLocalStorage.getItem.mockReturnValueOnce(null); // foundation_user_name

      const result = isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false if no user info exists', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null); // userInfo
      mockLocalStorage.getItem.mockReturnValueOnce(null); // currentUserName
      mockLocalStorage.getItem.mockReturnValueOnce(null); // foundation_user_name

      const result = isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('should remove all user-related data from localStorage', () => {
      logout();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userInfo');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('currentUserName');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('foundation_user_name');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('oidc_access_token');
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has the permission', () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王',
        foundation_user_permissions: ['read', 'write']
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUserInfo));

      const result = hasPermission('read');

      expect(result).toBe(true);
    });

    it('should return false if user does not have the permission', () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王',
        foundation_user_permissions: ['read']
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUserInfo));

      const result = hasPermission('write');

      expect(result).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('should return the user role', () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王',
        foundation_user_role: 'admin'
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUserInfo));

      const result = getUserRole();

      expect(result).toBe('admin');
    });

    it('should return empty string if no role exists', () => {
      const mockUserInfo = {
        id: 'user123',
        name: '张三',
        nickname: 'zhangsan',
        company_name: '测试公司',
        department_name: '技术部',
        group_name: '前端组',
        position_name: '高级工程师',
        supervisor_nickname: 'liwang',
        supervisor_name: '李王'
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockUserInfo));

      const result = getUserRole();

      expect(result).toBe('');
    });
  });
});