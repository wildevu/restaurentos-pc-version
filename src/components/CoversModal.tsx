import React, { useState, useEffect } from 'react';
import { Users, Check, ArrowLeft, RefreshCw, X } from 'lucide-react';

interface CoversModalProps {
  isOpen: boolean;
  tableNumber: number;
  tableName?: string | null;
  onSelectCovers: (covers: number) => Promise<void> | void;
  onClose?: () => void;
}

export const CoversModal: React.FC<CoversModalProps> = ({
  isOpen,
  tableNumber,
  tableName,
  onSelectCovers,
  onClose,
}) => {
  const [selectedCovers, setSelectedCovers] = useState<number | null>(null);
  const [customCovers, setCustomCovers] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedCovers(null);
      setCustomCovers('');
      setIsConfirming(false);
      setIsSaving(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePickCovers = (num: number) => {
    setSelectedCovers(num);
    setIsConfirming(true);
    setErrorMessage(null);
  };

  const handleCustomPick = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customCovers, 10);
    if (!isNaN(val) && val > 0) {
      setSelectedCovers(val);
      setIsConfirming(true);
      setErrorMessage(null);
    }
  };

  const handleFinalConfirm = async () => {
    if (selectedCovers === null || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSelectCovers(selectedCovers);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la confirmation des couverts.');
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (isSaving) return;
    setIsConfirming(false);
    setSelectedCovers(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in duration-200 relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        )}

        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Users size={32} />
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: COVER SELECTION GRID */}
        {!isConfirming ? (
          <>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                Nombre de Couverts (Guests)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                Table {tableNumber} {tableName ? `(${tableName})` : ''} • Sélectionnez le nombre de personnes
              </p>
            </div>

            {/* 10 Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePickCovers(num)}
                  className="py-3.5 px-4 bg-gray-50 hover:bg-blue-600 hover:text-white border border-gray-200 hover:border-blue-600 rounded-2xl font-black text-lg text-gray-900 transition-all active:scale-[0.97] shadow-xs cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <span>{num} {num === 1 ? 'Personne' : 'Personnes'}</span>
                </button>
              ))}
            </div>

            {/* Custom Count Option */}
            <form onSubmit={handleCustomPick} className="pt-2 border-t border-gray-100 flex items-center gap-2">
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
          </>
        ) : (
          /* STEP 2: EXPLICIT CONFIRMATION STEP */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-black uppercase tracking-wider rounded-full">
                Confirmation requise
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-2">
                Ouvrir Table {tableNumber} ?
              </h2>
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Couverts sélectionnés</span>
                <span className="text-3xl font-black text-blue-600">
                  {selectedCovers} {selectedCovers === 1 ? 'Personne' : 'Personnes'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSaving}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-bold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Retour / Modifier</span>
              </button>

              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={isSaving}
                className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Ouverture...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>Confirmer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
