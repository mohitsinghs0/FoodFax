export type StallType = 
  | 'Thela / Food Stall'
  | 'College Canteen'
  | 'Tea Tapri'
  | 'Fast Food Counter'
  | 'Sandwich Cart'
  | 'Juice Point'
  | 'Chaat Cart'
  | 'Tiffin Cart';

export interface ShopCategory {
  id: string;
  name: string;
  iconName: string;
  description?: string;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  stallType: StallType;
  tagline: string;
  description: string;
  image: string;
  bannerImage: string;
  contactPhone?: string;
  phone?: string;
  ownerId?: string;
  latitude?: number;
  longitude?: number;
  openingTime?: string;
  closingTime?: string;
  upiId?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location: {
    address: string;
    landmark: string;
    distanceKm: number;
    latitude?: number;
    longitude?: number;
  };
  isOpen: boolean;
  openingHours: string;
  rating: number;
  totalReviews: number;
  categories: string[];
  preparationTimeMinutes: string; // e.g. "5-10" or "10-15"
  isPureVeg: boolean;
  tableServiceAvailable: boolean;
  isRushHour?: boolean;
  featuredItem?: string;
  isDemo?: boolean;
}

export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isVeg: boolean;
  isBestseller?: boolean;
  preparationTimeMin?: number;
  preparationMinutes?: string;
  customizationOptions?: any[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  shopId: string;
}

export interface Cart {
  items: CartItem[];
  shopId: string | null;
  shopName: string | null;
  shopImage?: string;
}

export type OrderType = 'TAKEAWAY' | 'DINE_IN';

export type PaymentMethod = 'CASH_AT_COUNTER' | 'PAY_ONLINE';
export type PaymentMode = PaymentMethod;

export type PaymentStatus = 'PENDING' | 'PAID' | 'COLLECT_ON_DELIVERY' | 'REFUNDED' | 'FAILED';

export type OrderStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

export interface Order {
  id: string;
  shopId: string;
  shopName: string;
  shopImage?: string;
  shopLocation: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  tokenNumber: string; // e.g. "#142"
  orderType: OrderType;
  tableNumber?: string;
  paymentMethod: PaymentMethod;
  paymentMode?: PaymentMode;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  estimatedPreparationMinutes: string;
  createdAt: string;
  updatedAt?: string;
  readyAt?: string;
  completedAt?: string;
  instructions?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: 'customer' | 'owner' | 'system';
  rating?: number;
  reviewText?: string;
  reviewedAt?: string;
  feedbackTags?: string[];
  isDemo?: boolean;
}

export interface BusinessOwner {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  upiId: string;
}

export interface BusinessNotification {
  id: string;
  shopId: string;
  title: string;
  message: string;
  type: 'ORDER_NEW' | 'ORDER_READY' | 'ORDER_CANCELLED' | 'PAYMENT' | 'ALERT' | 'INFO';
  tokenNumber?: string;
  orderId?: string;
  amount?: number;
  isRead: boolean;
  createdAt: string;
}

export interface SalesSummary {
  period: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH';
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  averageOrderValue: number;
  topSellingItems: {
    name: string;
    count: number;
    revenue: number;
  }[];
}

export interface BusinessSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoPrintReceipt: boolean;
  rushMode: boolean;
  isOnline: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  savedShopIds: string[];
  preferredLocation: string;
}

export type UserRole = 'customer' | 'owner' | 'admin';

export interface AuthUser {
  id: string;
  fullName: string;
  name?: string;
  phone: string;
  email?: string;
  role: UserRole;
  shopId?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  area?: string;
  city?: string;
  photoUrl?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
  createdAt?: string;
  isDemo?: boolean;
}

export interface OwnerBusinessContext {
  id: string;
  name: string;
  ownerId: string;
  description?: string;
  phone?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  stallType?: string;
  openingTime?: string;
  closingTime?: string;
  upiId?: string;
  isOpen?: boolean;
  isActive?: boolean;
  image?: string;
  rating?: number;
}

export interface DatabaseUser {
  id: string;
  phone: string;
  email?: string;
  fullName?: string;
  name?: string;
  role: UserRole;
  shopId?: string;
  latitude?: number;
  longitude?: number;
  area?: string;
  city?: string;
  photoUrl?: string;
  profileCompleted?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedBy?: string;
  note?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  paymentMode: 'cash' | 'upi' | 'card' | PaymentMethod;
  paymentStatus: PaymentStatus;
  amount: number;
  transactionId?: string;
  provider?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteShopRecord {
  userId: string;
  shopId: string;
  createdAt: string;
}

export interface TokenCounterRecord {
  shopId: string;
  tokenDate: string;
  lastToken: number;
}
