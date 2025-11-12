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
      
      // 检查响应结构和数据有效性
      if (response && typeof response === 'object') {
        if (response.data) {
          setUserInfo(response.data);
        } else if (response.message) {
          // 如果只有错误消息但没有数据，显示错误
          setError(response.message);
          console.error('获取用户信息失败:', response.message);
        } else {
          setError('获取用户信息格式错误');
          console.error('获取用户信息格式错误:', response);
        }
      } else {
        setError('获取用户信息失败');
        console.error('获取用户信息失败，无效响应:', response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
      setError(errorMessage);
      console.error('获取用户信息异常:', err);
      
      // 如果发生异常，尝试直接从auth模块获取用户信息作为后备
      try {
        const { getUserInfo } = await import('../lib/auth');
        const directUserInfo = getUserInfo();
        if (directUserInfo) {
          setUserInfo(directUserInfo);
          setError(null); // 清除错误，因为我们找到了有效的用户信息
          console.log('通过auth模块直接获取到用户信息作为后备');
        }
      } catch (backupErr) {
        console.error('尝试通过auth模块获取用户信息也失败:', backupErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取用户信息
  useEffect(() => {
    // 立即尝试获取用户信息，不再手动检查token（auth模块内部会处理token验证）
    fetchUserInfo();
    
    // 添加页面可见性变化的事件监听，当页面从隐藏变为可见时重新获取用户信息
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 当页面重新可见时，刷新用户信息
        fetchUserInfo();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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