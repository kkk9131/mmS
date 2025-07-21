import { useState, useEffect, useRef } from 'react';
import { NotificationService } from '../services/NotificationService';

export function useNotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationService = NotificationService.getInstance();

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      // エラー時はカウントをリセット
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // 最初に1回実行
    fetchUnreadCount();

    // 30秒ごとに未読数を更新
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 手動で未読数を更新する関数
  const refreshUnreadCount = () => {
    fetchUnreadCount();
  };

  // 通知を既読にした時に呼び出す関数
  const decrementUnreadCount = (count: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - count));
  };

  // 全件既読にした時に呼び出す関数
  const clearUnreadCount = () => {
    setUnreadCount(0);
  };

  useEffect(() => {
    startPolling();

    return () => {
      stopPolling();
    };
  }, []);

  return {
    unreadCount,
    loading,
    refreshUnreadCount,
    decrementUnreadCount,
    clearUnreadCount,
    startPolling,
    stopPolling,
  };
}