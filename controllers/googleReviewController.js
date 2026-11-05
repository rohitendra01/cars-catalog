const { GOOGLE_PLACE_ID } = require('../utils/googlePlace');
const { logError, logWarning } = require('../utils/logger');

exports.getGoogleReviewSummary = async (req, res) => {
    res.set('Cache-Control', 'no-store, max-age=0');

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        logWarning('integrations.google_reviews.not_configured', 'Google Maps API key is not configured.', req);
        return res.status(503).json({ error: 'Google Places API is not configured.' });
    }

    try {
        const response = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(GOOGLE_PLACE_ID)}`,
            {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'rating,userRatingCount'
                },
                signal: AbortSignal.timeout(8000)
            }
        );

        if (!response.ok) {
            const apiError = await response.json().catch(() => null);
            logWarning('integrations.google_reviews.upstream_failed', apiError?.error?.message || 'Request failed.', req, { upstreamStatus: response.status });
            return res.status(502).json({ error: 'Google rating is temporarily unavailable.' });
        }

        const place = await response.json();
        const rating = Number(place.rating);
        const userRatingCount = Number(place.userRatingCount ?? 0);
        if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isFinite(userRatingCount) || userRatingCount < 0) {
            logWarning('integrations.google_reviews.invalid_response', 'Google Places API returned an invalid rating summary.', req);
            return res.status(502).json({ error: 'Google rating is temporarily unavailable.' });
        }

        return res.json({ rating, userRatingCount });
    } catch (error) {
        logError('integrations.google_reviews.request_failed', error, req);
        return res.status(502).json({ error: 'Google rating is temporarily unavailable.' });
    }
};
