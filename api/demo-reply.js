const Anthropic = require("@anthropic-ai/sdk");

// Public-facing live demo endpoint — anyone on the site can paste a review
// and get a real AI-drafted reply back. This is the one part of the site
// with real per-use cost (calls the actual Anthropic API), so it's
// deliberately conservative: short input/output caps and the cheap/fast
// model, not the same one the paid product uses. Needs ANTHROPIC_API_KEY
// set as a Vercel environment variable — see README for setup.

const MAX_REVIEW_LENGTH = 500;
const MAX_BUSINESS_NAME_LENGTH = 80;
const MODEL = "claude-haiku-4-5";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://genuinereply.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Demo is not configured yet." });
    return;
  }

  const body = req.body || {};
  const reviewText = typeof body.reviewText === "string" ? body.reviewText.trim() : "";
  const rating = Number(body.rating);
  const businessName =
    typeof body.businessName === "string" && body.businessName.trim()
      ? body.businessName.trim().slice(0, MAX_BUSINESS_NAME_LENGTH)
      : "your business";

  if (!reviewText || reviewText.length > MAX_REVIEW_LENGTH) {
    res.status(400).json({ error: `Review text must be 1-${MAX_REVIEW_LENGTH} characters.` });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be an integer 1-5." });
    return;
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are drafting a reply to a Google review on behalf of ${businessName}, a local service business. This is a live demo for a prospective customer, so keep the tone warm and professional by default.

Draft a reply to this review. Address the specific details mentioned (not generic thanks), keep it to 2-4 sentences.

Rating: ${rating}/5
Review: "${reviewText}"

Reply only with the reply text, nothing else.`;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(502).json({ error: "Unexpected response from the model." });
      return;
    }

    res.status(200).json({ reply: block.text.trim() });
  } catch (err) {
    console.error("demo-reply error:", err);
    res.status(502).json({ error: "Something went wrong generating the reply. Please try again." });
  }
};
