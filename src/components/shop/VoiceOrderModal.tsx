import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MenuItem, Shop } from '../../types';
import { useCart } from '../../context/CartContext';
import { useRouter } from '../../context/RouterContext';
import { 
  Mic, 
  MicOff, 
  X, 
  ShoppingBag, 
  Check, 
  Plus, 
  Volume2, 
  Sparkles, 
  ArrowRight, 
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Flame
} from 'lucide-react';
import { VegBadge } from '../common/VegBadge';

interface VoiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop;
  menuItems: MenuItem[];
}

interface ParsedCommand {
  raw: string;
  item: MenuItem | null;
  quantity: number;
  confidence: number;
}

// Spoken number words map
const NUMBER_WORDS: Record<string, number> = {
  'a': 1,
  'an': 1,
  'one': 1,
  'single': 1,
  'ek': 1,
  'two': 2,
  'double': 2,
  'do': 2,
  'three': 3,
  'triple': 3,
  'teen': 3,
  'four': 4,
  'char': 4,
  'chaar': 4,
  'five': 5,
  'panch': 5,
  'paanch': 5,
  'six': 6,
  'che': 6,
  'chhe': 6,
  'seven': 7,
  'saat': 7,
  'eight': 8,
  'aath': 8,
  'nine': 9,
  'nau': 9,
  'ten': 10,
  'das': 10,
};

