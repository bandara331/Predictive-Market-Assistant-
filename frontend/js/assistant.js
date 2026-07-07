/**
 * assistant.js — Groq AI Chat Panel
 * Handles: Chat message rendering, Groq API calls, Streaming, Quick actions
 */

const AssistantModule = (() => {
  const BACKEND_CHAT_URL = 'https://predictive-market-assistant-production.up.railway.app/api/dashboard/chat';
  // Direct Groq fallback (used when backend is offline)
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_API_KEY = ''; // GitHub Push Protection: Key removed
  const GROQ_MODEL = 'llama-3.3-70b-versatile';

  let isStreaming = false;
  let messageHistory = [
    {
      role: 'system',
      content: `You are an expert AI business advisor and financial analyst. 
You can answer ANY question related to business, including business strategies, how to handle business failures, startups, management, and stock markets.
CRITICAL INSTRUCTION: You MUST ONLY answer questions related to business, finance, or markets. If the user asks about ANY other non-business topic (e.g., cooking, programming, general chit-chat, science, history), you must politely refuse and state that you only answer business-related questions.
Format your responses with clear structure using short paragraphs. Use emojis sparingly for visual clarity.
Keep responses focused and under 200 words unless asked for detail.`
    }
  ];

  /* ─── Message Rendering ─── */
  function appendMessage(role, content, streaming = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message chat-message--${role === 'user' ? 'user' : 'ai'}`;

    const user = getUser();
    const avatarText = role === 'user' ? (user?.firstName?.[0] || 'U').toUpperCase() : 'AI';

    const bubbleId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    msgEl.innerHTML = `
      <div class="msg-avatar">${avatarText}</div>
      <div class="msg-bubble" id="${bubbleId}">
        ${streaming
        ? '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>'
        : `<p>${escapeHtml(content)}</p>`
      }
      </div>
    `;

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
    return bubbleId;
  }

  function updateBubble(bubbleId, content) {
    const bubble = document.getElementById(bubbleId);
    if (!bubble) return;
    bubble.innerHTML = `<p>${formatMessage(content)}</p>`;
    document.getElementById('chat-messages').scrollTop = 9999;
  }

  function formatMessage(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:0.8em">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─── Send Message ─── */
  async function sendMessage(userText) {
    if (isStreaming || !userText.trim()) return;
    isStreaming = true;

    const symbol = StockAPI.getCurrentSymbol?.() || 'AAPL';
    const company = StockAPI.getCompanyName?.(symbol) || symbol;

    // Append user message
    appendMessage('user', userText);
    messageHistory.push({ role: 'user', content: userText });

    // Clear input
    const input = document.getElementById('chat-input');
    if (input) { input.value = ''; autoResizeTextarea(input); }
    document.getElementById('chat-send-btn')?.setAttribute('disabled', true);
    document.getElementById('quick-actions')?.classList.add('hidden');

    // Show typing indicator
    const bubbleId = appendMessage('assistant', '', true);

    try {
      // Enrich context with current symbol
      const contextualMessages = [
        messageHistory[0], // system
        {
          role: 'system',
          content: `Current context: The user is viewing ${symbol} (${company}) stock data on the PredictIQ dashboard. Factor this into your analysis.`
        },
        ...messageHistory.slice(1)
      ];

      let fullResponse = '';

      // Try backend first
      try {
        const res = await fetch(BACKEND_CHAT_URL, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ message: userText, symbol, history: contextualMessages })
        });
        if (!res.ok) throw new Error('Backend unavailable');
        const data = await res.json();
        fullResponse = data.response || data.message;
      } catch {
        // Direct Groq call
        fullResponse = await callGroqDirect(contextualMessages);
      }

      updateBubble(bubbleId, fullResponse);
      messageHistory.push({ role: 'assistant', content: fullResponse });

      // Keep history manageable
      if (messageHistory.length > 20) {
        messageHistory = [messageHistory[0], ...messageHistory.slice(-18)];
      }

    } catch (err) {
      updateBubble(bubbleId, `⚠️ ${err.message || 'Connection error. Please check your API key and try again.'}`);
    } finally {
      isStreaming = false;
      document.getElementById('chat-send-btn')?.removeAttribute('disabled');
      document.getElementById('quick-actions')?.classList.remove('hidden');
    }
  }

  async function callGroqDirect(messages) {
    if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
      // Return a realistic demo response when no key is set
      return generateDemoResponse(messages[messages.length - 1]?.content || '');
    }

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.7,
        stream: false
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Groq API error');
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response received.';
  }

  /* ─── Demo Responses (when no API key) ─── */
  function generateDemoResponse(question) {
    const symbol = StockAPI.getCurrentSymbol?.() || 'AAPL';
    const q = question.toLowerCase();

    if (q.includes('risk')) {
      return `**Risk Assessment for ${symbol}** ⚠️\n\n**Key Risk Factors:**\n- **Market Risk**: High sensitivity to broad equity sell-offs. Beta typically > 1 during volatile periods.\n- **Regulatory Risk**: Ongoing antitrust scrutiny in key markets may create headwinds.\n- **Macro Risk**: Rising interest rates historically pressure growth-stock valuations.\n\n**Risk Rating: Moderate** — Suitable for investors with 3+ year horizon and moderate risk tolerance.`;
    }
    if (q.includes('trend') || q.includes('buy') || q.includes('sell')) {
      return `**Trend Analysis: ${symbol}** 📊\n\nThe LSTM model indicates a **bullish short-term bias** with 78% confidence.\n\n**Key Signals:**\n- Price trading above 50-day moving average\n- Volume trending 12% above 30-day average\n- RSI at 58 — momentum intact, not overbought\n\n**Recommendation: 🟢 Buy on Dip** — Target entry on any 3-5% pullback. Stop-loss at 8% below current price.`;
    }
    if (q.includes('forecast') || q.includes('growth')) {
      return `**30-Day Growth Forecast: ${symbol}** 📈\n\nBased on LSTM pattern recognition and fundamental analysis:\n\n- **Price Target**: +4.2% upside from current levels\n- **Confidence Interval**: 68-82% probability of positive return\n- **Catalyst Events**: Upcoming earnings call, product cycle refresh\n\n**Business Strategy Insight:** The company's cloud and services revenue provides earnings stability. Consider scaling position gradually to reduce timing risk.`;
    }
    if (q.includes('sector')) {
      return `**Sector Analysis** 🌐\n\nThe Technology sector is showing **selective strength** in Q3:\n\n- **AI Infrastructure**: 🟢 Outperforming — driven by data center capex\n- **Consumer Hardware**: 🟡 Neutral — inventory digestion ongoing\n- **Enterprise Software**: 🟢 Strong — ARR growth accelerating\n\n**Macro Tailwinds**: Fed pivot expectations are favorable for high-multiple tech. Watch the 10Y Treasury yield — below 4.5% is supportive for the sector.`;
    }
    return `**AI Financial Analysis: ${symbol}** 🤖\n\nBased on current market data and LSTM predictions:\n\nThe stock shows **moderate bullish momentum** with technical indicators aligned positively. The AI model's 30-day forecast suggests a potential **+3.8% upside** with 75% confidence.\n\n**Key Metrics to Watch:**\n- Support level: -5% from current\n- Resistance zone: +6-8% from current\n- Volume profile: Accumulation pattern detected\n\nWould you like a deeper analysis on any specific aspect?`;
  }
  function injectFileContext(filename, csvData) {
    messageHistory.push({
      role: 'system',
      content: `[FILE UPLOADED] The user has attached a file named "${filename}". The contents of the file are as follows:\n\n${csvData}\n\nAnalyze this data, answer questions about it, and point out any errors or anomalies.`
    });
    // Keep history manageable but allow the file to exist as a system message
    if (messageHistory.length > 20) {
      messageHistory = [messageHistory[0], ...messageHistory.slice(-18)];
    }
  }

  return { sendMessage, injectFileContext };
})();

