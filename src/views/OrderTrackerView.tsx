import React, { useState, useEffect } from 'react';
import { LiveOrderTracker } from '../components/order/LiveOrderTracker';
import { orderService } from '../services/orderService';
import { useAuth } from '../context/AuthContext';

interface OrderTrackerViewProps {
  orderId?: string;
}

export const OrderTrackerView: React.FC<OrderTrackerViewProps> = ({ orderId }) => {
  const { currentUser } = useAuth();
  const [resolvedOrderId, setResolvedOrderId] = useState<string>(orderId || '');
  const [resolving, setResolving] = useState<boolean>(!orderId);

  useEffect(() => {
    if (orderId) {
      setResolvedOrderId(orderId);
      setResolving(false);
      return;
    }

    const resolveOrder = async () => {
      try {
        const orders = await orderService.getCustomerOrders(currentUser?.id);
        if (orders && orders.length > 0) {
          // Find an active order first
          const active = orders.find(
            (o) =>
              o.orderStatus === 'PENDING' ||
              o.orderStatus === 'ACCEPTED' ||
              o.orderStatus === 'PREPARING' ||
              o.orderStatus === 'READY'
          );
          if (active) {
            setResolvedOrderId(active.id);
            return;
          }
          // Otherwise most recent order
          setResolvedOrderId(orders[0].id);
          return;
        }
      } catch (e) {
        console.warn('Error resolving active order for tracker:', e);
      }
      setResolvedOrderId('');
    };

    resolveOrder().finally(() => setResolving(false));
  }, [orderId, currentUser?.id]);

  if (resolving) {
    return (
      <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-3">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Locating order token...</p>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 max-w-4xl mx-auto">
      <LiveOrderTracker orderId={resolvedOrderId} />
    </div>
  );
};
