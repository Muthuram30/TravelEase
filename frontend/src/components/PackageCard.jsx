import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolvePackageImage, getDestinationImage } from '../utils/destinationImages';
import './PackageCard.css';

export function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PackageCard({ pkg, delay = 0 }) {
  const fallbackImg = getDestinationImage(
    (typeof pkg.destination === 'object' ? pkg.destination?.name : pkg.destination) || pkg.package_name || '',
    pkg.package_type || ''
  );

  // Prefer stored images from API; fall back to destination-keyed local artwork
  const [imgSrc, setImgSrc] = useState(resolvePackageImage(pkg));

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
        <img
          src={imgSrc}
          alt={destName || pkg.package_name}
          loading="lazy"
          onError={() => {
            if (imgSrc !== fallbackImg) setImgSrc(fallbackImg);
          }}
        />
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
