import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { packagesApi } from '../../api/api';
import ImageUploader from '../../components/admin/ImageUploader';

/**
 * Admin page for managing package images
 * Route: /admin/packages/:id/images
 */
export default function PackageImageManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPackageData();
  }, [id]);

  async function fetchPackageData() {
    try {
      setLoading(true);
      const data = await packagesApi.get(id);
      setPackageData(data);
    } catch (err) {
      console.error('Failed to fetch package:', err);
      setError('Failed to load package data');
    } finally {
      setLoading(false);
    }
  }

  function handleUploadComplete(uploadedImages) {
    console.log('Uploaded images:', uploadedImages);
    // Optionally refresh package data or show success notification
  }

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !packageData) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          {error || 'Package not found'}
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/admin/packages')}
        >
          Back to Packages
        </button>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row mb-4">
        <div className="col">
          <button 
            className="btn btn-secondary mb-3"
            onClick={() => navigate('/admin/packages')}
          >
            ← Back to Packages
          </button>
          
          <h1>Manage Gallery Images</h1>
          <h2 className="text-muted h4">{packageData.package_name}</h2>
          
          <div className="alert alert-info">
            <strong>Package ID:</strong> {id} <br />
            <strong>Destination:</strong> {packageData.destination?.name || packageData.destination} <br />
            <strong>Price:</strong> ₹{packageData.price}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <ImageUploader 
            packageId={parseInt(id)} 
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </div>

      <div className="row mt-5">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Image Guidelines</h5>
              <ul>
                <li><strong>Formats:</strong> JPEG, PNG, WebP only</li>
                <li><strong>Size limit:</strong> 5MB per image</li>
                <li><strong>Recommended dimensions:</strong> 1920x1080 (16:9) or 1200x800</li>
                <li><strong>Primary image:</strong> First image in display order shown as thumbnail</li>
                <li><strong>Gallery images:</strong> Displayed in slideshow on package details page</li>
                <li><strong>Captions:</strong> Optional, shown in image galleries</li>
              </ul>
              
              <h6 className="mt-3">Best Practices:</h6>
              <ul>
                <li>Upload high-quality images that showcase the destination</li>
                <li>Include diverse shots (landscapes, activities, accommodations)</li>
                <li>Use descriptive captions for accessibility</li>
                <li>Set display order to control gallery sequence</li>
                <li>Delete duplicate or low-quality images</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
