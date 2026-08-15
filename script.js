const chat = document.getElementById('chat');
  const micBtn = document.getElementById('micBtn');
  const micWrap = document.getElementById('micWrap');
  const micHint = document.getElementById('micHint');
  const statusText = document.getElementById('statusText');
  const textInput = document.getElementById('textInput');
  const sendBtn = document.getElementById('sendBtn');
  const noSpeechNote = document.getElementById('noSpeechNote');

  function scrollBottom(){
    chat.scrollTop = chat.scrollHeight;
  }

  function addMessage(text, who){
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    chat.appendChild(div);
    scrollBottom();
  }

  function showTyping(){
    const div = document.createElement('div');
    div.className = 'msg jarvis typing';
    div.id = 'typingIndicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    chat.appendChild(div);
    scrollBottom();
  }

  function removeTyping(){
    const t = document.getElementById('typingIndicator');
    if(t) t.remove();
  }

  function speak(text){
    if(!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /male|david|daniel|google uk english male/i.test(v.name));
    if(preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  }

  function localFallback(input){
    const t = input.toLowerCase().trim();
    if(/^(hi|hello|hey|vanakkam)/.test(t)) return "Hello! 👋 How can I assist you today?";
    if(t.includes('your name')) return "I'm JARVIS — Just A Rather Very Intelligent System. At your service.";
    if(t.includes('time')) return "The current time is " + new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) + ".";
    if(t.includes('date') || t.includes('today')) return "Today is " + new Date().toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'}) + ".";
    if(t.includes('thank')) return "Always happy to help. 🤝";
    if(t.includes('bye') || t.includes('exit')) return "Goodbye! Call me anytime you need assistance. 👋";
    return "I don't have an AI key connected yet, so my replies are limited. Add your Gemini API key in Settings ⚙️ to unlock full intelligence.";
  }

  // ---------- Persistent API key storage (localStorage — works on real deployed sites) ----------
  let geminiKey = '';
  const STORAGE_KEY = 'jarvis-gemini-api-key';

  function loadKey(){
    try{
      const saved = localStorage.getItem(STORAGE_KEY);
      if(saved){
        geminiKey = saved;
        document.getElementById('apiKeyInput').value = geminiKey;
        document.getElementById('keyStatus').textContent = 'Key loaded ✓';
      }
    }catch(e){
      // localStorage blocked (private browsing etc.) — key just won't persist
    }
  }

  function saveKey(){
    const val = document.getElementById('apiKeyInput').value.trim();
    const statusEl = document.getElementById('keyStatus');
    if(!val){ statusEl.textContent = 'Enter a key first'; return; }
    try{
      localStorage.setItem(STORAGE_KEY, val);
      geminiKey = val;
      statusEl.textContent = 'Saved ✓';
    }catch(e){
      geminiKey = val; // still usable for this session even if it can't persist
      statusEl.textContent = 'Saved for this session only (' + e.message + ')';
    }
  }

  // ---------- Gemini call ----------
  async function askGemini(userText){
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + encodeURIComponent(geminiKey);
    const body = {
      contents: [{
        parts: [{ text: userText }]
      }],
      systemInstruction: {
        parts: [{ text: "You are JARVIS, a concise, helpful personal voice assistant. Keep replies short (1-3 sentences), friendly, and natural for speech. The user may mix Tamil and English (Thanglish) — reply in the same style if they do." }]
      }
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const errText = await res.text();
      throw new Error('Gemini error ' + res.status + ': ' + errText.slice(0,120));
    }
    const data = await res.json();
    const reply = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : null;
    if(!reply) throw new Error('Empty response from Gemini');
    return reply.trim();
  }

  async function handleUserInput(text){
    if(!text || !text.trim()) return;
    addMessage(text, 'user');
    textInput.value = '';
    showTyping();

    let reply;
    try{
      if(geminiKey){
        reply = await askGemini(text);
      } else {
        await new Promise(r => setTimeout(r, 400));
        reply = localFallback(text);
      }
    }catch(e){
      reply = "I hit an error reaching Gemini (" + e.message + "). Check your API key in Settings ⚙️.";
    }

    removeTyping();
    addMessage(reply, 'jarvis');
    speak(reply);
  }

  sendBtn.addEventListener('click', () => handleUserInput(textInput.value));
  textInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') handleUserInput(textInput.value);
  });

  // ---------- Settings panel ----------
  const gearBtn = document.getElementById('gearBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const wakeToggle = document.getElementById('wakeToggle');
  const wakeIndicator = document.getElementById('wakeIndicator');

  gearBtn.addEventListener('click', () => settingsPanel.classList.add('open'));
  closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));
  saveKeyBtn.addEventListener('click', saveKey);
  loadKey();

  // ---------- Speech Recognition ----------
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;

  if(SpeechRecognition){
    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      micWrap.classList.add('listening');
      micHint.textContent = 'LISTENING...';
      statusText.textContent = 'Listening';
    };

    recognition.onerror = () => {
      listening = false;
      micWrap.classList.remove('listening');
      micHint.textContent = 'TAP TO SPEAK';
      statusText.textContent = 'System Online';
    };

    recognition.onend = () => {
      listening = false;
      micWrap.classList.remove('listening');
      micHint.textContent = 'TAP TO SPEAK';
      statusText.textContent = 'System Online';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleUserInput(transcript);
    };

    micBtn.addEventListener('click', () => {
      if(listening){
        recognition.stop();
      } else {
        window.speechSynthesis.cancel();
        try{ recognition.start(); }catch(e){}
      }
    });
  } else {
    noSpeechNote.style.display = 'block';
    micHint.textContent = 'VOICE UNAVAILABLE';
    micBtn.addEventListener('click', () => {
      textInput.focus();
    });
  }

  // ---------- Wake word: "Hey Jarvis" ----------
  let wakeRecognition = null;
  let wakeModeOn = false;
  let wakeRestartTimer = null;

  function playChime(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }catch(e){}
  }

  function startWakeListening(){
    if(!SpeechRecognition || listening) return;
    wakeRecognition = new SpeechRecognition();
    wakeRecognition.lang = 'en-IN';
    wakeRecognition.interimResults = true;
    wakeRecognition.continuous = true;

    wakeRecognition.onresult = (event) => {
      let transcript = '';
      for(let i = event.resultIndex; i < event.results.length; i++){
        transcript += event.results[i][0].transcript;
      }
      if(/hey jarvis|hey,? jarvis|hi jarvis/i.test(transcript)){
        wakeRecognition.stop();
        playChime();
        micHint.textContent = 'WAKE WORD DETECTED';
        statusText.textContent = 'Awake — listening';
        try{ recognition.start(); }catch(e){}
      }
    };

    wakeRecognition.onerror = () => { /* will auto-restart via onend */ };

    wakeRecognition.onend = () => {
      if(wakeModeOn && !listening){
        wakeRestartTimer = setTimeout(() => startWakeListening(), 400);
      }
    };

    try{ wakeRecognition.start(); }catch(e){}
  }

  function stopWakeListening(){
    wakeModeOn = false;
    clearTimeout(wakeRestartTimer);
    if(wakeRecognition){
      wakeRecognition.onend = null;
      wakeRecognition.stop();
    }
    wakeIndicator.classList.remove('active');
  }

  if(SpeechRecognition){
    wakeToggle.addEventListener('change', () => {
      if(wakeToggle.checked){
        wakeModeOn = true;
        wakeIndicator.classList.add('active');
        startWakeListening();
      } else {
        stopWakeListening();
      }
    });

    // pause wake-word listener while an active command is being captured or spoken,
    // resume automatically once done (handled in recognition.onend below via patch)
    const originalRecognitionEnd = recognition.onend;
    recognition.onend = () => {
      originalRecognitionEnd();
      if(wakeModeOn){
        wakeRestartTimer = setTimeout(() => startWakeListening(), 600);
      }
    };
  } else {
    wakeToggle.disabled = true;
       }
