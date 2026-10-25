import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Store,
  MapPin,
} from 'lucide-react';
import { fetchFeaturedVendors } from '../services/catalog';
import { useCountry } from '../context/CountryContext';
import VendorBadges from './vendors/VendorBadges';
import SectionHeading from './SectionHeading';
import { countryLabel, type CatalogVendor } from '../types/catalog';
import { fetchActiveAds } from '../services/subscriptions';
import { supabase } from '../lib/supabase';

function SellerCard({ seller }: { seller: CatalogVendor }) {
  return (
    <div className="flex-shrink-0 w-72 bg-white rounded-3xl overflow-hidden hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)] transition-all duration-500 group snap-start">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[#FF8A2B] via-[#F25500] to-[#00A651]">
        <div className="absolute inset-0 bg-grid-light opacity-60" />
        {seller.shopLogoUrl && (
          <img
            src={seller.shopLogoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[1px] scale-110 group-hover:scale-125 transition-transform duration-700"
          />
        )}
        <div className="absolute top-2.5 left-2.5 right-2.5">
          <VendorBadges vendor={seller} size="sm" />
        </div>
      </div>

      <div className="relative px-4 -mt-8">
        <div className="w-16 h-16 rounded-2xl ring-4 ring-white overflow-hidden shadow-xl bg-white">
          {seller.shopLogoUrl ? (
            <img src={seller.shopLogoUrl} alt={seller.shopName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store size={24} className="text-gray-300" />
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-base font-extrabold text-[#1F2937] mb-1 group-hover:text-[#FF6B00] transition-colors">
          {seller.shopName}
        </h3>
        <p className="text-xs text-gray-500 mb-3">{seller.shopCategory || 'Boutique'}</p>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">
            <Star size={13} className="text-[#FFD700] fill-[#FFD700]" />
            <span className="text-xs font-bold text-[#1F2937]">{seller.rating.toFixed(1)}</span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            {seller.totalSales.toLocaleString('fr-FR')}+ ventes
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-4">
          <span className="flex items-center gap-1 font-mono">{seller.vendorCode}</span>
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {countryLabel(seller.country) || seller.city}
          </span>
        </div>

        <Link
          to={`/boutique/${seller.shopSlug}`}
          className="sheen w-full py-2.5 bg-[#0B0F19] text-white rounded-xl text-xs font-bold group-hover:bg-[#FF6B00] transition-colors flex items-center justify-center gap-1.5"
        >
          <Store size={13} /> Visiter boutique
        </Link>
      </div>
    </div>
  );
}

export default function Sellers() {
  const { country, countryName } = useCountry();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [sellers, setSellers] = useState<CatalogVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [list, ads] = await Promise.all([
        fetchFeaturedVendors(8, country),
        fetchActiveAds('featured_vendor').catch(() => []),
      ]);
      let ordered = list;
      const sponsoredIds = ads.map((a) => a.vendorId).filter(Boolean) as string[];
      if (sponsoredIds.length) {
        const missing = sponsoredIds.filter((id) => !list.some((v) => v.id === id));
        let extra: CatalogVendor[] = [];
        if (missing.length) {
          const { data } = await supabase
            .from('vendors')
            .select('*')
            .in('id', missing)
            .eq('status', 'approved');
          extra = (data || []).map((row) => ({
            id: row.id as string,
            shopName: row.shop_name as string,
            shopSlug: row.shop_slug as string,
            shopDescription: (row.shop_description as string) ?? null,
            shopCategory: (row.shop_category as string) ?? null,
            shopLogoUrl: (row.shop_logo_url as string) ?? null,
            vendorCode: row.vendor_code as string,
            country: row.country as string,
            city: row.city as string,
            rating: Number(row.rating ?? 0),
            reviewCount: Number(row.review_count ?? 0),
            totalSales: Number(row.total_sales ?? 0),
            status: row.status as string,
            isGoldSeller: Boolean(row.is_gold_seller),
            isTopRated: Boolean(row.is_top_rated),
            subscriptionPlanCode: (row.subscription_plan_code as string) ?? null,
            subscriptionBoost: Boolean(row.subscription_boost),
          }));
        }
        const byId = new Map([...list, ...extra].map((v) => [v.id, v]));
        const boosted = sponsoredIds.map((id) => byId.get(id)).filter(Boolean) as CatalogVendor[];
        const rest = list.filter((v) => !sponsoredIds.includes(v.id));
        ordered = [...boosted, ...rest].slice(0, 8);
      }
      if (!cancelled) {
        setSellers(ordered);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [country]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(
      scrollRef.current.scrollLeft <
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10
    );
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    setTimeout(checkScroll, 400);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 md:px-12 py-12 ring-1 ring-white/10">
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-[#10C86E]/35 blur-[110px] animate-orb mix-blend-screen" />
        <div className="absolute -bottom-40 -left-24 w-[420px] h-[420px] rounded-full bg-teal-400/20 blur-[110px] animate-orb mix-blend-screen" style={{ animationDelay: '-8s' }} />
        <div className="absolute inset-0 bg-grid-light pointer-events-none" />

        <div className="relative flex items-end justify-between gap-4 mb-8">
          <SectionHeading
            eyebrow="Boutiques"
            title="Vendeurs"
            highlight="vedettes"
            subtitle={`Les meilleurs vendeurs vérifiés — ${countryName}`}
            green
            light
          />
          <div className="flex items-center gap-2 shrink-0">
            {(['left', 'right'] as const).map((dir) => {
              const enabled = dir === 'left' ? canScrollLeft : canScrollRight;
              return (
                <button
                  key={dir}
                  onClick={() => scroll(dir)}
                  disabled={!enabled}
                  aria-label={dir === 'left' ? 'Précédent' : 'Suivant'}
                  className={`w-11 h-11 rounded-2xl glass-dark flex items-center justify-center transition-all ${
                    enabled ? 'text-white hover:bg-white/20' : 'text-white/25 cursor-not-allowed'
                  }`}
                >
                  {dir === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="relative flex gap-5 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-72 h-72 rounded-3xl bg-white/5 animate-pulse shrink-0" />
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="relative glass-dark rounded-3xl p-8 text-center text-sm text-white/70">
            Aucun vendeur approuvé pour le moment. Lancez le seed démo ou validez un vendeur.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="relative flex gap-5 overflow-x-auto scrollbar-hide pb-4 pt-2 snap-x"
          >
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
