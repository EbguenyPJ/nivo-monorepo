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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">Sin colecciones</p>
          <p className="text-sm">Crea colecciones desde el panel de administracion</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {collections.map((col) => (
        <button
          key={col.id}
          type="button"
          onClick={() => onSelect(col)}
          className="group relative aspect-square rounded-xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {/* Background image or color */}
          {col.image_url ? (
            <img
              src={col.image_url}
              alt={col.name}
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: col.color || 'hsl(var(--muted))',
                opacity: col.color ? 0.15 : 1,
              }}
            />
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-end p-3">
            <span className="text-sm font-semibold text-white drop-shadow-md text-center leading-tight">
              {col.name}
            </span>
            {col.children.length > 0 && (
              <span className="text-[10px] text-white/70 mt-0.5">
                {col.children.length} sub
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