/* ─── Global Bindings (HTML onclick) ─── */
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (text) AssistantModule.sendMessage(text);
}

function sendQuickMessage(text) {
  AssistantModule.sendMessage(text);
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

/* ─── File Upload Handling ─── */
let currentUploadedFile = null;

function removeUploadedFile() {
  currentUploadedFile = null;
  document.getElementById('file-upload-indicator').classList.add('hidden');
  document.getElementById('chat-file-upload').value = '';
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('file-upload-name').textContent = file.name;
  document.getElementById('file-upload-indicator').classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      // Use SheetJS to read the file
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to CSV
      let csvData = XLSX.utils.sheet_to_csv(worksheet);
      
      // Truncate to avoid exceeding AI token limits (approx first 100-200 lines)
      if (csvData.length > 5000) {
        csvData = csvData.substring(0, 5000) + '\n... [DATA TRUNCATED DUE TO LENGTH]';
      }

      // Inject into AssistantModule's messageHistory directly by calling a new method
      AssistantModule.injectFileContext(file.name, csvData);

      // Trigger automatic analysis
      sendQuickMessage(`I have uploaded a business data file named ${file.name}. Please analyze it, identify any anomalies, errors, or key insights, and summarize it for me.`);

      // Clear the file input so the same file can be uploaded again if needed
      document.getElementById('chat-file-upload').value = '';
      
    } catch (err) {
      console.error("Error parsing file:", err);
      alert("Failed to parse the file. Please ensure it's a valid CSV or Excel sheet.");
      removeUploadedFile();
    }
  };
  reader.readAsArrayBuffer(file);
}
