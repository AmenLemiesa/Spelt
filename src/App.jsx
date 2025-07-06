import React, { useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, Timestamp, where } from "firebase/firestore";
import { zonedTimeToUtc } from 'date-fns-tz';

// Import audio files
import audioAccommodate from './assets/spelt_accommodate.mp3';
import audioDefinitely from './assets/spelt_definitely.mp3';
import audioMischievous from './assets/spelt_mischievous.mp3';
import audioEmbarrass from './assets/spelt_embarrass.mp3';
import audioConscientious from './assets/spelt_conscientious.mp3';

// Import custom font
import customFont from './assets/Acknowledgement.otf';

// Custom font family name
const CUSTOM_FONT = 'Acknowledgement';

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

// Custom Typing Component
const TypingDisplay = ({ text, isTyping, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState(0); // 0: type, 1: pause, 2: erase
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  // Funny misspellings before the correct one
  const attempts = ['SPETL', 'SPE', 'SPELLT', 'SPELTE', text];

  useEffect(() => {
    if (!isTyping) {
      setDisplayedText('');
      setPhase(0);
      setWordIndex(0);
      setCharIndex(0);
      setShowCursor(true);
      return;
    }
    if (phase === 0) { // Typing
      if (charIndex < attempts[wordIndex].length) {
        const timer = setTimeout(() => {
          setDisplayedText(prev => prev + attempts[wordIndex][charIndex]);
          setCharIndex(i => i + 1);
        }, 120);
        return () => clearTimeout(timer);
      } else {
        setTimeout(() => setPhase(1), 500);
      }
    } else if (phase === 1) { // Pause
      if (wordIndex < attempts.length - 1) {
        // Extra long pause after "SPE" to simulate thinking
        const pauseTime = wordIndex === 1 ? 1200 : 400;
        setTimeout(() => setPhase(2), pauseTime);
      } else {
        // Final correct word, keep cursor blinking
        setShowCursor(true);
        onComplete?.();
      }
    } else if (phase === 2) { // Erasing
      if (displayedText.length > 0) {
        const timer = setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1));
        }, 60);
        return () => clearTimeout(timer);
      } else {
        setTimeout(() => {
          setPhase(0);
          setWordIndex(i => i + 1);
          setCharIndex(0);
        }, 200);
      }
    }
  }, [isTyping, phase, charIndex, wordIndex, displayedText, attempts, onComplete]);

  return (
    <div className="text-center" style={{ minHeight: '12rem', paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div className="flex justify-center items-center" style={{ width: '600px', height: '120px' }}>
        <div className="flex items-center">
          <span
            style={{
              fontFamily: CUSTOM_FONT,
              fontSize: '8rem',
              fontWeight: '900',
              letterSpacing: '0.1em',
              textAlign: 'left',
              minWidth: '1ch',
            }}
          >
            {displayedText}
          </span>
          <span
            className="ml-2 w-2 h-16 bg-black animate-[blink_1s_ease-in-out_infinite]"
            style={{ marginLeft: '8px', visibility: showCursor ? 'visible' : 'hidden' }}
          ></span>
        </div>
      </div>
    </div>
  );
};

// Helper to render text with custom font
function renderArtisanText(text) {
  return (
    <span style={{ fontFamily: CUSTOM_FONT, display: 'inline-block' }}>
      {text}
    </span>
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

// Custom Typing Input Component
const CustomTypingInput = ({ value, onChange, onKeyDown, placeholder, isFocused, onFocus, onBlur }) => {
  const [displayedValue, setDisplayedValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value.length > displayedValue.length) {
      // New character added - animate immediately
      setDisplayedValue(value);
      setIsAnimating(true);
      
      setTimeout(() => {
        setIsAnimating(false);
      }, 600); // Match animation duration
    } else if (value.length < displayedValue.length) {
      // Character deleted
      setDisplayedValue(value);
    }
  }, [value, displayedValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onKeyDown?.(e);
    } else if (e.key === 'Backspace') {
      // Handle backspace
      e.preventDefault();
      onChange?.({ target: { value: value.slice(0, -1) } });
    }
  };

  const handleKeyPress = (e) => {
    // Handle regular character input
    if (e.key.length === 1) {
      onChange?.({ target: { value: value + e.key } });
    }
  };

  return (
    <div 
      className="w-full p-8 text-4xl rounded-none bg-transparent min-h-[120px] flex items-center justify-center cursor-text transition-colors duration-300 relative custom-typing-input"
      onClick={() => {
        if (!isFocused) {
          onFocus?.();
        }
      }}
      onKeyDown={handleKeyDown}
      onKeyPress={handleKeyPress}
      tabIndex={0}
    >
      <div className="flex items-center justify-center w-full" style={{ minHeight: '80px' }}>
        <div className="flex justify-start items-center" style={{ width: '100%', maxWidth: '800px', position: 'relative' }}>
          {displayedValue.split('').map((char, index) => (
            <span
              key={`${index}-${char}-${displayedValue.length}`}
              className={`inline-block ${index === value.length - 1 && isAnimating ? 'animate-[inputLetterLand_0.6s_ease-out_forwards]' : ''}`}
              style={{ 
                fontFamily: CUSTOM_FONT,
                fontSize: '3.5rem',
                lineHeight: '1.2',
                transformOrigin: 'center bottom',
                marginRight: '2px'
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
          {isFocused && (
            <span 
              className="w-1 h-10 bg-black animate-[blink_1s_ease-in-out_infinite]"
              style={{ marginLeft: '2px' }}
            ></span>
          )}
        </div>
      </div>
      {!displayedValue && !isFocused && (
        <span className="text-gray-400 placeholder text-3xl" style={{ fontFamily: CUSTOM_FONT }}>
          {placeholder}
        </span>
      )}
    </div>
  );
};

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
  const [lastLeaderboardUpdate, setLastLeaderboardUpdate] = useState(null);
  const [isTitleTyping, setIsTitleTyping] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadLeaderboard();
    
    // Set up periodic cleanup (every hour)
    const cleanupInterval = setInterval(() => {
      cleanupOldEntries();
    }, 60 * 60 * 1000); // 1 hour
    
    // Set up periodic leaderboard refresh (every 30 minutes)
    const refreshInterval = setInterval(() => {
      loadLeaderboard();
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => {
      clearInterval(cleanupInterval);
      clearInterval(refreshInterval);
    };
  }, []);

  const loadLeaderboard = async () => {
    try {
      // Calculate ET midnight for today
      const now = new Date();
      const timeZone = 'America/New_York';
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const etMidnight = zonedTimeToUtc(`${year}-${month}-${day} 00:00:00`, timeZone);

      const q = query(
        collection(db, "leaderboard"),
        where("timestamp", ">", Timestamp.fromDate(etMidnight)),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const leaderboardData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboardData.push({ 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
        });
      });
      // Sort by score (descending) and take top 3
      const sortedData = leaderboardData
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      setLeaderboard(sortedData);
      setLastLeaderboardUpdate(new Date());
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  };

  const cleanupOldEntries = async () => {
    try {
      // Calculate ET midnight for today
      const now = new Date();
      const timeZone = 'America/New_York';
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const etMidnight = zonedTimeToUtc(`${year}-${month}-${day} 00:00:00`, timeZone);

      const q = query(
        collection(db, "leaderboard"),
        where("timestamp", "<=", Timestamp.fromDate(etMidnight)),
        orderBy("timestamp", "asc")
      );
      const querySnapshot = await getDocs(q);
      const deletePromises = [];
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`Cleaned up ${deletePromises.length} old leaderboard entries`);
      }
    } catch (error) {
      console.error("Error cleaning up old entries:", error);
    }
  };

  const addToLeaderboard = async (username, score) => {
    try {
      console.log('Adding to leaderboard:', { username, score });
      console.log('Firestore db instance:', db);
      console.log('Collection reference:', collection(db, "leaderboard"));
      const docRef = await addDoc(collection(db, "leaderboard"), {
        username: username,
        score: score,
        timestamp: Timestamp.now()
      });
      console.log('Document written with ID:', docRef.id);
      await loadLeaderboard(); // Reload leaderboard after adding new score
    } catch (error) {
      console.error("Error adding to leaderboard:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      throw error; // Re-throw to be caught by handleSubmitScore
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
    
    // Auto-play the first word immediately after user interaction
    setTimeout(() => {
      playWord();
    }, 100);
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
      try {
        console.log('Attempting to submit score:', { username: user.displayName, score: finalScore });
        await addToLeaderboard(user.displayName, finalScore);
        setScoreSubmitted(true);
        console.log('Score submitted successfully');
      } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
      }
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
    <div className="min-h-screen flex flex-col newspaper-bg newspaper-texture">
      {/* Header with user info */}
      {user && (
        <header className="newspaper-header p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="text-lg text-white">
              {renderArtisanText(`Welcome, ${user.displayName}`)}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg text-orange-400 font-bold">
                {renderArtisanText(`Score: ${score}`)}
              </span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-700 text-white text-sm font-bold border border-gray-600 hover:bg-gray-800 transition-colors duration-300"
              >
                {renderArtisanText("Sign Out")}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {!user ? (
          // Login screen
          <div className="flex flex-col items-center gap-10 w-full max-w-4xl">
            <header className="w-full flex flex-col items-center py-12">
              <div className="mb-6">
                <TypingDisplay 
                  text="SPELT" 
                  isTyping={isTitleTyping}
                  onComplete={() => {}} // Don't switch to static title
                />
              </div>
              <div className="mt-8 text-2xl md:text-3xl text-gray-700 font-medium text-center max-w-4xl newspaper-subtitle" style={{ whiteSpace: 'pre-line' }}>
                {renderArtisanText("Compete in daily spelling challenges\nClimb the leaderboard\nProve your word mastery")}
              </div>
            </header>
            <button 
              onClick={handleLogin}
              className="px-12 py-6 rounded-none bg-orange-600 text-white text-3xl font-bold newspaper-border shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Log In to Play")}
            </button>
          </div>
        ) : gameCompleted ? (
          // Game completion screen
          <div className="flex flex-col items-center gap-8 w-full max-w-4xl newspaper-section p-8">
            <div className="text-center">
              <h2 className="text-6xl font-bold text-black mb-8 newspaper-title">
                {renderArtisanText("Game Completed!")}
              </h2>
              <div className="text-4xl text-orange-600 font-bold mb-8">
                {renderArtisanText(`Final Score: ${finalScore} points`)}
              </div>
              {!scoreSubmitted ? (
                <button 
                  onClick={handleSubmitScore}
                  className="mt-4 px-12 py-6 rounded-none bg-orange-600 text-white text-3xl font-bold newspaper-border shadow-lg hover:bg-orange-700 transition-colors duration-300"
                >
                  {renderArtisanText("Submit Score")}
                </button>
              ) : (
                <div className="text-green-600 text-3xl font-bold">
                  {renderArtisanText("Score submitted to leaderboard!")}
                </div>
              )}
            </div>
          </div>
        ) : !gameMode ? (
          // Main menu after login
          <div className="flex flex-col items-center gap-10 w-full max-w-4xl">
            <header className="w-full flex flex-col items-center py-12">
              <h1 className="text-8xl md:text-9xl font-black tracking-wider text-black newspaper-title">
                {renderArtisanText("Spelt")}
              </h1>
              <p className="mt-8 text-2xl md:text-3xl text-gray-700 font-medium text-center max-w-4xl newspaper-subtitle">
                {renderArtisanText("Ready to test your spelling skills?")}
              </p>
            </header>
            <button 
              onClick={startGame}
              className="px-12 py-6 rounded-none bg-orange-600 text-white text-3xl font-bold newspaper-border shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Play Now")}
            </button>
          </div>
        ) : (
          // Game interface
          <div className="flex flex-col items-center gap-8 w-full max-w-6xl newspaper-section p-8">
            <div className="text-center">
              <h2 className="text-6xl font-bold text-black mb-8 newspaper-title">
                {renderArtisanText("Listen and Spell")}
              </h2>
              <button 
                onClick={playWord}
                disabled={isPlaying}
                className="px-12 py-6 rounded-none bg-blue-600 text-white text-3xl font-bold newspaper-border shadow-lg hover:bg-blue-700 transition-colors duration-300 disabled:bg-gray-400"
              >
                {renderArtisanText(isPlaying ? "Playing..." : "Play Word")}
              </button>
            </div>
            
            {/* Feedback display */}
            {feedback && (
              <div className={`w-full p-6 text-center text-2xl font-bold newspaper-border ${
                feedback.includes('Correct') ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
              }`}>
                {renderArtisanText(feedback)}
              </div>
            )}
            
            <div className="w-full">
              <CustomTypingInput
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder="Type your answer..."
                isFocused={isInputFocused}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            
            <button 
              onClick={checkSpelling}
              className="px-12 py-6 rounded-none bg-orange-600 text-white text-3xl font-bold newspaper-border shadow-lg hover:bg-orange-700 transition-colors duration-300"
            >
              {renderArtisanText("Check Spelling")}
            </button>
          </div>
        )}

        {/* Leaderboard section */}
        <section className="w-full max-w-2xl px-4 mt-8">
          <div className="newspaper-section border-2 border-black shadow-lg p-8 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-black mb-2 tracking-wide newspaper-title">{renderArtisanText("Today's Top Spellers")}</h2>
            <p className="text-sm text-gray-600 mb-4 text-center newspaper-subtitle">
              {renderArtisanText("Leaderboard refreshes daily at midnight")}
            </p>
            {lastLeaderboardUpdate && (
              <p className="text-xs text-gray-500 mb-4 text-center">
                {renderArtisanText(`Last updated: ${lastLeaderboardUpdate.toLocaleTimeString()}`)}
              </p>
            )}
            <div className="w-full flex flex-col gap-4">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300 newspaper-border">
                    <span className="font-bold text-lg text-black">{renderArtisanText(`${index + 1}. ${entry.username}`)}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText(`${entry.score} pts`)}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300 newspaper-border">
                    <span className="font-bold text-lg text-black">{renderArtisanText("1. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300 newspaper-border">
                    <span className="font-bold text-lg text-black">{renderArtisanText("2. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-3 bg-gray-100 border border-gray-300 newspaper-border">
                    <span className="font-bold text-lg text-black">{renderArtisanText("3. ???")}</span>
                    <span className="font-mono text-xl text-orange-600">{renderArtisanText("??? pts")}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-gray-500 text-sm text-center w-full newspaper-subtitle">
        <span>{renderArtisanText(`© ${new Date().getFullYear()} Spelt. All rights reserved.`)}</span>
      </footer>
    </div>
  );
};

export default App; 