import { z } from 'zod';

export const PropertySearchSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(10)
});

export const CalendarBulkUpdateSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  dates: z.array(z.string()).min(1, 'At least one date is required'),
  isBlocked: z.boolean(),
  priceOverride: z.number().positive().optional()
});
