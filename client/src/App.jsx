import React, { lazy, Suspense, useEffect } from 'react';
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
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const ArticlesAdmin = lazy(() => import('./pages/admin/ArticlesAdmin.jsx'));
const CausesAdmin = lazy(() => import('./pages/admin/CausesAdmin.jsx'));
const CampaignsAdmin = lazy(() => import('./pages/admin/CampaignsAdmin.jsx'));
const DonationsAdmin = lazy(() => import('./pages/admin/DonationsAdmin.jsx'));
const MessagesAdmin = lazy(() => import('./pages/admin/MessagesAdmin.jsx'));
const MediaAdmin = lazy(() => import('./pages/admin/MediaAdmin.jsx'));
const UsersAdmin = lazy(() => import('./pages/admin/UsersAdmin.jsx'));
const SettingsAdmin = lazy(() => import('./pages/admin/SettingsAdmin.jsx'));

function AdminFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm font-semibold text-ink-400">Chargement de l'espace admin…</p>
      </div>
    </div>
  );
}

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
        <Route path="/admin/login" element={<Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<AdminFallback />}><AdminLayout /></Suspense>}>
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
