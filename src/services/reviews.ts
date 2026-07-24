import { supabase } from '../lib/supabase';

export interface ReviewView {
  id: string;
  userId: string;
  productId: string;
  vendorId: string;
  orderId: string;
  rating: number;
  vendorRating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  productName?: string | null;
  productSlug?: string | null;
}

export interface SubmitReviewInput {
  orderId: string;
  productId: string;
  rating: number;
  vendorRating: number;
  comment?: string;
}

function mapReview(row: Record<string, unknown>): ReviewView {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  const p = profile as Record<string, unknown> | null;
  const prod = product as Record<string, unknown> | null;

  return {
    id: row.id as string,
    userId: row.user_id as string,
    productId: row.product_id as string,
    vendorId: row.vendor_id as string,
    orderId: row.order_id as string,
    rating: Number(row.rating),
    vendorRating: Number(row.vendor_rating),
    comment: (row.comment as string) ?? null,
    createdAt: row.created_at as string,
    authorName: (p?.full_name as string) || 'Client AfriZone',
    productName: (prod?.name as string) ?? null,
    productSlug: (prod?.slug as string) ?? null,
  };
}

const REVIEW_SELECT = `
  id, user_id, product_id, vendor_id, order_id, rating, vendor_rating, comment, created_at,
  profiles:user_id ( full_name ),
  products:product_id ( name, slug )
`;

export async function fetchProductReviews(
  productId: string,
  limit = 20
): Promise<ReviewView[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchProductReviews', error);
    return [];
  }
  return (data ?? []).map((row) => mapReview(row as Record<string, unknown>));
}

export async function fetchVendorReviews(
  vendorId: string,
  limit = 20
): Promise<ReviewView[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchVendorReviews', error);
    return [];
  }
  return (data ?? []).map((row) => mapReview(row as Record<string, unknown>));
}

/** Avis déjà déposés pour une commande (par productId) */
export async function fetchOrderReviews(
  orderId: string,
  userId: string
): Promise<Record<string, ReviewView>> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('order_id', orderId)
    .eq('user_id', userId);

  if (error) {
    console.error('fetchOrderReviews', error);
    return {};
  }

  const map: Record<string, ReviewView> = {};
  for (const row of data ?? []) {
    const r = mapReview(row as Record<string, unknown>);
    map[r.productId] = r;
  }
  return map;
}

export async function submitReview(input: SubmitReviewInput): Promise<string> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('La note produit doit être entre 1 et 5.');
  }
  if (input.vendorRating < 1 || input.vendorRating > 5) {
    throw new Error('La note vendeur doit être entre 1 et 5.');
  }

  const { data, error } = await supabase.rpc('submit_review', {
    p_order_id: input.orderId,
    p_product_id: input.productId,
    p_rating: input.rating,
    p_vendor_rating: input.vendorRating,
    p_comment: input.comment?.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}
