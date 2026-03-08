"""
AI service — spam detection, content moderation, message analysis.
All models run locally — no external APIs.
Uses simple heuristic + ML-free pattern matching for spam/moderation.
Designed to be extended with local models (e.g. Hugging Face transformers).
"""

import re
import hashlib
import time
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .security import require_internal_api_key

router = APIRouter(prefix="/v1/ai", tags=["ai"])

# ─── Schemas ──────────────────────────────────────────────────────────

class SpamCheckRequest(BaseModel):
    user_id: str = Field(max_length=128)
    content: str = Field(max_length=10_000)
    room_id: str = Field(default="", max_length=128)


class SpamCheckResponse(BaseModel):
    is_spam: bool
    confidence: float
    reasons: list[str]


class ModerationRequest(BaseModel):
    content: str = Field(max_length=10_000)
    context: str = Field(default="chat", max_length=32)


class ModerationResponse(BaseModel):
    flagged: bool
    categories: dict[str, bool]
    scores: dict[str, float]


class MessageAnalysisRequest(BaseModel):
    messages: list[str] = Field(max_length=100)
    analysis_type: str = Field(default="summary", pattern="^(summary|sentiment|topics|language)$")


class MessageAnalysisResponse(BaseModel):
    analysis_type: str
    result: dict[str, Any]


class SmartReplyRequest(BaseModel):
    messages: list[str] = Field(default_factory=list, max_length=100)
    tone: str = Field(default="neutral", max_length=32)


class SmartReplyResponse(BaseModel):
    suggestions: list[str]


class LanguageDetectRequest(BaseModel):
    text: str = Field(max_length=5_000)


class LanguageDetectResponse(BaseModel):
    language: str
    confidence: float


# ─── Spam detection (heuristic-based, no external APIs) ──────────────

SPAM_PATTERNS = [
    r"(?i)(buy\s+now|limited\s+offer|act\s+fast|click\s+here|free\s+money)",
    r"(?i)(earn\s+\$?\d+|make\s+money\s+fast|work\s+from\s+home)",
    r"(?i)(nigerian?\s+prince|lottery\s+winner|congratulations.*won)",
    r"(?i)(viagra|cialis|pharmaceutical|diet\s+pill)",
    r"(?i)(bit\.ly|tinyurl|goo\.gl|t\.co)\/\w+",  # Short URL spam
    r"(.)\1{10,}",  # Repeated characters
    r"(?i)(subscribe|follow\s+me|check\s+out\s+my)",
]

# Rate limiting for spam detection (per-user message frequency)
# Uses OrderedDict with max 10k entries to prevent unbounded growth

_message_timestamps: OrderedDict[str, list[float]] = OrderedDict()
_MAX_RATE_ENTRIES = 10_000
MAX_MESSAGES_PER_MINUTE = 30


def _check_rate(user_id: str) -> float:
    """Returns spam probability based on message frequency."""
    now = time.time()
    window = 60.0
    timestamps = _message_timestamps.get(user_id, [])
    # Prune old entries
    fresh = [t for t in timestamps if now - t < window]
    fresh.append(now)
    _message_timestamps[user_id] = fresh
    _message_timestamps.move_to_end(user_id)
    # Evict oldest entries if too many users tracked
    while len(_message_timestamps) > _MAX_RATE_ENTRIES:
        _message_timestamps.popitem(last=False)
    count = len(fresh)
    if count > MAX_MESSAGES_PER_MINUTE:
        return min(1.0, count / MAX_MESSAGES_PER_MINUTE)
    return 0.0


def _check_patterns(content: str) -> tuple[float, list[str]]:
    """Check content against spam patterns."""
    reasons: list[str] = []
    score = 0.0
    for pattern in SPAM_PATTERNS:
        if re.search(pattern, content):
            reasons.append(f"matched pattern: {pattern[:40]}...")
            score += 0.3
    # Check for excessive caps
    if len(content) > 10:
        caps_ratio = sum(1 for c in content if c.isupper()) / len(content)
        if caps_ratio > 0.7:
            reasons.append("excessive_caps")
            score += 0.2
    # Check for excessive URLs
    url_count = len(re.findall(r"https?://", content))
    if url_count > 3:
        reasons.append(f"excessive_urls ({url_count})")
        score += 0.3
    return min(1.0, score), reasons


@router.post("/spam-check", dependencies=[Depends(require_internal_api_key)])
async def check_spam(req: SpamCheckRequest) -> SpamCheckResponse:
    """Check if a message is spam using heuristic analysis."""
    rate_score = _check_rate(req.user_id)
    pattern_score, reasons = _check_patterns(req.content)

    if rate_score > 0:
        reasons.append(f"high_message_rate ({rate_score:.2f})")

    combined = min(1.0, rate_score * 0.4 + pattern_score * 0.6)
    return SpamCheckResponse(
        is_spam=combined > 0.5,
        confidence=combined,
        reasons=reasons,
    )


# ─── Content moderation (pattern-based, no external APIs) ────────────

MODERATION_CATEGORIES = {
    "harassment": [
        r"(?i)(kill\s+yourself|kys\b|you\s+should\s+die)",
        r"(?i)(retard|idiot|moron|stupid)",
    ],
    "hate_speech": [
        r"(?i)(racial\s+slur|hate\s+all)",
    ],
    "self_harm": [
        r"(?i)(self[\s-]?harm|sui[c]ide\s+method)",
    ],
    "violence": [
        r"(?i)(bomb\s+threat|shoot\s+up|mass\s+shooting\s+plan)",
    ],
    "sexual": [
        r"(?i)(explicit\s+sexual|pornograph)",
    ],
}


