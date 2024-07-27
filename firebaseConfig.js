// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {getAuth} from 'firebase/auth'
// TODO:Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCFGLYwnuW0k1aUUkgwkpt20UGaxe5KVQU",
  authDomain: "jobseeker-d26f9.firebaseapp.com",
  projectId: "jobseeker-d26f9",
  storageBucket: "jobseeker-d26f9.appspot.com",
  messagingSenderId: "437843120847",
  appId: "1:437843120847:web:a11252a7784f1c2a9b9dba",
  measurementId: "G-M1K0VSHY27"
};

// Initialize Firebase
 const app = initializeApp(firebaseConfig);

 
export const auth = getAuth(app);