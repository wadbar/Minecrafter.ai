import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function saveArtifact(type: 'skin' | 'map' | 'mod' | 'texture' | 'storyteller' | 'voxel', title: string, content: string, parameters?: any, tags?: string[]) {
  if (!auth.currentUser) throw new Error("Usuário não autenticado");

  try {
    await addDoc(collection(db, "artifacts"), {
      userId: auth.currentUser.uid,
      type,
      title,
      content,
      parameters: parameters || null,
      tags: tags || [],
      createdAt: serverTimestamp()
    });
  } catch (error: any) {
    console.error("Erro no Firestore: ", error);
    throw new Error(error.message);
  }
}

export async function deleteArtifacts(ids: string[]) {
  if (!auth.currentUser) throw new Error("Usuário não autenticado");
  
  const { writeBatch, doc } = await import('firebase/firestore');
  const batch = writeBatch(db);
  
  ids.forEach(id => {
    batch.delete(doc(db, "artifacts", id));
  });
  
  await batch.commit();
}

export async function updateArtifactTags(id: string, tags: string[]) {
  if (!auth.currentUser) throw new Error("Usuário não autenticado");
  const { doc, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, "artifacts", id), { tags });
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
