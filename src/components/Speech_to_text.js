import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const SpeechToText = () => {
  const [doctorText, setDoctorText] = useState("");
  const [patientText, setPatientText] = useState("");
  const [doctorTranslatedText, setDoctorTranslatedText] = useState("");
  const [patientTranslatedText, setPatientTranslatedText] = useState("");
  const [isDoctorSpeaking, setIsDoctorSpeaking] = useState(false);
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [doctorRecognition, setDoctorRecognition] = useState(null);
  const [patientRecognition, setPatientRecognition] = useState(null);
  const [doctorLang, setDoctorLang] = useState("en-US");
  const [patientLang, setPatientLang] = useState("hi-IN");
  const [isSpeakingTranslation, setIsSpeakingTranslation] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const [isAutoFlow, setIsAutoFlow] = useState(true);
  const [silenceTimer, setSilenceTimer] = useState(null);
  const [hasSpeechStarted, setHasSpeechStarted] = useState(false);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const SILENCE_TIMEOUT = 5000; // 5 seconds
  const MIN_SPEECH_LENGTH = 2; // Minimum words to consider as valid speech

  // Language options
  const languages = [
    { code: "en-US", name: "English" },
    { code: "hi-IN", name: "Hindi" },
    { code: "te-IN", name: "Telugu" },
    { code: "ta-IN", name: "Tamil" },
    { code: "kn-IN", name: "Kannada" },
    { code: "ml-IN", name: "Malayalam" }
  ];

  const translateText = async (text, fromLang, toLang) => {
    try {
      const sourceLang = fromLang.split('-')[0];
      const targetLang = toLang.split('-')[0];
      
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );
      
      const data = await response.json();
      return data[0][0][0];
    } catch (error) {
      console.error('Translation error:', error);
      return 'Translation failed';
    }
  };

  useEffect(() => {
    const initializeRecognition = (lang, isDoctor) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return null;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        if (isDoctor) {
          setIsDoctorSpeaking(true);
        } else {
          setIsPatientSpeaking(true);
        }
      };

      recognition.onend = () => {
        if (isDoctor) {
          setIsDoctorSpeaking(false);
        } else {
          setIsPatientSpeaking(false);
        }
      };

      recognition.onresult = async (event) => {
        if (silenceTimer) clearTimeout(silenceTimer);

        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');

        if (isDoctor) {
          setDoctorText(transcript);
          const translated = await translateText(transcript, doctorLang, patientLang);
          setDoctorTranslatedText(translated);
        } else {
          setPatientText(transcript);
          const translated = await translateText(transcript, patientLang, doctorLang);
          setPatientTranslatedText(translated);
        }

        // Set new silence timer that triggers the auto flow
        const timer = setTimeout(() => {
          handleAutoFlow(isDoctor);
        }, SILENCE_TIMEOUT);

        setSilenceTimer(timer);
      };

      return recognition;
    };

    const doctorRec = initializeRecognition(doctorLang, true);
    const patientRec = initializeRecognition(patientLang, false);

    setDoctorRecognition(doctorRec);
    setPatientRecognition(patientRec);

    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (doctorRec) doctorRec.stop();
      if (patientRec) patientRec.stop();
    };
  }, [doctorLang]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [silenceTimer]);

  const handleLanguageChange = (role, lang) => {
    if (role === 'doctor') {
      if (isDoctorSpeaking) doctorRecognition.stop();
      setDoctorLang(lang);
    }
  };

  const startDoctorRecording = () => {
    if (!doctorRecognition) return;
    
    if (isPatientSpeaking) {
      patientRecognition.stop();
    }
    
    if (!isDoctorSpeaking) {
      try {
        doctorRecognition.start();
      } catch (error) {
        console.error('Failed to start doctor recording:', error);
        setIsDoctorSpeaking(false);
      }
    }
  };

  const stopDoctorRecording = () => {
    handleAutoFlow(true);
  };

  const startPatientRecording = () => {
    if (!patientRecognition) return;
    
    if (isDoctorSpeaking) {
      doctorRecognition.stop();
    }
    
    if (!isPatientSpeaking) {
      try {
        patientRecognition.start();
      } catch (error) {
        console.error('Failed to start patient recording:', error);
        setIsPatientSpeaking(false);
      }
    }
  };

  const stopPatientRecording = () => {
    handleAutoFlow(false);
  };

  const speakText = (text, lang) => {
    return new Promise((resolve) => {
      if (isSpeakingTranslation) {
        window.speechSynthesis.cancel();
        setIsSpeakingTranslation(false);
        resolve();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang.split('-')[0];
        
        utterance.onend = () => {
          setIsSpeakingTranslation(false);
          resolve();
        };
        
        utterance.onerror = () => {
          console.error('Speech synthesis error');
          setIsSpeakingTranslation(false);
          resolve();
        };

        setIsSpeakingTranslation(true);
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Text-to-speech error:', error);
        setIsSpeakingTranslation(false);
        resolve();
      }
    });
  };

  const SilenceCountdown = ({ isActive }) => {
    if (!isActive) return null;
    
    return (
      <div className="silence-countdown">
        <div className="countdown-bar"></div>
        <small>Auto-stop in 5s</small>
      </div>
    );
  };

  const handleAutoFlow = async (isDoctor) => {
    try {
      // For doctor's flow
      if (isDoctor) {
        // First stop the recording
        if (doctorRecognition && isDoctorSpeaking) {
          doctorRecognition.stop();
          setIsDoctorSpeaking(false);
        }

        // Wait a moment for the recording to fully stop
        await new Promise(resolve => setTimeout(resolve, 300));

        // Speak the translation if available
        if (doctorTranslatedText) {
          await speakText(doctorTranslatedText, patientLang);
          
          // After speaking completes, start patient recording
          setTimeout(() => {
            if (!isPatientSpeaking) {
              startPatientRecording();
            }
          }, 500);
        }
      } 
      // For patient's flow
      else {
        if (patientRecognition && isPatientSpeaking) {
          patientRecognition.stop();
          setIsPatientSpeaking(false);
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        if (patientTranslatedText) {
          await speakText(patientTranslatedText, doctorLang);
          
          setTimeout(() => {
            if (!isDoctorSpeaking) {
              startDoctorRecording();
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error in auto flow:', error);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Translation Console</h3>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="autoFlowSwitch"
            checked={isAutoFlow}
            onChange={(e) => setIsAutoFlow(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="autoFlowSwitch">
            Auto-flow Mode
          </label>
        </div>
      </div>
      
      <div className="row">
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Doctor's Speech</h5>
                <select 
                  className="form-select form-select-sm w-auto"
                  value={doctorLang}
                  onChange={(e) => handleLanguageChange('doctor', e.target.value)}
                  disabled={isDoctorSpeaking}
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="speech-box mb-3">
                <label className="form-label">Original Speech:</label>
                <textarea
                  className="form-control mb-3"
                  value={doctorText}
                  onChange={(e) => setDoctorText(e.target.value)}
                  rows="3"
                  placeholder="Doctor's speech will appear here..."
                  readOnly
                />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Translated for Patient:</label>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => speakText(doctorTranslatedText, patientLang)}
                    disabled={!doctorTranslatedText || isSpeakingTranslation || isDoctorSpeaking}
                  >
                    <i className="fas fa-volume-up me-1"></i>
                    {isSpeakingTranslation ? 'Speaking...' : 'Speak'}
                  </button>
                </div>
                <textarea
                  className="form-control translated-text"
                  value={doctorTranslatedText}
                  rows="3"
                  placeholder="Translation will appear here..."
                  readOnly
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                <button
                  className={`btn ${isDoctorSpeaking ? 'btn-danger' : 'btn-primary'}`}
                  onClick={isDoctorSpeaking ? stopDoctorRecording : startDoctorRecording}
                >
                  <i className={`fas fa-microphone${isDoctorSpeaking ? '-slash' : ''} me-2`}></i>
                  {isDoctorSpeaking ? 'Stop Recording' : 'Start Recording'}
                </button>
                {isDoctorSpeaking && (
                  <>
                    <div className="recording-indicator">
                      <span className="pulse-dot"></span>
                      Recording...
                    </div>
                    <div className="silence-countdown">
                      <div className="countdown-bar"></div>
                      <small>Auto-stop in 5s</small>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Patient's Speech (Hindi)</h5>
              </div>
              <div className="speech-box mb-3">
                <label className="form-label">Original Speech:</label>
                <textarea
                  className="form-control mb-3"
                  value={patientText}
                  onChange={(e) => setPatientText(e.target.value)}
                  rows="3"
                  placeholder="Patient's speech will appear here..."
                  readOnly
                />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Translated for Doctor:</label>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => speakText(patientTranslatedText, doctorLang)}
                    disabled={!patientTranslatedText || isSpeakingTranslation || isPatientSpeaking}
                  >
                    <i className="fas fa-volume-up me-1"></i>
                    Speak
                  </button>
                </div>
                <textarea
                  className="form-control translated-text"
                  value={patientTranslatedText}
                  rows="3"
                  placeholder="Translation will appear here..."
                  readOnly
                />
              </div>
              <div className="d-flex gap-2">
                <button
                  className={`btn ${isPatientSpeaking ? 'btn-danger' : 'btn-primary'}`}
                  onClick={isPatientSpeaking ? stopPatientRecording : startPatientRecording}
                >
                  <i className={`fas fa-microphone${isPatientSpeaking ? '-slash' : ''} me-2`}></i>
                  {isPatientSpeaking ? 'Stop Recording' : 'Start Recording'}
                </button>
                {isPatientSpeaking && (
                  <div className="recording-indicator">
                    <span className="pulse-dot"></span>
                    Recording...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .speech-box {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
        }

        .translated-text {
          background-color: #e8f4ff;
        }

        .btn-outline-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          color: #dc3545;
          margin-left: 1rem;
        }

        .pulse-dot {
          width: 10px;
          height: 10px;
          background-color: #dc3545;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.5; }
        }

        .form-select {
          min-width: 120px;
        }

        .form-label {
          font-weight: 500;
          color: #666;
        }

        .form-switch {
          padding-left: 2.5em;
        }
        
        .form-check-input {
          cursor: pointer;
        }
        
        .form-check-input:checked {
          background-color: #3f51b5;
          border-color: #3f51b5;
        }
        
        .form-check-label {
          cursor: pointer;
          user-select: none;
        }

        .silence-countdown {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-left: 1rem;
        }

        .countdown-bar {
          width: 100px;
          height: 4px;
          background: #3f51b5;
          border-radius: 2px;
          animation: countdown 5s linear forwards;
        }

        @keyframes countdown {
          from { width: 100%; }
          to { width: 0; }
        }

        .silence-countdown small {
          color: #666;
          margin-top: 4px;
          font-size: 0.75rem;
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default SpeechToText;