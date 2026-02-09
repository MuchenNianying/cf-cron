// API配置
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '/api';

// 生成完整的API URL
export const getApiUrl = (endpoint: string): string => {
  // 如果endpoint已经是完整的URL，直接返回
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  
  // 拼接API基础URL和端点
  const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL : `${SERVER_URL}/`;
  const endpointUrl = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${baseUrl}${endpointUrl}`;
};

// API请求工具
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = getApiUrl(endpoint);
  
  // 添加默认的请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  // 添加认证token
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP Error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
};

// 导出SERVER_URL供其他地方使用
export { SERVER_URL };