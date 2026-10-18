export default function SectionHeading({
  eyebrow,
  title,
  highlight,
  subtitle,
  green,
  light,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle?: string;
  green?: boolean;
  light?: boolean;
}) {
  return (
    <div>
      <p
        className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${
          green ? 'text-[#00A651]' : 'text-[#FF6B00]'
        }`}
      >
        <span
          className={`h-px w-8 bg-gradient-to-r ${
            green ? 'from-[#00A651] to-transparent' : 'from-[#FF6B00] to-transparent'
          }`}
        />
        {eyebrow}
      </p>
      <h2 className={`mt-2 text-3xl md:text-4xl font-extrabold ${light ? 'text-white' : 'text-[#0B0F19]'}`}>
        {title}{' '}
        <span className={green ? 'text-gradient-green' : 'text-gradient-brand'}>{highlight}</span>
      </h2>
      {subtitle && (
        <p className={`text-sm md:text-base mt-2 ${light ? 'text-white/60' : 'text-gray-500'}`}>{subtitle}</p>
      )}
    </div>
  );
}
