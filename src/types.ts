export interface Table {
  id: string;
  number: number;
  label?: string | null;
  section?: string | null;
  displayOrder?: number;
  status: 'EMPTY' | 'ACTIVE';
  orderId: string | null;
  itemCount?: number;
  archivedAt?: string | null;
}

export interface MenuItem {
  id: string;
  categoryId?: string;
  category?: string;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  displayOrder?: number;
  items: MenuItem[];
}

export interface OrderItem {
  id: string;
  orderId?: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string | null;
  kitchenStatus: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  kitchenStatusUpdatedAt?: string | null;
  addedByUserId?: string | null;
  addedByUserName?: string | null;
  createdAt?: string;
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber?: number;
  tableLabel?: string | null;
  tableSection?: string | null;
  status: 'OPEN' | 'CLOSED';
  openedByUserId?: string | null;
  openedByUserName?: string | null;
  closedByUserId?: string | null;
  closedByUserName?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
}

export interface Restaurant {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  logo?: string | null;
}

