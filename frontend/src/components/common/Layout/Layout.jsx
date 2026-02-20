import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className={styles.layout}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className={styles.mainContainer}>
        <Sidebar isOpen={sidebarOpen} />
        
        <main className={`${styles.content} ${!sidebarOpen ? styles.contentExpanded : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;