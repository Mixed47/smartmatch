import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './App.tsx';
import StudentLogbook from './StudentLogbook';
import { getAuthUser } from './apiClient';

function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function RoleRoute({ roles, children }) {
  const user = getAuthUser();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const user = getAuthUser();
  if (user?.role === 'student') return <Navigate to="/student" replace />;
  if (user?.role === 'company') return <Navigate to="/company" replace />;
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  useEffect(() => {
    applySavedTheme();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/student"
          element={
            <RoleRoute roles={['student']}>
              <Dashboard initialRole="student" />
            </RoleRoute>
          }
        />
        <Route
          path="/student/logbook"
          element={
            <RoleRoute roles={['student']}>
              <StudentLogbook />
            </RoleRoute>
          }
        />
        <Route
          path="/company"
          element={
            <RoleRoute roles={['company']}>
              <Dashboard initialRole="company" />
            </RoleRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <RoleRoute roles={['teacher']}>
              <Dashboard initialRole="teacher" />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
