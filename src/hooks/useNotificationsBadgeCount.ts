import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/databaseService';

/** Pending incoming follow requests (Bulletin notifications bell). */
export function useNotificationsBadgeCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      return;
    }
    return DatabaseService.subscribeToIncomingFollowRequests(user.uid, items => {
      setCount(items.length);
    });
  }, [user?.uid]);

  return count;
}
