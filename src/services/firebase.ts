import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import {
  deleteDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, listAll, ref, uploadBytes } from 'firebase/storage';
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from 'firebase/messaging';
import type { AppState, Attachment, UserProfile } from '../types';
import { normalizeState } from '../data/storage';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';
export { isFirebaseConfigured } from './firebaseConfig';

let app: FirebaseApp | undefined;
let database: Firestore | undefined;
const firebaseApp = (): FirebaseApp => {
  if (!isFirebaseConfigured) throw new Error('Firebaseが未設定です。.envの設定後に再起動してください。');
  app ??= initializeApp(firebaseConfig);
  return app;
};

const firestoreDb = (): Firestore => {
  if (database) return database;
  try {
    database = initializeFirestore(firebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch {
    database = getFirestore(firebaseApp());
  }
  return database;
};

const profileFromUser = (user: User, provider: UserProfile['provider'] = 'password'): UserProfile => ({
  id: user.uid,
  email: user.email ?? undefined,
  displayName: user.displayName || user.email?.split('@')[0] || 'ユーザー',
  provider
});

export const registerWithEmail = async (email: string, password: string, displayName: string): Promise<UserProfile> => {
  const auth = getAuth(firebaseApp());
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return profileFromUser(credential.user);
};

export const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
  const credential = await signInWithEmailAndPassword(getAuth(firebaseApp()), email, password);
  return profileFromUser(credential.user);
};

export const loginWithGoogle = async (): Promise<UserProfile> => {
  const credential = await signInWithPopup(getAuth(firebaseApp()), new GoogleAuthProvider());
  return profileFromUser(credential.user, 'google');
};

export const sendResetEmail = async (email: string): Promise<void> =>
  sendPasswordResetEmail(getAuth(firebaseApp()), email);

export const logoutFirebase = async (): Promise<void> => {
  if (isFirebaseConfigured) await signOut(getAuth(firebaseApp()));
};

export const subscribeToAuth = (listener: (profile?: UserProfile) => void): (() => void) => {
  if (!isFirebaseConfigured) {
    listener(undefined);
    return () => undefined;
  }
  return onAuthStateChanged(getAuth(firebaseApp()), (user) => listener(user ? profileFromUser(user) : undefined));
};

export const saveStateToCloud = async (state: AppState): Promise<string> => {
  if (state.currentUser.provider === 'local') throw new Error('クラウド保存にはログインが必要です。');
  const db = firestoreDb();
  const attachments = await Promise.all(
    state.attachments.map(async (attachment) => {
      if (!attachment.dataUrl.startsWith('data:')) return attachment;
      const blob = await fetch(attachment.dataUrl).then((response) => response.blob());
      const objectRef = ref(getStorage(firebaseApp()), `users/${state.currentUser.id}/attachments/${attachment.id}`);
      await uploadBytes(objectRef, blob, {
        contentType: attachment.mimeType,
        customMetadata: { ownerId: state.currentUser.id, ownerType: attachment.ownerType }
      });
      return { ...attachment, dataUrl: await getDownloadURL(objectRef) };
    })
  );
  const cloudState = {
    ...state,
    attachments,
    lastSyncedAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', state.currentUser.id, 'appData', 'state'), {
    state: cloudState,
    updatedAt: serverTimestamp()
  });
  return cloudState.lastSyncedAt;
};

export const loadStateFromCloud = async (userId: string): Promise<AppState | undefined> => {
  const snapshot = await getDoc(doc(firestoreDb(), 'users', userId, 'appData', 'state'));
  if (!snapshot.exists()) return undefined;
  return normalizeState(snapshot.data().state as Partial<AppState>);
};

export const deleteCloudAccountData = async (userId: string): Promise<void> => {
  await deleteDoc(doc(firestoreDb(), 'users', userId, 'appData', 'state'));
};

export const deleteFirebaseAccount = async (): Promise<void> => {
  const user = getAuth(firebaseApp()).currentUser;
  if (!user) throw new Error('ログイン情報を確認できません。もう一度ログインしてください。');
  const lastSignInAt = Date.parse(user.metadata.lastSignInTime ?? '');
  if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > 5 * 60_000) {
    const error = new Error('安全のため再認証が必要です。');
    Object.assign(error, { code: 'auth/requires-recent-login' });
    throw error;
  }
  const attachments = await listAll(ref(getStorage(firebaseApp()), `users/${user.uid}/attachments`));
  const devices = await getDocs(collection(firestoreDb(), 'users', user.uid, 'devices'));
  await Promise.allSettled(attachments.items.map((item) => deleteObject(item)));
  await Promise.all(devices.docs.map((device) => deleteDoc(device.ref)));
  await deleteCloudAccountData(user.uid);
  await deleteUser(user);
};

export const uploadAttachmentToCloud = async (userId: string, attachment: Attachment, file: Blob): Promise<string> => {
  const objectRef = ref(getStorage(firebaseApp()), `users/${userId}/attachments/${attachment.id}`);
  await uploadBytes(objectRef, file, {
    contentType: attachment.mimeType,
    customMetadata: { ownerId: userId, ownerType: attachment.ownerType }
  });
  return getDownloadURL(objectRef);
};

export const deleteCloudAttachment = async (userId: string, attachmentId: string): Promise<void> =>
  deleteObject(ref(getStorage(firebaseApp()), `users/${userId}/attachments/${attachmentId}`));

export const enableFirebaseMessaging = async (
  userId: string,
  onForegroundMessage?: (title: string, body: string) => void
): Promise<boolean> => {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!vapidKey || !(await isMessagingSupported())) return false;
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(firebaseApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return false;
  await setDoc(
    doc(firestoreDb(), 'users', userId, 'devices', token),
    { token, updatedAt: serverTimestamp(), userAgent: navigator.userAgent },
    { merge: true }
  );
  if (onForegroundMessage) {
    onMessage(messaging, (payload) =>
      onForegroundMessage(payload.notification?.title ?? '今日ノート', payload.notification?.body ?? '新しいお知らせがあります。')
    );
  }
  return true;
};

export const subscribeToCloudState = (
  userId: string,
  onState: (state: AppState) => void,
  onError: (message: string) => void
): Unsubscribe =>
  onSnapshot(
    doc(firestoreDb(), 'users', userId, 'appData', 'state'),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
      const state = snapshot.data().state as Partial<AppState> | undefined;
      if (state) onState(normalizeState(state));
    },
    () => onError('クラウドの更新を受信できませんでした。接続を確認して再試行してください。')
  );

export const updateFirebaseDisplayName = async (displayName: string): Promise<void> => {
  const user = getAuth(firebaseApp()).currentUser;
  if (!user) throw new Error('ログイン情報を確認できません。');
  await updateProfile(user, { displayName });
};
