import './Contact.css';

const INFO = [
  { icon: 'call', label: 'Customer Support', value: '9000000000', href: 'tel:9000000000' },
  { icon: 'email', label: 'Email Us', value: 'info@travelease.com', href: 'mailto:info@travelease.com' },
  { icon: 'schedule', label: 'Hours', value: '9 AM – 8 PM, Mon–Sat', href: null },
  { icon: 'psychology', label: 'AI Assistant', value: '24/7 Available', href: null },
];

export default function Contact() {
  return (
    <div className="contact-page">
      <div className="contact-hero">
        <div className="container">
          <div className="text-label-caps contact-hero__tag">Get In Touch</div>
          <h1 className="text-headline-lg">Contact TravelEase</h1>
          <p className="text-body-lg">Our travel experts are ready to help you plan your dream trip.</p>
        </div>
      </div>

      <div className="container contact-main">
        {/* Info cards */}
        <div className="contact-info-grid">
          {INFO.map((item) => (
            <div key={item.label} className="contact-info-card glass-card">
              <div className="contact-info-card__icon">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <div className="text-label-caps contact-info-card__label">{item.label}</div>
              {item.href ? (
                <a href={item.href} className="contact-info-card__value text-headline-sm">{item.value}</a>
              ) : (
                <div className="contact-info-card__value text-headline-sm">{item.value}</div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="contact-cta glass-card">
          <div className="contact-cta__text">
            <h2 className="text-headline-md">Ready to Book?</h2>
            <p className="text-body-md">Browse our tour packages and start your journey today.</p>
          </div>
          <div className="contact-cta__actions">
            <a href="/packages" className="btn btn-primary btn-lg btn-pill">
              <span className="material-symbols-outlined">luggage</span>
              Browse Packages
            </a>
            <a href="tel:9000000000" className="btn btn-ghost btn-lg btn-pill">
              <span className="material-symbols-outlined">call</span>
              Call Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
