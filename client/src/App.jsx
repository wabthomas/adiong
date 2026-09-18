import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import PartnerSlider from './components/PartnerSlider.jsx';
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
import Shop from './pages/Shop.jsx';
import MemberCard from './pages/MemberCard.jsx';
import MemberPrintCard from './pages/MemberPrintCard.jsx';
import NotFound from './pages/NotFound.jsx';
import Maintenance from './pages/Maintenance.jsx';
import { useSite } from './hooks/useSite.jsx';
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
const ProfileAdmin = lazy(() => import('./pages/admin/ProfileAdmin.jsx'));
const SettingsAdmin = lazy(() => import('./pages/admin/SettingsAdmin.jsx'));
const GrhAdmin = lazy(() => import('./pages/admin/GrhAdmin.jsx'));
const PosAdmin = lazy(() => import('./pages/admin/PosAdmin.jsx'));
const MyLeave = lazy(() => import('./pages/admin/MyLeave.jsx'));
const Chat = lazy(() => import('./pages/admin/Chat.jsx'));
const PartnersAdmin = lazy(() => import('./pages/admin/PartnersAdmin.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));

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

function AdminPage({ children }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="text-sm font-semibold text-ink-400">Chargement…</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-cream p-8 text-center">
          <div className="max-w-lg">
            <p className="font-display text-xl font-bold text-ink-900">Erreur d’affichage</p>
            <p className="mt-2 text-sm text-ink-500">{String(this.state.error?.message || this.state.error)}</p>
            <button type="button" className="btn-primary mt-5 text-sm" onClick={() => window.location.reload()}>
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PublicGate({ children }) {
  const { maintenance, maintenanceMessage, site } = useSite();
  if (maintenance) {
    return <Maintenance message={maintenanceMessage} site={site} />;
  }
  return children;
}

function Shell() {
  const loc = useLocation();
  return (
    <PublicGate>
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
              <Route path="/boutique" element={<Shop />} />
              <Route path="/membre/:code" element={<MemberCard />} />
              <Route path="/membre/:code/carte" element={<MemberPrintCard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </main>
        <PartnerSlider />
        <Footer />
      </div>
    </PublicGate>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ScrollToTop />
      <Routes>
        <Route path="/inscription" element={<PublicGate><Suspense fallback={<AdminFallback />}><RegisterPage /></Suspense></PublicGate>} />
        <Route path="/admin/login" element={<Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<AdminFallback />}><AdminLayout /></Suspense>}>
          <Route index element={<AdminPage><Dashboard /></AdminPage>} />
          <Route path="articles" element={<AdminPage><ArticlesAdmin /></AdminPage>} />
          <Route path="causes" element={<AdminPage><CausesAdmin /></AdminPage>} />
          <Route path="campagnes" element={<AdminPage><CampaignsAdmin /></AdminPage>} />
          <Route path="dons" element={<AdminPage><DonationsAdmin /></AdminPage>} />
          <Route path="messages" element={<AdminPage><MessagesAdmin /></AdminPage>} />
          <Route path="medias" element={<AdminPage><MediaAdmin /></AdminPage>} />
          <Route path="utilisateurs" element={<AdminPage><UsersAdmin /></AdminPage>} />
          <Route path="profil" element={<AdminPage><ProfileAdmin /></AdminPage>} />
          <Route path="mon-espace" element={<AdminPage><MyLeave /></AdminPage>} />
          <Route path="messagerie" element={<AdminPage><Chat /></AdminPage>} />
          <Route path="grh" element={<AdminPage><GrhAdmin /></AdminPage>} />
          <Route path="pos" element={<AdminPage><PosAdmin /></AdminPage>} />
          <Route path="partenaires" element={<AdminPage><PartnersAdmin /></AdminPage>} />
          <Route path="parametres" element={<AdminPage><SettingsAdmin /></AdminPage>} />
        </Route>
        <Route path="/*" element={<Shell />} />
      </Routes>
    </AppErrorBoundary>
  );
}
