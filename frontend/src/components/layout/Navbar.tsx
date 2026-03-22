import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../assets/logo.png'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="AsphaltAtlas" className="h-10 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" end className={linkClass}>Explore</NavLink>
            <NavLink to="/map" className={linkClass}>Map</NavLink>
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/routes/new"
                  className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  + Post a Route
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
                      {user.email?.[0].toUpperCase()}
                    </div>
                  </button>

                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
                      onMouseLeave={() => setMenuOpen(false)}
                    >
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Profile
                      </Link>
                      <Link
                        to="/favourites"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Favourites
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span className="sr-only">Menu</span>
            <div className="space-y-1.5">
              <span className="block w-6 h-0.5 bg-current" />
              <span className="block w-6 h-0.5 bg-current" />
              <span className="block w-6 h-0.5 bg-current" />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            <NavLink to="/" end className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Explore</NavLink>
            <NavLink to="/map" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Map</NavLink>
            {user ? (
              <>
                <NavLink to="/routes/new" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>+ Post a Route</NavLink>
                <NavLink to="/profile" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>My Profile</NavLink>
                <NavLink to="/favourites" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Favourites</NavLink>
                <button onClick={handleSignOut} className="block w-full text-left px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50">Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Log in</NavLink>
                <NavLink to="/register" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Sign up</NavLink>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
