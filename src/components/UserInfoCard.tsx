import React from 'react';
import { Card, CardContent, Typography, Divider, Box } from '@mui/material';

interface UserInfoData {
  company_name?: string;
  department_name?: string;
  group_name?: string;
  position_name?: string;
  user_id?: string;
  company_id?: string;
  department_id?: string;
  group_id?: string;
  position_id?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  employee_id?: string;
  name: string;
  email: string;
  mobile: string;
  [key: string]: any;
}

interface UserInfoCardProps {
  userInfo?: UserInfoData | null;
  title?: string;
}

const UserInfoCard: React.FC<UserInfoCardProps> = ({ userInfo, title = '用户基本信息' }) => {
  // 添加空值处理函数
  const getDisplayValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '未提供';
    }
    return String(value);
  };

  if (!userInfo) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography color="textSecondary">
            暂无用户信息
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">姓名</Typography>
            <Typography>{getDisplayValue(userInfo.name)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">邮箱</Typography>
            <Typography>{getDisplayValue(userInfo.email)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">手机号</Typography>
            <Typography>{getDisplayValue(userInfo.mobile)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">工号</Typography>
            <Typography>{getDisplayValue(userInfo.employee_id)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">公司</Typography>
            <Typography>{getDisplayValue(userInfo.company_name)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">部门</Typography>
            <Typography>{getDisplayValue(userInfo.department_name)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">组别</Typography>
            <Typography>{getDisplayValue(userInfo.group_name)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">职位</Typography>
            <Typography>{getDisplayValue(userInfo.position_name)}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="textSecondary">直接上级</Typography>
            <Typography>{getDisplayValue(userInfo.supervisor_name)}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UserInfoCard;