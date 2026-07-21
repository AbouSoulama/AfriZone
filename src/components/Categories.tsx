import { Smartphone, Shirt, Home, Sparkles, Utensils, Dumbbell, BookOpen, Car, ChevronRight } from 'lucide-react';

const categories = [
  { name: 'Électronique', icon: Smartphone, count: '2 450 produits', color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Mode', icon: Shirt, count: '3 120 produits', color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Maison', icon: Home, count: '1 890 produits', color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Beauté', icon: Sparkles, count: '950 produits', color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Alimentation', icon: Utensils, count: '780 produits', color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Sport', icon: Dumbbell, count: '560 produits', color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Livres', icon: BookOpen, count: '420 produits', color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Auto', icon: Car, count: '340 produits', color: '#00A651', bg: 'from-green-100 to-green-50' },
];

export default function Categories() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">
            Catégories <span className="text-[#FF6B00]">principales</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Explorez nos univers produits</p>
        </div>
        <a href="#" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#00A651] hover:text-[#008A43] transition-colors">
          Voir tout <ChevronRight size={16} />
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <a
              key={cat.name}
              href="#"
              className={`group flex flex-col items-center gap-3 p-4 bg-gradient-to-b ${cat.bg} rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300"
                style={{ backgroundColor: cat.color }}
              >
                <Icon size={26} className="text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-[#1F2937] group-hover:text-[#FF6B00] transition-colors">{cat.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{cat.count}</p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
