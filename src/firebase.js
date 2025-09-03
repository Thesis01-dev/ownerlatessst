import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 


const firebaseConfig = {
  apiKey: "AIzaSyCcuQHQVEpXyqdBPsaSRxS9mYZbE6PzKcY",
  authDomain: "car-rental1-3c82a.firebaseapp.com",
  projectId: "car-rental1-3c82a",
  storageBucket: "car-rental1-3c82a.firebasestorage.app",
  messagingSenderId: "492454951144",
  appId: "1:492454951144:web:d667b7f7237c7ea1e6b15d",
  measurementId: "G-9ZCVCPBL2T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 


export { auth, db, storage }; 
export default app;
