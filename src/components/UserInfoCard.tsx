import React from 'react';

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
  loading?: boolean;
}

const UserInfoCard: React.FC<UserInfoCardProps> = ({ userInfo, title = '用户基本信息', loading }) => {
  // 添加空值处理函数
  const getDisplayValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '未提供';
    }
    return String(value);
  };

  // CSS样式
  const cardStyle = {
    marginBottom: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };
  
  const cardContentStyle = {
    padding: '16px'
  };
  
  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 500,
    marginBottom: '16px'
  };
  
  const dividerStyle = {
    border: 'none',
    height: '1px',
    backgroundColor: '#e0e0e0',
    marginBottom: '16px'
  };
  
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  };
  
  const itemStyle = {
    marginBottom: '8px'
  };
  
  const labelStyle = {
    fontSize: '0.875rem',
    color: '#616161',
    marginBottom: '4px'
  };
  
  const valueStyle = {
    fontSize: '1rem'
  };
  
  const emptyStyle = {
    color: '#616161'
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={cardContentStyle}>
          <div style={titleStyle}>{title}</div>
          <div style={emptyStyle}>加载中...</div>
        </div>
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div style={cardStyle}>
        <div style={cardContentStyle}>
          <div style={titleStyle}>{title}</div>
          <div style={emptyStyle}>暂无用户信息</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={cardContentStyle}>
        <div style={titleStyle}>{title}</div>
        <hr style={dividerStyle} />
        <div style={gridStyle}>
          <div style={itemStyle}>
            <div style={labelStyle}>姓名</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.name)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>邮箱</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.email)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>手机号</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.mobile)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>工号</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.employee_id)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>公司</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.company_name)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>部门</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.department_name)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>组别</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.group_name)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>职位</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.position_name)}</div>
          </div>
          <div style={itemStyle}>
            <div style={labelStyle}>直接上级</div>
            <div style={valueStyle}>{getDisplayValue(userInfo.supervisor_name)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfoCard;