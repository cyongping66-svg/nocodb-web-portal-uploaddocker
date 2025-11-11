import React from 'react';
import { Card } from './ui/card';
import { Avatar } from './ui/avatar';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

interface UserInfoData {
  id: string;
  name: string;
  nickname: string;
  company_id: string;
  company_name: string;
  department_id: string;
  department_name: string;
  group_id: string;
  group_name: string;
  position_id: string;
  position_name: string;
  supervisor_id?: string;
  supervisor_name?: string;
  supervisor_nickname?: string;
  user_id: string;
}

interface UserInfoCardProps {
  userInfo: UserInfoData | null;
  loading?: boolean;
}

const UserInfoCard: React.FC<UserInfoCardProps> = ({ userInfo, loading = false }) => {
  // 生成用户头像文字（取姓名首字母）
  const getAvatarText = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  if (loading) {
    return (
      <Card className="p-6 shadow-lg border rounded-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-400">
            <span className="text-xl font-medium">?</span>
          </div>
          <div className="space-y-2">
            <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (!userInfo) {
    return (
      <Card className="p-6 shadow-lg border rounded-xl text-center text-gray-500">
        <p>暂无用户信息</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-lg border rounded-xl">
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-medium">
          {getAvatarText(userInfo.name)}
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{userInfo.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-sm">{userInfo.nickname}</Badge>
            <Badge className="text-sm bg-blue-100 text-blue-800">{userInfo.position_name}</Badge>
          </div>
        </div>
      </div>
      
      <Separator className="my-4" />
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">所属公司</p>
            <p className="text-gray-900">{userInfo.company_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">所属部门</p>
            <p className="text-gray-900">{userInfo.department_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">所属团队</p>
            <p className="text-gray-900">{userInfo.group_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">职位</p>
            <p className="text-gray-900">{userInfo.position_name}</p>
          </div>
        </div>
        
        {userInfo.supervisor_name && (
          <div>
            <p className="text-sm font-medium text-gray-500">直属上级</p>
            <p className="text-gray-900">
              {userInfo.supervisor_name} {userInfo.supervisor_nickname && `(${userInfo.supervisor_nickname})`}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UserInfoCard;