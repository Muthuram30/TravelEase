import RecommendationEngine from './RecommendationEngine';

/**
 * RecommendationWidget Component
 * Wrapper around RecommendationEngine for embedding recommendation matching across pages.
 */
export default function RecommendationWidget(props) {
  return <RecommendationEngine {...props} />;
}
