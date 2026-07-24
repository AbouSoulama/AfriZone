import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import HeroCarousel from './components/HeroCarousel';
import Categories from './components/Categories';
import Products from './components/Products';
import Sellers from './components/Sellers';
import CTABanner from './components/CTABanner';
import Footer from './components/Footer';
import CatalogPage from './pages/Catalog';
import ProductDetailPage from './pages/ProductDetail';
import VendorShopPage from './pages/VendorShop';
import CartPage from './pages/Cart';
import CheckoutPage from './pages/Checkout';
import OrdersPage from './pages/Orders';
import OrderDetailPage from './pages/OrderDetail';
import ParcelSendPage from './pages/ParcelSend';
import ParcelListPage from './pages/ParcelList';
import ParcelDetailPage from './pages/ParcelDetail';
import ParcelTrackPage from './pages/ParcelTrack';
import AccountLayout from './pages/account/AccountLayout';
import AccountProfilePage from './pages/account/AccountProfile';
import AccountAddressesPage from './pages/account/AccountAddresses';
import VendorLayout from './pages/vendor/VendorLayout';
import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorProductsPage from './pages/vendor/VendorProducts';
import VendorProductFormPage from './pages/vendor/VendorProductForm';
import VendorOrdersPage from './pages/vendor/VendorOrders';
import VendorOrderDetailPage from './pages/vendor/VendorOrderDetail';
import {
  LoginPage,
  RegisterChoicePage,
  RegisterClientPage,
  RegisterVendorPage,
  RegisterDriverPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from './pages/auth';
import DriverLayout from './pages/driver/DriverLayout';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverDeliveriesPage from './pages/driver/DriverDeliveries';
import DriverDeliveryDetailPage from './pages/driver/DriverDeliveryDetail';
import AdminDriversPage from './pages/admin/AdminDrivers';
import AdminDeliveriesPage from './pages/admin/AdminDeliveries';
import AdminLayout from './pages/admin/AdminLayout';
import AdminVendorsPage from './pages/admin/AdminVendors';
import AdminParcelsPage from './pages/admin/AdminParcels';

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
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalogue" element={<CatalogPage />} />
            <Route path="/produit/:slug" element={<ProductDetailPage />} />
            <Route path="/boutique/:slug" element={<VendorShopPage />} />
            <Route path="/panier" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/commandes" element={<OrdersPage />} />
            <Route path="/commandes/:id" element={<OrderDetailPage />} />
            <Route path="/colis" element={<ParcelSendPage />} />
            <Route path="/colis/mes-envois" element={<ParcelListPage />} />
            <Route path="/colis/:id" element={<ParcelDetailPage />} />
            <Route path="/suivi" element={<ParcelTrackPage />} />

            <Route path="/compte" element={<AccountLayout />}>
              <Route index element={<AccountProfilePage />} />
              <Route path="adresses" element={<AccountAddressesPage />} />
            </Route>

            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterChoicePage />} />
            <Route path="/auth/register/client" element={<RegisterClientPage />} />
            <Route path="/auth/register/vendor" element={<RegisterVendorPage />} />
            <Route path="/auth/register/driver" element={<RegisterDriverPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/vendeur"
              element={
                <ProtectedRoute roles={['vendeur']}>
                  <VendorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<VendorDashboard />} />
              <Route path="commandes" element={<VendorOrdersPage />} />
              <Route path="commandes/:id" element={<VendorOrderDetailPage />} />
              <Route path="produits" element={<VendorProductsPage />} />
              <Route path="produits/nouveau" element={<VendorProductFormPage />} />
              <Route path="produits/:id" element={<VendorProductFormPage />} />
            </Route>

            <Route
              path="/livreur"
              element={
                <ProtectedRoute roles={['livreur']}>
                  <DriverLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DriverDashboard />} />
              <Route path="courses" element={<DriverDeliveriesPage />} />
              <Route path="courses/:id" element={<DriverDeliveryDetailPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/vendeurs" replace />} />
              <Route path="vendeurs" element={<AdminVendorsPage />} />
              <Route path="livreurs" element={<AdminDriversPage />} />
              <Route path="livraisons" element={<AdminDeliveriesPage />} />
              <Route path="colis" element={<AdminParcelsPage />} />
            </Route>
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}
