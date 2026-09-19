import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './App.tsx';
import StudentLogbook from './StudentLogbook';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function StudentRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'student') return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (token && role === 'student') return <Navigate to="/student" replace />;
  if (token && role === 'company') return <Navigate to="/company" replace />;
  if (token && role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <Dashboard initialRole="student" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/logbook"
          element={
            <StudentRoute>
              <StudentLogbook />
            </StudentRoute>
          }
        />
        <Route
          path="/company"
          element={
            <ProtectedRoute>
              <Dashboard initialRole="company" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <Dashboard initialRole="teacher" />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
