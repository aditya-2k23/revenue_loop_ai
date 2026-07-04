export function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-zinc-900/40 backdrop-blur-md border ${highlight ? "border-blue-500/30" : "border-white/5"} rounded-2xl p-5 text-center transition-all hover:bg-zinc-900/60 flex flex-col justify-center`}
    >
      <div
        className={`text-2xl lg:text-3xl font-bold mb-1.5 ${highlight ? "text-blue-400" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest">
        {label}
      </div>
    </div>
  );
}
