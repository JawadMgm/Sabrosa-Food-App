import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyD6Av_P04MVQ1Y78T9YRIObMommCjmrbPA",
  authDomain: "sabrosa-food-db.firebaseapp.com",
  projectId: "sabrosa-food-db",
  storageBucket: "sabrosa-food-db.firebasestorage.app",
  messagingSenderId: "741941725103",
  appId: "1:741941725103:web:b6bf760a532d797df6115a",
  measurementId: "G-81QXF6BVPD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);