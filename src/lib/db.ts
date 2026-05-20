import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function saveArtifact(type: 'skin' | 'map' | 'mod' | 'texture' | 'storyteller' | 'voxel', title: string, content: string) {
  if (!auth.currentUser) throw new Error("Usuário não autenticado");

  try {
    await addDoc(collection(db, "artifacts"), {
      userId: auth.currentUser.uid,
      type,
      title,
      content,
      createdAt: serverTimestamp()
    });
  } catch (error: any) {
    console.error("Erro no Firestore: ", error);
    throw new Error(error.message);
  }
}

export async function getArtifacts() {
  if (!auth.currentUser) return [];

  try {
    const q = query(
      collection(db, "artifacts"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      timestamp: doc.data().createdAt?.toDate()?.getTime() || Date.now()
    }));
  } catch (error) {
    console.error("Erro ao buscar artefatos:", error);
    return [];
  }
}