// Common fillers & conversational words to strip
const FILLER_WORDS = new Set([
  'please', 'pls', 'can', 'i', 'get', 'want', 'order', 'add', 'put', 'give', 'me', 
  'to', 'cart', 'bhi', 'aur', 'chahiye', 'karo', 'de', 'do', 'dalo', 'lagao', 
  'plate', 'plates', 'piece', 'pieces', 'pc', 'pcs', 'cup', 'cups', 'glass', 'glasses',
  'portion', 'pack', 'packet', 'the', 'item'
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy score between query text and target item name/description
 */
function calculateMatchScore(query: string, item: MenuItem): number {
  const normQuery = normalizeText(query);
  const normName = normalizeText(item.name);
  const normDesc = normalizeText(item.description || '');

  if (normName === normQuery) return 100;
  if (normName.includes(normQuery) && normQuery.length > 2) return 85;
  if (normQuery.includes(normName)) return 80;

  // Split query tokens
  const queryTokens = normQuery.split(' ').filter((t) => t.length > 1 && !FILLER_WORDS.has(t));
  const nameTokens = normName.split(' ').filter((t) => t.length > 1);

  if (queryTokens.length === 0) return 0;

  let matchCount = 0;
  for (const qTok of queryTokens) {
    if (nameTokens.some((nTok) => nTok.includes(qTok) || qTok.includes(nTok))) {
      matchCount += 1;
    } else if (normDesc.includes(qTok)) {
      matchCount += 0.5;
    }
  }

  return (matchCount / queryTokens.length) * 75;
}

export const VoiceOrderModal: React.FC<VoiceOrderModalProps> = ({
  isOpen,
  onClose,
  shop,
  menuItems,
}) => {
  const { addItem, totalItems, subtotal } = useCart();
  const { navigate } = useRouter();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{ item: MenuItem; quantity: number } | null>(null);
  const [manualInput, setManualInput] = useState('');

  const recognitionRef = useRef<any>(null);

  // Available items for matching
  const availableItems = useMemo(() => {
    return menuItems.filter((i) => i.isAvailable);
  }, [menuItems]);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English handles Hindi street food names very well

      recognition.onstart = () => {
        setIsListening(true);
        setMicPermissionDenied(false);
        setFeedbackMessage('Listening... Speak your order clearly (e.g. "2 Vada Pav")');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalPhrase = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalPhrase += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentInterim) {
          setInterimTranscript(currentInterim);
        }

        if (finalPhrase) {
          setTranscript(finalPhrase);
          setInterimTranscript('');
          handleProcessVoiceCommand(finalPhrase);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceOrder] Speech error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicPermissionDenied(true);
          setIsListening(false);
          setFeedbackMessage('Microphone access denied. You can type spoken commands below.');
        } else if (event.error === 'no-speech') {
          setFeedbackMessage('No voice detected. Say "Add 2 Vada Pav" or tap a sample dish.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to setup SpeechRecognition:', err);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [availableItems, shop]);

  // Automatically start listening when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimTranscript('');
      setFeedbackMessage('Tap the microphone or say "2 Vada Pav"');
      setLastAdded(null);

      // Start listening after slight delay for modal transition
      const timer = setTimeout(() => {
        startListening();
      }, 300);

      return () => clearTimeout(timer);
    } else {
      stopListening();
    }
  }, [isOpen]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setFeedbackMessage('Listening... Say item and quantity (e.g. "2 Vada Pav")');
    } catch (err: any) {
      // If already started, ignore
      if (err.name !== 'InvalidStateError') {
        console.warn('Speech start issue:', err);
      }
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch {
      // ignore
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  /**
   * Parse voice string into items and quantities, then auto-add to cart
   */
  const handleProcessVoiceCommand = (spokenText: string) => {
    if (!spokenText.trim()) return;

    const lower = spokenText.toLowerCase().trim();

    // Check for conversational checkout commands
    if (lower.includes('checkout') || lower.includes('view cart') || lower.includes('show cart') || lower.includes('open cart')) {
      stopListening();
      onClose();
      navigate('/cart');
      return;
    }

    // Split compound phrases by 'and', 'aur', 'plus', or commas
    const parts = lower.split(/\band\b|\baur\b|\bplus\b|,/).map((p) => p.trim()).filter(Boolean);

    let anyAdded = false;
    let feedbackPhrases: string[] = [];

    parts.forEach((phrase) => {
      const parsed = parsePhraseToItem(phrase);
      if (parsed.item && parsed.confidence >= 35) {
        addItem(parsed.item, shop, parsed.quantity);
        setLastAdded({ item: parsed.item, quantity: parsed.quantity });
        anyAdded = true;
        feedbackPhrases.push(`${parsed.quantity}× ${parsed.item.name}`);
      }
    });

    if (anyAdded) {
      setFeedbackMessage(`✅ Added to cart: ${feedbackPhrases.join(', ')}! Say next item or checkout.`);
    } else {
      // Try single global best match if compound splitting failed
      const singleParsed = parsePhraseToItem(lower);
      if (singleParsed.item && singleParsed.confidence >= 25) {
        addItem(singleParsed.item, shop, singleParsed.quantity);
        setLastAdded({ item: singleParsed.item, quantity: singleParsed.quantity });
        setFeedbackMessage(`✅ Added ${singleParsed.quantity}× ${singleParsed.item.name} (₹${singleParsed.item.price * singleParsed.quantity}) to cart!`);
      } else {
        setFeedbackMessage(`Could not find dish matching "${spokenText}". Try saying e.g. "2 ${availableItems[0]?.name || 'Vada Pav'}"`);
      }
    }
  };

  /**
   * Parse a single segment like "two cheese burst vada pav" or "ek masala chai"
   */
  const parsePhraseToItem = (phrase: string): ParsedCommand => {
    const tokens = phrase.split(/\s+/).map((t) => t.trim()).filter(Boolean);

    let quantity = 1;
    let remainingTokens: string[] = [];

    // Extract quantity from tokens
    for (const tok of tokens) {
      const num = parseInt(tok, 10);
      if (!isNaN(num) && num > 0 && num <= 25) {
        quantity = num;
      } else if (NUMBER_WORDS[tok]) {
        quantity = NUMBER_WORDS[tok];
      } else {
        remainingTokens.push(tok);
      }
    }

    const itemQuery = remainingTokens.join(' ');

    // Find best matching menu item
    let bestItem: MenuItem | null = null;
    let highestScore = 0;

    for (const item of availableItems) {
      const score = calculateMatchScore(itemQuery, item);
      if (score > highestScore) {
        highestScore = score;
        bestItem = item;
      }
    }

    return {
      raw: phrase,
      item: bestItem,
      quantity,
      confidence: highestScore,
    };
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setTranscript(manualInput);
    handleProcessVoiceCommand(manualInput);
    setManualInput('');
  };

  const handleAddSampleCommand = (samplePhrase: string) => {
    setTranscript(samplePhrase);
    handleProcessVoiceCommand(samplePhrase);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Voice-to-Text Ordering</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/25 text-white">
                  Hands-Free
                </span>
              </div>
              <p className="text-xs text-orange-100 font-medium truncate max-w-[240px] sm:max-w-xs">
                {shop.name} • Say items to add to cart
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Visual Voice Wave / Mic Animation Container */}
          <div className="text-center py-4 px-3 bg-gradient-to-b from-orange-50/60 to-slate-50/50 rounded-3xl border border-orange-100 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated Sound Wave Rings */}
            {isListening && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="absolute w-32 h-32 rounded-full bg-orange-400/20 animate-ping opacity-75" />
                <span className="absolute w-44 h-44 rounded-full bg-orange-400/10 animate-pulse" />
              </div>
            )}

            {/* Central Interactive Mic Button */}
            <button
              onClick={toggleListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                isListening
                  ? 'bg-gradient-to-br from-orange-500 to-rose-600 text-white scale-105 shadow-orange-500/40 ring-4 ring-orange-200'
                  : 'bg-slate-900 hover:bg-orange-600 text-white shadow-slate-900/20'
              }`}
              title={isListening ? 'Tap to pause microphone' : 'Tap to start speaking'}
            >
              {isListening ? (
                <Mic className="w-8 h-8 animate-bounce" />
              ) : (
                <MicOff className="w-8 h-8 text-slate-300" />
              )}
            </button>

            {/* Status Label */}
            <div className="mt-3 space-y-1 relative z-10">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isListening ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-orange-500 animate-pulse' : 'bg-slate-400'}`} />
                {isListening ? 'Active Listening...' : 'Microphone Paused (Tap to Speak)'}
              </span>
            </div>

            {/* Live Transcript Display */}
            <div className="mt-3 max-w-sm w-full min-h-[44px] flex items-center justify-center px-4 py-2 bg-white/90 backdrop-blur-xs rounded-2xl border border-slate-200/80 shadow-2xs">
              {interimTranscript ? (
                <p className="text-xs sm:text-sm font-semibold text-orange-600 italic animate-pulse">
                  "{interimTranscript}..."
                </p>
              ) : transcript ? (
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  "{transcript}"
                </p>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  {isListening ? 'Listening for your voice... speak anytime' : 'Tap the microphone to speak'}
                </p>
              )}
            </div>
          </div>

          {/* Feedback & Recognition Message Alert */}
          {feedbackMessage && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 transition-all ${
              feedbackMessage.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium'
                : feedbackMessage.includes('Could not') || feedbackMessage.includes('denied')
                ? 'bg-amber-50 text-amber-900 border border-amber-200 font-medium'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}>
              {feedbackMessage.startsWith('✅') ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed flex-1">{feedbackMessage}</span>
            </div>
          )}

          {/* Last Added Item Highlight Card */}
          {lastAdded && (
            <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <VegBadge isVeg={lastAdded.item.isVeg} size="sm" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {lastAdded.item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lastAdded.quantity} × ₹{lastAdded.item.price} = ₹{lastAdded.quantity * lastAdded.item.price}
                  </p>
                </div>
              </div>
              <span className="px-2 py-1 bg-white text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase rounded-lg shadow-2xs shrink-0 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                In Cart
              </span>
            </div>
          )}

          {/* Quick Voice Prompt Shortcuts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Voice Commands (Tap to order)
              </span>
              <span className="text-[10px] text-slate-400">Hands-Free Examples</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {availableItems.slice(0, 5).map((item, idx) => {
                const samplePhrase = idx % 2 === 0 ? `2 ${item.name}` : `1 ${item.name}`;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAddSampleCommand(samplePhrase)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 border border-transparent text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3 h-3 text-orange-500" />
                    <span>"{samplePhrase}"</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fallback Text Input (Useful in noisy environments or without microphone permission) */}
          <div className="pt-2 border-t border-slate-100">
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 block">
                Type spoken order if microphone is unavailable:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. 2 vada pav and 1 cold coffee"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer with Live Cart Counter & Direct Checkout Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-tight">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in Cart
              </p>
              <p className="text-[11px] font-bold text-emerald-600">
                Subtotal: ₹{subtotal}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Keep Browsing
            </button>
            <button
              onClick={() => {
                stopListening();
                onClose();
                navigate('/cart');
              }}
              disabled={totalItems === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
