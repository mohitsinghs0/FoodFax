import React from 'react';
import { LiveOrderTracker } from '../components/order/LiveOrderTracker';

interface OrderTrackerViewProps {
  orderId: string;
}

export const OrderTrackerView: React.FC<OrderTrackerViewProps> = ({ orderId }) => {
  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 max-w-4xl mx-auto">
      <LiveOrderTracker orderId={orderId} />
    </div>
  );
};
