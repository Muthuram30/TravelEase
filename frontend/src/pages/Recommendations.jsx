import { Link } from 'react-router-dom';
import SmartTravelAssistant from '../components/recommendations/SmartTravelAssistant';
import './Recommendations.css';

export default function Recommendations() {
  return (
    <div className="recs-page">
      {/* Hero Header */}
      <section className="recs-hero">
        <div className="recs-hero__inner">
          <span className="recs-hero__tag">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>auto_awesome</span>
            Smart Travel Match
          </span>
          <h1 className="text-headline-lg recs-hero__title">
            Find Your Perfect Trip
          </h1>
          <p className="recs-hero__desc">
            Get personalized package recommendations with transparent, explainable scoring.
            Our rule-based assistant analyzes your preferences across 7 factors to find your ideal match.
          </p>

          <div className="recs-hero__badges">
            <div className="recs-badge">
              <span className="material-symbols-outlined">insights</span>
              <span>Explainable Scoring</span>
            </div>
            <div className="recs-badge">
              <span className="material-symbols-outlined">tune</span>
              <span>Personalized Filters</span>
            </div>
            <div className="recs-badge">
              <span className="material-symbols-outlined">verified</span>
              <span>No AI Hype</span>
            </div>
            <div className="recs-badge">
              <span className="material-symbols-outlined">trending_up</span>
              <span>Smart Matching</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Smart Travel Assistant */}
      <main className="container recs-main">
        <SmartTravelAssistant />

        {/* Discovery Cross-Links */}
        <section className="recs-more-section">
          <h2 className="text-headline-sm">Explore More Ways to Travel</h2>
          <div className="recs-more-grid">
            <Link to="/explore" className="recs-more-card glass-card">
              <div className="recs-more-card__icon">
                <span className="material-symbols-outlined">public</span>
              </div>
              <h3 className="text-title-md">3D Globe Explorer</h3>
              <p className="text-body-sm" style={{ opacity: 0.8 }}>
                Rotate our interactive 3D globe and examine panoramic 360 views of iconic destinations.
              </p>
            </Link>

            <Link to="/route-planner" className="recs-more-card glass-card">
              <div className="recs-more-card__icon">
                <span className="material-symbols-outlined">map</span>
              </div>
              <h3 className="text-title-md">Interactive Route Planner</h3>
              <p className="text-body-sm" style={{ opacity: 0.8 }}>
                Calculate realistic road driving distances, stops, and waypoints with OpenFreeMap tiles.
              </p>
            </Link>

            <Link to="/food-spots" className="recs-more-card glass-card">
              <div className="recs-more-card__icon">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <h3 className="text-title-md">Contracted Food Spots</h3>
              <p className="text-body-sm" style={{ opacity: 0.8 }}>
                Browse authentic regional culinary venues, menus, and verified hygiene-inspected kitchens.
              </p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
