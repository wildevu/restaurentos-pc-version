import { z } from 'zod';

export const SetupPayloadSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  language: z.string().default('en'),
  currency: z.string().length(3, 'Currency code must be exactly 3 characters (e.g. USD, EUR, GBP)').default('USD'),
  timezone: z.string().default('UTC'),
  seatingCapacity: z.number().int().min(1).default(30),
  logo: z.string().optional(),
  tableCount: z.number().int().min(1).max(100).optional(),
  sections: z.array(z.string()).optional(),
  initialTables: z.array(z.object({
    number: z.number().int().min(1),
    label: z.string().optional(),
    section: z.string().optional(),
  })).optional(),
  ownerName: z.string().min(2, 'Name must be at least 2 characters'),
  ownerUsername: z.string().min(3, 'Username must be at least 3 characters'),
  ownerPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const LoginPayloadSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().min(1).optional(),
});

export const AuthStateSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    role: z.enum(['OWNER', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']),
    restaurantId: z.string(),
  }).nullable(),
  restaurant: z.object({
    id: z.string(),
    name: z.string(),
    language: z.string().optional(),
    currency: z.string(),
    timezone: z.string(),
    logo: z.string().nullable().optional(),
  }).nullable(),
});

export const CommandPayloadSchema = z.object({
  actionId: z.string().uuid(),
  type: z.enum([
    'OPEN_TABLE',
    'CLOSE_TABLE',
    'ADD_ITEM',
    'INCREMENT_ITEM',
    'DECREMENT_ITEM',
    'REMOVE_ITEM',
    'SET_ITEM_NOTE',
    'UPDATE_ITEM_KITCHEN_STATUS',
    'BATCH_UPDATE_KITCHEN_STATUS'
  ]),
  payload: z.any()
});

export const OpenTablePayload = z.object({ tableId: z.string(), covers: z.number().int().min(1).optional().default(1), clientOrderId: z.string().uuid().optional() });
export const CloseTablePayload = z.object({ tableId: z.string() });
export const AddItemPayload = z.object({ tableId: z.string(), menuItemId: z.string(), notes: z.string().max(255).optional(), clientItemId: z.string().uuid().optional() });
export const UpdateItemPayload = z.object({ tableId: z.string(), orderItemId: z.string() });
export const NoteItemPayload = z.object({ tableId: z.string(), orderItemId: z.string(), notes: z.string().max(255) });
export const UpdateKitchenStatusPayload = z.object({
  orderItemId: z.string(),
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED'])
});
export const BatchUpdateKitchenStatusPayload = z.object({
  orderId: z.string().optional(),
  orderItemIds: z.array(z.string()).optional(),
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED'])
});

