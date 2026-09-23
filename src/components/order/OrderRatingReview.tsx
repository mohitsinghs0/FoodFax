import React, { useState } from 'react';
import { Star, Sparkles, CheckCircle2, MessageSquare, ThumbsUp, Send } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { Order } from '../../types';

interface OrderRatingReviewProps {
  order: Order;
  onReviewSubmitted?: (updatedOrder: Order) => void;
  compact?: boolean;
}

const FEEDBACK_TAGS = [
  'Crispy & Hot 🔥',
  'Super Fast Counter ⚡',
  'Super Tasty 😋',
  'Clean & Hygienic ✨',
  'Generous Chutney 🥫',
  'Value for Money 💰',
  'Polite Stall Staff 🤝',
  'Secure Takeaway Packaging 🥡',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Poor — Needs Improvement',
  2: 'Fair — Okayish',
  3: 'Good — Standard Taste',
  4: 'Very Good — Loved it!',
  5: 'Outstanding — Delicious & Fresh! ⭐',
};

export const OrderRatingReview: React.FC<OrderRatingReviewProps> = ({
  order,
  onReviewSubmitted,
  compact = false,
}) => {
  const [rating, setRating] = useState<number>(order.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(order.reviewText || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(order.feedbackTags || ['Super Tasty 😋', 'Crispy & Hot 🔥']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<boolean>(!!order.rating);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (rating < 1) return;

    setSubmitting(true);
    try {
      const updated = await orderService.submitOrderReview(
        order.id,
        rating,
        reviewText.trim(),
        selectedTags
      );
      if (updated) {
        setSubmitted(true);
        setIsEditing(false);
        if (onReviewSubmitted) onReviewSubmitted(updated);
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // If already reviewed and not currently editing
  if (submitted && !isEditing) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 text-left space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Your Stall Feedback
              </span>
              <p className="text-[11px] text-emerald-700 font-medium">
                Thank you for reviewing {order.shopName}!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline px-2 py-1 rounded bg-emerald-100/60"
          >
            Edit Feedback
          </button>
        </div>

        {/* Display Rating Stars */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= (order.rating || rating)
                    ? 'text-amber-500 fill-amber-400'
                    : 'text-slate-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-slate-800 ml-1">
            {RATING_LABELS[order.rating || rating]}
          </span>
        </div>

        {/* Selected tags */}
        {(order.feedbackTags || selectedTags).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(order.feedbackTags || selectedTags).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full bg-white text-emerald-900 border border-emerald-200 text-[10px] font-bold shadow-2xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Review text */}
        {(order.reviewText || reviewText) && (
          <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-emerald-100 italic">
            "{order.reviewText || reviewText}"
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-3xl border border-orange-200/90 shadow-sm p-5 space-y-4 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-none">
              Rate your Experience at {order.shopName}
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Help stall chefs maintain high quality & speed
            </p>
          </div>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-bold"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Star Selector */}
      <div className="space-y-1.5 text-center sm:text-left">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          How was the food & counter service?
        </span>
        <div className="flex items-center justify-center sm:justify-start gap-1 py-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const activeStar = (hoverRating || rating) >= star;
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="p-1 rounded-lg hover:scale-115 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label={`Rate ${star} out of 5 stars`}
              >
                <Star
                  className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                    activeStar
                      ? 'text-amber-500 fill-amber-400 drop-shadow-xs'
                      : 'text-slate-200 hover:text-amber-200'
                  }`}
                />
              </button>
            );
          })}
        </div>
        <p className="text-xs font-bold text-amber-700 min-h-[1.25rem]">
          {RATING_LABELS[hoverRating || rating]}
        </p>
      </div>

      {/* Feedback Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          What went great? (Select highlights)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-xs ring-1 ring-orange-400 scale-102'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Comment Input */}
      <div className="space-y-1.5">
        <label
          htmlFor={`review-text-${order.id}`}
          className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block"
        >
          Add a detailed review note (optional):
        </label>
        <textarea
          id={`review-text-${order.id}`}
          rows={compact ? 2 : 3}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="e.g. Samosas were piping hot and spicy, mint chutney was super fresh! Would definitely order again."
          className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:bg-white resize-none"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{submitting ? 'Submitting Review...' : isEditing ? 'Update Feedback' : 'Submit Stall Feedback'}</span>
      </button>
    </form>
  );
};
