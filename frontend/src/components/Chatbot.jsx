import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatbotApi } from '../api/api';
import './Chatbot.css';

const QUICK_ACTIONS = [
  { label: 'Explore Destinations', icon: 'explore',      message: 'Show me popular destinations in India' },
  { label: 'Find a Package',       icon: 'luggage',      message: 'What tour packages are available?' },
  { label: 'Plan a Route',         icon: 'map',          message: 'How can I plan a road or air route?' },
  { label: 'Regional Food Spots',  icon: 'restaurant',   message: 'Show me verified regional food spots' },
  { label: 'How do I book?',       icon: 'help',         message: 'How do I book a tour?' },
  { label: 'Check my booking',     icon: 'receipt_long', message: 'How do I check my booking status?' },
];

export default function Chatbot() {
  const navigate                  = useNavigate();
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState([
    {
      role: 'assistant',
      content: 'Hello! Welcome to TravelEase 👋\n\nI\'m your AI travel assistant. I can help you explore India\'s most beautiful destinations, find the perfect tour package, and guide you through booking.\n\nHow can I help you today?',
    },
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);


  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasUnread(false);
    }
  }, [isOpen]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // chatbotApi.send returns a plain string (the AI response text)
      const reply = await chatbotApi.send(trimmed);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (!isOpen) setHasUnread(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.message ||
            "Sorry, I'm temporarily unavailable. Please call **9000000000** 📞",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };


  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Convert markdown-lite to JSX
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <>
      {/* Floating FAB */}
      <button
        className={`chatbot-fab ${hasUnread ? 'chatbot-fab--unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open AI Travel Assistant"
      >
        <span className="material-symbols-outlined chatbot-fab__icon">
          {isOpen ? 'close' : 'smart_toy'}
        </span>
        {hasUnread && <span className="chatbot-fab__dot" />}
      </button>

      {/* Chat Panel */}
      <div className={`chatbot-panel ${isOpen ? 'chatbot-panel--open' : ''}`}
           role="dialog" aria-label="TravelEase AI Assistant">
        {/* Header */}
        <div className="chatbot-panel__header">
          <div className="chatbot-panel__header-brand">
            <div className="chatbot-panel__avatar">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div>
              <div className="chatbot-panel__name">TravelEase AI</div>
              <div className="chatbot-panel__status text-label-caps">
                <span className="chatbot-panel__online-dot" />
                Online — AI Powered
              </div>
            </div>
          </div>
          <button className="chatbot-panel__close" onClick={() => setIsOpen(false)}
                  aria-label="Close chat">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="chatbot-panel__messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-msg chat-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="chat-msg__avatar">
                  <span className="material-symbols-outlined">smart_toy</span>
                </div>
              )}
              <div className="chat-msg__bubble">
                {renderContent(msg.content)}
                {msg.role === 'assistant' && (
                  <div className="chat-msg__actions">
                    {(msg.content.includes('Food Spots') || msg.content.includes('culinary')) && (
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => { setIsOpen(false); navigate('/food-spots'); }}
                      >
                        <span className="material-symbols-outlined">restaurant</span>
                        View Food Spots
                      </button>
                    )}
                    {(msg.content.includes('Route Planner') || msg.content.includes('route')) && (
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => { setIsOpen(false); navigate('/route-planner'); }}
                      >
                        <span className="material-symbols-outlined">map</span>
                        Open Route Map
                      </button>
                    )}
                    {(msg.content.includes('Tour Packages') || msg.content.includes('package')) && (
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => { setIsOpen(false); navigate('/packages'); }}
                      >
                        <span className="material-symbols-outlined">luggage</span>
                        Browse Packages
                      </button>
                    )}
                    {(msg.content.includes('Plan & Book') || msg.content.includes('book a tour') || msg.content.includes('booking')) && (
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => { setIsOpen(false); navigate('/book'); }}
                      >
                        <span className="material-symbols-outlined">flight_takeoff</span>
                        Book a Tour
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg chat-msg--assistant">
              <div className="chat-msg__avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="chat-msg__bubble chat-msg__bubble--typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions (shown only at start) */}
        {messages.length <= 1 && (
          <div className="chatbot-panel__quick">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="chatbot-quick-btn"
                onClick={() => sendMessage(action.message)}
              >
                <span className="material-symbols-outlined">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chatbot-panel__input-area">
          <textarea
            ref={inputRef}
            className="chatbot-panel__input"
            placeholder="Ask me anything about travel..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className={`chatbot-panel__send ${!input.trim() || loading ? 'chatbot-panel__send--disabled' : ''}`}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>

        <div className="chatbot-panel__footer text-label-caps">
          TravelEase AI · Need urgent help? Call&nbsp;
          <a href="tel:9000000000">9000000000</a>
        </div>
      </div>
    </>
  );
}
