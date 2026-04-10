'use client';

import { FolderOpen } from 'lucide-react';

interface CollectionNode {
  id: string;
  name: string;
  color: string | null;
  image_url: string | null;
  children: CollectionNode[];
}

interface CollectionGridProps {
  collections: CollectionNode[];
  onSelect: (collection: CollectionNode) => void;
}

export function CollectionGrid({ collections, onSelect }: CollectionGridProps) {
  if (collections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg text-slate-400">Sin colecciones</p>
          <p className="text-sm">Crea colecciones desde el panel de administracion</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {collections.map((col) => (
        <button
          key={col.id}
          type="button"
          onClick={() => onSelect(col)}
          className="group relative aspect-square rounded-2xl bg-slate-900/80 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/50 hover:scale-[1.02] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          {/* Background image or color wash */}
          {col.image_url ? (
            <img
              src={col.image_url}
              alt={col.name}
              className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-300"
            />
          ) : (
            <div
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300"
              style={{ backgroundColor: col.color || '#334155' }}
            />
          )}

          {/* Glass overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

          {/* Subtle border glow on hover */}
          <div className="absolute inset-0 rounded-2xl border border-slate-700/30 group-hover:border-slate-500/40 transition-colors duration-300" />

          {/* Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-end p-4">
            <span className="text-sm font-semibold text-white drop-shadow-lg text-center leading-tight tracking-wide">
              {col.name}
            </span>
            {col.children.length > 0 && (
              <span className="text-[10px] text-slate-400 mt-1 font-medium">
                {col.children.length} subcategorias
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
