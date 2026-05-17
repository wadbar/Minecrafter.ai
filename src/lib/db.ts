import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function saveArtifact(type: 'skin' | 'map' | 'mod' | 'texture' | 'storyteller', title: string, content: string) {
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
