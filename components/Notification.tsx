import React from 'react';
import { XIcon } from './icons';

interface NotificationProps {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose, actionText, onAction }) => {
  const baseClasses = "flex items-center justify-between p-2 mb-2 text-sm rounded-lg animate-fade-in";
  const typeClasses = {
    error: 'text-red-200 bg-red-800/50',
    success: 'text-green-200 bg-green-800/50',
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <span>{message}</span>
      <div className="flex items-center gap-2">
        {onAction && actionText && (
          <button onClick={onAction} className="font-bold underline hover:text-white transition-colors">
            {actionText}
          </button>
        )}
        <button onClick={onClose} className="p-1 rounded-full hover:bg-black/20 transition-colors">
            <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
