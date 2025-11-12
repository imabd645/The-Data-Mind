const firebaseConfig = {
    apiKey: "AIzaSyC_nAXNRwGnOO_6iuqx443FlNsMRf0Q8Y4",
    authDomain: "the-data-mind.firebaseapp.com",
    projectId: "the-data-mind",
    storageBucket: "the-data-mind.firebasestorage.app",
    messagingSenderId: "593077171009",
    appId: "1:593077171009:web:5788dae577c2c52d57e7c0",
    measurementId: "G-B6GKY4EH79"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser does not support persistence.');
        }
    }); 