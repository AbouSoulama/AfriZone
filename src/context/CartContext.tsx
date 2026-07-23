import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  addToCart,
  fetchCartSummary,
  removeCartItem,
  updateCartItemQuantity,
  type CartSummary,
} from '../services/cart';

interface CartContextType {
  summary: CartSummary | null;
  itemCount: number;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const emptySummary: CartSummary = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  shippingEstimate: 0,
  total: 0,
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSummary(emptySummary);
      return;
    }
    setIsLoading(true);
    try {
      setSummary(await fetchCartSummary(user.id));
    } catch (e) {
      console.error(e);
      setSummary(emptySummary);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = async (productId: string, quantity = 1) => {
    if (!user) throw new Error('Connectez-vous pour ajouter au panier.');
    await addToCart(user.id, productId, quantity);
    await refreshCart();
  };

  const setQuantity = async (itemId: string, quantity: number) => {
    await updateCartItemQuantity(itemId, quantity);
    await refreshCart();
  };

  const removeItem = async (itemId: string) => {
    await removeCartItem(itemId);
    await refreshCart();
  };

  return (
    <CartContext.Provider
      value={{
        summary,
        itemCount: summary?.itemCount ?? 0,
        isLoading,
        refreshCart,
        addItem,
        setQuantity,
        removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
