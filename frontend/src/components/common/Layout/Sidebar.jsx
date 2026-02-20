import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../store/slices/auth.slice';
import styles from './Sidebar.module.css';

const Sidebar = ({ isOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { hasUnviewed } = useSelector((state) => state.weekly);
  const { suggestions } = useSelector((state) => state.suggestions);

  const pendingSuggestions = suggestions?.filter(s => s.status === 'pending').length || 0;

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/transactions', icon: '💰', label: 'Transactions' },
    { path: '/budgets', icon: '📋', label: 'Budgets' },
    { path: '/subscriptions', icon: '🔄', label: 'Subscriptions' },
    { 
      path: '/suggestions', 
      icon: '💡', 
      label: 'Suggestions',
      badge: pendingSuggestions
    },
    { 
      path: '/weekly', 
      icon: '📅', 
      label: 'Weekly Summary',
      badge: hasUnviewed ? 'New' : null
    },
    { path: '/settings', icon: '⚙️', label: 'Settings' }
  ];

  return (
    <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''}`}>
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {isOpen && (
              <>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && (
                  <span className={styles.badge}>
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {isOpen && (
        <div className={styles.footer}>
          <button onClick={handleLogout} className={styles.logoutButton}>
            <span className={styles.navIcon}>🚪</span>
            <span className={styles.navLabel}>Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;