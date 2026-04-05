// src/hooks/useMailbox.js
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useMailbox = ({ user }) => {
  const [mailboxItems, setMailboxItems] = useState([]);

  useEffect(() => {
    if (!user) { setMailboxItems([]); return; }

    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'mailbox'),
      where('claimed', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMailboxItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [user]);

  return { mailboxItems, unclaimedCount: mailboxItems.length };
};
