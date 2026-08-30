import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../assets/logo.png'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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

                {/* Profile dropdown */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      menuOpen
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className={`w-8 h-8 rounded-full object-cover transition-all duration-150 ${
                          menuOpen ? 'ring-2 ring-brand-400' : 'ring-1 ring-gray-200 hover:ring-brand-300'
                        }`}
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-150 ${
                        menuOpen ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'
                      }`}>
                        {profile?.username?.[0]?.toUpperCase() ?? user.email?.[0].toUpperCase()}
                      </div>
                    )}
                    <span className="hidden lg:block max-w-[120px] truncate">
                      {profile?.username ?? user.email}
                    </span>
                    {/* Chevron */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20" fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in">

                      {/* Profile preview inside menu */}
                      <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{profile?.username}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 mx-1.5 px-3 py-2 text-sm text-gray-700 rounded-xl hover:bg-brand-50 hover:text-brand-700 transition-colors group"
                      >
                        <span className="text-base transition-transform duration-150 group-hover:scale-110">👤</span>
                        My Profile
                      </Link>
                      <Link
                        to="/profile?tab=saved"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 mx-1.5 px-3 py-2 text-sm text-gray-700 rounded-xl hover:bg-brand-50 hover:text-brand-700 transition-colors group"
                      >
                        <span className="text-base transition-transform duration-150 group-hover:scale-110">♡</span>
                        Saved Routes
                      </Link>
                      <Link
                        to="/routes/new"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 mx-1.5 px-3 py-2 text-sm text-gray-700 rounded-xl hover:bg-brand-50 hover:text-brand-700 transition-colors group"
                      >
                        <span className="text-base transition-transform duration-150 group-hover:scale-110">🛣️</span>
                        Post a Route
                      </Link>

                      <hr className="my-1.5 border-gray-100 mx-3" />

                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        className="flex items-center gap-3 w-full mx-1.5 px-3 py-2 text-sm text-red-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors group"
                        style={{ width: 'calc(100% - 12px)' }}
                      >
                        <span className="text-base transition-transform duration-150 group-hover:scale-110">↩</span>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
            <NavLink to="/" end className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Explore</NavLink>
            <NavLink to="/map" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Map</NavLink>
            {user ? (
              <>
                <NavLink to="/routes/new" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>+ Post a Route</NavLink>
                <NavLink to="/profile" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>My Profile</NavLink>
                <NavLink to="/profile?tab=saved" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Saved Routes</NavLink>
                <button onClick={handleSignOut} className="block w-full text-left px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors">Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Log in</NavLink>
                <NavLink to="/register" className="block px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>Sign up</NavLink>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
