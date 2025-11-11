import React, { useState, useEffect } from 'react';
import UserInfoCard from './UserInfoCard';
import apiService from '../lib/api';

const UserProfilePage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取用户信息
  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用API服务获取用户信息
      const response = await apiService.getUserInfo();
      
      // 假设API返回的格式是 { message: string, data: UserInfo } 结构
      if (response && response.data) {
        setUserInfo(response.data);
      } else {
        setError('获取用户信息格式错误');
        console.error('获取用户信息格式错误:', response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
      setError(errorMessage);
      console.error('获取用户信息失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取用户信息
  useEffect(() => {
    // 检查是否有访问令牌
    const accessToken = localStorage.getItem('oidc_access_token') || sessionStorage.getItem('oidc_access_token');
    if (accessToken) {
      fetchUserInfo();
    } else {
      setError('未登录或令牌已过期');
      setLoading(false);
    }
  }, []);

  // 手动刷新用户信息
  const handleRefresh = () => {
    fetchUserInfo();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>
        <button 
          onClick={handleRefresh} 
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <UserInfoCard userInfo={userInfo} loading={loading} />
      
      {/* 调试信息区域（可选，用于开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-medium mb-2">调试信息</h3>
          <pre className="text-sm text-gray-700 overflow-auto">
            {JSON.stringify(userInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;