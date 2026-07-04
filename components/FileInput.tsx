import { forwardRef } from "react";

export const FileInput = forwardRef<
  HTMLInputElement,
  { label: string; accept: string; id: string }
>(function FileInput({ label, accept, id }, ref) {
  return (
    <label className="flex flex-col gap-2 group cursor-pointer">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">
        {label}
      </span>
      <div className="relative">
        <input
          type="file"
          accept={accept}
          ref={ref}
          id={id}
          className="block w-full text-sm text-zinc-400
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-zinc-800 file:text-zinc-200
              hover:file:bg-zinc-700 file:transition-colors
              bg-zinc-950/50 border border-white/10 rounded-xl p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
        />
      </div>
    </label>
  );
});
