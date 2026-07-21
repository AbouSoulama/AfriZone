import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import HeroCarousel from './components/HeroCarousel';
import Categories from './components/Categories';
import Products from './components/Products';
import Sellers from './components/Sellers';
import CTABanner from './components/CTABanner';
import Footer from './components/Footer';
import {
  LoginPage,
  RegisterClientPage,
  RegisterVendorPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from './pages/auth';

function BackToTop() {
  const handleScroll = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <button
      onClick={handleScroll}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#FF6B00] text-white rounded-full shadow-xl hover:bg-[#E05E00] flex items-center justify-center transition-all hover:-translate-y-1"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <HeroCarousel />
        <Categories />
        <Products />
        <Sellers />
        <CTABanner />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register/client" element={<RegisterClientPage />} />
          <Route path="/auth/register/vendor" element={<RegisterVendorPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
