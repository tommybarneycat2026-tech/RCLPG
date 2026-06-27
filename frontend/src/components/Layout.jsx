import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReportPeriodModal from './ReportPeriodModal';
import StaffProfileModal from './StaffProfileModal';
import Logo from '../../RCLPG_Logo.jpg';

const navClass = ({ isActive }) =>
  `px-4 py-2.5 text-sm rounded-xl transition ${
    isActive
      ? 'font-bold text-red-600 bg-red-50'
      : 'font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100'
  }`;

export default function Layout({ children }) {
  const { logout, admin, isAdministrator } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reportModal, setReportModal] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-24 items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <img
                src={Logo}
                alt="RCLPG Logo"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/80x80?text=RCLPG';
                }}
                className="h-16 w-16 object-contain rounded-xl shadow-sm border border-slate-100"
              />
              <div>
                <span className="block text-lg font-black text-slate-900 tracking-tight leading-none">
                  RCLPG Portal
                </span>
                <span className="text-[11px] text-red-600 font-bold tracking-wider uppercase mt-1.5 block">
                  Management Hub
                </span>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1" aria-label="Main Navigation">
              <NavLink to="/dashboard" className={navClass} end>
                Dashboard & Sales
              </NavLink>
              <NavLink to="/inventory" className={navClass}>
                Inventory Catalog
              </NavLink>
              <NavLink to="/sales-log" className={navClass}>
                Customer & Sales Log
              </NavLink>
              <NavLink to="/credit-logs" className={navClass}>
                Credit Logs
              </NavLink>
              {isAdministrator && (
                <NavLink to="/admin/profile" className={navClass}>
                  Admin Profile
                </NavLink>
              )}
            </nav>

            <div className="hidden sm:flex items-center space-x-2">
              {!isAdministrator && (
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition"
                  aria-label="Open profile"
                >
                  Profile
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportModal('excel')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition"
              >
                Excel Export
              </button>
              <button
                type="button"
                onClick={() => setReportModal('pdf')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2.5 rounded-xl shadow-sm transition"
              >
                PDF Report
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-2.5 rounded-xl transition"
              >
                Logout
              </button>
            </div>

            <button
              type="button"
              className="md:hidden text-slate-600 p-2 rounded-xl"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-2 space-y-1 shadow-inner">
            <Link to="/dashboard" className="block px-3 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50" onClick={() => setMobileOpen(false)}>
              Dashboard & Sales
            </Link>
            <Link to="/inventory" className="block px-3 py-2 rounded-xl text-sm text-slate-600" onClick={() => setMobileOpen(false)}>
              Inventory Catalog
            </Link>
            <Link to="/sales-log" className="block px-3 py-2 rounded-xl text-sm text-slate-600" onClick={() => setMobileOpen(false)}>
              Customer & Sales Log
            </Link>
            <Link to="/credit-logs" className="block px-3 py-2 rounded-xl text-sm text-slate-600" onClick={() => setMobileOpen(false)}>
              Credit Logs
            </Link>
            {isAdministrator && (
              <Link to="/admin/profile" className="block px-3 py-2 rounded-xl text-sm text-slate-600" onClick={() => setMobileOpen(false)}>
                Admin Profile
              </Link>
            )}
            {!isAdministrator && (
              <button
                type="button"
                onClick={() => { setProfileOpen(true); setMobileOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-xl text-sm text-slate-600"
              >
                Profile
              </button>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setReportModal('excel')} className="bg-slate-100 py-2 text-xs font-bold rounded-lg">
                Excel
              </button>
              <button type="button" onClick={() => setReportModal('pdf')} className="bg-red-600 text-white py-2 text-xs font-bold rounded-lg">
                PDF
              </button>
              <button type="button" onClick={handleLogout} className="bg-slate-800 text-white py-2 text-xs font-bold rounded-lg">
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-center text-xs text-slate-400 font-medium">
        <p>&copy; {new Date().getFullYear()} RCLPG Portal. All rights reserved.</p>
      </footer>

      {reportModal && (
        <ReportPeriodModal format={reportModal} onClose={() => setReportModal(null)} />
      )}

      {profileOpen && !isAdministrator && (
        <StaffProfileModal onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}
