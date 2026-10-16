// Match the existing server policy; this only controls available UI actions.
export function workspacePermissions(role: string) {
  const admin = role === '企业管理员';
  const content = admin || role === '内容作者';
  const department = role === '部门管理员';
  const routes = new Set([
    ...(admin || content || department ? ['overview', 'courses'] : []),
    ...(admin || department ? ['tasks', 'members', 'reports'] : []),
    ...(content ? ['knowledge'] : []),
    ...(admin ? ['settings'] : []),
  ]);
  return {admin, content, department, routes};
}