@router.post("/moderate", dependencies=[Depends(require_internal_api_key)])
async def moderate_content(req: ModerationRequest) -> ModerationResponse:
    """Moderate content for policy violations."""
    categories: dict[str, bool] = {}
    scores: dict[str, float] = {}
    flagged = False

    for category, patterns in MODERATION_CATEGORIES.items():
        score = 0.0
        for pattern in patterns:
            if re.search(pattern, req.content):
                score += 0.5
        score = min(1.0, score)
        categories[category] = score > 0.4
        scores[category] = round(score, 3)
        if categories[category]:
            flagged = True

    return ModerationResponse(flagged=flagged, categories=categories, scores=scores)


# ─── Message analysis ────────────────────────────────────────────────

# Simple word frequency for topics (no ML required)
STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
    "they", "them", "and", "but", "or", "so", "to", "in", "on", "at",
    "for", "of", "with", "by", "from", "this", "that", "not", "no",
}

SENTIMENT_POSITIVE = {"good", "great", "awesome", "love", "happy", "excellent", "nice", "wonderful", "fantastic", "perfect", "amazing", "thanks", "thank"}
SENTIMENT_NEGATIVE = {"bad", "terrible", "awful", "hate", "sad", "angry", "horrible", "worst", "ugly", "disgusting", "annoying"}


@router.post("/analyze", dependencies=[Depends(require_internal_api_key)])
async def analyze_messages(req: MessageAnalysisRequest) -> MessageAnalysisResponse:
    """Analyze messages for summary, sentiment, topics, or language."""
    combined = " ".join(req.messages)

    if req.analysis_type == "sentiment":
        words = set(combined.lower().split())
        pos = len(words & SENTIMENT_POSITIVE)
        neg = len(words & SENTIMENT_NEGATIVE)
        total = pos + neg
        if total == 0:
            sentiment = "neutral"
            score = 0.0
        else:
            score = (pos - neg) / total
            sentiment = "positive" if score > 0.2 else "negative" if score < -0.2 else "neutral"
        return MessageAnalysisResponse(
            analysis_type="sentiment",
            result={"sentiment": sentiment, "score": round(score, 3), "positive_words": pos, "negative_words": neg},
        )

    elif req.analysis_type == "topics":
        word_list = combined.lower().split()
        freq: dict[str, int] = {}
        for w in word_list:
            clean = re.sub(r"[^a-z0-9]", "", w)
            if clean and len(clean) > 2 and clean not in STOP_WORDS:
                freq[clean] = freq.get(clean, 0) + 1
        top_topics = sorted(freq.items(), key=lambda x: -x[1])[:10]
        return MessageAnalysisResponse(
            analysis_type="topics",
            result={"topics": [{"word": w, "count": c} for w, c in top_topics]},
        )

    elif req.analysis_type == "language":
        # Simple Latin vs non-Latin detection
        latin = sum(1 for c in combined if c.isascii() and c.isalpha())
        total_alpha = sum(1 for c in combined if c.isalpha())
        if total_alpha == 0:
            lang = "unknown"
        elif latin / total_alpha > 0.8:
            lang = "en"  # Simplistic — real impl would use langdetect
        else:
            lang = "non-latin"
        return MessageAnalysisResponse(
            analysis_type="language",
            result={"detected": lang, "latin_ratio": round(latin / max(total_alpha, 1), 3)},
        )

    else:  # summary
        all_words = combined.split()
        word_count = len(all_words)
        msg_count = len(req.messages)
        return MessageAnalysisResponse(
            analysis_type="summary",
            result={
                "message_count": msg_count,
                "word_count": word_count,
                "avg_words_per_message": round(word_count / max(msg_count, 1), 1),
            },
        )


@router.post("/smart-reply", dependencies=[Depends(require_internal_api_key)])
async def smart_reply(req: SmartReplyRequest) -> SmartReplyResponse:
    """Generate smart reply suggestions based on conversation context."""
    if not req.messages:
        return SmartReplyResponse(suggestions=["Hello!", "How are you?", "Sure!"])

    last = req.messages[-1].lower().strip()

    # Pattern-based reply suggestions
    suggestions: list[str] = []

    if any(q in last for q in ["how are you", "how's it going", "what's up"]):
        suggestions = ["I'm good, thanks!", "Doing well! You?", "Not bad!"]
    elif "?" in last:
        suggestions = ["Yes!", "No, I don't think so.", "Let me check."]
    elif any(g in last for g in ["thanks", "thank you", "thx"]):
        suggestions = ["You're welcome!", "No problem!", "Happy to help!"]
    elif any(g in last for g in ["bye", "goodbye", "see you"]):
        suggestions = ["Bye! 👋", "See you later!", "Take care!"]
    elif any(g in last for g in ["hello", "hi", "hey"]):
        suggestions = ["Hey there!", "Hi! How's it going?", "Hello!"]
    else:
        suggestions = ["Got it!", "Makes sense.", "I agree."]

    return SmartReplyResponse(suggestions=suggestions[:3])


@router.post("/language/detect", dependencies=[Depends(require_internal_api_key)])
async def detect_language(req: LanguageDetectRequest) -> LanguageDetectResponse:
    """Detect the language of text."""
    text = req.text
    latin = sum(1 for c in text if c.isascii() and c.isalpha())
    total = sum(1 for c in text if c.isalpha())
    if total == 0:
        return LanguageDetectResponse(language="unknown", confidence=0.0)

    ratio = latin / total
    if ratio > 0.9:
        return LanguageDetectResponse(language="en", confidence=round(ratio, 3))
    elif ratio > 0.5:
        return LanguageDetectResponse(language="latin-based", confidence=round(ratio, 3))
    else:
        return LanguageDetectResponse(language="non-latin", confidence=round(1 - ratio, 3))
