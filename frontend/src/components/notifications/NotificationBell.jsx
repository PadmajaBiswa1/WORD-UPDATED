import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { notificationApi } from '@/services/api';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function NotificationBell({ style = {} }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.list({ limit: 40 });
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      // ignore network errors for polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const unreadList = notifications.filter((n) => !n.read);
  const unreadCount = unreadList.length;

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleItemClick = async (notif) => {
    if (!notif.read) {
      try {
        await notificationApi.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch {
        // ignore
      }
    }

    setOpen(false);
    if (notif.documentId) {
      navigate(`/editor?id=${notif.documentId}`);
    }
  };

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 6,
          background: open ? 'var(--bg-hover, rgba(255,255,255,0.08))' : 'transparent',
          border: '1px solid transparent',
          cursor: 'pointer',
          color: 'var(--text-main, #e5e5e5)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.08))';
          e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255,255,255,0.12))';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        {/* Bell Icon */}
        <Bell size={18} />

        {/* Badge Count */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: '#ef4444',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: '16px',
            textAlign: 'center',
            boxShadow: '0 0 0 2px var(--bg-app, #121212)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 340,
          maxHeight: 440,
          background: 'var(--bg-card, #1e1e1e)',
          border: '1px solid var(--border-strong, #383838)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-strong, #383838)',
            background: 'var(--ribbon-surface, #252525)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #fff)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10,
                  background: 'rgba(201,168,76,0.2)',
                  color: 'var(--gold, #c9a84c)',
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 600,
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold, #c9a84c)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '2px 4px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body List */}
          <div style={{
            overflowY: 'auto',
            maxHeight: 380,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted, #888)',
                fontSize: 12,
              }}>
                {loading ? 'Loading notifications…' : 'No notifications yet'}
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read;
                const senderInitial = (n.sender?.name || 'U').slice(0, 1).toUpperCase();

                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                      background: isUnread ? 'rgba(201,168,76,0.06)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread ? 'rgba(201,168,76,0.12)' : 'var(--bg-hover, rgba(255,255,255,0.05))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread ? 'rgba(201,168,76,0.06)' : 'transparent';
                    }}
                  >
                    {/* Unread dot */}
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isUnread ? 'var(--gold, #c9a84c)' : 'transparent',
                      marginTop: 6,
                      flexShrink: 0,
                    }} />

                    {/* Sender Avatar */}
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--gold, #c9a84c)',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {senderInitial}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-main, #f0f0f0)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                        fontWeight: isUnread ? 600 : 400,
                      }}>
                        {n.message}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted, #888)' }}>
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        {n.documentTitle && (
                          <>
                            <span style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>•</span>
                            <span style={{
                              fontSize: 10,
                              color: 'var(--gold, #c9a84c)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 140,
                            }}>
                              {n.documentTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mark Read single button */}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, n.id)}
                        title="Mark as read"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted, #777)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          lineHeight: 1,
                        }}
                      >
                        <Check size={13} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
