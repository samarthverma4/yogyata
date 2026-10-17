import React, { useEffect } from 'react';
import { Info, X } from 'lucide-react';
import type { NotificationState } from '../types';

interface NotificationProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  notification,
  onClose,
}) => {
  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div
      className="notification-container"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="notification-toast" id={`notification-${notification.id}`}>
        {/* Icon */}
        <div className="notification-icon-wrapper" aria-hidden="true">
          <Info size={18} />
        </div>

        {/* Content */}
        <div className="notification-content">
          <p className="notification-title">{notification.title}</p>
          <p className="notification-message">{notification.message}</p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          className="notification-close-btn"
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
