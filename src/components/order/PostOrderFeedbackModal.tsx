import React, { useState, useEffect } from 'react';
import { Star, Sparkles, CheckCircle2, X, MessageSquare, ThumbsUp, Send, Store, Heart } from 'lucide-react';
import { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { notificationService } from '../../services/notificationService';
import { sanitizeTextInput, isBotDetected } from '../../utils/orderValidation';

interface PostOrderFeedbackModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSubmitted?: (updatedOrder: Order) => void;
}

const FEEDBACK_TAGS = [
  'Crispy & Hot 🔥',
  'Super Fast Counter ⚡',
  'Super Tasty 😋',
  'Clean & Hygienic ✨',
  'Generous Chutney 🥫',
  'Value for Money 💰',
  'Polite Stall Staff 🤝',
  'Secure Packaging 🥡',
];

const RATING_EMOJIS: Record<number, { label: string; sub: string; emoji: string }> = {
  1: { label: 'Needs Improvement', sub: 'Sorry you had a poor experience', emoji: '🙁' },
  2: { label: 'Fair / Okayish', sub: 'Could be better next time', emoji: '😐' },
  3: { label: 'Good Standard Taste', sub: 'Satisfying street food bite', emoji: '🙂' },
  4: { label: 'Very Good — Loved It!', sub: 'Delicious food & quick service', emoji: '😋' },
  5: { label: 'Outstanding & Fresh! ⭐', sub: 'Perfection! Highly recommended', emoji: '🤩' },
};

export const PostOrderFeedbackModal: React.FC<PostOrderFeedbackModalProps> = ({
  order,
  isOpen,
  onClose,
  onFeedbackSubmitted,
}) => {
  const [rating, setRating] = useState<number>(order?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(order?.reviewText || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    order?.feedbackTags || ['Super Tasty 😋', 'Crispy & Hot 🔥']
  );
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [botTrap, setBotTrap] = useState('');

  useEffect(() => {
    if (order) {
      setRating(order.rating || 5);
      setReviewText(order.reviewText || '');
      setSelectedTags(order.feedbackTags || ['Super Tasty 😋', 'Crispy & Hot 🔥']);
      setIsSuccess(false);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const currentActiveRating = hoverRating || rating;
  const ratingDetails = RATING_EMOJIS[currentActiveRating] || RATING_EMOJIS[5];

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBotDetected(botTrap)) return;
    if (rating < 1) return;

    setSubmitting(true);
    try {
      const safeReview = sanitizeTextInput(reviewText);
      const updated = await orderService.submitOrderReview(
        order.id,
        rating,
        safeReview,
        selectedTags
      );

      if (updated) {
        setIsSuccess(true);
        notificationService.playReadyChime();
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(updated);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Failed to submit order review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Modal Top Header Gradient */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 px-5 sm:px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" /> Order Completed & Collected
              </span>
              <h3 id="feedback-modal-title" className="text-base sm:text-lg font-black leading-tight">
                Rate your Stall Experience
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/15 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
            aria-label="Close feedback modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Splash View */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4 animate-in zoom-in-90 duration-300">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 animate-bounce" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900">Thank You for Your Feedback!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your rating helps <strong className="text-slate-800">{order.shopName}</strong> maintain great quality and guides other street food lovers in the neighborhood.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>{rating} Stars Recorded</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Stall Summary Badge */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/70 border border-orange-100 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-black text-slate-900 leading-tight">{order.shopName}</p>
                  <p className="text-[11px] text-slate-500">
                    Token {order.tokenNumber} • {order.items.length} item{order.items.length > 1 ? 's' : ''} (₹{order.total})
                  </p>
                </div>
              </div>
              <span className="font-bold text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Delivered
              </span>
            </div>

            {/* Interactive Star Rating Selector */}
            <div className="text-center py-2 space-y-2 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-600">How would you rate the food & service?</p>
              
              <div 
                className="flex items-center justify-center gap-2 sm:gap-3 py-1"
                role="radiogroup" 
                aria-label="Star Rating from 1 to 5"
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = starValue <= currentActiveRating;
                  return (
                    <button
                      type="button"
                      key={starValue}
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 rounded-xl transition-all duration-150 transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      aria-label={`${starValue} Star${starValue > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                            : 'text-slate-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Expression & Label */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-800">
                <span className="text-lg">{ratingDetails.emoji}</span>
                <span>{ratingDetails.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {ratingDetails.sub}
              </p>
            </div>

            {/* Quick Feedback Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>What stood out? (Optional)</span>
                <span className="text-[10px] text-slate-400 font-normal">Select all that apply</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs scale-102'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Honeypot Bot Trap */}
            <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <input
                type="text"
                name="bot_trap"
                value={botTrap}
                onChange={(e) => setBotTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Review Comment Box */}
            <div className="space-y-1">
              <label htmlFor="modal-review-comments" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Write a note for the stall chef (Optional)</span>
              </label>
              <textarea
                id="modal-review-comments"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="e.g. The green chutney was on point, and the bun was perfectly toasted!"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Review</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
