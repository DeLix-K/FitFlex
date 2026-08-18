import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CartItem } from './types';

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (syncVariantId: number, quantity: number) => void;
  removeItem: (syncVariantId: number) => void;
  clearCart: () => void;
  totalCents: number;
  totalCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

// Lives above the tab navigator (in App.tsx) rather than inside MerchScreen
// so the cart survives switching tabs and coming back — MerchScreen unmounts
// on every tab switch since AppShell renders tabs conditionally.
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.syncVariantId === item.syncVariantId);
      if (existing) {
        return current.map((i) =>
          i.syncVariantId === item.syncVariantId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...current, { ...item, quantity }];
    });
  };

  const updateQuantity = (syncVariantId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(syncVariantId);
      return;
    }
    setItems((current) =>
      current.map((i) => (i.syncVariantId === syncVariantId ? { ...i, quantity } : i))
    );
  };

  const removeItem = (syncVariantId: number) => {
    setItems((current) => current.filter((i) => i.syncVariantId !== syncVariantId));
  };

  const clearCart = () => setItems([]);

  const totalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    [items]
  );
  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clearCart, totalCents, totalCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
