import PropTypes from "prop-types";
import { useState } from "react";

import Footer from "./Footer";
import Header from "./Header";
import Sidebar from "./Sidebar";

/** Authenticated app shell: Header + Sidebar + content + Footer. */
export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <Footer />
    </div>
  );
}

Layout.propTypes = { children: PropTypes.node };

export default Layout;
