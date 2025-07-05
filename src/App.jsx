import React, { useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";

// Import audio files
import audioAccommodate from './assets/spelt_accommodate.mp3';
import audioDefinitely from './assets/spelt_definitely.mp3';
import audioMischievous from './assets/spelt_mischievous.mp3';
import audioEmbarrass from './assets/spelt_embarrass.mp3';
import audioConscientious from './assets/spelt_conscientious.mp3';

// List of artisan fonts (Google Fonts)
const ARTISAN_FONTS = [
  'Dancing Script',
  'Playfair Display',
  'Pacifico',
  'Cormorant Garamond',
  'Great Vibes',
  'EB Garamond',
  'Satisfy',
  'Lora',
  'Parisienne',
  'Merriweather',
  'Sacramento',
  'Crimson Text',
  'Allura',
  'Spectral',
  'Tangerine',
  'Alegreya',
  'Marck Script',
  'Bodoni Moda',
  'Herr Von Muellerhoff',
  'Prata',
  'Cookie',
  'Amiri',
  'Kaushan Script',
  'Gloock',
  'Yellowtail',
  'Vollkorn',
  'Alex Brush',
  'Tinos',
  'La Belle Aurore',
  'Cardo',
  'Calligraffitti',
  'Rosarivo',
  'Mr Dafoe',
  'Gelasio',
  'Faustina',
  'Lobster',
  'Lusitana',
  'Italiana',
  'Sorts Mill Goudy',
  'Delius Swash Caps',
  'Zilla Slab',
  'Petit Formal Script',
  'Bitter',
  'Qwigley',
  'Arvo',
  'Rouge Script',
  'Noticia Text',
  'Yesteryear',
  'Domine',
  'Meddon',
  'Quattrocento',
  'Mrs Saint Delafield',
  'PT Serif',
  'MonteCarlo',
  'Noto Serif',
  'Norican',
  'Cinzel',
  'Over the Rainbow',
  'Rokkitt',
  'Reenie Beanie',
  'Josefin Slab',
  'Rock Salt',
  'Neuton',
  'Shadows Into Light',
  'Old Standard TT',
  'Swanky and Moo Moo',
  'Libre Baskerville',
  'Zeyada',
  'Cormorant',
  'Nanum Myeongjo',
  'Slabo 27px',
  'IBM Plex Serif',
  'Lustria',
  'Marcellus',
  'Radley',
  'Alice',
  'Abhaya Libre',
  'Arapey',
  'Bree Serif',
  'Crete Round',
  'Fenix',
  'Gentium Book Basic',
  'Ledger',
  'Taviraj',
  'Unna',
];

// Protected word mapping - audio files mapped to random IDs
const WORD_MAPPING = {
  'word_1': { audio: audioAccommodate, answer: 'accommodate' },
  'word_2': { audio: audioDefinitely, answer: 'definitely' },
  'word_3': { audio: audioMischievous, answer: 'mischievous' },
  'word_4': { audio: audioEmbarrass, answer: 'embarrass' },
  'word_5': { audio: audioConscientious, answer: 'conscientious' }
};

// Word order for the game
const WORD_ORDER = ['word_1', 'word_2', 'word_3', 'word_4', 'word_5'];

// Helper to wrap each letter in a span with a different font
function renderArtisanText(text) {
  let fontCount = ARTISAN_FONTS.length;
  return (
    <>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{ fontFamily: ARTISAN_FONTS[i % fontCount], display: 'inline-block' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </>
  );
}

// Initialize Gemini with fallback for development
const getApiKey = () => {
    if (import.meta.env.DEV) {
        return import.meta.env.VITE_GEMINI_API_KEY;
    }
    return window.__GEMINI_API_KEY__;
};

const genAI = new GoogleGenerativeAI(getApiKey(), {
    apiVersion: 'v1beta'
});

const firebaseConfig = {
    apiKey: "AIzaSyDYws4YK1e7hfVWzPPrhpSWjP-1bXhgyO4",
    authDomain: "spelt-game.firebaseapp.com",
    projectId: "spelt-game",
    storageBucket: "spelt-game.firebasestorage.app",
    messagingSenderId: "926609416945",
    appId: "1:926609416945:web:cf915fa1ba7318cb9ebf50",
    measurementId: "G-QS1GLRQX82"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState(false);
  const [currentWordId, setCurrentWordId] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(3));
      const querySnapshot = await getDocs(q);
      const leaderboardData = [];
      querySnapshot.forEach((doc) => {
        leaderboardData.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  };

  const addToLeaderboard = async (username, score) => {
    try {
      await addDoc(collection(db, "leaderboard"), {
        username: username,
        score: score,
        timestamp: new Date()
      });
      await loadLeaderboard(); // Reload leaderboard after adding new score
      setScoreSubmitted(true);
    } catch (error) {
      console.error("Error adding to leaderboard:", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGameMode(false);
      setCurrentWordId('');
      setUserInput('');
      setScore(0);
      setCurrentWordIndex(0);
      setIncorrectAttempts(0);
      setFeedback('');
      setShowCorrectAnswer(false);
      setGameCompleted(false);
      setFinalScore(0);
      setScoreSubmitted(false);
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const startGame = () => {
    setGameMode(true);
    setCurrentWordId(WORD_ORDER[0]);
    setUserInput('');
    setCurrentWordIndex(0);
    setIncorrectAttempts(0);
    setFeedback('');
    setShowCorrectAnswer(false);
    setGameCompleted(false);
    setFinalScore(0);
    setScoreSubmitted(false);
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      checkSpelling();
    }
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  const playWord = () => {
    if (!currentWordId || !WORD_MAPPING[currentWordId]) return;
    
    setIsPlaying(true);
    
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    
    // Create new audio element
    const audio = new Audio(WORD_MAPPING[currentWordId].audio);
    setAudioElement(audio);
    
    audio.play();
    
    audio.onended = () => {
      setIsPlaying(false);
    };
    
    audio.onerror = () => {
      console.error('Error playing audio');
      setIsPlaying(false);
    };
  };

  const checkSpelling = () => {
    const currentWordData = WORD_MAPPING[currentWordId];
    if (!currentWordData) return;
    
    if (userInput.toLowerCase() === currentWordData.answer.toLowerCase()) {
      setFeedback('Correct! +10 points');
      const newScore = score + 10;
      setScore(newScore);
      setIncorrectAttempts(0);
      setShowCorrectAnswer(false);
      
      const nextIndex = currentWordIndex + 1;
      if (nextIndex < WORD_ORDER.length) {
        setCurrentWordIndex(nextIndex);
        const nextWordId = WORD_ORDER[nextIndex];
        setCurrentWordId(nextWordId);
        setTimeout(() => {
          setFeedback('');
          // Auto-play the next word
          setTimeout(() => {
            // Create new audio element for the next word
            const audio = new Audio(WORD_MAPPING[nextWordId].audio);
            setAudioElement(audio);
            setIsPlaying(true);
            
            audio.play();
            
            audio.onended = () => {
              setIsPlaying(false);
            };
            
            audio.onerror = () => {
              console.error('Error playing audio');
              setIsPlaying(false);
            };
          }, 500);
        }, 2000);
      } else {
        // Game completed
        setFinalScore(newScore);
        setGameCompleted(true);
        setGameMode(false);
        setCurrentWordId('');
        setFeedback('');
      }
      setUserInput('');
    } else {
      const newIncorrectAttempts = incorrectAttempts + 1;
      setIncorrectAttempts(newIncorrectAttempts);
      const newScore = Math.max(0, score - 5);
      setScore(newScore);
      
      if (newIncorrectAttempts >= 3) {
        setFeedback(`Incorrect! The correct spelling is: ${currentWordData.answer}`);
        setShowCorrectAnswer(true);
        setTimeout(() => {
          const nextIndex = currentWordIndex + 1;
          if (nextIndex < WORD_ORDER.length) {
            setCurrentWordIndex(nextIndex);
            const nextWordId = WORD_ORDER[nextIndex];
            setCurrentWordId(nextWordId);
            setIncorrectAttempts(0);
            setFeedback('');
            setShowCorrectAnswer(false);
            // Auto-play the next word
            setTimeout(() => {
              // Create new audio element for the next word
              const audio = new Audio(WORD_MAPPING[nextWordId].audio);
              setAudioElement(audio);
              setIsPlaying(true);
              
              audio.play();
              
              audio.onended = () => {
                setIsPlaying(false);
              };
              
              audio.onerror = () => {
                console.error('Error playing audio');
                setIsPlaying(false);
              };
            }, 500);
          } else {
            // Game completed
            setFinalScore(newScore);
            setGameCompleted(true);
            setGameMode(false);
            setCurrentWordId('');
            setFeedback('');
          }
          setUserInput('');
        }, 3000);
      } else {
        setFeedback(`Incorrect! Try again. (${3 - newIncorrectAttempts} attempts remaining)`);
        setTimeout(() => {
          setFeedback('');
        }, 2000);
      }
    }
  };

  const handleSubmitScore = async () => {
    if (user && !scoreSubmitted) {
      await addToLeaderboard(user.displayName, finalScore);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-2xl font-serif text-gray-600">{renderArtisanText("Loading...")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white font-serif">
      {/* Header with user info */}
      {user && (
        <header className="bg-gray-100 border-b-2 border-black p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="text-lg text-gray-600">
              {renderArtisanText(`Welcome, ${user.displayName}`)}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg text-orange-600 font-bold">
                {renderArtisanText(`Score: ${score}`)}
              </span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-bold border border-black hover:bg-gray-700 transition-colors duration-300"
              >
                {renderArtisanText("Sign Out")}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col items-center justify-center">
        {!user ? (
          // Login screen
          <div className="flex flex-col items-center gap-10 w-full max-w-2xl px-4">
            <header className="w-full flex flex-col items-center py-12">
              <h1 className="text-6xl md:text-7xl font-black tracking-wider text-black">
                {renderArtisanText("Spelt")}
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-gray-700 font-medium text-center max-w-2xl">
                {renderArtisanText("Compete in daily spelling challenges. Climb the leaderboard. Prove your word mastery.")}
              </p>
            </header>
            <button 
              onClick={handleLogin}
              className="px-8 py-4 rounded-none bg-orange-600 text-white text-2xl font-bold border-2 border-black shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Log In to Play")}
            </button>
          </div>
        ) : gameCompleted ? (
          // Game completion screen
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-black mb-6">
                {renderArtisanText("Game Completed!")}
              </h2>
              <div className="text-2xl text-orange-600 font-bold mb-8">
                {renderArtisanText(`Final Score: ${finalScore} points`)}
              </div>
              {!scoreSubmitted ? (
                <button 
                  onClick={handleSubmitScore}
                  className="mt-4 px-8 py-4 rounded-none bg-orange-600 text-white text-xl font-bold border-2 border-black shadow-lg hover:bg-orange-700 transition-colors duration-300"
                >
                  {renderArtisanText("Submit Score")}
                </button>
              ) : (
                <div className="text-green-600 text-xl font-bold">
                  {renderArtisanText("Score submitted to leaderboard!")}
                </div>
              )}
            </div>
          </div>
        ) : !gameMode ? (
          // Main menu after login
          <div className="flex flex-col items-center gap-10 w-full max-w-2xl px-4">
            <header className="w-full flex flex-col items-center py-12">
              <h1 className="text-6xl md:text-7xl font-black tracking-wider text-black">
                {renderArtisanText("Spelt")}
              </h1>
              <p className="mt-6 text-xl md:text-2xl text-gray-700 font-medium text-center max-w-2xl">
                {renderArtisanText("Ready to test your spelling skills?")}
              </p>
            </header>
            <button 
              onClick={startGame}
              className="px-8 py-4 rounded-none bg-orange-600 text-white text-2xl font-bold border-2 border-black shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Play Now")}
            </button>
          </div>
        ) : (
          // Game interface
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-black mb-6">
                {renderArtisanText("Listen and Spell")}
              </h2>
              <button 
                onClick={playWord}
                disabled={isPlaying}
                className="px-8 py-4 rounded-none bg-blue-600 text-white text-xl font-bold border-2 border-black shadow-lg hover:bg-blue-700 transition-colors duration-300 disabled:bg-gray-400"
              >
                {renderArtisanText(isPlaying ? "Playing..." : "Play Word")}
              </button>
            </div>
            
            {/* Feedback display */}
            {feedback && (
              <div className={`w-full max-w-md p-4 text-center text-lg font-bold ${
                feedback.includes('Correct') ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
              } border-2 border-black`}>
                {renderArtisanText(feedback)}
              </div>
            )}
            
            <div className="w-full max-w-md">
              <input
                type="text"
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Type your answer..."
                className="w-full p-4 text-xl border-2 border-black rounded-none focus:outline-none focus:border-orange-500 opacity-0 absolute"
                style={{ fontFamily: 'inherit' }}
              />
              <div className="w-full p-4 text-xl border-2 border-black rounded-none bg-white min-h-[60px] flex items-center">
                {userInput ? renderArtisanText(userInput) : (
                  !isInputFocused && <span className="text-gray-400">{renderArtisanText("Type your answer...")}</span>
                )}
                {isInputFocused && (
                  <span className="ml-1 w-0.5 h-6 bg-black animate-[blink_1s_ease-in-out_infinite]"></span>
                )}
              </div>
            </div>
            
            <button 
              onClick={checkSpelling}
              className="px-8 py-4 rounded-none bg-orange-600 text-white text-xl font-bold border-2 border-black shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Check Spelling")}
            </button>
          </div>
        )}

        {/* Leaderboard section */}
        <section className="w-full max-w-2xl px-4 mt-8">
          <div className="bg-white border-2 border-black shadow-lg p-8 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-black mb-4 tracking-wide">{renderArtisanText("Today's Top Spellers")}</h2>
            <div className="w-full flex flex-col gap-4">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300">
                    <span className="font-bold text-lg text-black">{renderArtisanText(`${index + 1}. ${entry.username}`)}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText(`${entry.score} pts`)}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300">
                    <span className="font-bold text-lg text-black">{renderArtisanText("1. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300">
                    <span className="font-bold text-lg text-black">{renderArtisanText("2. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300">
                    <span className="font-bold text-lg text-black">{renderArtisanText("3. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-gray-500 text-sm text-center w-full">
        <span>{renderArtisanText(`© ${new Date().getFullYear()} Spelt. All rights reserved.`)}</span>
      </footer>
    </div>
  );
};

export default App; 