import React from 'react';
import { AlertCircle, RefreshCw, Trash2, X, Clock, HelpCircle } from 'lucide-react';
import { retryCommand, dismissCommand, clearRejectedCommands } from '../offline';

interface Props {
  commands: any[];
  isOpen: boolean;
  onClose: () => void;
}

export function RejectedCommandsModal({ commands, isOpen, onClose }: Props) {
  if (!isOpen || commands.length === 0) return null;

  const formatTime = (date: any) => {
    try {
      const d = new Date(date);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">Command Sync Issues</h3>
              <p className="text-xs text-gray-500">{commands.length} mutation{commands.length === 1 ? '' : 's'} rejected by Local Hub</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-gray-100">
          {commands.map((cmd) => (
            <div key={cmd.actionId} className="pt-3 first:pt-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md">
                  {cmd.type}
                </span>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(cmd.createdAt)}
                </span>
              </div>

              {cmd.lastError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-100 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{cmd.lastError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={async () => {
                    await dismissCommand(cmd.actionId);
                    if (commands.length <= 1) onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px]"
                >
                  <Trash2 size={13} />
                  <span>Dismiss</span>
                </button>

                <button
                  onClick={async () => {
                    await retryCommand(cmd.actionId);
                    if (commands.length <= 1) onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg transition-all flex items-center gap-1.5 shadow-xs min-h-[36px]"
                >
                  <RefreshCw size={13} />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={async () => {
              await clearRejectedCommands();
              onClose();
            }}
            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline min-h-[44px] flex items-center"
          >
            Dismiss All
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 shadow-xs min-h-[44px] flex items-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
