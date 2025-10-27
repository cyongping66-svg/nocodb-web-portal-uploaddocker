export const isAuthenticated = (): boolean => {
  try {
    const user1 = localStorage.getItem('currentUserName');
    const user2 = localStorage.getItem('foundation_user_name');
    return !!(user1 || user2);
  } catch {
    return false;
  }
};