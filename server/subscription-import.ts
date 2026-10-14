import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from './db';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Invalid date');
export const ImportSchema = z.object({
  name: z.string().trim().min(1).max(200), category: z.string().default('Other'),
  price: z.coerce.number().finite().nonnegative(), currency: z.enum(['USD','KHR','EUR','GBP','AUD','CAD','JPY','THB','VND','SGD','CNY','INR']).default('USD'),
  billing_cycle: z.enum(['weekly','monthly','quarterly','semi_annual','yearly','lifetime']),
  start_date: date, next_billing_date: date,
  status: z.enum(['active','paused','cancelled','trial']).default('active'),
  payment_method: z.string().default('other'), notes: z.string().max(4000).default(''),
  website: z.string().default(''), logo: z.string().default(''), color: z.string().default('#4F46E5'),
  reminder_days: z.coerce.number().int().min(0).max(90).default(3),
  auto_renew: z.union([z.boolean(),z.literal(0),z.literal(1)]).default(false),
  cancellation_url: z.string().default(''), source_id: z.string().max(200).optional(),
  initial_payment: z.object({amount:z.number().finite().nonnegative(), date, status:z.enum(['paid','failed']).default('paid')}).optional(),
});
export async function importSubscription(userId: string, input: unknown) {
  const s = ImportSchema.parse(input);
  const id = s.source_id ? 'sub-mail-' + crypto.createHash('sha256').update(userId+'\0'+s.source_id).digest('hex') : 'sub-'+crypto.randomUUID();
  if (await db.prepare('SELECT id FROM public.subtrack_subscriptions WHERE id=? AND user_id=?').get(id,userId)) return {id,added:false};
  const added = await db.prepare(`INSERT INTO public.subtrack_subscriptions
    (id,user_id,name,category,price,currency,billing_cycle,payment_method,start_date,next_billing_date,status,notes,website,logo,color,reminder_days,auto_renew,cancellation_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`).run(id,userId,s.name,s.category,s.price,s.currency,s.billing_cycle,s.payment_method,s.start_date,s.next_billing_date,s.status,s.notes,s.website,s.logo,s.color,s.reminder_days,Number(Boolean(s.auto_renew)),s.cancellation_url);
  if (added.changes && s.initial_payment) await db.prepare(`INSERT INTO public.subtrack_payment_history
    (id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(s.source_id?.startsWith('gmail:')?'gmail-'+crypto.createHash('sha256').update(userId+s.source_id.slice(6)).digest('hex'):'hist-'+id,userId,id,s.initial_payment.amount,s.currency,s.initial_payment.date,s.payment_method,s.initial_payment.status);
  return {id,added:added.changes > 0};
}
