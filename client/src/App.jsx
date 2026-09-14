import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Work from './pages/Work.jsx';
import WorkDetail from './pages/WorkDetail.jsx';
import News from './pages/News.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import Donate from './pages/Donate.jsx';
import Contact from './pages/Contact.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import ArticlesAdmin from './pages/admin/ArticlesAdmin.jsx';
import CausesAdmin from './pages/admin/CausesAdmin.jsx';
import CampaignsAdmin from './pages/admin/CampaignsAdmin.jsx';
import DonationsAdmin from './pages/admin/DonationsAdmin.jsx';
import MessagesAdmin from './pages/admin/MessagesAdmin.jsx';
import MediaAdmin from './pages/admin/MediaAdmin.jsx';
import UsersAdmin from './pages/admin/UsersAdmin.jsx';
import SettingsAdmin from './pages/admin/SettingsAdmin.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function Shell() {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={loc} key={loc.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/a-propos" element={<About />} />
            <Route path="/notre-travail" element={<Work />} />
            <Route path="/notre-travail/:slug" element={<WorkDetail />} />
            <Route path="/actualites" element={<News />} />
            <Route path="/actualites/:slug" element={<ArticlePage />} />
            <Route path="/collectes" element={<Campaigns />} />
            <Route path="/collectes/:slug" element={<CampaignDetail />} />
            <Route path="/faire-un-don" element={<Donate />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="articles" element={<ArticlesAdmin />} />
          <Route path="causes" element={<CausesAdmin />} />
          <Route path="campagnes" element={<CampaignsAdmin />} />
          <Route path="dons" element={<DonationsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="medias" element={<MediaAdmin />} />
          <Route path="utilisateurs" element={<UsersAdmin />} />
          <Route path="parametres" element={<SettingsAdmin />} />
        </Route>
        <Route path="/*" element={<Shell />} />
      </Routes>
    </>
  );
}
