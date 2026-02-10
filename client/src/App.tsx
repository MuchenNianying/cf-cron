import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Login from './pages/auth/Login';
import TaskList from './pages/tasks/TaskList';
import TaskEdit from './pages/tasks/TaskEdit';
import LogList from './pages/logs/LogList';
import LoginLogList from './pages/logs/LoginLogList';
import SettingList from './pages/settings/SettingList';
import UserList from './pages/users/UserList';

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'CF-Cron';
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>加载中...</div>;
  }

  const isAdmin = user?.is_admin === 1;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={user ? <Navigate to="/tasks" /> : <Navigate to="/login" />} />
        <Route path="/tasks" element={user ? <AppLayout><TaskList /></AppLayout> : <Navigate to="/login" />} />
        <Route path="/tasks/create" element={user ? <AppLayout><TaskEdit /></AppLayout> : <Navigate to="/login" />} />
        <Route path="/tasks/edit/:id" element={user ? <AppLayout><TaskEdit /></AppLayout> : <Navigate to="/login" />} />
        <Route path="/logs" element={user ? <AppLayout><LogList /></AppLayout> : <Navigate to="/login" />} />
        <Route path="/logs/login" element={isAdmin ? <AppLayout><LoginLogList /></AppLayout> : <Navigate to="/tasks" />} />
        <Route path="/settings" element={isAdmin ? <AppLayout><SettingList /></AppLayout> : <Navigate to="/tasks" />} />
        <Route path="/users" element={isAdmin ? <AppLayout><UserList /></AppLayout> : <Navigate to="/tasks" />} />
      </Routes>
    </Router>
  );
};

export default App;
