// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBRjYwh7CQlAWWxKAhGfK8Z5SSgBDsAYDc",
  authDomain: "tickr-190ee.firebaseapp.com",
  projectId: "tickr-190ee",
  storageBucket: "tickr-190ee.appspot.com",
  messagingSenderId: "913662019966",
  appId: "1:913662019966:web:754dc7792d736ae71d8b2f",
  measurementId: "G-NK415QQQ4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Check if the app is initialized correctly
if (!app.options) {
  throw new Error('Firebase app is not initialized correctly');
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
};
