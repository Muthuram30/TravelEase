import { Link } from 'react-router-dom';
import './PackageCard.css';

// Destination → Unsplash photo mapping for visual richness
const DESTINATION_IMAGES = {
  'Kerala':                'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=80',
  'Goa':                   'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80',
  'Rajasthan':             'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600&q=80',
  'Kashmir':               'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=600&q=80',
  'Andaman Islands':       'https://images.unsplash.com/photo-1586861256632-9ba3c4c0e0b7?w=600&q=80',
  'Darjeeling':            'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80',
  'Varanasi':              'https://images.unsplash.com/photo-1561361058-c24e01d3e0f1?w=600&q=80',
  'Manali-Leh':            'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80',
  'Delhi-Agra-Jaipur':     'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80',
  'Shillong-Cherrapunji':  'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=600&q=80',
  'Tamil Nadu':            'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80',
};

function getDestinationImage(destination) {
  // Try exact match first
  if (DESTINATION_IMAGES[destination]) return DESTINATION_IMAGES[destination];
  // Try partial match
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (destination.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(destination.toLowerCase())) {
      return url;
    }
  }
  // Generic India fallback
  return 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80';
}

export function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PackageCard({ pkg, delay = 0 }) {
  // Prefer stored images from API; fall back to destination-keyed Unsplash fallback
  const storedImg = pkg.images?.[0]?.image_url;
  const imgUrl = storedImg || getDestinationImage(
    typeof pkg.destination === 'object' ? pkg.destination?.name : (pkg.destination || '')
  );

  // Support both old (cost/availability) and new (price/max_group_size) schema
  const displayPrice = pkg.price ?? pkg.cost ?? 0;
  const displayAvail = pkg.availability ?? pkg.max_group_size ?? 0;
  const destName = typeof pkg.destination === 'object' ? pkg.destination?.name : pkg.destination;

  return (
    <div
      className="pkg-card animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {/* Image */}
      <div className="pkg-card__image">
        <img src={imgUrl} alt={destName} loading="lazy" />
        <div className="pkg-card__image-overlay" />

        {/* Availability badge */}
        <div className={`pkg-card__avail ${displayAvail <= 5 ? 'pkg-card__avail--low' : ''}`}>
          {displayAvail <= 0
            ? 'Fully Booked'
            : displayAvail <= 5
            ? `${displayAvail} slots left`
            : `${displayAvail} available`}
        </div>
      </div>

      {/* Body */}
      <div className="pkg-card__body">
        <div className="pkg-card__destination text-label-caps">
          <span className="material-symbols-outlined">location_on</span>
          {destName}
        </div>

        <h3 className="pkg-card__name text-headline-sm">{pkg.package_name}</h3>

        <div className="pkg-card__meta">
          <div className="pkg-card__meta-item">
            <span className="material-symbols-outlined">schedule</span>
            <span>{pkg.duration} Days</span>
          </div>
          <div className="pkg-card__meta-item">
            <span className="material-symbols-outlined">groups</span>
            <span>Per person</span>
          </div>
        </div>

        <div className="pkg-card__footer">
          <div>
            <div className="pkg-card__price-label text-label-caps">Starting from</div>
            <div className="pkg-card__price">{formatPrice(displayPrice)}</div>
          </div>
          <div className="pkg-card__actions">
            <Link to={`/packages/${pkg.package_id}`} className="btn btn-ghost btn-sm">
              Details
            </Link>
            <Link
              to={`/book/${pkg.package_id}`}
              className={`btn btn-primary btn-sm ${displayAvail <= 0 ? 'btn-disabled' : ''}`}
              onClick={(e) => displayAvail <= 0 && e.preventDefault()}
            >
              Book Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
