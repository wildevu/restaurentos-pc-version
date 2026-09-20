import React, { useState } from 'react';
import { Users, Check } from 'lucide-react';

interface CoversModalProps {
  isOpen: boolean;
  tableNumber: number;
  tableName?: string | null;
  onSelectCovers: (covers: number) => void;
}

export const CoversModal: React.FC<CoversModalProps> = ({
  isOpen,
  tableNumber,
  tableName,
  onSelectCovers,
}) => {
  const [customCovers, setCustomCovers] = useState<string>('');

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customCovers, 10);
    if (!isNaN(val) && val > 0) {
      onSelectCovers(val);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Users size={32} />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            Nombre de Couverts (Guests)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Table {tableNumber} {tableName ? `(${tableName})` : ''} • Sélectionnez le nombre de personnes
          </p>
        </div>

        {/* 10 Cards Grid: 2 per row (5 rows) */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              onClick={() => onSelectCovers(num)}
              className="py-3.5 px-4 bg-gray-50 hover:bg-blue-600 hover:text-white border border-gray-200 hover:border-blue-600 rounded-2xl font-black text-lg text-gray-900 transition-all active:scale-[0.97] shadow-xs cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>{num} {num === 1 ? 'Personne' : 'Personnes'}</span>
            </button>
          ))}
        </div>

        {/* Custom Count Option (> 10) */}
        <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-gray-100 flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="99"
            placeholder="Autre nombre (>10)..."
            value={customCovers}
            onChange={(e) => setCustomCovers(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!customCovers || parseInt(customCovers, 10) <= 0}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Check size={16} />
            <span>OK</span>
          </button>
        </form>
      </div>
    </div>
  );
};
