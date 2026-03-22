import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CreateRoutePage from './pages/CreateRoutePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes — add pages here as we build them */}
            <Route element={<ProtectedRoute />}>
              <Route path="/routes/new" element={<CreateRoutePage />} />
              <Route path="/profile" element={<div className="p-8">Profile — coming soon</div>} />
              <Route path="/favourites" element={<div className="p-8">Favourites — coming soon</div>} />
            </Route>

            {/* Route detail (public) */}
            <Route path="/routes/:id" element={<div className="p-8">Route detail — coming soon</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
