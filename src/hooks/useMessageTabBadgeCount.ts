import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/databaseService';
import { Conversation, MessageRequest } from '../types';

function isConversationUnread(conv: Conversation, myId: string): boolean {
  const lm = conv.lastMessage;
  if (!lm || lm.senderId === myId) return false;
  const t =
    lm.createdAt instanceof Date ? lm.createdAt.getTime() : new Date(lm.createdAt as string).getTime();
  const readAt = conv.lastReadAt?.[myId]?.getTime?.() ?? 0;
  return t > readAt;
}

function computeBadge(conversations: Conversation[], requests: MessageRequest[], userId: string): number {
  let n = 0;
  for (const c of conversations) {
    if (c.hiddenFor?.includes(userId)) continue;
    if (isConversationUnread(c, userId)) n += 1;
  }
  n += requests.length;
  return n;
}

/** Unread inbox threads + pending incoming message requests (for tab badge). */
export function useMessageTabBadgeCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setCount(0);
      return;
    }

    let conversations: Conversation[] = [];
    let requests: MessageRequest[] = [];

    const sync = () => {
      setCount(computeBadge(conversations, requests, user.uid));
    };

    const unsubConv = DatabaseService.subscribeToConversations(user.uid, list => {
      conversations = list;
      sync();
    });
    const unsubReq = DatabaseService.subscribeToIncomingMessageRequests(user.uid, list => {
      requests = list;
      sync();
    });

    return () => {
      unsubConv();
      unsubReq();
    };
  }, [user?.uid]);

  return count;
}
